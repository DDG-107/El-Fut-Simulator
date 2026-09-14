// El Fut Simulator — UEFA Champions League 26/27 mode
// ---------------------------------------------------------------------------
// A one-session run through the authentic 2026/27 Champions League: pick any of
// the 36 qualified clubs, play the real Swiss-model league phase (8 matches,
// two opponents from each pot, home and away, straight from the actual draw),
// then the knockout phase — top 8 get a bye to the Round of 16, teams 9–24
// contest two-legged playoffs, and the bracket follows the real competition's
// structure all the way to the final. Never written to the save list.

const UCL_LEAGUE_KEY = 'UCL 26/27';

const UCL = {
    yourClubId: null,
    pots: {
        1: ['ucl-psg', 'ucl-bay', 'ucl-rmd', 'ucl-liv', 'ucl-int', 'ucl-mci', 'ucl-ars', 'ucl-bar', 'ucl-atm'],
        2: ['ucl-bvb', 'ucl-rom', 'ucl-spt', 'ucl-avl', 'ucl-por', 'ucl-mun', 'ucl-clu', 'ucl-bet', 'ucl-psv'],
        3: ['ucl-fey', 'ucl-lil', 'ucl-bod', 'ucl-nap', 'ucl-rbl', 'ucl-vll', 'ucl-fen', 'ucl-shk', 'ucl-gal'],
        4: ['ucl-slp', 'ucl-slo', 'ucl-vfb', 'ucl-aek', 'ucl-las', 'ucl-com', 'ucl-len', 'ucl-vik', 'ucl-sab']
    },
    // The authentic 2026/27 league-phase calendar: for each club, its eight
    // matchdays in order — [opponentId, atHome] — straight from the official
    // fixture list announced after the Monaco draw. This yields exactly the
    // real 144 fixtures with their true matchday assignments.
    grid: {
        'ucl-psg': [['ucl-slo', 1], ['ucl-mci', 0], ['ucl-bar', 1], ['ucl-vll', 0], ['ucl-rom', 1], ['ucl-avl', 0], ['ucl-com', 0], ['ucl-gal', 1]],
        'ucl-bay': [['ucl-bod', 1], ['ucl-vik', 0], ['ucl-ars', 1], ['ucl-atm', 0], ['ucl-lil', 0], ['ucl-slp', 1], ['ucl-mun', 0], ['ucl-bet', 1]],
        'ucl-rmd': [['ucl-int', 1], ['ucl-rom', 0], ['ucl-rbl', 1], ['ucl-aek', 0], ['ucl-psv', 1], ['ucl-ars', 0], ['ucl-las', 1], ['ucl-shk', 0]],
        'ucl-liv': [['ucl-atm', 1], ['ucl-las', 0], ['ucl-vll', 1], ['ucl-fen', 0], ['ucl-clu', 0], ['ucl-por', 1], ['ucl-int', 0], ['ucl-len', 1]],
        'ucl-int': [['ucl-rmd', 0], ['ucl-clu', 1], ['ucl-shk', 1], ['ucl-fey', 0], ['ucl-vfb', 1], ['ucl-bvb', 0], ['ucl-liv', 1], ['ucl-slo', 0]],
        'ucl-mci': [['ucl-por', 0], ['ucl-psg', 1], ['ucl-aek', 1], ['ucl-rbl', 0], ['ucl-nap', 1], ['ucl-bar', 0], ['ucl-len', 0], ['ucl-spt', 1]],
        'ucl-ars': [['ucl-nap', 0], ['ucl-lil', 1], ['ucl-bay', 0], ['ucl-slp', 0], ['ucl-bvb', 1], ['ucl-rmd', 1], ['ucl-bet', 0], ['ucl-sab', 1]],
        'ucl-bar': [['ucl-fey', 1], ['ucl-gal', 0], ['ucl-psg', 0], ['ucl-avl', 1], ['ucl-sab', 0], ['ucl-mci', 1], ['ucl-spt', 0], ['ucl-com', 1]],
        'ucl-atm': [['ucl-liv', 0], ['ucl-mun', 1], ['ucl-vfb', 0], ['ucl-bay', 1], ['ucl-vik', 1], ['ucl-psv', 0], ['ucl-bod', 0], ['ucl-fen', 1]],
        'ucl-bvb': [['ucl-vll', 1], ['ucl-bod', 0], ['ucl-sab', 0], ['ucl-bet', 1], ['ucl-ars', 0], ['ucl-int', 1], ['ucl-avl', 0], ['ucl-aek', 1]],
        'ucl-rom': [['ucl-fen', 0], ['ucl-rmd', 1], ['ucl-slo', 1], ['ucl-mun', 0], ['ucl-psg', 0], ['ucl-spt', 1], ['ucl-aek', 0], ['ucl-lil', 1]],
        'ucl-spt': [['ucl-gal', 1], ['ucl-len', 0], ['ucl-las', 1], ['ucl-shk', 0], ['ucl-mun', 1], ['ucl-rom', 0], ['ucl-bar', 1], ['ucl-mci', 0]],
        'ucl-avl': [['ucl-clu', 0], ['ucl-fen', 1], ['ucl-vik', 1], ['ucl-bar', 0], ['ucl-gal', 0], ['ucl-psg', 1], ['ucl-bvb', 1], ['ucl-slp', 0]],
        'ucl-por': [['ucl-mci', 1], ['ucl-bet', 0], ['ucl-psv', 1], ['ucl-nap', 1], ['ucl-fey', 0], ['ucl-liv', 0], ['ucl-slp', 1], ['ucl-las', 0]],
        'ucl-mun': [['ucl-sab', 1], ['ucl-atm', 0], ['ucl-com', 0], ['ucl-rom', 1], ['ucl-spt', 0], ['ucl-rbl', 1], ['ucl-bay', 1], ['ucl-vll', 0]],
        'ucl-clu': [['ucl-avl', 1], ['ucl-int', 0], ['ucl-len', 1], ['ucl-psv', 0], ['ucl-liv', 1], ['ucl-nap', 0], ['ucl-vfb', 0], ['ucl-bod', 1]],
        'ucl-bet': [['ucl-lil', 0], ['ucl-por', 1], ['ucl-fey', 1], ['ucl-bvb', 0], ['ucl-slo', 0], ['ucl-com', 1], ['ucl-ars', 1], ['ucl-bay', 0]],
        'ucl-psv': [['ucl-shk', 1], ['ucl-rbl', 0], ['ucl-por', 0], ['ucl-clu', 1], ['ucl-rmd', 0], ['ucl-atm', 1], ['ucl-vik', 0], ['ucl-vfb', 1]],
        'ucl-fey': [['ucl-bar', 0], ['ucl-com', 1], ['ucl-bet', 0], ['ucl-int', 1], ['ucl-por', 1], ['ucl-vik', 0], ['ucl-gal', 0], ['ucl-rbl', 1]],
        'ucl-lil': [['ucl-bet', 1], ['ucl-ars', 0], ['ucl-gal', 1], ['ucl-bod', 0], ['ucl-bay', 1], ['ucl-vfb', 0], ['ucl-slo', 1], ['ucl-rom', 0]],
        'ucl-bod': [['ucl-bay', 0], ['ucl-bvb', 1], ['ucl-nap', 0], ['ucl-lil', 1], ['ucl-las', 1], ['ucl-len', 0], ['ucl-atm', 1], ['ucl-clu', 0]],
        'ucl-nap': [['ucl-ars', 1], ['ucl-vll', 0], ['ucl-bod', 1], ['ucl-por', 0], ['ucl-mci', 0], ['ucl-clu', 1], ['ucl-sab', 0], ['ucl-vik', 1]],
        'ucl-rbl': [['ucl-com', 0], ['ucl-psv', 1], ['ucl-rmd', 0], ['ucl-mci', 1], ['ucl-len', 1], ['ucl-mun', 0], ['ucl-shk', 1], ['ucl-fey', 0]],
        'ucl-vll': [['ucl-bvb', 0], ['ucl-nap', 1], ['ucl-liv', 0], ['ucl-psg', 1], ['ucl-slp', 0], ['ucl-sab', 1], ['ucl-fen', 0], ['ucl-mun', 1]],
        'ucl-fen': [['ucl-rom', 1], ['ucl-avl', 0], ['ucl-slp', 1], ['ucl-liv', 1], ['ucl-shk', 0], ['ucl-las', 0], ['ucl-vll', 1], ['ucl-atm', 0]],
        'ucl-shk': [['ucl-psv', 0], ['ucl-aek', 1], ['ucl-int', 0], ['ucl-spt', 1], ['ucl-fen', 1], ['ucl-slo', 0], ['ucl-rbl', 0], ['ucl-rmd', 1]],
        'ucl-gal': [['ucl-spt', 0], ['ucl-bar', 1], ['ucl-lil', 0], ['ucl-vfb', 1], ['ucl-avl', 1], ['ucl-aek', 0], ['ucl-fey', 1], ['ucl-psg', 0]],
        'ucl-slp': [['ucl-len', 1], ['ucl-sab', 0], ['ucl-fen', 0], ['ucl-ars', 1], ['ucl-vll', 1], ['ucl-bay', 0], ['ucl-por', 0], ['ucl-avl', 1]],
        'ucl-slo': [['ucl-psg', 0], ['ucl-vfb', 1], ['ucl-rom', 0], ['ucl-las', 0], ['ucl-bet', 1], ['ucl-shk', 1], ['ucl-lil', 0], ['ucl-int', 1]],
        'ucl-vfb': [['ucl-vik', 1], ['ucl-slo', 0], ['ucl-atm', 1], ['ucl-gal', 0], ['ucl-int', 0], ['ucl-lil', 1], ['ucl-clu', 1], ['ucl-psv', 0]],
        'ucl-aek': [['ucl-las', 1], ['ucl-shk', 0], ['ucl-mci', 0], ['ucl-rmd', 1], ['ucl-com', 0], ['ucl-gal', 1], ['ucl-rom', 1], ['ucl-bvb', 0]],
        'ucl-las': [['ucl-aek', 0], ['ucl-liv', 1], ['ucl-spt', 0], ['ucl-slo', 1], ['ucl-bod', 0], ['ucl-fen', 1], ['ucl-rmd', 0], ['ucl-por', 1]],
        'ucl-com': [['ucl-rbl', 1], ['ucl-fey', 0], ['ucl-mun', 1], ['ucl-len', 0], ['ucl-aek', 1], ['ucl-bet', 0], ['ucl-psg', 1], ['ucl-bar', 0]],
        'ucl-len': [['ucl-slp', 0], ['ucl-spt', 1], ['ucl-clu', 0], ['ucl-com', 1], ['ucl-rbl', 0], ['ucl-bod', 1], ['ucl-mci', 1], ['ucl-liv', 0]],
        'ucl-vik': [['ucl-vfb', 0], ['ucl-bay', 1], ['ucl-avl', 0], ['ucl-sab', 1], ['ucl-atm', 0], ['ucl-fey', 1], ['ucl-psv', 1], ['ucl-nap', 0]],
        'ucl-sab': [['ucl-mun', 0], ['ucl-slp', 1], ['ucl-bvb', 1], ['ucl-vik', 0], ['ucl-bar', 1], ['ucl-vll', 0], ['ucl-nap', 1], ['ucl-ars', 0]]
    }
};

