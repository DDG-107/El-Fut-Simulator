// El Fut Simulator — National Team / World Cup mode
// ---------------------------------------------------------------------------
// Pick your nation from the national teams in the database (World Cup 2026
// league), pick 7+ more nations to complete the field, then play a Mini World
// Cup: groups of 4 in a round robin, top two advance to a knockout bracket.
// One-session run — never written to the save list.

const WC = {
    nationKey: null,        // league key holding the national teams
    yourNationId: null,
    participants: []        // team ids taking part (multiple of 4, >= 8)
};

function wcNationalLeague() {
    for (const key in activeDatabase.leagues) {
        const league = activeDatabase.leagues[key];
        if (/world|cup/i.test((league.name || key) + ' ' + key)) return { key, league };
    }
    return null;
}

function wcTeamAvg(team) {
    const pl = (team && team.players) || [];
    if (!pl.length) return 0;
    return pl.reduce((s, p) => s + (p.rating || 0), 0) / pl.length;
}

function openWorldCupSetup() {
    const found = wcNationalLeague();
    if (!found) {
        return alert('No national teams found. Add a league named like "World Cup" with 8+ national teams in the Database Manager, then try again.');
    }
    const teams = found.league.teams || [];
    if (teams.length < 8) {
        return alert(`Only ${teams.length} national teams exist in "${found.league.name}". Add more national teams in the Database Manager (8+ needed) and try again.`);
    }
    WC.nationKey = found.key;
    WC.yourNationId = null;
    WC.participants = [];

    document.getElementById('welcome-screen').style.display = 'none';
    const screen = document.getElementById('modes-screen');
    screen.style.display = 'flex';
    renderWCSetup();
}

function wcTeam(id) {
    const found = wcNationalLeague();
    if (!found) return null;
    return (found.league.teams || []).find(t => t.id === id) || null;
}

