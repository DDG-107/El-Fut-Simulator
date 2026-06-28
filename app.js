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

const POSITIONS = ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"];
const FIRST_NAMES = ["Oliver", "Lucas", "Mateo", "Santiago", "Marcus", "Julian", "Ethan", "Leo", "Tom", "Ben"];
const LAST_NAMES = ["Smith", "Müller", "Garcia", "Silva", "Jones", "Fernandez", "Dupont", "Alves", "Vidal"];

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

function normalizeRoster(team, baselineOvr = 80) {
    if (!team.players) team.players = [];
    team.players.forEach(p => {
        if (!p.stats) p.stats = { goals: 0, assists: 0, cleanSheets: 0 };
    });
    while (team.players.length < 11) {
        let assignedPos = POSITIONS[team.players.length % POSITIONS.length];
        team.players.push(generateRandomPlayer(assignedPos, baselineOvr));
    }
    if (team.players.length > 11) {
        team.players = team.players.slice(0, 11);
    }
}

function parseTacticalStrength(team) {
    let attackWeight = 0, defenseWeight = 0;
    team.players.forEach(p => {
        let r = p.rating;
        if (["ST", "LW", "RW"].includes(p.pos)) { attackWeight += r * 1.3; defenseWeight += r * 0.2; }
        else if (["CAM", "CM"].includes(p.pos)) { attackWeight += r * 1.0; defenseWeight += r * 0.6; }
        else if (["CDM"].includes(p.pos)) { attackWeight += r * 0.5; defenseWeight += r * 1.1; }
        else if (["CB", "LB", "RB"].includes(p.pos)) { attackWeight += r * 0.2; defenseWeight += r * 1.4; }
        else if (p.pos === "GK") { defenseWeight += r * 1.8; }
    });
    return { att: attackWeight / 11, def: defenseWeight / 11 };
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

function runFixtureSimulation(homeTeam, awayTeam) {
    let tA = parseTacticalStrength(homeTeam);
    let tB = parseTacticalStrength(awayTeam);

    let baseChanceA = Math.max(0, (tA.att - tB.def) / 5) + 1.2;
    let baseChanceB = Math.max(0, (tB.att - tA.def) / 5) + 1.0;

    let goalsA = Math.floor(Math.random() * 2.8) + (Math.random() < baseChanceA / 4 ? 1 : 0);
    let goalsB = Math.floor(Math.random() * 2.8) + (Math.random() < baseChanceB / 4 ? 1 : 0);

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
            let btn = document.createElement('button');
            btn.className = 'save-btn';
            btn.innerText = name;
            btn.onclick = () => resumeTargetSave(key);
            savesList.appendChild(btn);
        }
    }
    if (!foundSaves) savesList.innerHTML = '<p style="color:#666;grid-column:1/3;">No past save states found.</p>';
}

