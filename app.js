// El Fut Simulator - Custom League Pool Management Engine

let saveState = {
    saveName: "",
    mode: "league", // "league" or "tournament"
    userTeamId: "",
    currentMatchday: 1,
    totalMatchdays: 0,
    isCompleted: false, // Flag blocking action ticks once threshold crosses
    teams: [], // User-selected clubs running live inside this environment
    schedule: []
};

// --- CUSTOM DATABASE LAYER ---
// The built-in database comes from database.js. Edits made in the in-app
// Database Manager are stored as a full snapshot in localStorage and override
// the built-in data at load time.
let activeDatabase = null;                    // Working copy used everywhere
const DB_STORAGE_KEY = 'elfut_db_custom';
let dbEditorState = { leagueKey: null, teamIdx: null }; // Selection in the DB manager

function cloneDeep(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function loadActiveDatabase() {
    if (typeof gameDatabase === 'undefined' || !gameDatabase.leagues) return null;
    activeDatabase = cloneDeep(gameDatabase);
    try {
        const raw = localStorage.getItem(DB_STORAGE_KEY);
        if (raw) {
            const custom = JSON.parse(raw);
            if (custom && custom.leagues && typeof custom.leagues === 'object') {
                activeDatabase = custom;
            }
        }
    } catch (e) {
        console.warn('Could not load custom database edits:', e);
    }
    return activeDatabase;
}

function saveCustomDatabase() {
    if (!activeDatabase) return;
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(activeDatabase));
}

function resetCustomDatabase() {
    localStorage.removeItem(DB_STORAGE_KEY);
    activeDatabase = cloneDeep(gameDatabase);
}

function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function slugify(name) {
    return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'team';
}

function teamIdExists(id) {
    for (let k in activeDatabase.leagues) {
        if ((activeDatabase.leagues[k].teams || []).some(t => t.id === id)) return true;
    }
    return false;
}

function uniqueTeamId(name) {
    const base = slugify(name);
    let id = base;
    let n = 1;
    while (teamIdExists(id)) { id = `${base}-${n}`; n++; }
    return id;
}

function fmtBudget(b) {
    const m = (b || 0) / 1e6;
    return '€' + (m % 1 === 0 ? m : m.toFixed(1)) + 'M';
}

function pluralCount(n, word) {
    return `${n} ${word}${n === 1 ? '' : 's'}`;
}

const POSITIONS = ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"];

// Expanded names pools for more diverse generated players
const FIRST_NAMES = [
    "Oliver", "Lucas", "Mateo", "Santiago", "Marcus", "Julian", "Ethan", "Leo", "Tom", "Ben",
    "Alexander", "Daniel", "Gabriel", "Harry", "Jack", "Liam", "Noah", "Mason", "William", "Elias",
    "Hugo", "Arthur", "Theo", "Luka", "Kai", "Enzo", "Alessandro", "Diego", "Leonardo", "Samuel",
    "Kylian", "Erling", "Kevin", "Lamine", "Jude", "Bukayo", "Florian", "Jamal", "Antoine", "Bruno"
];
const LAST_NAMES = [
    "Smith", "Müller", "Garcia", "Silva", "Jones", "Fernandez", "Dupont", "Alves", "Vidal", "Johnson",
    "Williams", "Brown", "Taylor", "Davies", "Wilson", "Evans", "Thomas", "Roberts", "Schneider", "Fischer",
    "Weber", "Meyer", "Wagner", "Becker", "Bianchi", "Rossi", "Ferrari", "Russo", "Martinez", "Rodriguez",
    "Mbappé", "Haaland", "De Bruyne", "Yamal", "Bellingham", "Saka", "Wirtz", "Musiala", "Griezmann", "Dias"
];

function generateRandomPlayer(position, targetRating) {
    let fname = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    let lname = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    let variance = Math.floor(Math.random() * 7) - 3;
    let rating = Math.max(60, Math.min(95, targetRating + variance));
    
    return {
        name: `${fname} ${lname} (Gen)`,
        pos: position,
        rating: rating,
        stats: { goals: 0, assists: 0, cleanSheets: 0 },
        img: ""
    };
}

// Fixed Roster Normalization to prevent multiple GKs from overpowering defenses
function normalizeRoster(team, baselineOvr = 80) {
    if (!team.players) team.players = [];
    team.players.forEach(p => {
        if (!p.stats) p.stats = { goals: 0, assists: 0, cleanSheets: 0 };
    });

    const outfieldPositions = ["CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"];

    while (team.players.length < 11) {
        let hasGK = team.players.some(p => p.pos === "GK");
        let assignedPos;
        
        if (!hasGK) {
            assignedPos = "GK";
        } else {
            assignedPos = outfieldPositions[team.players.length % outfieldPositions.length];
        }
        
        team.players.push(generateRandomPlayer(assignedPos, baselineOvr));
    }
    if (team.players.length > 11) {
        team.players = team.players.slice(0, 11);
    }
}

// Optimized 1-99 Position-Agnostic Multiplier Engine
function parseTacticalStrength(team) {
    // --- FIXED SAFETY NET ---
    // If a team is completely empty or missing players, auto-generate them immediately before parsing stats!
    if (!team.players || team.players.length === 0) {
        normalizeRoster(team, 80);
    }

    let attackWeight = 0, defenseWeight = 0;
    
    team.players.forEach(p => {
        let r = p.rating;
        if (["ST", "LW", "RW"].includes(p.pos)) { 
            attackWeight += r * 2.20;  // Increases impact of elite front-line stars
            defenseWeight += r * 0.10; 
        }
        else if (["CAM"].includes(p.pos)) { 
            attackWeight += r * 1.50; 
            defenseWeight += r * 0.40; 
        }
        else if (["CM"].includes(p.pos)) { 
            attackWeight += r * 1.10; 
            defenseWeight += r * 0.60; 
        }
        else if (["CDM"].includes(p.pos)) { 
            attackWeight += r * 0.50; 
            defenseWeight += r * 1.20; 
        }
        else if (["CB", "LB", "RB"].includes(p.pos)) { 
            attackWeight += r * 0.22;  // Balanced so 4 defenders provide appropriate weight
            defenseWeight += r * 1.60; 
        }
        else if (p.pos === "GK") { 
            attackWeight += r * 0.00; 
            defenseWeight += r * 1.90; 
        }
    });

    // Keeping outputs accurately scaled to the 1-99 range
    return { 
        att: Math.max(1, Math.min(99, attackWeight / 11)), 
        def: Math.max(1, Math.min(99, defenseWeight / 11)) 
    };
}