function renderWCSetup() {
    const found = wcNationalLeague();
    const teams = (found.league.teams || []).slice().sort((a, b) => wcTeamAvg(b) - wcTeamAvg(a));
    const meta = GAME_MODES.find(m => m.id === 'national') || GAME_MODES[0];
    const screen = document.getElementById('modes-screen');

    if (!WC.yourNationId) {
        // strongest team is a friendly default
        WC.yourNationId = teams[0].id;
    }

    screen.innerHTML = `
        <div class="menu-box large-box">
            <div class="config-topbar">
                <button id="wc-back-btn" class="btn-secondary config-back-btn">← Menu</button>
                <div class="config-title-group">
                    <h2>${meta.icon} ${meta.name}</h2>
                    <p class="subtitle" id="wc-subtitle">${esc(meta.desc)}</p>
                </div>
            </div>
            <div id="wc-body"></div>
        </div>`;
    document.getElementById('wc-back-btn').onclick = () => {
        if (window.confirm('Cancel this run?')) loadActiveMenu();
    };

    const yourOptions = teams.map(t => {
        const sel = t.id === WC.yourNationId;
        const avg = wcTeamAvg(t).toFixed(1);
        return `
            <button type="button" class="nation-card ${sel ? 'selected' : ''}" data-id="${esc(t.id)}" data-avg="${avg}">
                <span class="nation-name">${esc(t.name)}</span><span class="nation-ovr">OVR ${avg}</span>
                ${sel ? '<span class="you-tag">YOU</span>' : ''}
            </button>`;
    }).join('');

    const others = teams.filter(t => t.id !== WC.yourNationId);
    const othersSelected = new Set(WC.participants);
    const otherHtml = others.map(t => {
        const sel = othersSelected.has(t.id);
        const avg = wcTeamAvg(t).toFixed(1);
        return `
            <label class="nation-pick ${sel ? 'selected' : ''}">
                <input type="checkbox" data-id="${esc(t.id)}" ${sel ? 'checked' : ''}>
                <span class="nation-name">${esc(t.name)}</span><span class="nation-ovr">OVR ${avg}</span>
            </label>`;
    }).join('');

    document.getElementById('wc-body').innerHTML = `
        <div class="editor-layout sb-step1-layout">
            <div class="team-selector-pane">
                <div class="pane-head"><span class="pane-eyebrow">STEP 1 · YOUR NATION</span><h3>Who do you manage?</h3></div>
                <div class="nation-list">${yourOptions}</div>
            </div>
            <div class="roster-modifier-pane">
                <div class="pane-head pane-head-row">
                    <div>
                        <span class="pane-eyebrow">STEP 2 · THE FIELD</span>
                        <h3>Choose the other nations</h3>
                    </div>
                    <div class="pane-tools">
                        <button type="button" id="wc-sel-all" class="pane-tool-btn">Select all</button>
                        <button type="button" id="wc-sel-none" class="pane-tool-btn">Clear</button>
                    </div>
                </div>
                <p class="pane-hint">Your nation + the ones you tick form the field. Every nation in the World Cup 2026 league is listed — <strong>Select all</strong> runs the full 48-nation tournament (12 groups of 4, exactly like the real thing). Valid field sizes: 8, 12, 16, 24, 28, 32, 44 or 48.</p>
                <div class="nation-picks" id="wc-others">${otherHtml}</div>
            </div>
        </div>
        <div class="config-footer">
            <div class="config-footer-left">
                <span class="config-count" id="wc-count-ui">Field: <strong>0</strong> nations</span>
                <span id="wc-warning-ui" class="config-warning" style="display:none;"></span>
            </div>
            <button id="wc-start" class="launch-btn">🏆 Start World Cup</button>
        </div>`;

    // Your-nation pick resets participant selection (you must stay in the field).
    document.querySelectorAll('#wc-body .nation-card').forEach(card => {
        card.onclick = () => {
            WC.yourNationId = card.dataset.id;
            WC.participants = [];
            renderWCSetup();
        };
    });
    const othersWrap = document.getElementById('wc-others');
    if (othersWrap) {
        othersWrap.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.onchange = () => {
                if (cb.checked) WC.participants.push(cb.dataset.id);
                else WC.participants = WC.participants.filter(id => id !== cb.dataset.id);
                wcUpdateCount();
            };
        });
    }
    const setOthers = (ids) => {
        WC.participants = ids.slice();
        if (othersWrap) {
            othersWrap.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                const on = WC.participants.indexOf(cb.dataset.id) !== -1;
                cb.checked = on;
                const row = cb.closest('.nation-pick');
                if (row) row.classList.toggle('selected', on);
            });
        }
        wcUpdateCount();
    };
    const selAll = document.getElementById('wc-sel-all');
    if (selAll) selAll.onclick = () => setOthers(others.map(t => t.id));
    const selNone = document.getElementById('wc-sel-none');
    if (selNone) selNone.onclick = () => setOthers([]);
    wcUpdateCount();
}

// A field size works when the qualifiers (top two of each group) can fill a
// power-of-two knockout bracket, with the groups supplying any best
// third-placed teams needed to complete it: valid totals are
// 8, 12, 16, 24, 28, 32, 44 and 48 nations.
function wcFieldSizeValid(total) {
    if (total < 8 || total % 4 !== 0) return false;
    const qualifiers = total / 2;              // winners + runners-up
    let bracketSize = 1;
    while (bracketSize < qualifiers) bracketSize *= 2;
    return (bracketSize - qualifiers) <= total / 4;  // enough thirds exist
}
function wcValidSizes() {
    const sizes = [];
    for (let n = 8; n <= 48; n += 4) if (wcFieldSizeValid(n)) sizes.push(n);
    return sizes;
}
function wcUpdateCount() {
    const total = WC.participants.length + 1;
    const countEl = document.getElementById('wc-count-ui');
    if (countEl) countEl.innerHTML = `Field: <strong>${total}</strong> nations`;
    const warnEl = document.getElementById('wc-warning-ui');
    const startBtn = document.getElementById('wc-start');
    const ok = wcFieldSizeValid(total);
    if (warnEl) {
        if (!ok) {
            warnEl.style.display = '';
            warnEl.textContent = `⚠️ Field must be ${wcValidSizes().join(', ')} nations — currently ${total}.`;
        } else {
            warnEl.style.display = 'none';
        }
    }
    if (startBtn) startBtn.disabled = !ok;
    if (startBtn) startBtn.style.opacity = ok ? '' : '.55';
    if (startBtn) startBtn.style.cursor = ok ? '' : 'not-allowed';

    if (startBtn) {
        startBtn.onclick = () => {
            if (!ok) return;
            startWorldCup();
        };
    }
}