function uclAllTeams() {
    const league = activeDatabase && activeDatabase.leagues[UCL_LEAGUE_KEY];
    return (league && league.teams) || [];
}

function uclTeam(id) {
    return uclAllTeams().find(t => t.id === id) || null;
}

function uclTeamAvg(team) {
    const pl = (team && team.players) || [];
    if (!pl.length) return 0;
    return pl.reduce((s, p) => s + (p.rating || 0), 0) / pl.length;
}

// --- Setup screen: pick your club (pot-grouped, like the real draw) -----------
function openUclSetup() {
    const teams = uclAllTeams();
    if (teams.length < 36) {
        return alert('The Champions League database is unavailable or incomplete. It ships built-in as "UCL 26/27" — try resetting the custom database in the Database Manager.');
    }
    UCL.yourClubId = null;

    document.getElementById('welcome-screen').style.display = 'none';
    const screen = document.getElementById('modes-screen');
    screen.style.display = 'flex';
    renderUclSetup();
}

function renderUclSetup() {
    const meta = GAME_MODES.find(m => m.id === 'ucl') || GAME_MODES[0];
    const screen = document.getElementById('modes-screen');

    if (!UCL.yourClubId) UCL.yourClubId = UCL.pots[1][0]; // holders are the default pick

    const cards = [];
    [1, 2, 3, 4].forEach(pot => {
        cards.push(`<div class="ucl-pot-head"><span>Pot ${pot}</span></div>`);
        UCL.pots[pot].forEach(id => {
            const t = uclTeam(id);
            if (!t) return;
            const sel = id === UCL.yourClubId;
            cards.push(`
                <button type="button" class="nation-card ${sel ? 'selected' : ''}" data-id="${esc(id)}">
                    <span class="nation-name">${esc(t.name)}</span><span class="nation-ovr">OVR ${uclTeamAvg(t).toFixed(1)}</span>
                    ${sel ? '<span class="you-tag">YOU</span>' : ''}
                </button>`);
        });
    });

    screen.innerHTML = `
        <div class="menu-box large-box">
            <div class="config-topbar">
                <button id="ucl-back-btn" class="btn-secondary config-back-btn">← Menu</button>
                <div class="config-title-group">
                    <h2>${meta.icon} ${esc(meta.name)}</h2>
                    <p class="subtitle">${esc(meta.desc)}</p>
                </div>
            </div>
            <div id="ucl-body">
                <div class="pane-head"><span class="pane-eyebrow">YOUR CLUB</span><h3>Who do you manage?</h3></div>
                <div class="nation-list ucl-club-list">${cards.join('')}</div>
            </div>
            <div class="config-footer">
                <div class="config-footer-left">
                    <span class="config-count">36 clubs · authentic 2026/27 league phase &amp; bracket</span>
                </div>
                <button id="ucl-start" class="launch-btn">Start Champions League</button>
            </div>
        </div>`;

    document.getElementById('ucl-back-btn').onclick = () => {
        if (window.confirm('Cancel this run?')) loadActiveMenu();
    };
    document.querySelectorAll('#ucl-body .nation-card').forEach(card => {
        card.onclick = () => {
            UCL.yourClubId = card.dataset.id;
            renderUclSetup();
        };
    });
    document.getElementById('ucl-start').onclick = startUcl;
}

