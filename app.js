// El Fut Simulator - Custom League Pool Management Engine

let saveState = {
    saveName: "",
    mode: "realistic", // 'realistic' | 'draft' | 'draftChallenge' | 'omnipotent' | 'national'
    competitionType: "league", // 'league' or 'tournament' — Realistic Career only
    userTeamId: "",
    currentMatchday: 1,
    totalMatchdays: 0,
    isCompleted: false, // Flag blocking action ticks once threshold crosses
    teams: [], // User-selected clubs running live inside this environment
    schedule: []
};

// --- GAME MODES ---
// 'mode' on the save object selects which ruleset governs this career.
// 'realistic' is the persistent full-club save; every other mode is a
// one-session run that opens its own setup flow (implemented in modes-*.js).
const GAME_MODES = [
    { id: 'realistic', icon: '🏟️', name: 'Realistic Career', desc: 'Full season (league or knockout) with transfers and a youth academy. The complete El Fut experience.' },
    { id: 'draft', icon: '📋', name: 'Single Season Draft', desc: 'For every position the game deals you 5 real players from any league — keep the best pick of each.' },
    { id: 'draftChallenge', icon: '🥊', name: 'Single Season Draft Challenge', desc: 'The same five-card draft, but preset guidelines decide the pool and must be met before the season starts.' },
    { id: 'omnipotent', icon: '👑', name: 'Omnipotent Mode', desc: 'Unlimited budget and god-tier control over your club.' },
    { id: 'national', icon: '🌍', name: 'National Team / World Cup', desc: 'Take a national team to the World Cup.' }
];

function isRealistic() { return saveState.mode === 'realistic'; }
// Competition format helpers apply to every game mode that runs a league or
// bracket season (Daily/Draft/Omnipotent runs a league; National runs a World Cup).
function isLeagueFormat() { return saveState.competitionType === 'league'; }
function isKnockoutFormat() { return saveState.competitionType === 'tournament'; }
function isWorldCupFormat() { return saveState.competitionType === 'worldcup'; }
function getModeName() {
    const m = GAME_MODES.find(x => x.id === saveState.mode);
    return m ? m.name : saveState.mode;
}
// Old saves stored the competition format directly on 'mode'; migrate them so
// they load as a Realistic Career with the format preserved.
function migrateSaveState(data) {
    if (!data || typeof data !== 'object') return data;
    if (data.mode === 'league' || data.mode === 'tournament') {
        data.competitionType = data.mode;
        data.mode = 'realistic';
    }
    if (data.mode === 'realistic' && !data.competitionType) data.competitionType = 'league';
    // Draft Challenge was merged into Single Season Draft.
    if (data.mode === 'draftChallenge') data.mode = 'draft';
    return data;
}

// --- CUSTOM DATABASE LAYER ---
// The built-in database comes from database.js. Edits made in the in-app
// Database Manager are stored as a full snapshot in localStorage and override
// the built-in data at load time.
let activeDatabase = null;                    // Working copy used everywhere
const DB_STORAGE_KEY = 'elfut_db_custom';
const DB_SCHEMA_VERSION = 10;                 // 2 = expanded leagues merged in; 3+ = real rosters filled into empty teams (marquee clubs, MLS, Serie A, PL, La Liga); 8 = all 48 qualified 2026 WC nations present; 9 = merge ensures stored snapshots also gain the WC nations added at v8; 10 = national team ratings recalibrated to realistic gaps
let dbEditorState = { leagueKey: null, teamIdx: null }; // Selection in the DB manager

function cloneDeep(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// Stored custom snapshots are full copies taken at save time, so an old
// snapshot would silently hide leagues/teams added to the built-in database
// later. Snapshots carry a schemaVersion; on upgrade, built-in leagues and
// teams the snapshot predates are merged in once, while every user edit
// (including added leagues) is preserved. Saves written afterwards keep the
// new version and load as-is.
function upgradeStoredDatabase(stored) {
    const db = cloneDeep(stored);
    const version = db.schemaVersion || 1;
    if (version >= DB_SCHEMA_VERSION) return db;
    const builtin = (typeof gameDatabase !== 'undefined' && gameDatabase) || {};
    for (let key in (builtin.leagues || {})) {
        const bLeague = builtin.leagues[key];
        if (!db.leagues[key]) {
            db.leagues[key] = cloneDeep(bLeague);
            continue;
        }
        const customTeams = db.leagues[key].teams || (db.leagues[key].teams = []);
        const have = new Set(customTeams.map(t => t.id));
        (bLeague.teams || []).forEach(t => {
            if (!have.has(t.id)) customTeams.push(cloneDeep(t));
        });
    }
    // Schema 3+: built-in rosters were added for clubs that snapshots copied
    // while still empty. Fill an empty custom team ONLY when the built-in
    // version of that exact team id now carries players — teams the user has
    // already built (non-empty) are never touched.
    if (version < DB_SCHEMA_VERSION) {
        for (let key in db.leagues) {
            const bLeague = builtin.leagues ? builtin.leagues[key] : null;
            if (!bLeague) continue;
            const bTeams = bLeague.teams || [];
            (db.leagues[key].teams || []).forEach(customTeam => {
                const built = bTeams.find(t => t.id === customTeam.id);
                if (built && (built.players || []).length > 0 && !(customTeam.players || []).length) {
                    customTeam.players = cloneDeep(built.players);
                }
            });
        }
    }
    // Schema 10: national-team ratings were recalibrated. Sync player ratings
    // of World Cup league teams from the built-in baseline (matched by name) so
    // stored snapshots inherit the new gaps. Players the user added themselves
    // and every other league are left untouched.
    if (version < 10) {
        const bwc = builtin.leagues ? builtin.leagues['WC 2026'] : null;
        const swc = db.leagues ? db.leagues['WC 2026'] : null;
        if (bwc && swc) {
            (swc.teams || []).forEach(st => {
                const bt = (bwc.teams || []).find(t => t.id === st.id);
                if (!bt) return;
                (st.players || []).forEach(sp => {
                    const bp = (bt.players || []).find(p => p.name === sp.name);
                    if (bp) sp.rating = bp.rating;
                });
            });
        }
    }
    db.schemaVersion = DB_SCHEMA_VERSION;
    return db;
}

function loadActiveDatabase() {
    if (typeof gameDatabase === 'undefined' || !gameDatabase.leagues) return null;
    activeDatabase = cloneDeep(gameDatabase);
    try {
        const raw = localStorage.getItem(DB_STORAGE_KEY);
        if (raw) {
            const custom = JSON.parse(raw);
            if (custom && custom.leagues && typeof custom.leagues === 'object') {
                activeDatabase = upgradeStoredDatabase(custom);
                saveCustomDatabase(); // persist the one-time upgrade
            }
        }
    } catch (e) {
        console.warn('Could not load custom database edits:', e);
    }
    return activeDatabase;
}

function saveCustomDatabase() {
    if (!activeDatabase) return;
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(Object.assign({}, activeDatabase, { schemaVersion: DB_SCHEMA_VERSION })));
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

function teamAverageRating(team) {
    const pl = (team && team.players) || [];
    if (!pl.length) return 50;
    return pl.reduce((s, p) => s + (p.rating || 0), 0) / pl.length;
}

// Expected-goals (xG) match model. Each team's expected goals come from the
// overall rating gap to its opponent, and the actual goals are drawn from a
// Poisson distribution around that xG. This produces realistic football
// scorelines and probabilities: favorites convert their superiority into wins
// most of the time, evenly-matched sides trade close games with a realistic
// share of draws, and underdogs still get a rare shock day.
//
// Ratings drive the model (not a position-weighted split) so every roster
// shape — star-stacked national XIs or deep club squads — plays the same
// football, which keeps club leagues scoring like real ones.
//
// Knockout ties pass a gapScale > 1: single-elimination sharpens the quality
// gap (no safety net of a return leg), so mid-tier nations can't luck their
// way past elite sides in cups — while close clashes stay close.
function expectedGoalsFor(ratingA, ratingB, home, gapScale) {
    // Ratings live on a ~60-99 scale. Positive edges convert steeply (a +1
    // edge is ~0.16 xG); negative edges decay more gently with a floor so the
    // weaker side still creates the odd chance instead of vanishing.
    // The chaos slider scales the effective gap (1.0 = default curve).
    const gap = (ratingA - ratingB) * (gapScale || 1) * simChaosGapFactor();
    let xg = gap >= 0 ? 1.18 + 0.16 * gap : Math.max(0.26, 1.18 + 0.10 * gap);
    if (home) xg *= 1.07; // slight home advantage
    return Math.min(3.8, xg);
}
function samplePoissonGoals(lambda) {
    if (lambda <= 0) return 0;
    const L = Math.exp(-lambda);
    let k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L);
    return Math.min(7, k - 1);
}
// Knockout shootouts are not coin flips — the stronger side converts more.
// Returns P(teamA wins the shootout).
function shootoutWinnerProbability(teamA, teamB) {
    const diff = teamAverageRating(teamA) - teamAverageRating(teamB);
    const p = 0.5 + 0.22 * Math.tanh(diff / 7);
    return Math.max(0.3, Math.min(0.7, p));
}