// Distribute teams into balanced groups (serpentine by squad rating).
function wcBuildGroups() {
    const found = wcNationalLeague();
    const all = (found.league.teams || []).filter(t => WC.participants.indexOf(t.id) !== -1 || t.id === WC.yourNationId);
    const sorted = all.slice().sort((a, b) => wcTeamAvg(b) - wcTeamAvg(a));
    const groupCount = sorted.length / 4;
    const groups = [];
    for (let g = 0; g < groupCount; g++) groups.push([]);
    sorted.forEach((t, i) => {
        const row = Math.floor(i / groupCount);
        const pos = i % groupCount;
        const gi = row % 2 === 0 ? pos : (groupCount - 1 - pos);
        groups[gi].push(t.id);
    });
    return groups;
}

function wcGroupFixtures(ids) {
    const list = [...ids];
    const rounds = [];
    for (let r = 0; r < 3; r++) {
        rounds.push([
            { home: list[0], away: list[3] },
            { home: list[1], away: list[2] }
        ]);
        list.splice(1, 0, list.pop());
    }
    return rounds;
}

function startWorldCup() {
    const found = wcNationalLeague();
    const teams = [];
    const ids = WC.participants.concat([WC.yourNationId]);
    (found.league.teams || []).forEach(t => {
        if (ids.indexOf(t.id) === -1) return;
        const c = cloneDeep(t);
        normalizeRoster(c, 80);
        c.points = 0; c.gf = 0; c.ga = 0; c.gd = 0; c.isEliminated = false;
        teams.push(c);
    });

    const groups = wcBuildGroups();
    const groupLetters = groups.map((_, i) => String.fromCharCode(65 + i)); // A, B, C...
    saveState.wcGroups = groups.map((g, i) => ({ letter: groupLetters[i], teamIds: g }));

    // Build the full schedule: 3 group matchdays, then KO rounds are appended live.
    const schedule = [];
    for (let r = 0; r < 3; r++) {
        const round = [];
        groups.forEach(g => round.push(...wcGroupFixtures(g)[r]));
        schedule.push(round);
    }
    const qualifiers = groups.length * 2;
    let bracketSize = 1;
    while (bracketSize < qualifiers) bracketSize *= 2;
    saveState.wcBracketSize = bracketSize;
    saveState.totalMatchdays = 3 + Math.log2(bracketSize);

    saveState.saveName = 'World Cup run';
    saveState.mode = 'national';
    saveState.competitionType = 'worldcup';
    saveState.userTeamId = WC.yourNationId;
    saveState.userLeagueName = 'World Cup';
    saveState.teams = teams;
    saveState.schedule = schedule;
    saveState.currentMatchday = 1;
    saveState.isCompleted = false;
    saveState.challengeGoal = null;

    document.getElementById('modes-screen').style.display = 'none';
    document.getElementById('hub-screen').style.display = 'flex';
    const feedBox = document.getElementById('ticker-feed-box');
    if (feedBox) feedBox.innerHTML = 'Welcome to the World Cup. Group play starts now — hit Simulate Season to run the tournament.';
    refreshHubDashboardUI();
    switchHubPane('table');
}

function wcGroupLetter(teamId) {
    const groups = saveState.wcGroups || [];
    const g = groups.find(gr => gr.teamIds.indexOf(teamId) !== -1);
    return g ? g.letter : null;
}

function wcSortedGroup(group) {
    return group.teamIds.map(id => saveState.teams.find(t => t.id === id))
        .filter(Boolean)
        .sort((a, b) => b.points - a.points || b.gd - a.gd);
}

function wcAliveCount() {
    return saveState.teams.filter(t => !t.isEliminated).length;
}