document.getElementById('create-save-btn').onclick = () => {
    let name = document.getElementById('new-save-name').value.trim();
    if (!name) return alert('Please input a valid Save Name.');

    saveState.saveName = name;
    saveState.mode = document.querySelector('input[name="game-mode"]:checked').value;
    saveState.isCompleted = false;
    
    poolTeamsMap = [];
    activeConfigEditingIdx = 0;

    for (let leagueKey in gameDatabase.leagues) {
        let currentLeague = gameDatabase.leagues[leagueKey];
        currentLeague.teams.forEach(t => {
            let cloned = JSON.parse(JSON.stringify(t));
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
    listContainer.innerHTML = '';

    let structuralLeagues = [...new Set(poolTeamsMap.map(p => p.leagueName))];
    let totalSelected = 0;

    structuralLeagues.forEach(lName => {
        let groupDiv = document.createElement('div');
        groupDiv.className = 'picker-league-group';
        groupDiv.innerHTML = `<div class="picker-league-title">${lName}</div>`;
        
        let matchingPoolItems = poolTeamsMap.filter(p => p.leagueName === lName);
        
        matchingPoolItems.forEach(poolItem => {
            let globalIdx = poolTeamsMap.indexOf(poolItem);
            if (poolItem.isSelected) totalSelected++;

            let row = document.createElement('div');
            row.className = `team-picker-row ${globalIdx === activeConfigEditingIdx ? 'active-edit' : ''}`;
            
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

        listContainer.appendChild(groupDiv);
    });

    document.getElementById('selected-count-badge').innerText = totalSelected;

    const warning = document.getElementById('power-of-two-warning');
    if (saveState.mode === "tournament" && ![2,4,8,16,32].includes(totalSelected)) {
        warning.style.display = 'block';
    } else {
        warning.style.display = 'none';
    }

    let activeItem = poolTeamsMap[activeConfigEditingIdx];
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
    
    let allGlobalPlayers = [];
    for (let l in gameDatabase.leagues) {
        gameDatabase.leagues[l].teams.forEach(t => allGlobalPlayers.push(...t.players));
    }

    activeItem.teamData.players.forEach((p, pIdx) => {
        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${p.name}</strong></td>
            <td>${p.pos}</td>
            <td><span class="rating-badge">${p.rating}</span></td>
            <td><select class="editor-select" id="swap-select-${pIdx}"></select></td>
        `;
        
        let select = tr.querySelector('select');
        let defOpt = document.createElement('option');
        defOpt.innerText = "Swap with..."; defOpt.value = "";
        select.appendChild(defOpt);

        allGlobalPlayers.forEach(gp => {
            let opt = document.createElement('option');
            opt.value = JSON.stringify(gp);
            opt.innerText = `${gp.name} (${gp.pos} ${gp.rating})`;
            select.appendChild(opt);
        });

        select.onchange = (e) => {
            if(!e.target.value) return;
            let chosenObj = JSON.parse(e.target.value);
            chosenObj.stats = { goals: 0, assists: 0, cleanSheets: 0 };
            activeItem.teamData.players[pIdx] = chosenObj;
            renderDatabasePickerPanel();
        };

        tbody.appendChild(tr);
    });
}

document.getElementById('launch-sim-btn').onclick = () => {
    saveState.teams = poolTeamsMap.filter(p => p.isSelected).map(p => p.teamData);

    if (saveState.teams.length < 2) {
        return alert("Please select at least 2 teams to generate a functional simulator schedule.");
    }
    if (saveState.mode === "tournament" && ![2,4,8,16,32].includes(saveState.teams.length)) {
        return alert("Knockout mode requires an even power-of-two team lineup format (2, 4, 8, or 16 teams). Adjust your selections.");
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
            tr.innerHTML = `<td>${i+1}</td><td class="clickable-row-team"><strong>${t.name}</strong></td><td>${t.gd}</td><td><strong>${t.points}</strong></td>`;
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
    // If the season is already completed, just show the pop-up immediately and exit
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

    let winners = [];

    currentRoundMatches.forEach(match => {
        let homeTeam = saveState.teams.find(t => t.id === match.home);
        let awayTeam = saveState.teams.find(t => t.id === match.away);

        let sim = runFixtureSimulation(homeTeam, awayTeam);
        feedBox.innerHTML += sim.text + "<br>";

        if (sim.details.scorersA.length > 0) feedBox.innerHTML += ` &nbsp;&nbsp; Goals [Home]: ${sim.details.scorersA.join(', ')}<br>`;
        if (sim.details.scorersB.length > 0) feedBox.innerHTML += ` &nbsp;&nbsp; Goals [Away]: ${sim.details.scorersB.join(', ')}<br>`;

        if (saveState.mode === "tournament") {
            if (sim.details.goalsA === sim.details.goalsB) {
                if (Math.random() > 0.5) {
                    feedBox.innerHTML += ` &nbsp;&nbsp; 🏆 ${homeTeam.name} wins on Penalties!<br>`;
                    winners.push(homeTeam); awayTeam.isEliminated = true;
                } else {
                    feedBox.innerHTML += ` &nbsp;&nbsp; 🏆 ${awayTeam.name} wins on Penalties!<br>`;
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
    });

    // Check completion criteria boundaries AFTER simulating current matchday
    if (saveState.mode === "league") {
        if (saveState.currentMatchday >= saveState.totalMatchdays) {
            saveState.isCompleted = true;
            refreshHubDashboardUI();
            autoSaveCurrentProgress();
            // Trigger popup immediately on the last matchday simulation click!
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

    let roundIndex = saveState.currentMatchday - 1;
    let currentRoundMatches = saveState.schedule[roundIndex];

    let feedBox = document.getElementById('ticker-feed-box');
    feedBox.innerHTML = `<strong>--- MATCHDAY ${saveState.currentMatchday} LOGS ---</strong><br>`;

    let winners = [];

    currentRoundMatches.forEach(match => {
        let homeTeam = saveState.teams.find(t => t.id === match.home);
        let awayTeam = saveState.teams.find(t => t.id === match.away);

        let sim = runFixtureSimulation(homeTeam, awayTeam);
        feedBox.innerHTML += sim.text + "<br>";

        if (sim.details.scorersA.length > 0) feedBox.innerHTML += ` &nbsp;&nbsp; Goals [Home]: ${sim.details.scorersA.join(', ')}<br>`;
        if (sim.details.scorersB.length > 0) feedBox.innerHTML += ` &nbsp;&nbsp; Goals [Away]: ${sim.details.scorersB.join(', ')}<br>`;

        if (saveState.mode === "tournament") {
            if (sim.details.goalsA === sim.details.goalsB) {
                if (Math.random() > 0.5) {
                    feedBox.innerHTML += ` &nbsp;&nbsp; 🏆 ${homeTeam.name} wins on Penalties!<br>`;
                    winners.push(homeTeam); awayTeam.isEliminated = true;
                } else {
                    feedBox.innerHTML += ` &nbsp;&nbsp; 🏆 ${awayTeam.name} wins on Penalties!<br>`;
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
    });

    // Check completion criteria boundaries
    if (saveState.mode === "league") {
        if (saveState.currentMatchday >= saveState.totalMatchdays) {
            saveState.isCompleted = true;
            refreshHubDashboardUI();
            triggerEndgameModalDisplay();
            autoSaveCurrentProgress();
            return;
        } else {
            saveState.currentMatchday++;
        }
    } else {
        if (winners.length === 1) {
            saveState.isCompleted = true;
            refreshHubDashboardUI();
            triggerEndgameModalDisplay();
            autoSaveCurrentProgress();
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

// --- POPUP INTERACTIVE OVERLAY TRIGGERS ---
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
    document.getElementById('endgame-modal').style.display = 'block';
}

// Button Bind A: Return to Dashboard
document.getElementById('endgame-dashboard-btn').onclick = () => {
    document.getElementById('endgame-modal').style.display = 'none';
};

// Button Bind B: Reset league scores but keep custom team selections intact
document.getElementById('endgame-replay-btn').onclick = () => {
    document.getElementById('endgame-modal').style.display = 'none';
    
    // Clear matches score tracking across rosters
    saveState.teams.forEach(t => {
        t.points = 0; t.gf = 0; t.ga = 0; t.gd = 0; t.isEliminated = false;
        
        // Wipe player metric logs back to absolute zero baseline
        t.players.forEach(p => {
            p.stats = { goals: 0, assists: 0, cleanSheets: 0 };
        });
    });

    saveState.currentMatchday = 1;
    saveState.isCompleted = false;

    // Regene schedules list tree strings
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

document.querySelector('.modal-close-trigger').onclick = () => document.getElementById('team-modal').style.display = 'none';

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
    
    // Immediately reopen the seasonal popup if user saves and loads inside a finished season state
    if (saveState.isCompleted) {
        triggerEndgameModalDisplay();
    }
}

window.onload = loadActiveMenu;