// Rewritten Realistic Match Simulation Engine
// gapScale: knockout ties pass >1 to sharpen the quality gap.
function runFixtureSimulation(homeTeam, awayTeam, gapScale) {
    // Overall squad ratings drive the matchup (robust for any roster shape).
    const ovrA = teamAverageRating(homeTeam);
    const ovrB = teamAverageRating(awayTeam);

    // Sample goals from each side's expected goals against the other.
    let goalsA = samplePoissonGoals(expectedGoalsFor(ovrA, ovrB, true, gapScale));
    let goalsB = samplePoissonGoals(expectedGoalsFor(ovrB, ovrA, false, gapScale));

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
    if (typeof stopAutoSim === 'function') stopAutoSim();
    document.getElementById('welcome-screen').style.display = 'flex';
    document.getElementById('config-screen').style.display = 'none';
    document.getElementById('hub-screen').style.display = 'none';
    document.getElementById('placeholder-screen').style.display = 'none';
    const modesScreen = document.getElementById('modes-screen');
    if (modesScreen) modesScreen.style.display = 'none';
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

// --- MODE PICKER ---
let selectedModeId = 'realistic';

function renderModePicker() {
    const grid = document.getElementById('mode-picker-grid');
    if (!grid) return;
    grid.innerHTML = '';
    GAME_MODES.forEach(mode => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'mode-card' + (selectedModeId === mode.id ? ' selected' : '');
        card.innerHTML = `
            <span class="mode-card-icon">${mode.icon}</span>
            <span class="mode-card-text"><strong>${mode.name}</strong><small>${mode.desc}</small></span>
        `;
        card.onclick = () => { selectedModeId = mode.id; renderModePicker(); };
        grid.appendChild(card);
    });
    const formatRow = document.getElementById('competition-format-row');
    if (formatRow) formatRow.style.display = selectedModeId === 'realistic' ? '' : 'none';
    const createBtn = document.getElementById('create-save-btn');
    if (createBtn) createBtn.innerText = selectedModeId === 'realistic' ? 'Create League Blueprint' : '▶ Start This Mode';
}

function showPlaceholderScreen(modeId) {
    const def = GAME_MODES.find(m => m.id === modeId) || GAME_MODES[0];
    document.getElementById('placeholder-icon').innerText = def.icon;
    document.getElementById('placeholder-title').innerText = def.name;
    document.getElementById('placeholder-desc').innerText = def.desc;
    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('placeholder-screen').style.display = 'flex';
}

document.getElementById('placeholder-save-exit-btn').onclick = () => {
    autoSaveCurrentProgress();
    loadActiveMenu();
};

document.getElementById('create-save-btn').onclick = () => {
    if (!activeDatabase) {
        return alert('Could not start a save: the team database (database.js) failed to load. It may contain a syntax error. Check the browser console for details.');
    }

    let name = document.getElementById('new-save-name').value.trim();
    if (!name) return alert('Please input a valid Save Name.');

    const formatRadio = document.querySelector('input[name="competition-format"]:checked');
    saveState.saveName = name;
    saveState.mode = selectedModeId;
    saveState.competitionType = isRealistic() && formatRadio ? formatRadio.value : 'league';
    saveState.isCompleted = false;

    // Mode routing: Realistic Career keeps the classic club/team picker; every
    // other mode opens its own setup flow (implemented in modes-*.js).
    if (!isRealistic()) {
        if (typeof openModeSetupFlow === 'function') {
            openModeSetupFlow(saveState.mode);
            return;
        }
        showPlaceholderScreen(saveState.mode);
        return;
    }
    
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
                leagueKey: leagueKey,
                leagueName: currentLeague.name,
                teamData: cloned,
                isSelected: false
            });
        });
    }

    if(poolTeamsMap.length >= 1) poolTeamsMap[0].isSelected = true;
    if(poolTeamsMap.length >= 2) poolTeamsMap[1].isSelected = true;
    
    saveState.userTeamId = poolTeamsMap[0].teamData.id;

    const fmtLine = document.getElementById('config-format-line');
    if (fmtLine) {
        if (isKnockoutFormat()) {
            fmtLine.innerText = 'Knockout Tournament · single elimination · pick a power-of-two field (2, 4, 8, 16, 32 or 64 clubs)';
        } else {
            fmtLine.innerText = 'League Mode · double round robin · every club plays each other twice · pick an even number of clubs';
        }
    }

    document.getElementById('welcome-screen').style.display = 'none';
    document.getElementById('config-screen').style.display = 'flex';
    
    renderDatabasePickerPanel();
};