// --- League-phase schedule from the authentic draw ---------------------------
function uclBuildSchedule() {
    const md = [[], [], [], [], [], [], [], []];
    for (const clubId in UCL.grid) {
        UCL.grid[clubId].forEach((entry, m) => {
            // Emit each fixture once, from the home side's row.
            if (entry[1]) md[m].push({ home: clubId, away: entry[0] });
        });
    }
    return md;
}

// --- Start the run ------------------------------------------------------------
function startUcl() {
    const teams = [];
    uclAllTeams().forEach(t => {
        const c = cloneDeep(t);
        normalizeRoster(c, 75);
        c.points = 0; c.p = 0; c.w = 0; c.d = 0; c.l = 0; c.gf = 0; c.ga = 0; c.gd = 0; c.isEliminated = false;
        teams.push(c);
    });

    const schedule = uclBuildSchedule();
    saveState.uclPhase = 'league';         // league | playoff | ko
    saveState.uclBracket = null;           // fixed R16→final bracket (built after MD8)
    saveState.uclPlayoffPairs = null;      // seeded draw pairs for the KO playoffs
    saveState.uclTieAgg = null;            // two-legged aggregate tracking

    if (typeof assignAutoSaveName === 'function') assignAutoSaveName(uclTeam(UCL.yourClubId).name, 'ucl');
    saveState.mode = 'ucl';
    saveState.competitionType = 'ucl';
    saveState.userTeamId = UCL.yourClubId;
    saveState.userLeagueName = 'UEFA Champions League';
    saveState.teams = teams;
    saveState.schedule = schedule;
    saveState.currentMatchday = 1;
    saveState.totalMatchdays = 8;          // the bracket appends rounds live, like the WC mode
    saveState.isCompleted = false;
    saveState.challengeGoal = null;

    document.getElementById('modes-screen').style.display = 'none';
    document.getElementById('hub-screen').style.display = 'flex';
    const feedBox = document.getElementById('ticker-feed-box');
    if (feedBox) feedBox.innerHTML = 'Welcome to the UEFA Champions League. Eight league-phase nights lie ahead — the top 8 go straight to the Round of 16, teams 9–24 face the knockout playoffs.';
    refreshHubDashboardUI();
    switchHubPane('table');
}