function buildDoubleRoundRobin(teamsList) {
    let list = [...teamsList];
    let fixtures = [];
    let numTeams = list.length;
    let totalRounds = (numTeams - 1) * 2;
    let matchesPerRound = numTeams / 2;

    for (let round = 0; round < totalRounds; round++) {
        let roundMatches = [];
        for (let i = 0; i < matchesPerRound; i++) {
            let home = list[i];
            let away = list[numTeams - 1 - i];
            if (round >= numTeams - 1) {
                roundMatches.push({ home: away.id, away: home.id });
            } else {
                roundMatches.push({ home: home.id, away: away.id });
            }
        }
        fixtures.push(roundMatches);
        list.splice(1, 0, list.pop());
    }
    return fixtures;
}

function buildDirectKnockoutTree(teamsList) {
    let fixtures = [];
    let roundMatches = [];
    for (let i = 0; i < teamsList.length; i += 2) {
        roundMatches.push({ home: teamsList[i].id, away: teamsList[i+1].id });
    }
    fixtures.push(roundMatches);
    return fixtures;
}

// Rewritten High-Fidelity Realistic Match Simulation Engine
function runFixtureSimulation(homeTeam, awayTeam) {
    let tA = parseTacticalStrength(homeTeam);
    let tB = parseTacticalStrength(awayTeam);

    // 1. Calculate tactical supremacy performance gap
    let attackAdvantageA = tA.att - tB.def; // Positive means your attack slices their defense
    let attackAdvantageB = tB.att - tA.def;

    // 2. Tightly controlled, compressed random baseline factor (Maximum 1 goal from pure chaos)
    let randomBaseA = Math.random() < 0.35 ? 1 : 0;
    let randomBaseB = Math.random() < 0.25 ? 1 : 0; 

    // 3. Performance Based Dynamic Bonus Goals (High ratings safely generate goals here)
    let dynamicGoalsA = 0;
    let dynamicGoalsB = 0;

    // Home Team Attack execution loops
    if (attackAdvantageA > 0) {
        // Elite teams completely punishing weak defenses
        dynamicGoalsA += Math.floor(attackAdvantageA / 6); 
        if (Math.random() * 15 < (attackAdvantageA % 6)) dynamicGoalsA++;
    } else {
        // Severe attacking deficit creates a steep slope to score
        if (Math.random() < (1 / (Math.abs(attackAdvantageA) + 1))) dynamicGoalsA++;
    }

    // Away Team Attack execution loops
    if (attackAdvantageB > 0) {
        dynamicGoalsB += Math.floor(attackAdvantageB / 7); 
        if (Math.random() * 18 < (attackAdvantageB % 7)) dynamicGoalsB++;
    } else {
        if (Math.random() < (1 / (Math.abs(attackAdvantageB) + 1))) dynamicGoalsB++;
    }

    let goalsA = randomBaseA + dynamicGoalsA;
    let goalsB = randomBaseB + dynamicGoalsB;

    // Clamp goals to realistic football metrics
    goalsA = Math.min(7, goalsA);
    goalsB = Math.min(7, goalsB);

    let scorersA = distributeGoals(homeTeam, goalsA);
    let assistersA = distributeAssists(homeTeam, scorersA);
    let scorersB = distributeGoals(awayTeam, goalsB);
    let assistersB = distributeAssists(awayTeam, scorersB);

    if (goalsB === 0) distributeCleanSheets(homeTeam);
    if (goalsA === 0) distributeCleanSheets(awayTeam);

    homeTeam.gf += goalsA; homeTeam.ga += goalsB; homeTeam.gd = homeTeam.gf - homeTeam.ga;
    awayTeam.gf += goalsB; awayTeam.ga += goalsA; awayTeam.gd = awayTeam.gf - awayTeam.ga;

    if (goalsA > goalsB) homeTeam.points += 3;
    else if (goalsB > goalsA) awayTeam.points += 3;
    else { homeTeam.points += 1; awayTeam.points += 1; }

    return {
        text: `${homeTeam.name} ${goalsA} - ${goalsB} ${awayTeam.name}`,
        details: { homeTeam, awayTeam, goalsA, goalsB, scorersA, assistersA, scorersB, assistersB }
    };
}

function distributeGoals(team, count) {
    let scorers = [];
    if (count <= 0) return scorers;
    let weights = team.players.map(p => {
        if (["ST"].includes(p.pos)) return 45;
        if (["LW", "RW"].includes(p.pos)) return 35;
        if (["CAM"].includes(p.pos)) return 20;
        if (["CM"].includes(p.pos)) return 10;
        if (["CDM"].includes(p.pos)) return 4;
        return 2;
    });
    for (let c = 0; c < count; c++) {
        let idx = selectWeightedIndex(weights);
        team.players[idx].stats.goals++;
        scorers.push(team.players[idx].name);
    }
    return scorers;
}

function distributeAssists(team, scorersList) {
    let assisters = [];
    scorersList.forEach(() => {
        if (Math.random() > 0.7) return;
        let weights = team.players.map(p => {
            if (["LW", "RW", "CAM"].includes(p.pos)) return 40;
            if (["CM"].includes(p.pos)) return 30;
            if (["CDM"].includes(p.pos)) return 15;
            if (["ST"].includes(p.pos)) return 10;
            return 5;
        });
        let idx = selectWeightedIndex(weights);
        team.players[idx].stats.assists++;
        assisters.push(team.players[idx].name);
    });
    return assisters;
}

function distributeCleanSheets(team) {
    team.players.forEach(p => {
        if (["GK", "CB", "LB", "RB", "CDM"].includes(p.pos)) p.stats.cleanSheets++;
    });
}

function selectWeightedIndex(weights) {
    let total = weights.reduce((a, b) => a + b, 0);
    let rand = Math.random() * total;
    let sum = 0;
    for (let i = 0; i < weights.length; i++) {
        sum += weights[i];
        if (rand <= sum) return i;
    }
    return 0;
}

let poolTeamsMap = []; 
let activeConfigEditingIdx = 0;

function loadActiveMenu() {
    document.getElementById('welcome-screen').style.display = 'flex';
    document.getElementById('config-screen').style.display = 'none';
    document.getElementById('hub-screen').style.display = 'none';
    document.getElementById('endgame-modal').style.display = 'none';
    
    const savesList = document.getElementById('saves-list');
    savesList.innerHTML = '';
    let foundSaves = false;

    for (let key in localStorage) {
        if (key.startsWith('elfut_save_')) {
            foundSaves = true;
            let name = key.replace('elfut_save_', '');
            
            let saveRow = document.createElement('div');
            saveRow.className = 'save-item-row';
            saveRow.style.display = 'flex';
            saveRow.style.gap = '10px';
            saveRow.style.marginBottom = '10px';
            saveRow.style.width = '100%';

            let loadBtn = document.createElement('button');
            loadBtn.className = 'save-btn';
            loadBtn.innerText = name;
            loadBtn.style.margin = '0';
            loadBtn.style.flex = '1';
            loadBtn.onclick = () => resumeTargetSave(key);

            let deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '🗑️';
            deleteBtn.className = 'delete-save-btn';
            deleteBtn.style.margin = '0';
            deleteBtn.style.width = '55px';
            deleteBtn.style.backgroundColor = '#d32f2f';
            deleteBtn.style.boxShadow = 'none';
            
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                if (confirm(`Are you sure you want to permanently delete the save progress for "${name}"?`)) {
                    localStorage.removeItem(key);
                    loadActiveMenu();
                }
            };

            saveRow.appendChild(loadBtn);
            saveRow.appendChild(deleteBtn);
            savesList.appendChild(saveRow);
        }
    }
    if (!foundSaves) savesList.innerHTML = '<p style="color:#aaa4c4;grid-column:1/3;">No past save states found.</p>';
}