// --- TEAM PICKER UI STATE ---
let pickerLeagueFilter = null;   // league key, or null = all leagues
let pickerExpanded = new Set();  // league keys whose club lists are expanded
let pickerInitialized = false;

function initialsOf(name) {
    return String(name || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';
}

function poolLeagueEntries() {
    const map = new Map();
    poolTeamsMap.forEach(p => { if (!map.has(p.leagueKey)) map.set(p.leagueKey, p.leagueName); });
    return [...map.entries()].map(([key, name]) => ({ key, name }));
}

function leagueDisplayName(key, name) {
    const dup = poolLeagueEntries().filter(l => l.name === name).length > 1;
    return dup ? `${name} · ${key}` : name;
}

function currentPoolTeam() {
    return poolTeamsMap[activeConfigEditingIdx] || poolTeamsMap[0] || null;
}

function squadAvgRating(teamData) {
    const players = (teamData && teamData.players) || [];
    if (!players.length) return null;
    return (players.reduce((s, p) => s + (p.rating || 0), 0) / players.length).toFixed(1);
}

function renderDatabasePickerPanel() {
    if (!poolTeamsMap.length) return;
    if (!pickerInitialized) {
        pickerLeagueFilter = null;
        const focus = poolTeamsMap[Math.min(activeConfigEditingIdx, poolTeamsMap.length - 1)];
        pickerExpanded = new Set(focus ? [focus.leagueKey] : []);
        pickerInitialized = true;
    }

    const listContainer = document.getElementById('database-team-picker-list');
    listContainer.innerHTML = `
        <div id="league-filter-row" class="league-filter-row"></div>
        <div class="picker-search-row">
            <input type="text" id="team-search-bar" placeholder="🔍 Search clubs in this view…">
            <button id="picker-clear-search" class="mini-btn picker-clear" title="Clear search">✕</button>
        </div>
        <div class="picker-tool-row">
            <button id="bulk-view-all-btn" class="tool-btn">✓ Select all in view</button>
            <button id="bulk-view-none-btn" class="tool-btn">✕ Clear view</button>
            <span id="picker-scope-label" class="picker-scope-label"></span>
        </div>
        <div id="picker-groups-container" class="picker-scroll"></div>
    `;

    document.getElementById('team-search-bar').oninput = () => renderDatabasePickerRows(false);
    document.getElementById('picker-clear-search').onclick = () => {
        document.getElementById('team-search-bar').value = '';
        renderDatabasePickerRows(false);
    };
    document.getElementById('bulk-view-all-btn').onclick = () => bulkTogglePickerTeams(true);
    document.getElementById('bulk-view-none-btn').onclick = () => bulkTogglePickerTeams(false);
    renderDatabasePickerRows(true);
}

function bulkTogglePickerTeams(state) {
    const query = (document.getElementById('team-search-bar').value || '').trim().toLowerCase();
    poolTeamsMap.forEach(p => {
        if (pickerLeagueFilter && p.leagueKey !== pickerLeagueFilter) return;
        if (query && !p.teamData.name.toLowerCase().includes(query)) return;
        p.isSelected = state;
    });
    renderDatabasePickerRows(true);
}

function renderLeagueFilterChips() {
    const row = document.getElementById('league-filter-row');
    if (!row) return;
    row.innerHTML = '';
    const leagues = poolLeagueEntries();
    let totalAll = 0, selAll = 0;
    const selPer = {};
    leagues.forEach(l => {
        const items = poolTeamsMap.filter(p => p.leagueKey === l.key);
        selPer[l.key] = items.filter(p => p.isSelected).length;
        totalAll += items.length;
        selAll += selPer[l.key];
    });
    const addChip = (label, sel, total, active, onClick) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'league-chip' + (active ? ' active' : '');
        b.innerHTML = `<span class="league-chip-name">${esc(label)}</span><span class="league-chip-count">${sel}/${total}</span>`;
        b.onclick = onClick;
        row.appendChild(b);
    };
    addChip('All Leagues', selAll, totalAll, !pickerLeagueFilter, () => { pickerLeagueFilter = null; renderDatabasePickerRows(true); });
    leagues.forEach(l => {
        const items = poolTeamsMap.filter(p => p.leagueKey === l.key);
        addChip(leagueDisplayName(l.key, l.name), items.filter(p => p.isSelected).length, items.length, pickerLeagueFilter === l.key, () => {
            pickerLeagueFilter = pickerLeagueFilter === l.key ? null : l.key;
            if (pickerLeagueFilter) pickerExpanded.add(pickerLeagueFilter);
            renderDatabasePickerRows(true);
        });
    });
}

function renderDatabasePickerRows(rebuildChips) {
    const groupsContainer = document.getElementById('picker-groups-container');
    if (!groupsContainer) return;
    if (rebuildChips !== false) renderLeagueFilterChips();

    const query = (document.getElementById('team-search-bar')?.value || '').trim().toLowerCase();
    const activeKey = pickerLeagueFilter;
    const leagues = poolLeagueEntries();
    let totalSelected = 0;
    poolTeamsMap.forEach(p => { if (p.isSelected) totalSelected++; });

    groupsContainer.innerHTML = '';

    leagues.forEach(league => {
        if (activeKey && league.key !== activeKey) return;
        const poolItems = poolTeamsMap.filter(p => p.leagueKey === league.key);
        const filtered = poolItems.filter(p => !query || p.teamData.name.toLowerCase().includes(query));
        if (poolItems.length === 0 || filtered.length === 0) return;

        const selectedInLeague = poolItems.filter(p => p.isSelected).length;
        const allChecked = selectedInLeague === poolItems.length;
        // While searching, force-open every league that has matches so results stay visible.
        const collapsed = !pickerExpanded.has(league.key) && !query;

        const group = document.createElement('div');
        group.className = 'picker-league-group';

        const head = document.createElement('div');
        head.className = 'picker-league-head' + (collapsed ? ' collapsed' : '');
        head.innerHTML = `
            <span class="picker-chevron">${collapsed ? '▸' : '▾'}</span>
            <span class="picker-league-name">${esc(leagueDisplayName(league.key, league.name))}</span>
            <label class="league-select-all-wrap" title="Select / deselect every club in this league">
                <input type="checkbox" class="league-select-all" ${allChecked ? 'checked' : ''}>
                <span>All</span>
            </label>
            <span class="picker-league-count">${selectedInLeague}/${poolItems.length}</span>
        `;
        head.onclick = (e) => {
            if (e.target.closest('.league-select-all-wrap')) return;
            if (pickerExpanded.has(league.key)) pickerExpanded.delete(league.key);
            else pickerExpanded.add(league.key);
            renderDatabasePickerRows(false);
        };
        head.querySelector('.league-select-all').onchange = (e) => {
            const state = e.target.checked;
            poolItems.forEach(p => { p.isSelected = state; });
            pickerExpanded.add(league.key);
            renderDatabasePickerRows(true);
        };
        group.appendChild(head);

        if (!collapsed) {
            filtered.forEach(poolItem => {
                const globalIdx = poolTeamsMap.indexOf(poolItem);
                const isFocus = globalIdx === activeConfigEditingIdx;
                const row = document.createElement('div');
                row.className = `team-picker-row ${poolItem.isSelected ? 'selected-active' : ''} ${isFocus ? 'active-edit' : ''}`;
                const avg = squadAvgRating(poolItem.teamData);
                row.innerHTML = `
                    <input type="checkbox" ${poolItem.isSelected ? 'checked' : ''}>
                    <span class="team-picker-name">${esc(poolItem.teamData.name)}</span>
                    <span class="team-picker-meta">${avg ? 'OVR ' + esc(avg) : ''}</span>
                    ${isFocus ? '<span class="picker-focus-tag">viewing</span>' : ''}
                `;
                row.onclick = (e) => {
                    if (e.target.type === 'checkbox') return;
                    activeConfigEditingIdx = globalIdx;
                    renderDatabasePickerRows(false);
                };
                row.querySelector('input').onchange = (e) => {
                    poolItem.isSelected = e.target.checked;
                    renderDatabasePickerRows(true);
                };
                group.appendChild(row);
            });
        }
        groupsContainer.appendChild(group);
    });

    if (groupsContainer.children.length === 0) {
        groupsContainer.innerHTML = '<p class="picker-empty">No clubs found — try another search or league.</p>';
    }

    updatePickerSummary(totalSelected);
    renderClubFocusPane();
}