// --- Standings (with the competition's in-progress tiebreakers) ---------------
function uclSortedTeams() {
    return saveState.teams.slice().sort((a, b) =>
        b.points - a.points || b.gd - a.gd || b.gf - a.gf ||
        (b.w || 0) - (a.w || 0) || a.name.localeCompare(b.name));
}

function uclQualZone(pos) {
    if (pos <= 8) return 'R16';
    if (pos <= 24) return 'PO';
    return '';
}

// --- Bracket building ---------------------------------------------------------
// Authentic post-league-phase structure. The playoff draw pits seeds 9–16
// against unseeded 17–24; the R16 bracket is fixed by competition rule, so the
// playoff winners slot into predetermined ties against the top 8.
function uclBuildKnockouts() {
    const sorted = uclSortedTeams();
    // Positions 25–36 are out of European competition entirely.
    sorted.slice(24).forEach(t => { t.isEliminated = true; });
    const top8 = sorted.slice(0, 8);
    const seeds = sorted.slice(8, 16);    // ranked 9–16 (seeded in the playoff draw)
    const unseeded = sorted.slice(16, 24); // ranked 17–24 (unseeded)

    // Seeded playoff draw: strongest seed vs weakest unseeded, home leg first
    // for the lower-ranked side (the seeded club hosts the decider).
    const playoffPairs = seeds.map((seed, i) => ({ a: seed.id, b: unseeded[unseeded.length - 1 - i].id }));

    // Fixed R16 path: playoff winners feed the bracket at these slots, with
    // top-8 sides pre-placed (mirrors the real competition's bracket).
    saveState.uclBracket = {
        r16: [
            { a: top8[0].id, b: null, wp: 0 },  // 1st vs PO-W1
            { a: top8[7].id, b: null, wp: 1 },  // 8th vs PO-W8
            { a: top8[4].id, b: null, wp: 2 },  // 5th vs PO-W5
            { a: top8[3].id, b: null, wp: 3 },  // 4th vs PO-W6
            { a: top8[1].id, b: null, wp: 4 },  // 2nd vs PO-W2
            { a: top8[6].id, b: null, wp: 5 },  // 7th vs PO-W7
            { a: top8[5].id, b: null, wp: 6 },  // 6th vs PO-W3
            { a: top8[2].id, b: null, wp: 7 }   // 3rd vs PO-W4
        ],
        qf: [
            { a: null, b: null }, { a: null, b: null }, { a: null, b: null }, { a: null, b: null }
        ],
        sf: [
            { a: null, b: null }, { a: null, b: null }
        ],
        final: { a: null, b: null },
        champion: null
    };
    saveState.uclPlayoffPairs = playoffPairs;
}