function wcRoundLabel() {
    const alive = wcAliveCount();
    const map = { 64: 'Round of 64', 32: 'Round of 32', 16: 'Round of 16', 8: 'Quarter-Final', 4: 'Semi-Final', 2: 'Final' };
    return map[alive] || `Knockout Round`;
}

function wcPhaseLabel(md) {
    return md <= 3 ? `Group Stage · Matchday ${md}` : wcRoundLabel();
}

// --- Hub rendering for a World Cup run ---
function renderWorldCupHubUI() {
    const userTeamObj = saveState.teams.find(t => t.id === saveState.userTeamId) || saveState.teams[0];
    if (!userTeamObj) return;
    const md = saveState.currentMatchday;
    const isGroup = md <= 3;

    document.getElementById('hub-user-team').innerText = userTeamObj.name;
    const avatar = document.getElementById('hub-club-avatar');
    if (avatar) avatar.innerText = initialsOf(userTeamObj.name);
    const leagueLine = document.getElementById('hub-competition-line');
    if (leagueLine) leagueLine.innerText = `World Cup · ${saveState.teams.length} nations · ${isGroup ? 'Group Stage' : 'Knockout'}`;

    const posLabel = document.getElementById('hub-pos-label');
    const posValue = document.getElementById('hub-position-ui');
    const ptsLabel = document.getElementById('hub-pts-label');
    const ptsValue = document.getElementById('user-points-ui');
    const gdLabel = document.getElementById('hub-gd-label');
    const gdValue = document.getElementById('hub-gd-ui');

    if (isGroup) {
        const letter = wcGroupLetter(userTeamObj.id);
        const group = (saveState.wcGroups || []).find(g => g.letter === letter);
        const sorted = group ? wcSortedGroup(group) : [];
        const pos = sorted.findIndex(t => t.id === userTeamObj.id) + 1;
        if (posLabel) posLabel.innerText = 'Group';
        if (posValue) posValue.innerText = letter ? `${ordinal(pos)} · Group ${letter}` : ordinal(pos);
        if (ptsLabel) ptsLabel.innerText = 'Points';
        if (ptsValue) ptsValue.innerText = userTeamObj.points;
        if (gdLabel) gdLabel.innerText = 'Goal Diff';
        const gd = userTeamObj.gd;
        if (gdValue) gdValue.innerText = (gd > 0 ? '+' : '') + gd;
    } else {
        if (posLabel) posLabel.innerText = 'Round';
        if (posValue) posValue.innerText = wcRoundLabel();
        if (ptsLabel) ptsLabel.innerText = 'Status';
        if (ptsValue) ptsValue.innerText = userTeamObj.isEliminated ? 'Eliminated' : 'Active';
        if (gdLabel) gdLabel.innerText = 'Teams Left';
        if (gdValue) gdValue.innerText = wcAliveCount();
    }

    const total = saveState.totalMatchdays || 1;
    const played = saveState.isCompleted ? total : Math.min(md - 1, total);
    const pct = Math.max(0, Math.round((played / total) * 100));
    const fill = document.getElementById('hub-progress-fill');
    if (fill) fill.style.width = pct + '%';
    const pctEl = document.getElementById('hub-progress-pct');
    if (pctEl) pctEl.innerText = pct + '%';
    const subEl = document.getElementById('hub-progress-sub');
    if (subEl) subEl.innerHTML = `Matchday <span id="current-matchday-ui">${md}</span> of <span id="total-matchdays-ui">${total}</span> · ${wcPhaseLabel(md)}`;

    const tableTitle = document.getElementById('table-title');
    const tableSub = document.getElementById('table-sub-ui');
    const feedRound = document.getElementById('feed-round-ui');
    const thead = document.getElementById('table-head-ui');
    if (isGroup) {
        if (tableTitle) tableTitle.innerText = 'World Cup — Group Stage';
        if (tableSub) tableSub.innerText = 'Top two of each group advance to the knockout rounds';
        if (feedRound) feedRound.innerText = `Group Stage · Matchday ${md} of 3`;
        if (thead) thead.innerHTML = '';
    } else {
        if (tableTitle) tableTitle.innerText = `World Cup — ${wcRoundLabel()}`;
        if (tableSub) tableSub.innerText = `Single elimination · ${wcAliveCount()} nations remain`;
        if (feedRound) feedRound.innerText = `${wcRoundLabel()} · Match ${md - 3} of ${total - 3}`;
        if (thead) thead.innerHTML = '<tr><th>Match</th><th>Home</th><th></th><th>Away</th></tr>';
    }

    const exitBtn = document.getElementById('save-exit-btn');
    if (exitBtn) exitBtn.innerText = '🚪 End Run · not saved';

    renderWCTable();
    renderLeaderboardCharts();
}