document.getElementById('create-save-btn').onclick = () => {
    if (!activeDatabase) {
        return alert('Could not start a save: the team database (database.js) failed to load. It may contain a syntax error. Check the browser console for details.');
    }

    let name = document.getElementById('new-save-name').value.trim();
    if (!name) return alert('Please input a valid Save Name.');

    saveState.saveName = name;
    saveState.mode = document.querySelector('input[name="game-mode"]:checked').value;
    saveState.isCompleted = false;
    
    poolTeamsMap = [];
    activeConfigEditingIdx = 0;

    for (let leagueKey in activeDatabase.leagues) {
        let currentLeague = activeDatabase.leagues[leagueKey];
        currentLeague.teams.forEach(t => {
            let cloned = JSON.parse(JSON.stringify(t));
            
            // --- FIXED ORDER OF OPERATIONS ---
            // Normalize immediately on clone so empty arrays are resolved before any rendering/parsing happens
            normalizeRoster(cloned, 80);
            
            cloned.points = 0; cloned.gf = 0; cloned.ga = 0; cloned.gd = 0; cloned.isEliminated = false;
            
            poolTeamsMap.push({
                leagueName: currentLeague.name,
                teamData: cloned,
                isSelected: false
            });
        });
    }

    if(poolTeamsMap.length >= 1) poolTeamsMap[0].isSelected = true;
    if(poolTeamsMap.length >= 2) poolTeamsMap[1].isSelected = true;
    
    saveState.userTeamId = poolTeamsMap[0].teamData.id;

    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('config-screen').style.display = 'flex';
    
    renderDatabasePickerPanel();
};

function renderDatabasePickerPanel() {
    const listContainer = document.getElementById('database-team-picker-list');
    
    let searchInput = document.getElementById('team-search-bar');
    if (!searchInput) {
        listContainer.innerHTML = `
            <div style="margin-bottom: 15px;">
                <input type="text" id="team-search-bar" placeholder="🔍 Search teams..." 
                       style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #231b40; background-color: #130f24; color: #fff; box-sizing: border-box;">
            </div>
            <div id="picker-groups-container"></div>
        `;
        searchInput = document.getElementById('team-search-bar');
        searchInput.oninput = () => renderDatabasePickerRows();
    }

    renderDatabasePickerRows();
}