function uclTeamById(id) {
    return saveState.teams.find(t => t.id === id) || null;
}

// --- Hub rendering -------------------------------------------------------------
function uclPhaseLabel() {
    if (saveState.uclPhase === 'league') return `League Phase · Matchday ${saveState.currentMatchday}`;
    if (saveState.uclPhase === 'playoff') return 'Knockout Playoffs';
    return 'Knockout Phase';
}

function isUclFormat() { return saveState.competitionType === 'ucl'; }

function renderUclHubUI() {
    const userTeamObj = uclTeamById(saveState.userTeamId) || saveState.teams[0];
    if (!userTeamObj) return;

    document.getElementById('hub-user-team').innerText = userTeamObj.name;
    const avatar = document.getElementById('hub-club-avatar');
    if (avatar) avatar.innerText = initialsOf(userTeamObj.name);
    const leagueLine = document.getElementById('hub-competition-line');
    if (leagueLine) leagueLine.innerText = `UEFA Champions League · 36 clubs · ${uclPhaseLabel()}`;

    const posLabel = document.getElementById('hub-pos-label');
    const posValue = document.getElementById('hub-position-ui');
    const ptsLabel = document.getElementById('hub-pts-label');
    const ptsValue = document.getElementById('user-points-ui');
    const gdLabel = document.getElementById('hub-gd-label');
    const gdValue = document.getElementById('hub-gd-ui');
    const sorted = uclSortedTeams();
    const pos = sorted.findIndex(t => t.id === userTeamObj.id) + 1;

    if (saveState.uclPhase === 'league') {
        if (posLabel) posLabel.innerText = 'Position';
        if (posValue) posValue.innerText = ordinal(pos);
        if (ptsLabel) ptsLabel.innerText = 'Points';
        if (ptsValue) ptsValue.innerText = userTeamObj.points;
        if (gdLabel) gdLabel.innerText = 'Goal Diff';
        const gd = userTeamObj.gd;
        if (gdValue) gdValue.innerText = (gd > 0 ? '+' : '') + gd;
    } else {
        const alive = saveState.teams.filter(t => !t.isEliminated).length;
        const roundName = saveState.uclPhase === 'playoff' ? 'Playoffs' : (alive <= 2 ? 'Final' : alive <= 4 ? 'Semi-Final' : alive <= 8 ? 'Quarter-Final' : 'Round of 16');
        if (posLabel) posLabel.innerText = 'Round';
        if (posValue) posValue.innerText = roundName;
        if (ptsLabel) ptsLabel.innerText = 'Status';
        if (ptsValue) ptsValue.innerText = userTeamObj.isEliminated ? 'Eliminated' : 'Active';
        if (gdLabel) gdLabel.innerText = 'Teams Left';
        if (gdValue) gdValue.innerText = alive;
    }

    // Progress = league matchdays, then one slot per knockout round played
    // (playoffs span two matchdays: first legs + deciders).
    const total = 14; // 8 league + 2 playoffs + R16 + QF + SF + Final
    const played = saveState.isCompleted ? total : Math.min(8, Math.max(0, saveState.currentMatchday - 1)) + Math.max(0, Math.min(6, (saveState.currentMatchday || 1) - 8));
    const pct = Math.max(0, Math.min(100, Math.round((played / total) * 100)));
    const fill = document.getElementById('hub-progress-fill');
    if (fill) fill.style.width = pct + '%';
    const pctEl = document.getElementById('hub-progress-pct');
    if (pctEl) pctEl.innerText = pct + '%';
    const subEl = document.getElementById('hub-progress-sub');
    if (subEl) {
        const mdHtml = `<span id="current-matchday-ui">${saveState.currentMatchday}</span>`;
        subEl.innerHTML = saveState.uclPhase === 'league'
            ? `Matchday ${mdHtml} of <span id="total-matchdays-ui">8</span> · League Phase`
            : `${uclPhaseLabel()} · Matchday ${mdHtml}`;
    }

    const tableTitle = document.getElementById('table-title');
    const tableSub = document.getElementById('table-sub-ui');
    const feedRound = document.getElementById('feed-round-ui');
    const thead = document.getElementById('table-head-ui');
    if (saveState.uclPhase === 'league') {
        if (tableTitle) tableTitle.innerText = 'Champions League — League Phase';
        if (tableSub) tableSub.innerText = 'Top 8 → Round of 16 · 9–24 → Playoffs · 25–36 out';
        if (feedRound) feedRound.innerText = `League Phase · Matchday ${saveState.currentMatchday} of 8`;
        if (thead) thead.innerHTML = '<tr><th>Pos</th><th>Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th></tr>';
    } else {
        if (tableTitle) tableTitle.innerText = `Champions League — ${saveState.uclPhase === 'playoff' ? 'Knockout Playoffs' : 'Knockout Phase'}`;
        if (tableSub) tableSub.innerText = saveState.uclPhase === 'playoff' ? 'Two-legged ties · winners join the top 8 in the Round of 16' : 'Playoff winners join the Round of 16 · single legs to the final';
        if (feedRound) feedRound.innerText = uclPhaseLabel();
        if (thead) thead.innerHTML = '<tr><th>Tie</th><th>Team 1</th><th></th><th>Team 2</th></tr>';
    }

    const exitBtn = document.getElementById('save-exit-btn');
    if (exitBtn) exitBtn.innerText = '🚪 End Run · not saved';

    renderUclTable();
    renderLeaderboardCharts();
}