function updatePickerSummary(totalSelected) {
    const badge = document.getElementById('selected-count-badge');
    const label = document.getElementById('selected-count-label');
    if (badge) badge.innerText = totalSelected;
    if (label) label.innerText = `${totalSelected === 1 ? 'club' : 'clubs'} selected`;

    const scope = document.getElementById('picker-scope-label');
    if (scope) {
        if (pickerLeagueFilter) {
            const l = poolLeagueEntries().find(x => x.key === pickerLeagueFilter);
            scope.innerText = l ? leagueDisplayName(l.key, l.name) : 'One league';
            scope.title = scope.innerText;
        } else {
            scope.innerText = `${poolLeagueEntries().length} leagues`;
        }
    }

    const warning = document.getElementById('power-of-two-warning');
    if (!warning) return;
    const pow = [2, 4, 8, 16, 32, 64];
    if (isKnockoutFormat()) {
        if (!pow.includes(totalSelected)) {
            warning.style.display = '';
            warning.textContent = `⚠️ Knockout needs exactly ${pow.join(', ')} clubs — currently ${totalSelected}.`;
        } else {
            warning.style.display = 'none';
        }
    } else if (isLeagueFormat() && totalSelected % 2 !== 0) {
        warning.style.display = '';
        warning.textContent = `⚠️ League Mode needs an even number of clubs — currently ${totalSelected}.`;
    } else {
        warning.style.display = 'none';
    }
}