function renderDatabasePickerRows() {
    const groupsContainer = document.getElementById('picker-groups-container');
    if (!groupsContainer) return;
    groupsContainer.innerHTML = '';

    const query = (document.getElementById('team-search-bar')?.value || "").toLowerCase();
    let structuralLeagues = [...new Set(poolTeamsMap.map(p => p.leagueName))];
    let totalSelected = 0;

    poolTeamsMap.forEach(p => { if (p.isSelected) totalSelected++; });

    structuralLeagues.forEach(lName => {
        let matchingPoolItems = poolTeamsMap.filter(p => p.leagueName === lName);
        let filteredItems = matchingPoolItems.filter(p => p.teamData.name.toLowerCase().includes(query));

        if (filteredItems.length === 0) return;

        let groupDiv = document.createElement('div');
        groupDiv.className = 'picker-league-group';
        
        let allChecked = matchingPoolItems.every(p => p.isSelected);

        let headerDiv = document.createElement('div');
        headerDiv.className = 'picker-league-title';
        headerDiv.style.display = 'flex';
        headerDiv.style.justifyContent = 'space-between';
        headerDiv.style.alignItems = 'center';
        headerDiv.innerHTML = `
            <span>${lName}</span>
            <label style="font-size: 0.85rem; font-weight: normal; cursor: pointer; display: flex; align-items: center; gap: 5px; color: #a370f7;">
                <input type="checkbox" class="league-select-all" ${allChecked ? 'checked' : ''}> Select All
            </label>
        `;

        headerDiv.querySelector('.league-select-all').onchange = (e) => {
            let targetState = e.target.checked;
            matchingPoolItems.forEach(poolItem => {
                poolItem.isSelected = targetState;
            });
            renderDatabasePickerPanel();
        };

        groupDiv.appendChild(headerDiv);

        filteredItems.forEach(poolItem => {
            let globalIdx = poolTeamsMap.indexOf(poolItem);
            let isCurrentEdit = (globalIdx === activeConfigEditingIdx);
            
            let row = document.createElement('div');
            row.className = `team-picker-row ${poolItem.isSelected ? 'selected-active' : ''} ${isCurrentEdit ? 'active-edit' : ''}`;
            
            row.innerHTML = `
                <input type="checkbox" ${poolItem.isSelected ? 'checked' : ''}>
                <span class="team-picker-label">${poolItem.teamData.name}</span>
            `;

            row.onclick = (e) => {
                if (e.target.type === 'checkbox') return;
                activeConfigEditingIdx = globalIdx;
                renderDatabasePickerPanel();
            };

            row.querySelector('input').onchange = (e) => {
                poolItem.isSelected = e.target.checked;
                renderDatabasePickerPanel();
            };

            groupDiv.appendChild(row);
        });

        groupsContainer.appendChild(groupDiv);
    });

    document.getElementById('selected-count-badge').innerText = totalSelected;

    const warning = document.getElementById('power-of-two-warning');
    if (saveState.mode === "tournament" && ![2,4,8,16,32,64].includes(totalSelected)) {
        warning.style.display = 'block';
    } else {
        warning.style.display = 'none';
    }

    let activeItem = poolTeamsMap[activeConfigEditingIdx];
    if (!activeItem) return;
    document.getElementById('editing-team-title').innerText = activeItem.teamData.name + (activeItem.isSelected ? "" : " (Not Selected)");

    let claimBtn = document.getElementById('claim-team-btn');
    if (activeItem.teamData.id === saveState.userTeamId) {
        claimBtn.className = "action-btn active-control";
        claimBtn.innerText = "Currently Managing This Club";
    } else {
        claimBtn.className = "action-btn";
        claimBtn.innerText = "Manage This Club";
        claimBtn.onclick = () => {
            if(!activeItem.isSelected) {
                alert("You must include this club in the competition before selecting it as your managed team.");
                return;
            }
            saveState.userTeamId = activeItem.teamData.id;
            renderDatabasePickerPanel();
        };
    }

    const tbody = document.getElementById('editor-roster-body');
    tbody.innerHTML = '';

    activeItem.teamData.players.forEach((p, pIdx) => {
        let tr = document.createElement('tr');
        const initials = (p.name || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
        tr.innerHTML = `
            <td>
                <div class="player-profile">
                    <div class="player-avatar"><span>${esc(initials)}</span></div>
                    <strong>${esc(p.name)}</strong>
                </div>
            </td>
            <td>${esc(p.pos)}</td>
            <td><span class="rating-badge">${esc(p.rating)}</span></td>
            <td><button class="swap-row-btn">Swap</button></td>
        `;
        tr.querySelector('.swap-row-btn').onclick = () => openSwapModal(activeItem, pIdx);
        tbody.appendChild(tr);
    });
}

// --- SWAP PLAYER MODAL ---
let swapContext = null;      // { teamItem, playerIdx } of the slot being edited
let swapPosFilter = 'all';   // 'all' | 'GK' | 'DEF' | 'MID' | 'FWD'

const POS_GROUPS = {
    GK: 'GK', CB: 'DEF', LB: 'DEF', RB: 'DEF',
    CDM: 'MID', CM: 'MID', CAM: 'MID', RM: 'MID', LM: 'MID',
    ST: 'FWD', LW: 'FWD', RW: 'FWD'
};

function getAllDatabasePlayers() {
    const out = [];
    if (!activeDatabase) return out;
    for (let leagueKey in activeDatabase.leagues) {
        const league = activeDatabase.leagues[leagueKey];
        (league.teams || []).forEach(t => {
            (t.players || []).forEach(p => {
                out.push({ player: p, teamName: t.name, leagueName: league.name || leagueKey });
            });
        });
    }
    return out;
}

function openSwapModal(teamItem, playerIdx) {
    swapContext = { teamItem, playerIdx };
    const replaced = teamItem.teamData.players[playerIdx];
    document.getElementById('swap-slot-label').innerText = `Replacing: ${replaced.name} (${replaced.pos})`;
    document.getElementById('swap-search').value = '';
    swapPosFilter = 'all';
    document.querySelectorAll('#swap-filters .chip').forEach(c => c.classList.toggle('active', c.dataset.pos === 'all'));
    renderSwapResults();
    document.getElementById('swap-modal').style.display = 'flex';
}

function closeSwapModal() {
    document.getElementById('swap-modal').style.display = 'none';
    swapContext = null;
}

function renderSwapResults() {
    const listEl = document.getElementById('swap-results-list');
    const countEl = document.getElementById('swap-results-count');
    if (!swapContext) { listEl.innerHTML = ''; countEl.innerText = '0 players'; return; }

    const query = (document.getElementById('swap-search').value || '').trim().toLowerCase();
    const currentRoster = swapContext.teamItem.teamData.players;
    const replacedIdx = swapContext.playerIdx;
    const replacedPos = currentRoster[replacedIdx] ? currentRoster[replacedIdx].pos : '';
    const replacedGroup = POS_GROUPS[replacedPos] || '';

    const pool = getAllDatabasePlayers().filter(entry => {
        const p = entry.player;
        if (!p || !p.pos) return false;
        // Don't offer players already standing in this lineup (except the slot being swapped)
        if (currentRoster.some((rp, i) => i !== replacedIdx && rp.name === p.name)) return false;
        if (swapPosFilter !== 'all' && (POS_GROUPS[p.pos] || '') !== swapPosFilter) return false;
        if (!query) return true;
        const hay = `${p.name} ${p.pos} ${p.rating} ${entry.teamName} ${entry.leagueName}`.toLowerCase();
        return hay.includes(query);
    });

    pool.sort((a, b) => {
        const aSame = (POS_GROUPS[a.player.pos] || '') === replacedGroup ? 0 : 1;
        const bSame = (POS_GROUPS[b.player.pos] || '') === replacedGroup ? 0 : 1;
        return aSame - bSame || b.player.rating - a.player.rating;
    });

    countEl.innerText = `${pool.length} player${pool.length === 1 ? '' : 's'}`;
    listEl.innerHTML = '';

    if (pool.length === 0) {
        listEl.innerHTML = '<p class="swap-empty">No players match your search.</p>';
        return;
    }

    pool.forEach(entry => {
        const p = entry.player;
        const initials = (p.name || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
        const imgHtml = p.img ? `<img src="${esc(p.img)}" onerror="this.style.display='none'">` : '';
        const card = document.createElement('div');
        card.className = 'swap-result-card';
        card.innerHTML = `
            <div class="player-avatar">${imgHtml}<span>${esc(initials)}</span></div>
            <div class="swap-card-info">
                <div class="swap-card-name">${esc(p.name)}</div>
                <div class="swap-card-sub">${esc(p.pos)} · ${esc(entry.teamName)} <span class="swap-card-league">${esc(entry.leagueName)}</span></div>
            </div>
            <div class="swap-card-rating"><span class="rating-badge">${esc(p.rating)}</span></div>
        `;
        card.onclick = () => {
            const chosen = cloneDeep(p);
            chosen.stats = { goals: 0, assists: 0, cleanSheets: 0 };
            swapContext.teamItem.teamData.players[swapContext.playerIdx] = chosen;
            closeSwapModal();
            renderDatabasePickerPanel();
        };
        listEl.appendChild(card);
    });
}

document.getElementById('launch-sim-btn').onclick = () => {
    saveState.teams = poolTeamsMap.filter(p => p.isSelected).map(p => p.teamData);

    if (saveState.teams.length < 2) {
        return alert("Please select at least 2 teams to generate a functional simulator schedule.");
    }
    if (saveState.mode === "tournament" && ![2,4,8,16,32,64].includes(saveState.teams.length)) {
        return alert("Knockout mode requires an even power-of-two team lineup format (2, 4, 8, 16, 32, or 64 teams). Adjust your selections.");
    }
    if (saveState.mode === "league" && saveState.teams.length % 2 !== 0) {
        return alert("Round Robin League format requires an even number of selected teams. Add or remove one team.");
    }

    let userAssignedCheck = saveState.teams.find(t => t.id === saveState.userTeamId);
    if(!userAssignedCheck) {
        saveState.userTeamId = saveState.teams[0].id;
    }

    saveState.currentMatchday = 1;
    saveState.isCompleted = false;
    
    if (saveState.mode === "league") {
        saveState.schedule = buildDoubleRoundRobin(saveState.teams);
        saveState.totalMatchdays = saveState.schedule.length;
    } else {
        saveState.schedule = buildDirectKnockoutTree(saveState.teams);
        saveState.totalMatchdays = Math.log2(saveState.teams.length);
    }

    document.getElementById('config-screen').style.display = 'none';
    document.getElementById('hub-screen').style.display = 'flex';
    refreshHubDashboardUI();
};

function refreshHubDashboardUI() {
    let userTeamObj = saveState.teams.find(t => t.id === saveState.userTeamId);
    document.getElementById('hub-user-team').innerText = userTeamObj.name;
    document.getElementById('current-matchday-ui').innerText = saveState.currentMatchday;
    document.getElementById('total-matchdays-ui').innerText = saveState.totalMatchdays;
    document.getElementById('user-points-ui').innerText = saveState.mode === "league" ? userTeamObj.points : (userTeamObj.isEliminated ? "Eliminated" : "Active");

    if (saveState.mode === "tournament") {
        document.getElementById('table-title').innerText = `Cup Bracket Tree - Round ${saveState.currentMatchday}`;
    } else {
        document.getElementById('table-title').innerText = "Standings Table";
    }

    renderActiveStandings();
    renderLeaderboardCharts();
}

function renderActiveStandings() {
    const tbody = document.getElementById('league-table-body');
    tbody.innerHTML = '';

    if (saveState.mode === "league") {
        let sorted = [...saveState.teams].sort((a,b) => b.points - a.points || b.gd - a.gd);
        sorted.forEach((t, i) => {
            let tr = document.createElement('tr');
            if (t.id === saveState.userTeamId) {
                tr.style.backgroundColor = 'rgba(124, 77, 255, 0.15)';
            }
            tr.innerHTML = `<td>${i+1}</td><td class="clickable-row-team"><strong>${t.name}</strong> ${t.id === saveState.userTeamId ? '⭐' : ''}</td><td>${t.gd}</td><td><strong>${t.points}</strong></td>`;
            tr.querySelector('.clickable-row-team').onclick = () => launchProfileModal(t);
            tbody.appendChild(tr);
        });
    } else {
        let currentFixtures = saveState.schedule[saveState.currentMatchday - 1];
        if(!currentFixtures) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Tournament Completed!</td></tr>';
            return;
        }
        currentFixtures.forEach((f, idx) => {
            let homeObj = saveState.teams.find(t => t.id === f.home);
            let awayObj = saveState.teams.find(t => t.id === f.away);
            let tr = document.createElement('tr');
            if (homeObj.id === saveState.userTeamId || awayObj.id === saveState.userTeamId) {
                tr.style.backgroundColor = 'rgba(124, 77, 255, 0.15)';
            }
            tr.innerHTML = `<td>M${idx+1}</td><td class="clickable-row-team"><strong>${homeObj.name}</strong></td><td>vs</td><td class="clickable-row-team"><strong>${awayObj.name}</strong></td>`;
            tr.querySelectorAll('.clickable-row-team')[0].onclick = () => launchProfileModal(homeObj);
            tr.querySelectorAll('.clickable-row-team')[1].onclick = () => launchProfileModal(awayObj);
            tbody.appendChild(tr);
        });
    }
}

function renderLeaderboardCharts() {
    let allPlayers = [];
    saveState.teams.forEach(t => {
        t.players.forEach(p => {
            allPlayers.push({ player: p, teamName: t.name });
        });
    });

    let topScorers = [...allPlayers].sort((a,b) => b.player.stats.goals - a.player.stats.goals).slice(0, 5);
    let topAssists = [...allPlayers].sort((a,b) => b.player.stats.assists - a.player.stats.assists).slice(0, 5);
    let topSheets = [...allPlayers].filter(p => ["GK","CB","LB","RB","CDM"].includes(p.player.pos)).sort((a,b) => b.player.stats.cleanSheets - a.player.stats.cleanSheets).slice(0, 5);

    document.getElementById('top-scorers-list').innerHTML = topScorers.map(p => `<li>${p.player.name} (${p.teamName}) - <strong>${p.player.stats.goals} G</strong></li>`).join('');
    document.getElementById('top-assists-list').innerHTML = topAssists.map(p => `<li>${p.player.name} (${p.teamName}) - <strong>${p.player.stats.assists} A</strong></li>`).join('');
    document.getElementById('top-sheets-list').innerHTML = topSheets.map(p => `<li>${p.player.name} (${p.teamName}) - <strong>${p.player.stats.cleanSheets} CS</strong></li>`).join('');
}

// --- CORE SIMULATION PROCESSING ENGINE ---
document.getElementById('advance-matchday-btn').onclick = () => {
    if (saveState.isCompleted) {
        triggerEndgameModalDisplay();
        return;
    }

    let roundIndex = saveState.currentMatchday - 1;
    let currentRoundMatches = saveState.schedule[roundIndex];

    if (!currentRoundMatches || currentRoundMatches.length === 0) {
        saveState.isCompleted = true;
        triggerEndgameModalDisplay();
        return;
    }

    let feedBox = document.getElementById('ticker-feed-box');
    feedBox.innerHTML = `<strong>--- MATCHDAY ${saveState.currentMatchday} LOGS ---</strong><br>`;

    let userMatchHtml = "";
    let basicMatchesHtml = "";
    let winners = [];

    currentRoundMatches.forEach(match => {
        let homeTeam = saveState.teams.find(t => t.id === match.home);
        let awayTeam = saveState.teams.find(t => t.id === match.away);

        let sim = runFixtureSimulation(homeTeam, awayTeam);
        let isUserMatch = (homeTeam.id === saveState.userTeamId || awayTeam.id === saveState.userTeamId);
        
        let matchRowHtml = "";
        if (isUserMatch) {
            matchRowHtml += `<div class="user-match-log" style="background: linear-gradient(90deg, rgba(124,77,255,0.25) 0%, rgba(0,0,0,0) 100%); padding: 10px 14px; border-left: 4px solid #7c4dff; margin: 8px 0; border-radius: 6px;">`;
            matchRowHtml += `<strong>⭐ ${sim.text}</strong>`;
        } else {
            matchRowHtml += `<div class="standard-match-log" style="padding: 6px 12px; margin: 4px 0; border-bottom: 1px solid #1c1635;">`;
            matchRowHtml += `${sim.text}`;
        }

        if (sim.details.scorersA.length > 0) matchRowHtml += `<br><span style="font-size:0.85rem; color:#aaa4c4;">&nbsp;&nbsp; Goals [Home]: ${sim.details.scorersA.join(', ')}</span>`;
        if (sim.details.scorersB.length > 0) matchRowHtml += `<br><span style="font-size:0.85rem; color:#aaa4c4;">&nbsp;&nbsp; Goals [Away]: ${sim.details.scorersB.join(', ')}</span>`;

        if (saveState.mode === "tournament") {
            if (sim.details.goalsA === sim.details.goalsB) {
                if (Math.random() > 0.5) {
                    matchRowHtml += `<br>&nbsp;&nbsp; 🏆 ${homeTeam.name} wins on Penalties!`;
                    winners.push(homeTeam); awayTeam.isEliminated = true;
                } else {
                    matchRowHtml += `<br>&nbsp;&nbsp; 🏆 ${awayTeam.name} wins on Penalties!`;
                    winners.push(awayTeam); homeTeam.isEliminated = true;
                }
            } else {
                if (sim.details.goalsA > sim.details.goalsB) {
                    winners.push(homeTeam); awayTeam.isEliminated = true;
                } else {
                    winners.push(awayTeam); homeTeam.isEliminated = true;
                }
            }
        }
        
        matchRowHtml += `</div>`;
        
        if (isUserMatch) {
            userMatchHtml += matchRowHtml;
        } else {
            basicMatchesHtml += matchRowHtml;
        }
    });

    feedBox.innerHTML += userMatchHtml + basicMatchesHtml;

    if (saveState.mode === "league") {
        if (saveState.currentMatchday >= saveState.totalMatchdays) {
            saveState.isCompleted = true;
            refreshHubDashboardUI();
            autoSaveCurrentProgress();
            setTimeout(() => { triggerEndgameModalDisplay(); }, 400); 
            return;
        } else {
            saveState.currentMatchday++;
        }
    } else {
        if (winners.length === 1) {
            saveState.isCompleted = true;
            refreshHubDashboardUI();
            autoSaveCurrentProgress();
            setTimeout(() => { triggerEndgameModalDisplay(); }, 400);
            return;
        } else {
            let nextRoundMatches = [];
            for (let i = 0; i < winners.length; i += 2) {
                nextRoundMatches.push({ home: winners[i].id, away: winners[i+1].id });
            }
            saveState.schedule.push(nextRoundMatches);
            saveState.currentMatchday++;
        }
    }

    refreshHubDashboardUI();
    autoSaveCurrentProgress();
};

function triggerEndgameModalDisplay() {
    let championName = "Unknown";
    
    if (saveState.mode === "league") {
        let sorted = [...saveState.teams].sort((a,b) => b.points - a.points || b.gd - a.gd);
        championName = sorted[0].name;
    } else {
        let activeRemaining = saveState.teams.filter(t => !t.isEliminated);
        championName = activeRemaining.length > 0 ? activeRemaining[0].name : "Tournament Finalist";
    }

    document.getElementById('endgame-winner-name').innerText = championName;
    document.getElementById('endgame-modal').style.display = 'flex';
}

document.getElementById('endgame-dashboard-btn').onclick = () => {
    document.getElementById('endgame-modal').style.display = 'none';
};

document.getElementById('endgame-replay-btn').onclick = () => {
    document.getElementById('endgame-modal').style.display = 'none';
    
    saveState.teams.forEach(t => {
        t.points = 0; t.gf = 0; t.ga = 0; t.gd = 0; t.isEliminated = false;
        t.players.forEach(p => {
            p.stats = { goals: 0, assists: 0, cleanSheets: 0 };
        });
    });

    saveState.currentMatchday = 1;
    saveState.isCompleted = false;

    if (saveState.mode === "league") {
        saveState.schedule = buildDoubleRoundRobin(saveState.teams);
        saveState.totalMatchdays = saveState.schedule.length;
    } else {
        saveState.schedule = buildDirectKnockoutTree(saveState.teams);
        saveState.totalMatchdays = Math.log2(saveState.teams.length);
    }

    let feedBox = document.getElementById('ticker-feed-box');
    feedBox.innerHTML = "Competition restarted! Roster configurations preserved. Advance matchday to play.";

    refreshHubDashboardUI();
    autoSaveCurrentProgress();
};

function launchProfileModal(team) {
    document.getElementById('modal-team-name').innerText = team.name;
    let t = parseTacticalStrength(team);
    document.getElementById('modal-team-tactics').innerText = `Calculated Ratings -> ATT Strength: ${Math.round(t.att)} | DEF Strength: ${Math.round(t.def)}`;

    const tbody = document.getElementById('modal-squad-table');
    tbody.innerHTML = team.players.map(p => `
        <tr><td><strong>${p.name}</strong></td><td>${p.pos}</td><td><span class="rating-badge">${p.rating}</span></td></tr>
    `).join('');

    document.getElementById('team-modal').style.display = 'block';
}

document.querySelector('#team-modal .modal-close-trigger').onclick = () => document.getElementById('team-modal').style.display = 'none';

// --- SWAP MODAL EVENT WIRING ---
document.getElementById('swap-search').oninput = renderSwapResults;
document.getElementById('swap-clear-search').onclick = () => {
    document.getElementById('swap-search').value = '';
    renderSwapResults();
};
document.querySelectorAll('#swap-filters .chip').forEach(chip => {
    chip.onclick = () => {
        swapPosFilter = chip.dataset.pos;
        document.querySelectorAll('#swap-filters .chip').forEach(c => c.classList.toggle('active', c === chip));
        renderSwapResults();
    };
});
document.querySelector('.swap-close-trigger').onclick = closeSwapModal;

// --- DATABASE MANAGER ---
function openDBScreen() {
    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('db-screen').style.display = 'flex';
    dbEditorState = { leagueKey: Object.keys(activeDatabase.leagues)[0] || null, teamIdx: null };
    renderDBEditor();
}

function closeDBScreen() {
    document.getElementById('db-screen').style.display = 'none';
    document.getElementById('welcome-screen').style.display = 'flex';
}

function renderDBEditor() {
    renderDBLeagueList();
    renderDBTeamList();
    renderDBPlayerList();
}

function currentDBLeague() {
    return dbEditorState.leagueKey ? activeDatabase.leagues[dbEditorState.leagueKey] : null;
}

function currentDBTeam() {
    const league = currentDBLeague();
    if (!league) return null;
    const teams = league.teams || [];
    return teams[dbEditorState.teamIdx] || null;
}

// --- Leagues ---
function renderDBLeagueList() {
    const container = document.getElementById('db-league-list');
    const query = (document.getElementById('db-league-search').value || '').trim().toLowerCase();
    container.innerHTML = '';
    let count = 0;
    for (let key in activeDatabase.leagues) {
        const league = activeDatabase.leagues[key];
        const label = league.name || key;
        if (query && !`${label} ${key}`.toLowerCase().includes(query)) continue;
        count++;
        const row = document.createElement('div');
        row.className = 'db-row' + (dbEditorState.leagueKey === key ? ' active' : '');
        row.innerHTML = `
            <div class="db-row-main">
                <strong>${esc(label)}</strong>
                <div class="db-row-sub">${pluralCount((league.teams || []).length, 'team')}</div>
            </div>
            <div class="db-row-actions">
                <button class="mini-btn" data-act="edit" title="Edit league">✏️</button>
                <button class="mini-btn danger" data-act="del" title="Delete league">🗑️</button>
            </div>`;
        row.querySelector('.db-row-main').onclick = () => {
            dbEditorState.leagueKey = key;
            dbEditorState.teamIdx = null;
            renderDBEditor();
        };
        row.querySelector('[data-act="edit"]').onclick = (e) => { e.stopPropagation(); openDBForm('league', key); };
        row.querySelector('[data-act="del"]').onclick = (e) => {
            e.stopPropagation();
            if (!confirm(`Delete the "${label}" league and all ${pluralCount((league.teams || []).length, 'team')} in it?`)) return;
            delete activeDatabase.leagues[key];
            if (dbEditorState.leagueKey === key) dbEditorState = { leagueKey: Object.keys(activeDatabase.leagues)[0] || null, teamIdx: null };
            saveCustomDatabase();
            renderDBEditor();
        };
        container.appendChild(row);
    }
    if (count === 0) container.innerHTML = '<p class="db-empty">No leagues found.</p>';
}

// --- Teams ---
function renderDBTeamList() {
    const container = document.getElementById('db-team-list');
    const titleEl = document.getElementById('db-team-pane-title');
    const addBtn = document.getElementById('db-add-team-btn');
    const league = currentDBLeague();
    container.innerHTML = '';
    if (!league) {
        titleEl.innerText = 'Select a league first';
        addBtn.style.display = 'none';
        container.innerHTML = '<p class="db-empty">Select a league on the left to manage its teams.</p>';
        return;
    }
    addBtn.style.display = '';
    titleEl.innerText = `${league.name || dbEditorState.leagueKey} (${pluralCount((league.teams || []).length, 'team')})`;
    const query = (document.getElementById('db-team-search').value || '').trim().toLowerCase();
    const teams = league.teams || [];
    let count = 0;
    teams.forEach((t, idx) => {
        if (query && !`${t.name} ${t.id}`.toLowerCase().includes(query)) return;
        count++;
        const row = document.createElement('div');
        row.className = 'db-row' + (dbEditorState.teamIdx === idx ? ' active' : '');
        row.innerHTML = `
            <div class="db-row-main">
                <strong>${esc(t.name)}</strong>
                <div class="db-row-sub">${pluralCount((t.players || []).length, 'player')} · ${fmtBudget(t.budget)}</div>
            </div>
            <div class="db-row-actions">
                <button class="mini-btn" data-act="edit" title="Edit team">✏️</button>
                <button class="mini-btn danger" data-act="del" title="Delete team">🗑️</button>
            </div>`;
        row.querySelector('.db-row-main').onclick = () => {
            dbEditorState.teamIdx = idx;
            renderDBEditor();
        };
        row.querySelector('[data-act="edit"]').onclick = (e) => { e.stopPropagation(); openDBForm('team', dbEditorState.leagueKey, idx); };
        row.querySelector('[data-act="del"]').onclick = (e) => {
            e.stopPropagation();
            if (!confirm(`Delete team "${t.name}" and its ${pluralCount((t.players || []).length, 'player')}?`)) return;
            teams.splice(idx, 1);
            if (dbEditorState.teamIdx === idx) dbEditorState.teamIdx = null;
            else if (dbEditorState.teamIdx > idx) dbEditorState.teamIdx--;
            saveCustomDatabase();
            renderDBEditor();
        };
        container.appendChild(row);
    });
    if (count === 0) container.innerHTML = '<p class="db-empty">No teams found.</p>';
}

// --- Players ---
function renderDBPlayerList() {
    const container = document.getElementById('db-player-list');
    const titleEl = document.getElementById('db-player-pane-title');
    const addBtn = document.getElementById('db-add-player-btn');
    const team = currentDBTeam();
    container.innerHTML = '';
    if (!team) {
        titleEl.innerText = 'Select a team first';
        addBtn.style.display = 'none';
        container.innerHTML = '<p class="db-empty">Select a team in the middle pane to manage its players.</p>';
        return;
    }
    addBtn.style.display = '';
    titleEl.innerText = `${team.name} (${pluralCount((team.players || []).length, 'player')})`;
    const query = (document.getElementById('db-player-search').value || '').trim().toLowerCase();
    const players = team.players || [];
    let count = 0;
    players.forEach((p, idx) => {
        if (query && !`${p.name} ${p.pos} ${p.rating}`.toLowerCase().includes(query)) return;
        count++;
        const row = document.createElement('div');
        row.className = 'db-row';
        row.innerHTML = `
            <div class="db-row-main">
                <strong>${esc(p.name)}</strong>
                <div class="db-row-sub">${esc(p.pos)} · OVR ${esc(p.rating)}</div>
            </div>
            <div class="db-row-actions">
                <button class="mini-btn" data-act="edit" title="Edit player">✏️</button>
                <button class="mini-btn danger" data-act="del" title="Remove player">🗑️</button>
            </div>`;
        row.querySelector('[data-act="edit"]').onclick = (e) => { e.stopPropagation(); openDBForm('player', dbEditorState.leagueKey, dbEditorState.teamIdx, idx); };
        row.querySelector('[data-act="del"]').onclick = (e) => {
            e.stopPropagation();
            if (!confirm(`Remove player "${p.name}" from ${team.name}?`)) return;
            players.splice(idx, 1);
            saveCustomDatabase();
            renderDBEditor();
        };
        container.appendChild(row);
    });
    if (count === 0) container.innerHTML = '<p class="db-empty">No players found.</p>';
}

// --- Add/Edit form ---
let dbFormContext = null; // { kind, leagueKey, teamIdx, playerIdx }

const ALL_POSITIONS = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST', 'RM', 'LM'];

function openDBForm(kind, leagueKey, teamIdx, playerIdx) {
    dbFormContext = { kind, leagueKey, teamIdx, playerIdx };
    const title = document.getElementById('db-form-title');
    const body = document.getElementById('db-form-body');

    if (kind === 'league') {
        const existing = leagueKey ? activeDatabase.leagues[leagueKey] : null;
        title.innerText = existing ? 'Edit League' : 'Add League';
        body.innerHTML = `
            <div class="form-field"><label>League name</label><input id="f-name" type="text" value="${esc(existing ? existing.name : '')}" placeholder="e.g. Ligue 1 25/26"></div>
            <div class="form-field"><label>Key / ID ${existing ? '' : '(optional — auto-generated if blank)'}</label><input id="f-key" type="text" value="${esc(existing ? leagueKey : '')}" placeholder="e.g. FR 1 25/26"></div>`;
    } else if (kind === 'team') {
        const league = activeDatabase.leagues[leagueKey];
        const existing = teamIdx != null && league && league.teams ? league.teams[teamIdx] : null;
        title.innerText = existing ? 'Edit Team' : 'Add Team';
        body.innerHTML = `
            <div class="form-field"><label>Team name</label><input id="f-name" type="text" value="${esc(existing ? existing.name : '')}" placeholder="e.g. Paris Saint-Germain"></div>
            <div class="form-field"><label>Budget (€ millions)</label><input id="f-budget" type="number" step="0.5" min="0" value="${existing ? (existing.budget || 0) / 1e6 : 50}"></div>`;
    } else {
        const league = activeDatabase.leagues[leagueKey];
        const team = league && league.teams ? league.teams[teamIdx] : null;
        const existing = playerIdx != null && team ? team.players[playerIdx] : null;
        title.innerText = existing ? 'Edit Player' : 'Add Player';
        const posOptions = ALL_POSITIONS.map(pos => `<option value="${pos}" ${existing && existing.pos === pos ? 'selected' : ''}>${pos}</option>`).join('');
        body.innerHTML = `
            <div class="form-field"><label>Player name</label><input id="f-name" type="text" value="${esc(existing ? existing.name : '')}" placeholder="e.g. K. Mbappé"></div>
            <div class="form-field"><label>Position</label><select id="f-pos">${posOptions}</select></div>
            <div class="form-field"><label>Rating (OVR)</label><input id="f-rating" type="number" min="1" max="99" value="${existing ? esc(existing.rating) : 80}"></div>
            <div class="form-field"><label>Image path (optional)</label><input id="f-img" type="text" value="${esc(existing && existing.img ? existing.img : '')}" placeholder="assets/player.png"></div>`;
    }
    document.getElementById('db-edit-modal').style.display = 'flex';
}

function closeDBForm() {
    document.getElementById('db-edit-modal').style.display = 'none';
    dbFormContext = null;
}

function saveDBForm() {
    const ctx = dbFormContext;
    if (!ctx) return;
    const val = (id) => document.getElementById(id).value.trim();

    if (ctx.kind === 'league') {
        const name = val('f-name');
        if (!name) return alert('League name is required.');
        let key = val('f-key') || slugify(name);
        if (ctx.leagueKey && key === ctx.leagueKey) {
            activeDatabase.leagues[key].name = name;
        } else {
            if (activeDatabase.leagues[key]) return alert(`A league with the key "${key}" already exists.`);
            const old = ctx.leagueKey ? activeDatabase.leagues[ctx.leagueKey] : null;
            if (old) delete activeDatabase.leagues[ctx.leagueKey];
            activeDatabase.leagues[key] = Object.assign({}, old || {}, { name, teams: old ? old.teams : [] });
        }
        dbEditorState.leagueKey = key;
    } else if (ctx.kind === 'team') {
        const name = val('f-name');
        if (!name) return alert('Team name is required.');
        const budgetM = parseFloat(document.getElementById('f-budget').value);
        const league = activeDatabase.leagues[ctx.leagueKey];
        const teams = league.teams || (league.teams = []);
        if (ctx.teamIdx != null && teams[ctx.teamIdx]) {
            teams[ctx.teamIdx].name = name;
            if (!isNaN(budgetM)) teams[ctx.teamIdx].budget = budgetM * 1e6;
        } else {
            teams.push({ id: uniqueTeamId(name), name, budget: isNaN(budgetM) ? 50000000 : budgetM * 1e6, players: [] });
            dbEditorState.teamIdx = teams.length - 1;
        }
    } else {
        const name = val('f-name');
        if (!name) return alert('Player name is required.');
        const pos = document.getElementById('f-pos').value;
        const rating = parseInt(document.getElementById('f-rating').value, 10);
        const img = document.getElementById('f-img').value.trim();
        const team = activeDatabase.leagues[ctx.leagueKey].teams[ctx.teamIdx];
        const players = team.players || (team.players = []);
        const player = { name, pos, rating: isNaN(rating) ? 80 : Math.max(1, Math.min(99, rating)) };
        if (img) player.img = img;
        if (ctx.playerIdx != null && players[ctx.playerIdx]) {
            players[ctx.playerIdx] = Object.assign(player, { stats: players[ctx.playerIdx].stats });
        } else {
            players.push(player);
        }
    }

    saveCustomDatabase();
    closeDBForm();
    renderDBEditor();
}

// --- DB manager wiring ---
document.getElementById('db-manager-btn').onclick = openDBScreen;
document.getElementById('db-back-btn').onclick = closeDBScreen;
document.getElementById('db-add-league-btn').onclick = () => openDBForm('league');
document.getElementById('db-add-team-btn').onclick = () => {
    if (!currentDBLeague()) return alert('Select a league first.');
    openDBForm('team', dbEditorState.leagueKey);
};
document.getElementById('db-add-player-btn').onclick = () => {
    if (!currentDBTeam()) return alert('Select a team first.');
    openDBForm('player', dbEditorState.leagueKey, dbEditorState.teamIdx);
};
document.getElementById('db-form-save').onclick = saveDBForm;
document.getElementById('db-form-cancel').onclick = closeDBForm;
document.getElementById('db-form-close').onclick = closeDBForm;
document.getElementById('db-league-search').oninput = renderDBLeagueList;
document.getElementById('db-team-search').oninput = renderDBTeamList;
document.getElementById('db-player-search').oninput = renderDBPlayerList;
document.getElementById('db-export-btn').onclick = () => {
    const blob = new Blob([JSON.stringify(activeDatabase, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'elfut-database.json';
    a.click();
    URL.revokeObjectURL(a.href);
};
document.getElementById('db-import-btn').onclick = () => document.getElementById('db-import-file').click();
document.getElementById('db-import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const data = JSON.parse(reader.result);
            if (!data || !data.leagues || typeof data.leagues !== 'object') throw new Error('file is missing a "leagues" object');
            activeDatabase = data;
            saveCustomDatabase();
            dbEditorState = { leagueKey: Object.keys(activeDatabase.leagues)[0] || null, teamIdx: null };
            renderDBEditor();
            alert('Database imported successfully.');
        } catch (err) {
            alert('Import failed: ' + err.message);
        }
    };
    reader.readAsText(file);
    e.target.value = '';
});
document.getElementById('db-reset-btn').onclick = () => {
    if (!confirm('Reset the database to the built-in default? This removes ALL custom leagues, teams and players you added.')) return;
    resetCustomDatabase();
    dbEditorState = { leagueKey: Object.keys(activeDatabase.leagues)[0] || null, teamIdx: null };
    renderDBEditor();
};

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active-content'));
    document.querySelectorAll('.tab-link').forEach(l => l.classList.remove('active'));
    document.getElementById(tabId).classList.add('active-content');
    event.currentTarget.classList.add('active');
}

function autoSaveCurrentProgress() {
    let key = `elfut_save_${saveState.saveName}`;
    localStorage.setItem(key, JSON.stringify(saveState));
}

document.getElementById('save-exit-btn').onclick = () => {
    autoSaveCurrentProgress();
    loadActiveMenu();
};

function resumeTargetSave(storageKey) {
    let data = localStorage.getItem(storageKey);
    if (!data) return;
    saveState = JSON.parse(data);
    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('hub-screen').style.display = 'flex';
    refreshHubDashboardUI();
    
    if (saveState.isCompleted) {
        triggerEndgameModalDisplay();
    }
}

window.onload = () => {
    loadActiveDatabase();
    loadActiveMenu();
};