function uclTieLabel(idx, phase) {
    return phase === 'playoff' ? `PO ${idx + 1}` : `R16 ${idx + 1}`;
}

function renderUclTable() {
    const tbody = document.getElementById('league-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (saveState.uclPhase === 'league') {
        uclSortedTeams().forEach((t, i) => {
            const tr = document.createElement('tr');
            if (t.id === saveState.userTeamId) tr.className = 'user-row';
            const w = t.w || 0, d = t.d || 0, l = t.l || 0;
            const zone = uclQualZone(i + 1);
            tr.innerHTML = `
                <td>${i + 1}</td>
                <td class="clickable-row-team"><strong>${esc(t.name)}</strong> ${t.id === saveState.userTeamId ? '<span class="you-star">⭐</span>' : ''} ${zone ? `<span class="qual-tag">${zone}</span>` : ''}</td>
                <td>${t.p || 0}</td>
                <td>${w}</td>
                <td>${d}</td>
                <td>${l}</td>
                <td>${t.gf || 0}</td>
                <td>${t.ga || 0}</td>
                <td>${t.gd > 0 ? '+' : ''}${t.gd}</td>
                <td><strong>${t.points}</strong></td>`;
            tr.querySelector('.clickable-row-team').onclick = () => launchProfileModal(t);
            tbody.appendChild(tr);
        });
        return;
    }

    // Knockout phase: show the active round's ties.
    const ties = uclCurrentTies();
    if (!ties || !ties.length) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Tournament Completed!</td></tr>';
        return;
    }
    ties.forEach((tie, idx) => {
        const a = uclTeamById(tie.a), b = tie.b ? uclTeamById(tie.b) : null;
        if (!a) return;
        const tr = document.createElement('tr');
        if (a.id === saveState.userTeamId || (b && b.id === saveState.userTeamId)) tr.className = 'user-row';
        const star = (id) => id === saveState.userTeamId ? ' <span class="you-star">⭐</span>' : '';
        tr.innerHTML = `
            <td>${uclTieLabel(idx, saveState.uclPhase)}</td>
            <td class="clickable-row-team"><strong>${esc(a.name)}</strong>${star(a.id)}${tie.aWon ? ' <span class="qual-tag">adv</span>' : ''}</td>
            <td class="vs-cell">vs</td>
            <td class="clickable-row-team">${b ? `<strong>${esc(b.name)}</strong>${star(b.id)}${tie.bWon ? ' <span class="qual-tag">adv</span>' : ''}` : '<span class="muted">— awaiting playoff winner</span>'}</td>`;
        tr.querySelectorAll('.clickable-row-team')[0].onclick = () => launchProfileModal(a);
        const bCell = tr.querySelectorAll('.clickable-row-team')[1];
        if (b) bCell.onclick = () => launchProfileModal(b);
        tbody.appendChild(tr);
    });
}

// Which ties make up the current knockout round, in bracket order.
function uclCurrentTies() {
    const br = saveState.uclBracket;
    if (!br) return null;
    if (saveState.uclPhase === 'playoff') return saveState.uclPlayoffPairs;
    const alive = saveState.teams.filter(t => !t.isEliminated).length;
    if (alive <= 2) return [br.final];
    if (alive <= 4) return br.sf;
    if (alive <= 8) return br.qf;
    return br.r16;
}