function renderClubFocusPane() {
    const activeItem = currentPoolTeam();
    const rosterBody = document.getElementById('editor-roster-body');
    if (!activeItem) {
        if (rosterBody) rosterBody.innerHTML = '';
        return;
    }
    const t = activeItem.teamData;

    const titleEl = document.getElementById('editing-team-title');
    if (titleEl) titleEl.innerText = t.name;
    const leagueEl = document.getElementById('editing-team-league');
    if (leagueEl) leagueEl.innerText = leagueDisplayName(activeItem.leagueKey, activeItem.leagueName);
    const avatarEl = document.getElementById('focus-club-avatar');
    if (avatarEl) avatarEl.innerText = initialsOf(t.name);

    const avgEl = document.getElementById('club-avg-rating');
    if (avgEl) avgEl.innerText = squadAvgRating(t) || '—';
    const strength = parseTacticalStrength(t);
    const attEl = document.getElementById('club-att-ui');
    if (attEl) attEl.innerText = Math.round(strength.att);
    const defEl = document.getElementById('club-def-ui');
    if (defEl) defEl.innerText = Math.round(strength.def);
    const budEl = document.getElementById('club-budget-ui');
    if (budEl) budEl.innerText = fmtBudget(t.budget);

    const chip = document.getElementById('club-status-chip');
    if (chip) {
        if (t.id === saveState.userTeamId) {
            chip.className = 'status-chip yours';
            chip.innerText = '⭐ Your Club';
        } else if (activeItem.isSelected) {
            chip.className = 'status-chip included';
            chip.innerText = 'Included in competition';
        } else {
            chip.className = 'status-chip excluded';
            chip.innerText = 'Not selected';
        }
    }

    const claimBtn = document.getElementById('claim-team-btn');
    if (claimBtn) {
        if (t.id === saveState.userTeamId) {
            claimBtn.className = 'action-btn active-control';
            claimBtn.innerText = '✅ You Manage This Club';
            claimBtn.onclick = null;
        } else {
            claimBtn.className = 'action-btn';
            claimBtn.innerText = `Manage ${t.name}`;
            claimBtn.onclick = () => {
                if (!activeItem.isSelected) {
                    alert('Include this club in the competition first (tick it in Step 1), then it can be your managed club.');
                    return;
                }
                saveState.userTeamId = t.id;
                renderDatabasePickerRows(true);
            };
        }
    }

    if (!rosterBody) return;
    rosterBody.innerHTML = '';
    t.players.forEach((p, pIdx) => {
        const tr = document.createElement('tr');
        const initials = initialsOf(p.name);
        const imgHtml = p.img ? `<img src="${esc(p.img)}" onerror="this.style.display='none'">` : '';
        tr.innerHTML = `
            <td class="row-num">${pIdx + 1}</td>
            <td>
                <div class="player-profile">
                    <div class="player-avatar">${imgHtml}<span>${esc(initials)}</span></div>
                    <strong>${esc(p.name)}</strong>
                </div>
            </td>
            <td>${esc(p.pos)}</td>
            <td><span class="rating-badge">${esc(p.rating)}</span></td>
            <td><button class="swap-row-btn">Swap</button></td>
        `;
        tr.querySelector('.swap-row-btn').onclick = () => openSwapModal(activeItem, pIdx);
        rosterBody.appendChild(tr);
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
        const hay = `${p.name} ${p.pos} ${p.rating} ${p.nationality || ''} ${entry.teamName} ${entry.leagueName}`.toLowerCase();
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
                <div class="swap-card-sub">${esc(p.pos)} · ${esc(entry.teamName)}${p.nationality ? ` · ${esc(p.nationality)}` : ''} <span class="swap-card-league">${esc(entry.leagueName)}</span></div>
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
    if (isKnockoutFormat() && ![2,4,8,16,32,64].includes(saveState.teams.length)) {
        return alert("Knockout mode requires an even power-of-two team lineup format (2, 4, 8, 16, 32, or 64 teams). Adjust your selections.");
    }
    if (isLeagueFormat() && saveState.teams.length % 2 !== 0) {
        return alert("Round Robin League format requires an even number of selected teams. Add or remove one team.");
    }

    let userAssignedCheck = saveState.teams.find(t => t.id === saveState.userTeamId);
    if(!userAssignedCheck) {
        saveState.userTeamId = saveState.teams[0].id;
    }

    saveState.currentMatchday = 1;
    saveState.isCompleted = false;
    
    if (isLeagueFormat()) {
        saveState.schedule = buildDoubleRoundRobin(saveState.teams);
        saveState.totalMatchdays = saveState.schedule.length;
    } else {
        saveState.schedule = buildDirectKnockoutTree(saveState.teams);
        saveState.totalMatchdays = Math.log2(saveState.teams.length);
    }

    document.getElementById('config-screen').style.display = 'none';
    document.getElementById('hub-screen').style.display = 'flex';
    refreshHubDashboardUI();
    switchHubPane('table');
};

function findTeamLeagueName(teamId) {
    if (!activeDatabase) return null;
    for (let key in activeDatabase.leagues) {
        const league = activeDatabase.leagues[key];
        if ((league.teams || []).some(t => t.id === teamId)) return league.name || key;
    }
    return null;
}

function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function knockoutRoundName() {
    const round = saveState.currentMatchday;
    const teamsNow = saveState.totalMatchdays ? Math.round(saveState.teams.length / Math.pow(2, round - 1)) : saveState.teams.length;
    const map = { 64: 'Round of 64', 32: 'Round of 32', 16: 'Round of 16', 8: 'Quarter-Final', 4: 'Semi-Final', 2: 'Final' };
    return map[teamsNow] || `Round ${round}`;
}

function refreshHubDashboardUI() {
    // World Cup runs render their own hub (group tables, then bracket) in modes-worldcup.js.
    if (isWorldCupFormat()) {
        if (typeof renderWorldCupHubUI === 'function') renderWorldCupHubUI();
        return;
    }

    const userTeamObj = saveState.teams.find(t => t.id === saveState.userTeamId) || saveState.teams[0];
    if (!userTeamObj) return;

    document.getElementById('hub-user-team').innerText = userTeamObj.name;
    const avatar = document.getElementById('hub-club-avatar');
    if (avatar) avatar.innerText = initialsOf(userTeamObj.name);
    const leagueLine = document.getElementById('hub-competition-line');
    if (leagueLine) {
        const leagueName = saveState.userLeagueName || findTeamLeagueName(userTeamObj.id);
        const formationTag = saveState.formation && saveState.mode !== 'realistic' ? ` · ${saveState.formation}` : '';
        leagueLine.innerText = `${leagueName ? leagueName + ' · ' : ''}${isKnockoutFormat() ? 'Knockout' : 'League Mode'} · ${saveState.teams.length} clubs${formationTag}`;
    }

    const posLabel = document.getElementById('hub-pos-label');
    const posValue = document.getElementById('hub-position-ui');
    const ptsLabel = document.getElementById('hub-pts-label');
    const ptsValue = document.getElementById('user-points-ui');
    const gdLabel = document.getElementById('hub-gd-label');
    const gdValue = document.getElementById('hub-gd-ui');

    if (isKnockoutFormat()) {
        if (posLabel) posLabel.innerText = 'Round';
        if (posValue) posValue.innerText = knockoutRoundName();
        if (ptsLabel) ptsLabel.innerText = 'Status';
        if (ptsValue) ptsValue.innerText = userTeamObj.isEliminated ? 'Eliminated' : 'Active';
        if (gdLabel) gdLabel.innerText = 'Clubs Left';
        if (gdValue) gdValue.innerText = saveState.teams.filter(t => !t.isEliminated).length;
    } else {
        const sorted = [...saveState.teams].sort((a, b) => b.points - a.points || b.gd - a.gd);
        const position = sorted.findIndex(t => t.id === userTeamObj.id) + 1;
        if (posLabel) posLabel.innerText = 'Position';
        if (posValue) posValue.innerText = ordinal(position);
        if (ptsLabel) ptsLabel.innerText = 'Points';
        if (ptsValue) ptsValue.innerText = userTeamObj.points;
        if (gdLabel) gdLabel.innerText = 'Goal Diff';
        const gd = userTeamObj.gd;
        if (gdValue) gdValue.innerText = (gd > 0 ? '+' : '') + gd;
    }

    const total = saveState.totalMatchdays || 1;
    const played = saveState.isCompleted ? total : Math.min(saveState.currentMatchday - 1, total);
    const pct = Math.max(0, Math.round((played / total) * 100));
    const fill = document.getElementById('hub-progress-fill');
    if (fill) fill.style.width = pct + '%';
    const pctEl = document.getElementById('hub-progress-pct');
    if (pctEl) pctEl.innerText = pct + '%';
    const curMd = saveState.currentMatchday;
    const totMd = saveState.totalMatchdays;
    const subEl = document.getElementById('hub-progress-sub');
    if (subEl) {
        subEl.innerHTML = isKnockoutFormat()
            ? `Round <span id="current-matchday-ui">${curMd}</span> of <span id="total-matchdays-ui">${totMd}</span> · ${knockoutRoundName()}`
            : `Matchday <span id="current-matchday-ui">${curMd}</span> of <span id="total-matchdays-ui">${totMd}</span>`;
    }

    const tableTitle = document.getElementById('table-title');
    const tableSub = document.getElementById('table-sub-ui');
    const feedRound = document.getElementById('feed-round-ui');
    const thead = document.getElementById('table-head-ui');
    if (isKnockoutFormat()) {
        if (tableTitle) tableTitle.innerText = `${knockoutRoundName()} — Cup Bracket`;
        if (tableSub) tableSub.innerText = `Single elimination · ${saveState.teams.filter(t => !t.isEliminated).length} clubs remain`;
        if (feedRound) feedRound.innerText = `Round ${saveState.currentMatchday} of ${saveState.totalMatchdays}`;
        if (thead) thead.innerHTML = '<tr><th>Match</th><th>Home</th><th></th><th>Away</th></tr>';
    } else {
        if (tableTitle) tableTitle.innerText = 'Standings Table';
        if (tableSub) tableSub.innerText = 'Double round robin · click a club to view its squad';
        if (feedRound) feedRound.innerText = `Matchday ${saveState.currentMatchday} of ${saveState.totalMatchdays}`;
        if (thead) thead.innerHTML = '<tr><th>Pos</th><th>Club</th><th>GD</th><th>Pts</th></tr>';
    }

    const exitBtn = document.getElementById('save-exit-btn');
    if (exitBtn) exitBtn.innerText = isRealistic() ? '💾 Save & Exit to Menu' : '🚪 End Run · not saved';

    renderActiveStandings();
    renderLeaderboardCharts();
}

function renderActiveStandings() {
    const tbody = document.getElementById('league-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (isLeagueFormat()) {
        const sorted = [...saveState.teams].sort((a, b) => b.points - a.points || b.gd - a.gd);
        sorted.forEach((t, i) => {
            const tr = document.createElement('tr');
            if (t.id === saveState.userTeamId) tr.className = 'user-row';
            tr.innerHTML = `
                <td>${i + 1}</td>
                <td class="clickable-row-team"><strong>${esc(t.name)}</strong> ${t.id === saveState.userTeamId ? '<span class="you-star">⭐</span>' : ''}</td>
                <td>${t.gd > 0 ? '+' : ''}${t.gd}</td>
                <td><strong>${t.points}</strong></td>`;
            tr.querySelector('.clickable-row-team').onclick = () => launchProfileModal(t);
            tbody.appendChild(tr);
        });
    } else {
        const currentFixtures = saveState.schedule[saveState.currentMatchday - 1];
        if (!currentFixtures) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Tournament Completed!</td></tr>';
            return;
        }
        currentFixtures.forEach((f, idx) => {
            const homeObj = saveState.teams.find(t => t.id === f.home);
            const awayObj = saveState.teams.find(t => t.id === f.away);
            if (!homeObj || !awayObj) return;
            const tr = document.createElement('tr');
            if (homeObj.id === saveState.userTeamId || awayObj.id === saveState.userTeamId) tr.className = 'user-row';
            const star = (id) => id === saveState.userTeamId ? ' <span class="you-star">⭐</span>' : '';
            tr.innerHTML = `
                <td>${idx + 1}</td>
                <td class="clickable-row-team"><strong>${esc(homeObj.name)}</strong>${star(homeObj.id)}</td>
                <td class="vs-cell">vs</td>
                <td class="clickable-row-team"><strong>${esc(awayObj.name)}</strong>${star(awayObj.id)}</td>`;
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
// Simulates exactly one matchday (or one tournament round) and refreshes the hub.
function advanceOneMatchday() {
    if (saveState.isCompleted) {
        triggerEndgameModalDisplay();
        return;
    }

    // World Cup runs simulate group + knockout rounds with their own engine.
    if (isWorldCupFormat()) {
        if (typeof performWorldCupAdvance === 'function') performWorldCupAdvance();
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

    const knockoutScale = isKnockoutFormat() ? 1.5 : 1;
    currentRoundMatches.forEach(match => {
        let homeTeam = saveState.teams.find(t => t.id === match.home);
        let awayTeam = saveState.teams.find(t => t.id === match.away);

        let sim = runFixtureSimulation(homeTeam, awayTeam, knockoutScale);
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

        if (isKnockoutFormat()) {
            if (sim.details.goalsA === sim.details.goalsB) {
                if (Math.random() < shootoutWinnerProbability(homeTeam, awayTeam)) {
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
        }        });        feedBox.innerHTML += userMatchHtml + basicMatchesHtml;
    scrollFeedToBottom();

    // Reveal results on a manual Step. During auto-sim, leave the player's
    // current tab alone so they can watch the table/bracket and stats live.
    if (!isAutoSimRunning()) switchHubPane('feed');

    if (isLeagueFormat()) {
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
    scrollFeedToBottom();
}

function scrollFeedToBottom() {
    const feed = document.getElementById('ticker-feed-box');
    if (feed) feed.scrollTop = feed.scrollHeight;
}

// --- CONTINUOUS SIMULATION ---
// The hub's main button starts the season running; it keeps simulating
// matchdays on a short timer until the season ends or the player stops it.
let simAutoTimer = null;

// Lets other modules know whether the season is running unattended, so the
// sim doesn't yank the view back to the feed while the player is browsing.
function isAutoSimRunning() {
    return !!simAutoTimer;
}

function stopAutoSim() {
    if (simAutoTimer) {
        clearInterval(simAutoTimer);
        simAutoTimer = null;
    }
    const btn = document.getElementById('advance-matchday-btn');
    if (btn) {
        btn.innerText = '▶ Simulate Season';
        btn.classList.remove('sim-running');
    }
    const stepBtn = document.getElementById('step-matchday-btn');
    if (stepBtn) stepBtn.disabled = false;
    const status = document.getElementById('sim-status-ui');
    if (status) status.style.display = 'none';
}

function startAutoSim() {
    if (simAutoTimer) return;
    if (saveState.isCompleted) {
        triggerEndgameModalDisplay();
        return;
    }
    const btn = document.getElementById('advance-matchday-btn');
    if (btn) {
        btn.innerText = '⏸ Stop Simulation';
        btn.classList.add('sim-running');
    }
    const stepBtn = document.getElementById('step-matchday-btn');
    if (stepBtn) stepBtn.disabled = true;
    const status = document.getElementById('sim-status-ui');
    if (status) {
        status.style.display = '';
        status.innerText = '⚙️ Simulating — press Stop Simulation to pause anytime.';
    }

    // Register the timer first so the very first (immediate) matchday counts
    // as an auto-sim tick and doesn't yank the view off the player's tab.
    simAutoTimer = setInterval(() => {
        advanceOneMatchday();
        if (saveState.isCompleted) stopAutoSim();
    }, 650);
    advanceOneMatchday();
    if (saveState.isCompleted) stopAutoSim();
}

document.getElementById('advance-matchday-btn').onclick = () => {
    if (simAutoTimer) stopAutoSim();
    else startAutoSim();
};

// Step button: simulate exactly one matchday and stay paused.
document.getElementById('step-matchday-btn').onclick = () => {
    if (simAutoTimer) return;
    if (saveState.isCompleted) {
        triggerEndgameModalDisplay();
        return;
    }
    advanceOneMatchday();
};

function triggerEndgameModalDisplay() {
    let championTeam = null;
    let championName = 'Unknown';

    if (isLeagueFormat() || (!isWorldCupFormat() && !isKnockoutFormat())) {
        const sorted = [...saveState.teams].sort((a, b) => b.points - a.points || b.gd - a.gd);
        championTeam = sorted[0];
        championName = championTeam ? championTeam.name : 'Unknown';
    } else {
        const activeRemaining = saveState.teams.filter(t => !t.isEliminated);
        championTeam = activeRemaining.length > 0 ? activeRemaining[0] : null;
        championName = championTeam ? championTeam.name : 'Tournament Finalist';
    }

    document.getElementById('endgame-winner-name').innerText = championName;

    const replayBtn = document.getElementById('endgame-replay-btn');
    if (replayBtn) replayBtn.style.display = isWorldCupFormat() ? 'none' : '';

    // Challenge verdict (Daily Challenge goals).
    const verdictEl = document.getElementById('endgame-verdict');
    if (verdictEl) {
        const goal = saveState.challengeGoal;
        if (goal && saveState.mode !== 'realistic' && isLeagueFormat()) {
            const sorted = [...saveState.teams].sort((a, b) => b.points - a.points || b.gd - a.gd);
            const userTeam = saveState.teams.find(t => t.id === saveState.userTeamId);
            let ok = false;
            let detail = '';
            if (goal.type === 'win') {
                ok = !!championTeam && !!userTeam && championTeam.id === userTeam.id;
                detail = ok ? 'won the league outright' : `finished behind champion ${championTeam ? championTeam.name : ''}`;
            } else if (goal.type === 'top4') {
                const userPos = userTeam ? sorted.findIndex(t => t.id === userTeam.id) + 1 : -1;
                ok = userPos >= 1 && userPos <= 4;
                detail = ok ? `finished ${ordinal(userPos)}` : (userPos > 0 ? `finished ${ordinal(userPos)} — needed a top-4 spot` : 'did not qualify');
            }
            const goalLabel = goal.label || 'the challenge goal';
            verdictEl.style.display = '';
            verdictEl.className = 'endgame-verdict ' + (ok ? 'verdict-good' : 'verdict-bad');
            verdictEl.innerHTML = `<strong>${ok ? '✔ CHALLENGE COMPLETE' : '✖ CHALLENGE FAILED'}</strong><span>Goal: ${esc(goalLabel)} — ${userTeam ? esc(userTeam.name) : 'Your team'} ${detail}.</span>`;
        } else {
            verdictEl.style.display = 'none';
        }
    }

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

    if (isLeagueFormat()) {
        saveState.schedule = buildDoubleRoundRobin(saveState.teams);
        saveState.totalMatchdays = saveState.schedule.length;
    } else {
        saveState.schedule = buildDirectKnockoutTree(saveState.teams);
        saveState.totalMatchdays = Math.log2(saveState.teams.length);
    }

    let feedBox = document.getElementById('ticker-feed-box');
    feedBox.innerHTML = "Competition restarted! Roster configurations preserved. Advance matchday to play.";

    refreshHubDashboardUI();
    switchHubPane('table');
    autoSaveCurrentProgress();
};

function launchProfileModal(team) {
    const isUser = team.id === saveState.userTeamId;
    const avg = squadAvgRating(team) || '—';
    const strength = parseTacticalStrength(team);
    const leagueName = findTeamLeagueName(team.id);
    document.getElementById('modal-team-name').innerText = team.name + (isUser ? ' ⭐' : '');
    document.getElementById('modal-team-tactics').innerHTML = `
        ${leagueName ? esc(leagueName) + ' · ' : ''}OVR ${avg} · ATT ${Math.round(strength.att)} · DEF ${Math.round(strength.def)}
        ${isUser ? ' · Your club' : ''}
    `;

    const tbody = document.getElementById('modal-squad-table');
    tbody.innerHTML = team.players.map(p => {
        const nat = p.nationality ? ` <span class="nat-tag">${esc(p.nationality)}</span>` : '';
        return `<tr><td><strong>${esc(p.name)}</strong>${nat}</td><td>${esc(p.pos)}</td><td><span class="rating-badge">${esc(p.rating)}</span></td></tr>`;
    }).join('');

    document.getElementById('team-modal').style.display = 'flex';
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
        if (query && !`${p.name} ${p.pos} ${p.rating} ${p.nationality || ''}`.toLowerCase().includes(query)) return;
        count++;
        const row = document.createElement('div');
        row.className = 'db-row';
        row.innerHTML = `
            <div class="db-row-main">
                <strong>${esc(p.name)}</strong>
                <div class="db-row-sub">${esc(p.pos)} · OVR ${esc(p.rating)}${p.nationality ? ` · <span class="nat-tag">${esc(p.nationality)}</span>` : ''}</div>
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
            <div class="form-field"><label>Nationality (optional)</label><input id="f-nat" type="text" value="${esc(existing && existing.nationality ? existing.nationality : '')}" placeholder="e.g. France"></div>
            <div class="form-field"><label>Image path (optional)</label><input id="f-img" type="text" value="${esc(existing && existing.img ? existing.img : '')}" placeholder="assets/player.png"></div>
            <div class="form-field">
                <label>Transfer history (optional)</label>
                <div id="f-th-list"></div>
                <button type="button" id="f-th-add" class="db-add-row-btn th-add-btn">+ Add Transfer</button>
            </div>
            <div class="form-field">
                <label>Former teammates</label>
                <div id="f-teammates-box" class="teammates-box">Former teammates are derived from overlapping transfer history — none found yet.</div>
            </div>`;
        const history = (existing && Array.isArray(existing.transferHistory)) ? existing.transferHistory : [];
        history.forEach(h => addTransferHistoryRow(h.club, h.season));
        document.getElementById('f-th-add').onclick = () => { addTransferHistoryRow('', ''); refreshTeammatesPreview(); };
        document.getElementById('f-name').addEventListener('input', refreshTeammatesPreview);
        refreshTeammatesPreview();
    }
    document.getElementById('db-edit-modal').style.display = 'flex';
}

// --- Transfer history row helpers (player form) ---
function addTransferHistoryRow(club, season) {
    const wrap = document.getElementById('f-th-list');
    if (!wrap) return;
    const row = document.createElement('div');
    row.className = 'th-row';
    row.innerHTML = `
        <input type="text" class="th-club" placeholder="Club (e.g. Ajax)" value="${esc(club || '')}">
        <input type="text" class="th-season" placeholder="Season (e.g. 2024/25)" value="${esc(season || '')}">
        <button type="button" class="th-del" title="Remove transfer">&times;</button>`;
    row.querySelector('.th-del').onclick = () => { row.remove(); refreshTeammatesPreview(); };
    row.querySelector('.th-club').addEventListener('input', refreshTeammatesPreview);
    row.querySelector('.th-season').addEventListener('input', refreshTeammatesPreview);
    wrap.appendChild(row);
}

function readTransferHistoryRows() {
    const out = [];
    document.querySelectorAll('#f-th-list .th-row').forEach(r => {
        const club = (r.querySelector('.th-club').value || '').trim();
        const season = (r.querySelector('.th-season').value || '').trim();
        if (club) out.push({ club, season });
    });
    return out;
}

// Former teammates are DERIVED, not hand-stored: two players count as former
// teammates when their transfer histories share a (club, season) stint.
function getFormerTeammates(player, database) {
    const out = [];
    if (!player || !database || !Array.isArray(player.transferHistory)) return out;
    const keyOf = (h) => String((h.club || '').trim().toLowerCase()) + '||' + String((h.season || '').trim().toLowerCase());
    const mine = player.transferHistory.filter(h => h && h.club && String(h.club).trim()).map(keyOf);
    if (mine.length === 0) return out;
    const seen = new Set();
    for (let lk in database.leagues) {
        const league = database.leagues[lk];
        (league.teams || []).forEach(t => {
            (t.players || []).forEach(q => {
                if (!q || !Array.isArray(q.transferHistory)) return;
                if (q.name === player.name) return; // self
                const shared = q.transferHistory.some(h => h && mine.includes(keyOf(h)));
                const key = q.name + '|' + lk;
                if (shared && !seen.has(key)) {
                    seen.add(key);
                    out.push({ name: q.name, teamName: t.name, leagueName: league.name || lk });
                }
            });
        });
    }
    return out;
}

function refreshTeammatesPreview() {
    const box = document.getElementById('f-teammates-box');
    if (!box) return;
    const name = (document.getElementById('f-name').value || '').trim();
    const history = readTransferHistoryRows();
    const mates = getFormerTeammates({ name, transferHistory: history }, activeDatabase);
    if (mates.length === 0) {
        box.innerHTML = 'No matches yet — add the same <strong>club + season</strong> to two players\' transfer history and they will appear here automatically.';
    } else {
        box.innerHTML = '<strong>Former teammates found:</strong> ' + mates.map(m => `<span class="mate-chip">${esc(m.name)} <small>(${esc(m.teamName)})</small></span>`).join(' ');
    }
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
        const nationality = document.getElementById('f-nat').value.trim();
        const history = readTransferHistoryRows();
        const team = activeDatabase.leagues[ctx.leagueKey].teams[ctx.teamIdx];
        const players = team.players || (team.players = []);
        const player = { name, pos, rating: isNaN(rating) ? 80 : Math.max(1, Math.min(99, rating)) };
        if (img) player.img = img;
        if (nationality) player.nationality = nationality;
        if (history.length) player.transferHistory = history;
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
            activeDatabase = upgradeStoredDatabase(data);
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
    // All non-realistic modes (Draft/Draft Challenge/Omnipotent/National) are one-session runs and are
    // never written to the save list.
    if (!isRealistic()) return;
    let key = `elfut_save_${saveState.saveName}`;
    localStorage.setItem(key, JSON.stringify(saveState));
}

document.getElementById('save-exit-btn').onclick = () => {
    stopAutoSim();
    // Every non-realistic mode is a one-session "play now" run: leaving ends the run.
    if (!isRealistic()) {
        if (confirm('End this run? One-session game modes are not saved.')) loadActiveMenu();
        return;
    }
    autoSaveCurrentProgress();
    loadActiveMenu();
};

function resumeTargetSave(storageKey) {
    let data = localStorage.getItem(storageKey);
    if (!data) return;
    saveState = migrateSaveState(JSON.parse(data));
    document.getElementById('welcome-screen').style.display = 'none';

    // Non-realistic modes are one-session "play now" runs, never written to the
    // save list, so nothing should exist under them — but guard old saves.
    if (!isRealistic()) {
        alert('This is a one-session game mode and cannot be resumed. Start a fresh run from the menu.');
        loadActiveMenu();
        return;
    }

    document.getElementById('hub-screen').style.display = 'flex';
    refreshHubDashboardUI();
    switchHubPane('table');
    
    if (saveState.isCompleted) {
        triggerEndgameModalDisplay();
    }
}

// --- HUB TABBED PANES + CONFIG/HUB NAVIGATION ---
function switchHubPane(name) {
    const panes = { table: 'hub-pane-table', feed: 'hub-pane-feed', stats: 'hub-pane-stats' };
    if (!panes[name]) return;
    document.querySelectorAll('.hub-tabpane').forEach(p => p.classList.toggle('active', p.id === panes[name]));
    document.querySelectorAll('.hub-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.pane === name));
    if (name === 'feed') {
        const feedBox = document.getElementById('ticker-feed-box');
        if (feedBox) feedBox.scrollTop = feedBox.scrollHeight;
    }
}

document.querySelectorAll('.hub-tab-btn').forEach(b => {
    b.onclick = () => switchHubPane(b.dataset.pane);
});

function viewOwnSquad() {
    const u = saveState.teams.find(t => t.id === saveState.userTeamId) || saveState.teams[0];
    if (u) launchProfileModal(u);
}

document.getElementById('view-squad-btn').onclick = viewOwnSquad;
document.getElementById('sidebar-club-card').onclick = viewOwnSquad;
document.getElementById('config-back-btn').onclick = () => loadActiveMenu();

// --- MATCH ENGINE CHAOS SETTINGS ---
// A welcome-screen slider scales how much rating gaps decide matches, without
// touching the calibrated default curve (slider 0 = the verified engine).
const SIM_CHAOS_KEY = 'elfut_sim_chaos';
const SIM_CHAOS_DEFAULT = 0;

function simChaosValue() {
    const raw = parseInt(localStorage.getItem(SIM_CHAOS_KEY), 10);
    return Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : SIM_CHAOS_DEFAULT;
}

// 0% -> gap factor 1.0 (curve untouched). 100% -> 0.2 (gaps almost vanish,
// so results become near coin-flips and shocks are everywhere). Non-linear so
// low slider values stay close to the verified balance.
function simChaosGapFactor(v) {
    const val = v == null ? simChaosValue() : v;
    return 1 - 0.8 * Math.pow(Math.max(0, Math.min(100, val)) / 100, 1.3);
}

function simChaosModeName(v) {
    if (v <= 12) return 'Realistic';
    if (v <= 40) return 'Balanced';
    if (v <= 70) return 'Chaotic';
    return 'Arcade';
}

function simChaosHint(v) {
    if (v <= 12) return 'Ratings decide every match — the tuned, realistic engine. Favorites win, underdogs shock rarely.';
    if (v <= 40) return 'Mostly realistic with a touch more luck — the odd cup giant-killing becomes more common.';
    if (v <= 70) return 'Quality still matters but form and fortune loom large. Expect surprise title runs and upsets.';
    return 'Anything can happen — minnows can take the World Cup. Pure entertainment mode.';
}

function renderChaosSetting() {
    const slider = document.getElementById('chaos-slider');
    if (!slider) return;
    const v = simChaosValue();
    slider.value = v;
    const nameEl = document.getElementById('chaos-mode-name');
    if (nameEl) nameEl.innerText = simChaosModeName(v);
    const hintEl = document.getElementById('chaos-hint');
    if (hintEl) hintEl.innerText = simChaosHint(v);
    const fill = document.getElementById('chaos-slider-fill');
    if (fill) fill.style.width = v + '%';
}

(function initChaosSetting() {
    const slider = document.getElementById('chaos-slider');
    if (!slider) return;
    slider.oninput = () => {
        localStorage.setItem(SIM_CHAOS_KEY, String(slider.value));
        renderChaosSetting();
    };
    renderChaosSetting();
})();

window.onload = () => {
    loadActiveDatabase();
    loadActiveMenu();
    renderModePicker();
};