function renderWCTable() {
    const tbody = document.getElementById('league-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    const md = saveState.currentMatchday;

    if (md <= 3) {
        // Group standings, one block per group.
        (saveState.wcGroups || []).forEach(group => {
            const sorted = wcSortedGroup(group);
            const sep = document.createElement('tr');
            sep.className = 'group-sep-row';
            sep.innerHTML = `<td colspan="4">Group ${group.letter}</td>`;
            tbody.appendChild(sep);
            sorted.forEach((t, i) => {
                const tr = document.createElement('tr');
                if (t.id === saveState.userTeamId) tr.className = 'user-row';
                tr.innerHTML = `
                    <td>${i + 1}</td>
                    <td class="clickable-row-team"><strong>${esc(t.name)}</strong> ${t.id === saveState.userTeamId ? '<span class="you-star">⭐</span>' : ''} ${i < 2 ? '<span class="qual-tag">adv</span>' : ''}</td>
                    <td>${t.gd > 0 ? '+' : ''}${t.gd}</td>
                    <td><strong>${t.points}</strong></td>`;
                tr.querySelector('.clickable-row-team').onclick = () => launchProfileModal(t);
                tbody.appendChild(tr);
            });
        });
        return;
    }

    // Knockout bracket for this round.
    const currentFixtures = saveState.schedule[md - 1];
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

// --- World Cup advance engine ---
function wcComputeQualifiers() {
    // After the 3rd group matchday: group winners and runners-up advance.
    // When those can't fill a power-of-two bracket by themselves (bigger
    // fields), the best third-placed teams complete the round — 48 nations
    // = 12 groups -> 24 + 8 best thirds -> Round of 32, like the real WC.
    const groups = saveState.wcGroups || [];
    const gCount = groups.length;
    const qualifiers = gCount * 2;                    // winners + runners-up
    let bracketSize = 1;
    while (bracketSize < qualifiers) bracketSize *= 2;
    const needThirds = bracketSize - qualifiers;

    const winners = [];
    const runnersUp = [];
    const thirds = [];
    const sortedPer = [];
    groups.forEach(group => {
        const sorted = wcSortedGroup(group);
        sortedPer.push(sorted);
        sorted.forEach((t, rank) => { if (rank >= 3) t.isEliminated = true; });
        winners.push(sorted[0]);
        runnersUp.push(sorted[1]);
        thirds.push(sorted[2]);
    });

    const round = [];
    if (needThirds === 0) {
        // Classic Mini WC seeding: group winner vs next group's runner-up.
        thirds.forEach(t => t.isEliminated = true);
        groups.forEach((group, i) => {
            const nextGroup = groups[(i + 1) % gCount];
            const nextSorted = wcSortedGroup(nextGroup);
            round.push({ home: sortedPer[i][0].id, away: nextSorted[1].id });
        });
    } else {
        // Fill the bracket with the best third-placed teams, then rank the
        // whole pool (winners, runners-up, best thirds by points) and pair
        // strongest vs weakest so group winners stay apart.
        const advancing = thirds
            .slice()
            .sort((a, b) => b.points - a.points || b.gd - a.gd)
            .slice(0, needThirds);
        const eliminated = thirds.filter(t => advancing.indexOf(t) === -1);
        eliminated.forEach(t => t.isEliminated = true);
        const byPts = arr => arr.slice().sort((a, b) => b.points - a.points || b.gd - a.gd);
        const pool = byPts(winners).concat(byPts(runnersUp), advancing);
        for (let i = 0; i < pool.length / 2; i++) {
            round.push({ home: pool[i].id, away: pool[pool.length - 1 - i].id });
        }
    }
    saveState.schedule.push(round);
}

function performWorldCupAdvance() {
    const md = saveState.currentMatchday;
    const roundIndex = md - 1;
    const matches = saveState.schedule[roundIndex];

    if (!matches || matches.length === 0) {
        saveState.isCompleted = true;
        triggerEndgameModalDisplay();
        return;
    }

    const feedBox = document.getElementById('ticker-feed-box');
    feedBox.innerHTML = `<strong>--- ${wcPhaseLabel(md).toUpperCase()} LOGS ---</strong><br>`;

    let userHtml = '';
    let basicHtml = '';
    const winners = [];

    matches.forEach(match => {
        const homeTeam = saveState.teams.find(t => t.id === match.home);
        const awayTeam = saveState.teams.find(t => t.id === match.away);
        if (!homeTeam || !awayTeam) return;
        // Knockout rounds sharpen the quality gap so weaker nations can't luck
        // past elite sides in a single game.
        const sim = runFixtureSimulation(homeTeam, awayTeam, md > 3 ? 1.5 : 1);
        const isUser = homeTeam.id === saveState.userTeamId || awayTeam.id === saveState.userTeamId;

        let html = isUser
            ? `<div class="user-match-log" style="background: linear-gradient(90deg, rgba(124,77,255,0.25) 0%, rgba(0,0,0,0) 100%); padding: 10px 14px; border-left: 4px solid #7c4dff; margin: 8px 0; border-radius: 6px;"><strong>⭐ ${sim.text}</strong>`
            : `<div class="standard-match-log" style="padding: 6px 12px; margin: 4px 0; border-bottom: 1px solid #1c1635;">${sim.text}`;

        if (sim.details.scorersA.length) html += `<br><span style="font-size:0.85rem; color:#aaa4c4;">&nbsp;&nbsp; Goals [Home]: ${sim.details.scorersA.join(', ')}</span>`;
        if (sim.details.scorersB.length) html += `<br><span style="font-size:0.85rem; color:#aaa4c4;">&nbsp;&nbsp; Goals [Away]: ${sim.details.scorersB.join(', ')}</span>`;

        if (md > 3) {
            if (sim.details.goalsA === sim.details.goalsB) {
                if (Math.random() < shootoutWinnerProbability(homeTeam, awayTeam)) {
                    html += `<br>&nbsp;&nbsp; 🏆 ${homeTeam.name} win on Penalties!`;
                    winners.push(homeTeam);
                    awayTeam.isEliminated = true;
                } else {
                    html += `<br>&nbsp;&nbsp; 🏆 ${awayTeam.name} win on Penalties!`;
                    winners.push(awayTeam);
                    homeTeam.isEliminated = true;
                }
            } else if (sim.details.goalsA > sim.details.goalsB) {
                winners.push(homeTeam);
                awayTeam.isEliminated = true;
            } else {
                winners.push(awayTeam);
                homeTeam.isEliminated = true;
            }
        }
        html += `</div>`;
        if (isUser) userHtml += html;
        else basicHtml += html;
    });

    feedBox.innerHTML += userHtml + basicHtml;
    if (typeof scrollFeedToBottom === 'function') scrollFeedToBottom();
    // Only jump to the feed on a manual Step; during auto-sim let the player
    // keep browsing the table/bracket and stats tabs.
    if (typeof isAutoSimRunning === 'function' && !isAutoSimRunning()) switchHubPane('feed');

    if (md <= 3) {
        if (md === 3) wcComputeQualifiers();
        saveState.currentMatchday++;
    } else {
        if (winners.length === 1) {
            saveState.isCompleted = true;
            refreshHubDashboardUI();
            setTimeout(() => triggerEndgameModalDisplay(), 300);
            return;
        }
        const nextRound = [];
        for (let i = 0; i < winners.length; i += 2) {
            nextRound.push({ home: winners[i].id, away: winners[i + 1] ? winners[i + 1].id : winners[i].id });
        }
        saveState.schedule.push(nextRound);
        saveState.currentMatchday++;
    }

    refreshHubDashboardUI();
}