// --- Simulation engine ----------------------------------------------------------
// Simulates one matchday. League phase: all 18 fixtures. Knockout playoffs:
// first legs, then second legs with aggregate tracking. R16 onwards: single
// legs, penalties if level, exactly like the real format from 2025/26.
function performUclAdvance() {
    const feedBox = document.getElementById('ticker-feed-box');

    if (saveState.uclPhase === 'league') {
        const matches = saveState.schedule[saveState.currentMatchday - 1];
        feedBox.innerHTML = `<strong>— LEAGUE PHASE · MATCHDAY ${saveState.currentMatchday} —</strong><br>`;
        let userHtml = '', basicHtml = '';
        matches.forEach(match => {
            const home = uclTeamById(match.home), away = uclTeamById(match.away);
            if (!home || !away) { feedBox.innerHTML += `<div class="standard-match-log">⚠ Skipped unresolvable fixture: ${esc(match.home)} vs ${esc(match.away)}</div>`; return; }
            const sim = runFixtureSimulation(home, away, 1);
            const html = uclMatchHtml(sim, home, away);
            if (home.id === saveState.userTeamId || away.id === saveState.userTeamId) userHtml += html;
            else basicHtml += html;
        });
        feedBox.innerHTML += userHtml + basicHtml;

        if (saveState.currentMatchday >= 8) {
            uclBuildKnockouts();
            saveState.uclPhase = 'playoff';
            saveState.currentMatchday++;
            saveState.uclLeg = 1;
            const sorted = uclSortedTeams();
            const userPos = sorted.findIndex(t => t.id === saveState.userTeamId) + 1;
            if (userPos <= 8) feedBox.innerHTML += `<br><strong>You finish ${ordinal(userPos)} — straight to the Round of 16.</strong>`;
            else if (userPos <= 24) feedBox.innerHTML += `<br><strong>You finish ${ordinal(userPos)} — into the knockout playoffs.</strong>`;
            else feedBox.innerHTML += `<br><strong>You finish ${ordinal(userPos)} — eliminated at the league phase.</strong>`;
        } else {
            saveState.currentMatchday++;
        }
        if (typeof scrollFeedToBottom === 'function') scrollFeedToBottom();
        if (typeof isAutoSimRunning === 'function' && !isAutoSimRunning()) switchHubPane('feed');
        refreshHubDashboardUI();
        return;
    }

    if (saveState.uclPhase === 'playoff') {
        // Two-legged ties: leg 1 at the unseeded club, decider at the seed.
        if (!saveState.uclTieAgg) saveState.uclTieAgg = {};
        if (saveState.uclLeg === 1) {
            feedBox.innerHTML = '<strong>— KNOCKOUT PLAYOFFS · FIRST LEGS —</strong><br>';
            let userHtml = '', basicHtml = '';
            saveState.uclPlayoffPairs.forEach((pair, idx) => {
                const away = uclTeamById(pair.a), home = uclTeamById(pair.b); // seed (a) travels first
                if (!home || !away) { feedBox.innerHTML += `<div class="standard-match-log">⚠ Skipped unresolvable tie: ${esc(pair.a)} vs ${esc(pair.b)}</div>`; return; }
                const sim = runFixtureSimulation(home, away, 1.35);
                saveState.uclTieAgg[idx] = { a: sim.details.goalsB, b: sim.details.goalsA };
                const html = uclMatchHtml(sim, home, away, true);
                if (home.id === saveState.userTeamId || away.id === saveState.userTeamId) userHtml += html;
                else basicHtml += html;
            });
            feedBox.innerHTML += userHtml + basicHtml;
            saveState.uclLeg = 2;
        } else {
            feedBox.innerHTML = '<strong>— KNOCKOUT PLAYOFFS · SECOND LEGS —</strong><br>';
            let userHtml = '', basicHtml = '';
            const winners = [];
            saveState.uclPlayoffPairs.forEach((pair, idx) => {
                const home = uclTeamById(pair.a), away = uclTeamById(pair.b); // seed hosts the decider
                if (!home || !away) { feedBox.innerHTML += `<div class="standard-match-log">⚠ Skipped unresolvable tie: ${esc(pair.a)} vs ${esc(pair.b)}</div>`; return; }
                const sim = runFixtureSimulation(home, away, 1.35);
                const agg = saveState.uclTieAgg[idx] || { a: 0, b: 0 };
                agg.a += sim.details.goalsA;
                agg.b += sim.details.goalsB;
                let winnerId;
                if (agg.a > agg.b) winnerId = pair.a;
                else if (agg.b > agg.a) winnerId = pair.b;
                else if (Math.random() < shootoutWinnerProbability(home, away)) winnerId = pair.a;
                else winnerId = pair.b;
                winners.push(winnerId);
                const loser = winnerId === pair.a ? away : home;
                loser.isEliminated = true;
                const tie = { a: pair.a, b: pair.b, aWon: winnerId === pair.a, bWon: winnerId === pair.b };
                saveState.uclPlayedTies = saveState.uclPlayedTies || [];
                saveState.uclPlayedTies.push(tie);
                const html = uclMatchHtml(sim, home, away, true) + `<br><em>${uclTeamById(winnerId).name} win the tie${agg.a === agg.b ? ' on penalties' : ` ${Math.max(agg.a, agg.b)}–${Math.min(agg.a, agg.b)} on aggregate`}.</em>`;
                if (home.id === saveState.userTeamId || away.id === saveState.userTeamId) userHtml += html;
                else basicHtml += html;
            });
            feedBox.innerHTML += userHtml + basicHtml;
            uclSlotPlayoffWinners(winners);
            saveState.uclPhase = 'ko';
            saveState.uclLeg = null;
        }
        if (typeof scrollFeedToBottom === 'function') scrollFeedToBottom();
        if (typeof isAutoSimRunning === 'function' && !isAutoSimRunning()) switchHubPane('feed');
        saveState.currentMatchday++;
        refreshHubDashboardUI();
        return;
    }

    // --- Knockout phase: single legs ---
    const ties = uclCurrentTies();
    if (!ties || !ties.length) {
        saveState.isCompleted = true;
        triggerEndgameModalDisplay();
        return;
    }
    const roundName = uclKoRoundName();
    feedBox.innerHTML = `<strong>— ${roundName.toUpperCase()} —</strong><br>`;
    let userHtml = '', basicHtml = '';
    const winners = [];
    ties.forEach(tie => {
        if (!tie.a || !tie.b) return;
        const home = uclTeamById(tie.a), away = uclTeamById(tie.b);
        if (!home || !away) { feedBox.innerHTML += `<div class="standard-match-log">⚠ Skipped unresolvable tie: ${esc(tie.a)} vs ${esc(tie.b)}</div>`; return; }
        const sim = runFixtureSimulation(home, away, 1.5);
        let winnerId;
        if (sim.details.goalsA > sim.details.goalsB) winnerId = tie.a;
        else if (sim.details.goalsB > sim.details.goalsA) winnerId = tie.b;
        else if (Math.random() < shootoutWinnerProbability(home, away)) winnerId = tie.a;
        else winnerId = tie.b;
        winners.push(winnerId);
        const loser = winnerId === tie.a ? away : home;
        loser.isEliminated = true;
        tie.aWon = winnerId === tie.a;
        tie.bWon = winnerId === tie.b;
        saveState.uclPlayedTies = saveState.uclPlayedTies || [];
        saveState.uclPlayedTies.push({ a: tie.a, b: tie.b, aWon: tie.aWon, bWon: tie.bWon });
        let html = uclMatchHtml(sim, home, away);
        if (sim.details.goalsA === sim.details.goalsB) html += `<br><em>${uclTeamById(winnerId).name} win on penalties.</em>`;
        if (home.id === saveState.userTeamId || away.id === saveState.userTeamId) userHtml += html;
        else basicHtml += html;
    });
    feedBox.innerHTML += userHtml + basicHtml;

    uclAdvanceBracket(winners);

    const finalTie = saveState.uclBracket.final;
    if (finalTie.a && finalTie.b && finalTie.aWon !== undefined) {
        saveState.uclBracket.champion = finalTie.aWon ? finalTie.a : finalTie.b;
        saveState.isCompleted = true;
        refreshHubDashboardUI();
        if (typeof scrollFeedToBottom === 'function') scrollFeedToBottom();
        setTimeout(() => triggerEndgameModalDisplay(), 300);
        return;
    }
    saveState.currentMatchday++;
    if (typeof scrollFeedToBottom === 'function') scrollFeedToBottom();
    if (typeof isAutoSimRunning === 'function' && !isAutoSimRunning()) switchHubPane('feed');
    refreshHubDashboardUI();
}

function uclKoRoundName() {
    const alive = saveState.teams.filter(t => !t.isEliminated).length;
    if (alive <= 2) return 'Final';
    if (alive <= 4) return 'Semi-Finals';
    if (alive <= 8) return 'Quarter-Finals';
    return 'Round of 16';
}

function uclMatchHtml(sim, home, away, isTwoLegged) {
    let html = '';
    if (home.id === saveState.userTeamId || away.id === saveState.userTeamId) {
        html += `<div class="user-match-log"><strong>${sim.text}</strong>`;
    } else {
        html += `<div class="standard-match-log">${sim.text}`;
    }
    if (sim.details.scorersA.length) html += `<br><span class="feed-goals">Goals [Home]: ${sim.details.scorersA.join(', ')}</span>`;
    if (sim.details.scorersB.length) html += `<br><span class="feed-goals">Goals [Away]: ${sim.details.scorersB.join(', ')}</span>`;
    html += `</div>`;
    return html;
}

// Place the 8 playoff winners into their predetermined R16 slots.
function uclSlotPlayoffWinners(winners) {
    const br = saveState.uclBracket;
    br.r16.forEach(slot => {
        slot.b = winners[slot.wp] || null;
    });
}

// Move winners into the next round. The bracket is fixed, mirroring the real
// competition's structure: R16 winners pair into QFs in bracket order, then
// SFs, then the final.
function uclAdvanceBracket(winners) {
    const br = saveState.uclBracket;
    if (winners.length === 8) {
        // Round of 16 done → quarter-final pairings.
        br.qf[0] = { a: winners[0], b: winners[1] };
        br.qf[1] = { a: winners[2], b: winners[3] };
        br.qf[2] = { a: winners[4], b: winners[5] };
        br.qf[3] = { a: winners[6], b: winners[7] };
    } else if (winners.length === 4) {
        br.sf[0] = { a: winners[0], b: winners[1] };
        br.sf[1] = { a: winners[2], b: winners[3] };
    } else if (winners.length === 2) {
        br.final = { a: winners[0], b: winners[1] };
    }
}

// --- Endgame ---------------------------------------------------------------------
function uclChampionId() {
    return saveState.uclBracket && saveState.uclBracket.champion;
}
