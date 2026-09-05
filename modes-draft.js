// El Fut Simulator — Squad-builder game modes
// ---------------------------------------------------------------------------
// Powers three flows:
//   draft           — Single Season Draft (per formation slot the game deals 5
//                     real players drawn from ANY club league)
//   draftChallenge  — Single Season Draft Challenge (SAME pick-one-of-five draft,
//                     but the deal pool and squad must satisfy preset guidelines)
//   omnipotent      — Omnipotent Mode (browse any player in the database)
//
// After the XI is built, the custom squad takes over a club slot inside a
// chosen even-sized league and runs through the normal match-sim season.
// These modes are ONE-SESSION: never written to the save list.

// --- FORMATIONS ---
// Standard GK + 10-outfield shapes. Each position may also accept its natural
// alternate when the DB only offers e.g. RM/LM instead of RW/LW.
const FORMATION_TEMPLATES = {
    '4-4-2':   ['GK', 'RB', 'CB', 'CB', 'LB', 'RM', 'CM', 'CM', 'LM', 'ST', 'ST'],
    '4-3-3':   ['GK', 'RB', 'CB', 'CB', 'LB', 'CDM', 'CM', 'CM', 'LW', 'ST', 'RW'],
    '4-2-3-1': ['GK', 'RB', 'CB', 'CB', 'LB', 'CDM', 'CDM', 'RW', 'CAM', 'LW', 'ST'],
    '3-5-2':   ['GK', 'CB', 'CB', 'CB', 'RM', 'CM', 'CDM', 'CM', 'LM', 'ST', 'ST'],
    '3-4-3':   ['GK', 'CB', 'CB', 'CB', 'RM', 'CM', 'CM', 'LM', 'LW', 'ST', 'RW'],
    '4-1-4-1': ['GK', 'RB', 'CB', 'CB', 'LB', 'CDM', 'RM', 'CM', 'CM', 'LM', 'ST'],
    '4-5-1':   ['GK', 'RB', 'CB', 'CB', 'LB', 'RM', 'CM', 'CDM', 'CM', 'LM', 'ST'],
    '5-3-2':   ['GK', 'RB', 'CB', 'CB', 'CB', 'LB', 'CDM', 'CM', 'CM', 'ST', 'ST'],
    '4-2-2-2': ['GK', 'RB', 'CB', 'CB', 'LB', 'CDM', 'CDM', 'CAM', 'CAM', 'ST', 'ST'],
    '4-4-1-1': ['GK', 'RB', 'CB', 'CB', 'LB', 'RM', 'CM', 'CM', 'LM', 'CAM', 'ST'],
    '3-4-1-2': ['GK', 'CB', 'CB', 'CB', 'RM', 'CM', 'CM', 'LM', 'CAM', 'ST', 'ST'],
    '5-4-1':   ['GK', 'RB', 'CB', 'CB', 'CB', 'LB', 'RM', 'CM', 'CM', 'LM', 'ST']
};
const FORMATION_ORDER = ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '3-4-3', '4-1-4-1', '4-5-1', '5-3-2', '4-2-2-2', '4-4-1-1', '3-4-1-2', '5-4-1'];

// Turn a formation's position list into slot objects with allowed positions.
function curSlots() {
    const list = FORMATION_TEMPLATES[SB.formation] || FORMATION_TEMPLATES['4-3-3'];
    return list.map(pos => {
        const allowed = pos === 'RM' ? ['RM', 'RW']
            : pos === 'LM' ? ['LM', 'LW']
            : pos === 'RB' ? ['RB', 'RWB']
            : pos === 'LB' ? ['LB', 'LWB']
            : [pos];
        return { pos, allowed };
    });
}

function dayHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) >>> 0;
    return h;
}

function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// --- Draft Challenge presets (guidelines layered on the normal draft) ---
// Each preset has its own character: some clamp the whole database (Moneyball,
// Under the Radar), some restrict deals to named clubs and rivalries (El
// Clasico, Der Klassiker, Big Six), some shrink the pool to one single club.
const DRAFT_CHALLENGE_DEFS = [
    {
        id: 'underdogs', icon: '🌱', title: 'Underdogs Only',
        desc: 'Deals come from clubs in the BOTTOM HALF of their league, and the finished squad must stay under a combined 845 OVR. Out-coach the elite without the stars.',
        pool: 'bottom-half',
        cap: 845,
        goal: { type: 'win', label: 'Win the league' }
    },
    {
        id: 'elite-poachers', icon: '💎', title: 'Elite Poachers',
        desc: 'Deals come from TOP-HALF clubs only, no single player above 85 — but the finished XI must still clear a combined 900 OVR. Sign the best of the nearly-best.',
        pool: 'top-half',
        maxRating: 85,
        minSum: 900,
        goal: { type: 'top4', label: 'Finish in the top 4' }
    },
    {
        id: 'wanderers', icon: '✈️', title: 'The Wanderers',
        desc: 'The deals come from three random leagues and EVERY one of them must end up represented in your XI. A true continental scavenger hunt.',
        pool: 'three-random',
        minLeagues: 3,
        goal: { type: 'top4', label: 'Finish in the top 4' }
    },
    {
        id: 'moneyball', icon: '📈', title: 'Moneyball',
        desc: 'Full freedom of pool — but the combined rating of the XI must stay under the cap. Squeeze maximum value out of every slot.',
        pool: 'any',
        cap: 860,
        goal: { type: 'win', label: 'Win the league' }
    },
    {
        id: 'under-the-radar', icon: '🕵️', title: 'Under the Radar',
        desc: 'No player above 83, from any club in the database. Scouting beats stardom — find the XI that overachieves.',
        pool: 'any',
        maxRating: 83,
        goal: { type: 'top4', label: 'Finish in the top 4' }
    },
    {
        id: 'der-klassiker', icon: '🏟️', title: 'Der Klassiker',
        desc: 'Every deal comes from the two giants of German football — FC Bayern München or Borussia Dortmund. Beat the Bundesliga with a German core.',
        pool: 'clubs',
        clubNames: ['FC Bayern München', 'Borussia Dortmund'],
        goal: { type: 'win', label: 'Win the league' }
    },
    {
        id: 'el-clasico', icon: '⚔️', title: 'El Clasico Kings',
        desc: 'The deal pool is exactly the two kings of Spain: Real Madrid and FC Barcelona. Forge a hybrid of the eternal rivals.',
        pool: 'clubs',
        clubNames: ['Real Madrid', 'FC Barcelona'],
        goal: { type: 'win', label: 'Win the league' }
    },
    {
        id: 'big-six', icon: '🏰', title: 'The Big Six',
        desc: 'Deals come only from England&apos;s Big Six (Arsenal, Chelsea, Liverpool, Man City, Man United, Spurs) — and the XI must still clear 935 combined OVR.',
        pool: 'clubs',
        clubNames: ['Arsenal', 'Chelsea FC', 'Liverpool FC', 'Manchester City', 'Manchester United', 'Tottenham Hotspur'],
        minSum: 935,
        goal: { type: 'top4', label: 'Finish in the top 4' }
    },
    {
        id: 'one-club-wonder', icon: '🎽', title: 'One-Club Wonder',
        desc: 'A single famous club is drawn as your only supplier — you must build the entire XI from exactly its squad. Every pick costs you one of theirs.',
        pool: 'one-club',
        formation: '4-3-3',
        goal: { type: 'top4', label: 'Finish in the top 4' }
    }
];

// Club leagues with real squads big enough to act as "named rivalry" deal pools.
function sbClubLeagues() {
    const out = [];
    for (const key in activeDatabase.leagues) {
        const league = activeDatabase.leagues[key];
        const label = (league.name || key) + ' ' + key;
        if (/world|cup|past|misc/i.test(label)) continue;
        if ((league.teams || []).length >= 2) out.push({ key, name: league.name || key });
    }
    return out;
}

// Leagues that can actually supply real draft deals (have enough non-Gen players).
function sbDraftableLeagues() {
    const out = [];
    for (const key in activeDatabase.leagues) {
        const league = activeDatabase.leagues[key];
        const label = (league.name || key) + ' ' + key;
        if (/world|cup|past|misc/i.test(label)) continue;
        let real = 0;
        (league.teams || []).forEach(t => {
            (t.players || []).forEach(p => {
                if (p && p.name && !/\(Gen\)$/i.test(p.name)) real++;
            });
        });
        if (real >= 20) out.push({ key, name: league.name || key });
    }
    return out;
}

// Clubs whose real 11-man squad exactly covers a 4-3-3 (1 GK, 4 DEF, 3 MID,
// 3 FWD) — the only squads a One-Club draft can fully consume.
const SB_ONE_CLUB_POOL = [
    'Arsenal', 'Manchester City', 'Manchester United', 'Tottenham Hotspur', 'Aston Villa',
    'West Ham United', 'FC Barcelona', 'Atlético Madrid', 'RB Leipzig', 'FC Bayern München',
    'Paris Saint-Germain'
];

// Resolve exact team ids for a list of club names (used by named-pool presets).
function sbClubIdsByName(names) {
    const want = new Set(names);
    const ids = [];
    for (const key in activeDatabase.leagues) {
        const league = activeDatabase.leagues[key];
        const label = (league.name || key) + ' ' + key;
        if (/world|cup|past|misc/i.test(label)) continue;
        (league.teams || []).forEach(t => {
            if (want.has(t.name) && ids.indexOf(t.id) === -1) ids.push(t.id);
        });
    }
    return ids;
}

// Draft Challenge pick: rotating preset; date-seeded only where a draw is needed
// (Wanderers leagues / One-Club Wonder's supplier).
function pickDraftChallenge() {
    const key = todayKey();
    const def = JSON.parse(JSON.stringify(DRAFT_CHALLENGE_DEFS[dayHash(key) % DRAFT_CHALLENGE_DEFS.length]));
    if (def.pool === 'three-random') {
        const leagues = sbDraftableLeagues();
        const chosen = [];
        const start = leagues.length ? dayHash(key + '|leagues') % leagues.length : 0;
        for (let i = 0; i < Math.min(3, leagues.length); i++) {
            const idx = (start + i * 7) % leagues.length;
            if (!chosen.some(c => c.key === leagues[idx].key)) chosen.push(leagues[idx]);
        }
        def.poolLeagues = chosen.map(c => c.key);
        def.poolLeagueNames = chosen.map(c => c.name);
    }
    if (def.pool === 'one-club') {
        const idx = dayHash(key + '|club') % SB_ONE_CLUB_POOL.length;
        def.clubName = SB_ONE_CLUB_POOL[idx];
    }
    if (def.id === 'moneyball') def.cap = 860 + (dayHash(key) % 13); // 860..872
    return def;
}

// --- Flow state ---
const SB = {
    mode: null,            // 'draft' | 'draftChallenge' | 'omnipotent'
    challenge: null,       // preset definition (draftChallenge) or null
    formation: '4-3-3',
    pool: [],              // cached eligible players for browse flows
    targetLeagueKey: null,
    replaceId: null,
    clubName: '',
    xi: null,              // array of 11 (entry or null)
    activeSlot: 0,
    posFilter: 'all',
    search: '',
    poolScroll: 0,
    // pick-1-of-5 draft state
    draftPool: null,       // cached real-player entries across club leagues
    shortlist: [],         // 5 dealt candidates for the current slot
    shortlistSlot: -1      // formation slot the shortlist was dealt for
};

function sbModeMeta() {
    return GAME_MODES.find(m => m.id === SB.mode) || GAME_MODES[0];
}

// Leagues big enough (>= 8 clubs, even count) to host a round-robin season.
function sbTargetLeagues() {
    const out = [];
    for (const key in activeDatabase.leagues) {
        const league = activeDatabase.leagues[key];
        const teams = league.teams || [];
        if (teams.length >= 8 && teams.length % 2 === 0) out.push({ key, name: league.name || key, teams });
    }
    return out;
}

// Leagues that can act as a draft SOURCE (needs at least 2 teams).
function sbPoolLeagues() {
    const out = [];
    for (const key in activeDatabase.leagues) {
        const league = activeDatabase.leagues[key];
        if ((league.teams || []).length >= 2) out.push({ key, name: league.name || key });
    }
    return out;
}

function sbWeakestClub(league) {
    const teams = league.teams || [];
    if (!teams.length) return null;
    let best = teams[0];
    // Empty DB rosters get auto-generated players in a real season — rate a
    // normalized copy so those clubs are treated fairly here too.
    const rated = (t) => {
        const c = cloneDeep(t);
        normalizeRoster(c, 80);
        return parseFloat(squadAvgRating(c) || 0);
    };
    let bestRating = rated(best);
    teams.forEach(t => {
        const r = rated(t);
        if (r < bestRating) { best = t; bestRating = r; }
    });
    return best;
}

// --- Screen shell ---
function openModeSetupFlow(mode) {
    if (mode === 'national') {
        if (typeof openWorldCupSetup === 'function') return openWorldCupSetup();
        return alert('National Team mode is not available.');
    }
    if (['draft', 'draftChallenge', 'omnipotent'].indexOf(mode) === -1) {
        if (mode === 'realistic') return;
        return alert('This mode is not available yet.');
    }
    openSquadModeSetup(mode);
}

function openSquadModeSetup(mode) {
    SB.mode = mode;
    SB.challenge = null;
    SB.formation = '4-3-3';
    SB.pool = [];
    SB.targetLeagueKey = null;
    SB.replaceId = null;
    SB.clubName = '';
    SB.xi = new Array(curSlots().length).fill(null);
    SB.activeSlot = 0;
    SB.posFilter = 'all';
    SB.search = '';
    SB.poolScroll = 0;
    SB.draftPool = null;
    SB.shortlist = [];
    SB.shortlistSlot = -1;

    if (mode === 'draftChallenge') SB.challenge = pickDraftChallenge();

    document.getElementById('welcome-screen').style.display = 'none';
    const screen = document.getElementById('modes-screen');
    screen.style.display = 'flex';
    renderSBScreen();
}

function renderSBScreen(targetStep) {
    const meta = sbModeMeta();
    const screen = document.getElementById('modes-screen');
    screen.innerHTML = `
        <div class="menu-box large-box">
            <div class="config-topbar">
                <button id="sb-back-btn" class="btn-secondary config-back-btn">← Menu</button>
                <div class="config-title-group">
                    <h2>${meta.icon} ${meta.name}</h2>
                    <p class="subtitle" id="sb-subtitle">${esc(meta.desc)}</p>
                </div>
            </div>
            <div id="sb-body"></div>
        </div>`;
    document.getElementById('sb-back-btn').onclick = () => {
        // Leaving the setup abandons the run (nothing is saved).
        if (SB.step > 1 || window.confirm('Cancel this run?')) loadActiveMenu();
    };
    SB.step = targetStep || 1;
    renderSBStep();
}

function renderSBStep() {
    if (SB.step === 1) renderSBStep1();
    else if (SB.step === 2) renderSBStep2();
    else renderSBStep3();
}

// Normalized squad rating for DB teams (fills Gen players for empty rosters).
function sbRatedAvg(team) {
    const c = cloneDeep(team);
    normalizeRoster(c, 80);
    return parseFloat(squadAvgRating(c) || 0);
}

function formationChipsHtml() {
    return FORMATION_ORDER.map(f => `
        <button type="button" class="league-chip ${SB.formation === f ? 'active' : ''}" data-form="${esc(f)}">${esc(f)}</button>`).join('');
}

// --- STEP 1: competition, formation, pool & identity ---
function renderSBStep1() {
    const ch = SB.challenge;
    const randomDraft = SB.mode === 'draft' || SB.mode === 'draftChallenge';
    const targets = sbTargetLeagues();

    // Defaults
    if (!SB.targetLeagueKey || !activeDatabase.leagues[SB.targetLeagueKey]) {
        SB.targetLeagueKey = targets[0] ? targets[0].key : null;
    }

    // Challenges with a fixed formation (One-Club Wonder drafts an exact squad)
    if (ch && ch.formation && SB.formation !== ch.formation) {
        SB.formation = ch.formation;
        SB.xi = new Array(curSlots().length).fill(null);
        SB.activeSlot = 0;
    }

    const metaChips = [];
    if (ch && ch.cap) metaChips.push(`💪 Cap: total OVR ≤ ${ch.cap}`);
    if (ch && ch.minSum) metaChips.push(`💪 Floor: total OVR ≥ ${ch.minSum}`);
    if (ch && ch.maxRating) metaChips.push(`🚫 No player above ${ch.maxRating}`);
    if (ch && ch.pool === 'bottom-half') metaChips.push('🌱 Bottom-half clubs only');
    if (ch && ch.pool === 'top-half') metaChips.push('💎 Top-half clubs only');
    if (ch && ch.pool === 'three-random') metaChips.push('✈️ Three random leagues');
    if (ch && ch.poolLeagues && ch.poolLeagueNames) metaChips.push('🗺️ ' + ch.poolLeagueNames.join(', '));
    if (ch && ch.pool === 'clubs' && ch.clubNames) metaChips.push('⚔️ Deal pool: ' + ch.clubNames.join(' vs '));
    if (ch && ch.pool === 'one-club' && ch.clubName) metaChips.push('🏟️ Sole supplier: ' + ch.clubName);
    if (ch && ch.minLeagues) metaChips.push(`🗂️ ${ch.minLeagues} leagues in the XI`);
    if (ch && ch.goal) metaChips.push(`🎯 Goal: ${ch.goal.label}`);

    const challengeHtml = ch ? `
        <div class="challenge-card">
            <div class="challenge-card-head">${ch.icon} Challenge — ${esc(ch.title)}</div>
            <p>${esc(ch.desc)}</p>
            <div class="challenge-meta">${metaChips.map(m => `<span>${m}</span>`).join('')}</div>
        </div>` : '';

    const fixedFormation = !!(ch && ch.formation);
    const formationHtml = `
        <div class="pane-head"><span class="pane-eyebrow">FORMATION</span><h3>Shape your team</h3></div>
        ${fixedFormation
            ? `<div class="notice-box" style="margin:0;">🔒 This challenge locks the formation to <strong>${esc(SB.formation)}</strong> — the supplier squad is exactly eleven players.</div>`
            : `<div class="league-filter-row wrap" id="sb-formation-row">${formationChipsHtml()}</div>`}
        <p class="pane-hint">${randomDraft ? 'Each pick in the draft fills the next open position of this shape.' : 'Each lineup slot follows this shape — the formation is shown on your squad screen.'}</p>`;

    let poolHtml = '';
    if (SB.mode === 'draft') {
        poolHtml = `<div class="notice-box">🃏 <strong>Pick one of five.</strong> For every open position the game deals you <strong>5 real players</strong> drawn at random from clubs across any league. Keep one, then the next position is dealt. No generated players, no browsing.</div>`;
    } else if (SB.mode === 'draftChallenge') {
        poolHtml = `<div class="notice-box">🎯 <strong>Same draft, with rules.</strong> Each position still deals <strong>5 real players</strong> — but the deal pool obeys the guideline above, and you cannot start the season until the whole XI passes every rule. Re-deal hands to find a compliant squad.</div>`;
    } else {
        poolHtml = `<div class="notice-box">🧺 Draft pool: <strong>every player in the database</strong>${ch ? ' (restrictions from the challenge above apply)' : ''}. Pick any player for any slot.</div>`;
    }

    // Target league / club takeover
    let identityHtml = '';
    const targetDisplay = !!SB.targetLeagueKey;
    if (targetDisplay) {
        const targetOptions = targets.map(t => `<option value="${esc(t.key)}" ${t.key === SB.targetLeagueKey ? 'selected' : ''}>${esc(t.name)} (${(t.teams || []).length} clubs)</option>`).join('');
        identityHtml = `
            <div class="pane-head"><span class="pane-eyebrow">COMPETITION LEAGUE</span><h3>Which league will you play in?</h3></div>
            <select id="sb-target-league">${targetOptions}</select>
            <div id="sb-replace-wrap"></div>
            <div class="pane-head" style="margin-top:14px;"><span class="pane-eyebrow">CLUB IDENTITY</span><h3>Name your club</h3></div>
            <input type="text" id="sb-club-name" placeholder="e.g. Riverside Rovers" value="${esc(SB.clubName)}">`;
    }

    document.getElementById('sb-body').innerHTML = `
        ${challengeHtml}
        <div class="formation-card">${formationHtml}</div>
        <div class="editor-layout sb-step1-layout">
            <div class="team-selector-pane">${poolHtml || '<div class="notice-box">No source leagues available.</div>'}</div>
            <div class="roster-modifier-pane">${identityHtml || '<div class="notice-box">No eligible competition leagues — a league needs 8+ clubs and an even count.</div>'}</div>
        </div>
        <div class="config-footer">
            <div class="config-footer-left"><span class="pane-hint" style="margin:0;">Step 1 of 3 — ${randomDraft ? 'shape + rules, then the randomized draft' : 'pick your field, then build the XI'}.</span></div>
            <button id="sb-continue1" class="launch-btn">Continue → ${randomDraft ? 'Start the Draft' : 'Build Your XI'}</button>
        </div>`;

    // Formation chips (hidden when a challenge locks the shape)
    if (!fixedFormation) {
        document.querySelectorAll('#sb-formation-row [data-form]').forEach(btn => {
            btn.onclick = () => {
                SB.formation = btn.dataset.form;
                SB.xi = new Array(curSlots().length).fill(null);
                SB.activeSlot = 0;
                SB.shortlist = [];
                SB.shortlistSlot = -1;
                renderSBStep1();
            };
        });
    }

    if (targetDisplay) {
        const sel = document.getElementById('sb-target-league');
        sel.onchange = () => {
            SB.targetLeagueKey = sel.value;
            const league = activeDatabase.leagues[SB.targetLeagueKey];
            SB.replaceId = sbWeakestClub(league) ? sbWeakestClub(league).id : null;
            renderSBStep1();
        };
        const league = activeDatabase.leagues[SB.targetLeagueKey];
        if (!SB.replaceId || !(league.teams || []).some(t => t.id === SB.replaceId)) {
            const weakest = sbWeakestClub(league);
            SB.replaceId = weakest ? weakest.id : null;
        }
        const replaceWrap = document.getElementById('sb-replace-wrap');
        if (replaceWrap) {
            const options = (league.teams || []).map(t => `<option value="${esc(t.id)}" ${t.id === SB.replaceId ? 'selected' : ''}>${esc(t.name)} · OVR ${sbRatedAvg(t).toFixed(1)}</option>`).join('');
            replaceWrap.innerHTML = `
                <div class="pane-head" style="margin-top:14px;"><span class="pane-eyebrow">TAKEOVER</span><h3>Whose place does your club take?</h3></div>
                <select id="sb-replace-club">${options}</select>
                <p class="pane-hint">The displaced club is removed and your custom squad competes in its slot.</p>`;
            document.getElementById('sb-replace-club').onchange = (e) => { SB.replaceId = e.target.value; };
        }
    }

    const nameInput = document.getElementById('sb-club-name');
    if (nameInput) nameInput.oninput = () => { SB.clubName = nameInput.value.trim(); };

    document.getElementById('sb-continue1').onclick = () => {
        if (targetDisplay) {
            if (!SB.targetLeagueKey) return alert('Choose a competition league.');
            if (!SB.replaceId) return alert('Choose which club your squad takes over.');
        }
        if (!SB.clubName) return alert('Give your club a name.');
        SB.draftPool = null;
        SB.shortlist = [];
        SB.shortlistSlot = -1;
        renderSBScreen(2);
    };
}

// --- STEP 2 dispatcher ---
function renderSBStep2() {
    if (SB.mode === 'draft' || SB.mode === 'draftChallenge') renderDraftPickUI();
    else renderBrowseBuilderUI();
}

// --- Browse XI builder (omnipotent mode) ---
function buildSBPool() {
    const out = [];
    for (const lk in activeDatabase.leagues) {
        const league = activeDatabase.leagues[lk];
        (league.teams || []).forEach(t => {
            (t.players || []).forEach(p => {
                if (!p || !p.pos || !p.name) return;
                out.push({ p, teamName: t.name, leagueKey: lk, leagueName: league.name || lk });
            });
        });
    }
    out.sort((a, b) => b.p.rating - a.p.rating);
    return out;
}

function renderBrowseBuilderUI() {
    if (!SB.pool.length) SB.pool = buildSBPool();
    document.getElementById('sb-subtitle').innerText = SB.challenge
        ? `${SB.challenge.title} — pick ${curSlots().length} players to build your squad.`
        : 'Build your starting XI from the eligible pool, then start the season.';

    document.getElementById('sb-body').innerHTML = `
        <div class="sb-builder">
            <div class="sb-pool-col team-selector-pane">
                <div class="pane-head"><span class="pane-eyebrow">AVAILABLE PLAYERS</span><h3>Eligible Pool</h3></div>
                <p class="pane-hint" id="sb-pool-count"></p>
                <div class="picker-search-row">
                    <input type="text" id="sb-search" placeholder="🔍 Search by name, team or league…" value="${esc(SB.search)}">
                </div>
                <div class="swap-filters" id="sb-pos-filters">
                    ${['all', 'GK', 'DEF', 'MID', 'FWD'].map(g => `<button type="button" class="chip ${SB.posFilter === g ? 'active' : ''}" data-pos="${g}">${g === 'all' ? 'All' : g}</button>`).join('')}
                </div>
                <div class="picker-scroll" id="sb-pool-list"></div>
            </div>
            <div class="sb-pick-col roster-modifier-pane">
                <div class="pane-head"><span class="pane-eyebrow">YOUR STARTING XI</span><h3>Pick a slot, then a player</h3></div>
                <div class="sb-capbar" id="sb-capbar"></div>
                <div class="slot-grid" id="sb-slots"></div>
                <div class="picker-tool-row">
                    <button type="button" id="sb-autofill" class="tool-btn">⚡ Auto-pick best XI</button>
                    <button type="button" id="sb-clearsi" class="tool-btn">Clear</button>
                </div>
                <div class="req-list" id="sb-reqs"></div>
            </div>
        </div>
        <div class="config-footer">
            <div class="config-footer-left"><button id="sb-back2" class="btn-secondary">← Back</button></div>
            <div id="sb-continue-wrap"></div>
        </div>`;

    document.getElementById('sb-back2').onclick = () => { renderSBScreen(1); };
    document.getElementById('sb-search').oninput = (e) => { SB.search = e.target.value; renderSBPoolList(true); };
    document.querySelectorAll('#sb-pos-filters .chip').forEach(c => {
        c.onclick = () => { SB.posFilter = c.dataset.pos; renderSBPoolList(true); };
    });
    document.getElementById('sb-autofill').onclick = () => sbAutoFill();
    document.getElementById('sb-clearsi').onclick = () => {
        SB.xi = new Array(curSlots().length).fill(null);
        SB.activeSlot = 0;
        refreshSBBuilder();
    };

    refreshSBBuilder();
}

function refreshSBBuilder() {
    renderSBPoolList();
    renderSBSlots();
    renderSBReqs();
}

// Key for a pool entry { p, teamName } OR a raw player { name, ... }.
function xiKey(e) {
    const name = (e && e.p && e.p.name) ? e.p.name : (e ? e.name : '');
    const team = (e && e.teamName) ? e.teamName : (e && e.p && e.p.teamName) ? e.p.teamName : '';
    return `${name}|${team}`;
}

function renderSBPoolList(keepScroll) {
    const wrap = document.getElementById('sb-pool-list');
    if (!wrap) return;
    const prevScroll = SB.poolScroll || wrap.scrollTop;
    const q = (SB.search || '').toLowerCase();
    const taken = new Set(SB.xi.filter(Boolean).map(x => xiKey(x.player)));
    const filtered = SB.pool.filter(e => {
        if (SB.posFilter !== 'all' && (POS_GROUPS[e.p.pos] || '') !== SB.posFilter) return false;
        if (!q) return true;
        const hay = `${e.p.name} ${e.p.pos} ${e.teamName} ${e.leagueName}`.toLowerCase();
        return hay.includes(q);
    });
    document.getElementById('sb-pool-count').innerText = `${filtered.length} eligible player${filtered.length === 1 ? '' : 's'}`;
    wrap.innerHTML = '';
    if (!filtered.length) {
        wrap.innerHTML = '<p class="picker-empty">No players match.</p>';
        return;
    }
    filtered.forEach(e => {
        const p = e.p;
        const row = document.createElement('div');
        const isTaken = taken.has(xiKey(e));
        row.className = 'team-picker-row pool-row' + (isTaken ? ' picked' : '');
        const initials = initialsOf(p.name);
        row.innerHTML = `
            <div class="player-avatar mini-avatar"><span>${esc(initials)}</span></div>
            <span class="team-picker-name">${esc(p.name)}<small>${esc(p.pos)} · ${esc(e.teamName)} · <span class="pool-league">${esc(e.leagueName)}</span></small></span>
            <span class="rating-badge">${esc(p.rating)}</span>
            ${isTaken ? '<span class="picker-focus-tag">in XI</span>' : ''}`;
        row.onclick = () => {
            if (isTaken) return;
            SB.xi[SB.activeSlot] = { player: e };
            const nextEmpty = SB.xi.findIndex((x, i) => !x && (POS_GROUPS[curSlots()[i].pos] || '') === (POS_GROUPS[p.pos] || ''));
            if (nextEmpty !== -1) SB.activeSlot = nextEmpty;
            refreshSBBuilder();
        };
        wrap.appendChild(row);
    });
    if (keepScroll) wrap.scrollTop = prevScroll;
    SB.poolScroll = wrap.scrollTop;
}

function renderSBSlots() {
    const wrap = document.getElementById('sb-slots');
    if (!wrap) return;
    const slots = curSlots();
    const draftFlow = SB.mode === 'draft' || SB.mode === 'draftChallenge';
    wrap.innerHTML = '';
    slots.forEach((slot, i) => {
        const pick = SB.xi[i];
        const isNext = draftFlow && !pick && i === SB.xi.findIndex(x => !x);
        const div = document.createElement('div');
        div.className = 'slot-card' + (pick ? ' filled' : ' empty') + (draftFlow ? (isNext ? ' active' : '') : (SB.activeSlot === i ? ' active' : ''));
        div.innerHTML = pick
            ? `<span class="slot-pos">${slot.pos}</span><strong>${esc(pick.player.p.name)}</strong><small>${esc(pick.player.p.pos)} · ${esc(pick.player.p.rating)}</small>${draftFlow ? '<em class="slot-redo">click to re-deal</em>' : ''}`
            : `<span class="slot-pos">${slot.pos}</span><em>${isNext ? '⬇ drafting…' : '+ ' + (POS_GROUPS[slot.pos] || '').toLowerCase()}</em>`;
        div.onclick = () => {
            if (!draftFlow) { SB.activeSlot = i; renderSBSlots(); return; }
            if (!pick) return;
            // Draft flow: clicking a FILLED slot clears that pick so it can be re-dealt.
            SB.xi[i] = null;
            SB.shortlist = [];
            SB.shortlistSlot = -1;
            SB.activeSlot = SB.xi.findIndex(x => !x);
            sbRefreshDraftUI();
        };
        wrap.appendChild(div);
    });
}

function sbRequirements() {
    const reqs = [];
    const filled = SB.xi.filter(Boolean).length;
    reqs.push({ label: `All ${curSlots().length} slots filled (${filled}/${curSlots().length})`, ok: filled === curSlots().length });
    const ch = SB.challenge;
    if (!ch) return reqs;
    const sum = SB.xi.filter(Boolean).reduce((s, x) => s + (x.player.p.rating || 0), 0);
    if (ch.cap) reqs.push({ label: `Total OVR ≤ ${ch.cap} (currently ${sum})`, ok: sum <= ch.cap });
    if (ch.minSum) reqs.push({ label: `Total OVR ≥ ${ch.minSum} (currently ${sum})`, ok: sum >= ch.minSum });
    if (ch.maxRating) reqs.push({ label: `No player above ${ch.maxRating}`, ok: SB.xi.every(x => !x || (x.player.p.rating || 0) <= ch.maxRating) });
    if (ch.minLeagues) {
        const leagues = new Set(SB.xi.filter(Boolean).map(x => x.player.leagueKey));
        reqs.push({ label: `Players from ≥ ${ch.minLeagues} different leagues (currently ${leagues.size})`, ok: leagues.size >= ch.minLeagues });
    }
    return reqs;
}

function renderSBReqs() {
    const reqs = sbRequirements();
    const capEl = document.getElementById('sb-capbar');
    const sum = SB.xi.filter(Boolean).reduce((s, x) => s + (x.player.p.rating || 0), 0);
    if (capEl) {
        const ch = SB.challenge;
        const cap = ch && ch.cap ? ch.cap : null;
        if (cap) {
            const pct = Math.min(100, Math.round((sum / cap) * 100));
            capEl.innerHTML = `<div class="progress-line"><span>Team OVR</span><span><strong>${sum}</strong> / ${cap}</span></div>
                <div class="progress-track"><div class="progress-fill ${sum > cap ? 'over' : ''}" style="width:${pct}%"></div></div>`;
        } else {
            capEl.innerHTML = `<div class="progress-line"><span>Team OVR</span><span><strong>${sum}</strong></span></div>`;
        }
    }
    const wrap = document.getElementById('sb-reqs');
    if (!wrap) return;
    const allOk = reqs.every(r => r.ok);
    wrap.innerHTML = reqs.map(r => `<div class="req-item ${r.ok ? 'ok' : 'bad'}">${r.ok ? '✔' : '✖'} ${esc(r.label)}</div>`).join('')
        + `<p class="pane-hint">Pick order is free — click a slot on the right, then a player. Players already in your XI are skipped.</p>`;

    const cw = document.getElementById('sb-continue-wrap');
    if (cw) {
        cw.innerHTML = `<button id="sb-review" class="launch-btn" ${allOk ? '' : 'disabled style="opacity:.55;cursor:not-allowed;"'}>Review & Start Season →</button>`;
        const btn = document.getElementById('sb-review');
        if (btn) btn.onclick = () => {
            if (!allOk) return;
            renderSBScreen(3);
        };
    }
}

function sbAutoFill() {
    const taken = new Set(SB.xi.filter(Boolean).map(x => xiKey(x.player)));
    curSlots().forEach((slot, i) => {
        if (SB.xi[i]) return;
        const best = SB.pool.find(e => {
            if (taken.has(xiKey(e))) return false;
            return (POS_GROUPS[e.p.pos] || '') === (POS_GROUPS[slot.pos] || '');
        });
        if (best) {
            SB.xi[i] = { player: best };
            taken.add(xiKey(best));
        }
    });
    const nextEmpty = SB.xi.findIndex(x => !x);
    if (nextEmpty !== -1) SB.activeSlot = nextEmpty;
    refreshSBBuilder();
}

// --- STEP 3: review & launch ---
function renderSBStep3() {
    const players = SB.xi.map((x, i) => ({ slot: curSlots()[i], p: x.player.p }));
    const sum = players.reduce((s, r) => s + (r.p.rating || 0), 0);
    const avg = (sum / players.length).toFixed(1);
    const targetLeague = activeDatabase.leagues[SB.targetLeagueKey];
    const displaced = targetLeague && (targetLeague.teams || []).find(t => t.id === SB.replaceId);
    const reqs = sbRequirements();

    document.getElementById('sb-subtitle').innerText = 'Final check — then the season starts.';
    document.getElementById('sb-body').innerHTML = `
        <div class="review-grid">
            <div class="team-selector-pane">
                <div class="pane-head"><span class="pane-eyebrow">THE SETUP</span><h3>Your Season</h3></div>
                <div class="review-line"><span>Club</span><strong>${esc(SB.clubName)}</strong></div>
                <div class="review-line"><span>Formation</span><strong>${esc(SB.formation)}</strong></div>
                <div class="review-line"><span>Competition</span><strong>${targetLeague ? esc(targetLeague.name) : '—'}</strong></div>
                <div class="review-line"><span>Takes the place of</span><strong>${displaced ? esc(displaced.name) : '—'}</strong></div>
                <div class="review-line"><span>Team OVR</span><strong>${sum} (avg ${avg})</strong></div>
                <div class="review-line"><span>Matchdays</span><strong>full double round robin</strong></div>
                ${SB.challenge ? `<div class="notice-box">🎯 <strong>Goal:</strong> ${esc(SB.challenge.goal ? SB.challenge.goal.label : 'Win the league')}</div>` : ''}
                <div class="req-list" style="margin-top:10px;">
                    ${reqs.map(r => `<div class="req-item ${r.ok ? 'ok' : 'bad'}">${r.ok ? '✔' : '✖'} ${esc(r.label)}</div>`).join('')}
                </div>
            </div>
            <div class="roster-modifier-pane">
                <div class="pane-head"><span class="pane-eyebrow">STARTING XI</span><h3>${esc(SB.clubName)}</h3></div>
                <div class="roster-scroll">
                    <table class="editor-table">
                        <thead><tr><th>#</th><th>Player</th><th>Slot</th><th>Pos</th><th>Source</th><th>OVR</th></tr></thead>
                        <tbody>
                            ${players.map((r, i) => `
                                <tr>
                                    <td class="row-num">${i + 1}</td>
                                    <td><strong>${esc(r.p.name)}</strong></td>
                                    <td>${esc(r.slot.pos)}</td>
                                    <td>${esc(r.p.pos)}</td>
                                    <td class="src-cell">${esc(SB.xi[i].player.leagueName)}</td>
                                    <td><span class="rating-badge">${esc(r.p.rating)}</span></td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        <div class="config-footer">
            <div class="config-footer-left"><button id="sb-back3" class="btn-secondary">← Back to picks</button></div>
            <button id="sb-launch" class="launch-btn">🏁 Start Season &amp; Open Hub</button>
        </div>`;
    document.getElementById('sb-back3').onclick = () => { renderSBScreen(2); };
    document.getElementById('sb-launch').onclick = () => {
        if (!reqs.every(r => r.ok)) return alert('Your squad does not meet the setup requirements yet.');
        launchSquadModeSeason();
    };
}

function launchSquadModeSeason() {
    const tgt = activeDatabase.leagues[SB.targetLeagueKey];
    if (!tgt) return alert('Target league missing — please restart the run.');
    const teams = [];
    (tgt.teams || []).forEach(t => {
        const c = cloneDeep(t);
        normalizeRoster(c, 80);
        c.points = 0; c.gf = 0; c.ga = 0; c.gd = 0; c.isEliminated = false;
        teams.push(c);
    });
    const idx = teams.findIndex(t => t.id === SB.replaceId);

    const xiPlayers = SB.xi.map(x => {
        const c = cloneDeep(x.player.p);
        c.stats = { goals: 0, assists: 0, cleanSheets: 0 };
        return c;
    });
    const clubName = SB.clubName || 'My Club';
    const userTeam = {
        id: 'custom-' + slugify(clubName),
        name: clubName,
        budget: 200e6,
        players: xiPlayers,
        points: 0, gf: 0, ga: 0, gd: 0, isEliminated: false
    };
    if (idx !== -1) teams.splice(idx, 1, userTeam);
    else teams.push(userTeam);

    saveState.saveName = clubName + ' run';
    saveState.mode = SB.mode;
    saveState.formation = SB.formation;
    saveState.competitionType = 'league';
    saveState.userTeamId = userTeam.id;
    saveState.userLeagueName = tgt.name;
    saveState.teams = teams;
    saveState.currentMatchday = 1;
    saveState.isCompleted = false;
    saveState.schedule = buildDoubleRoundRobin(teams);
    saveState.totalMatchdays = saveState.schedule.length;
    saveState.challengeGoal = SB.challenge ? SB.challenge.goal : null;

    document.getElementById('modes-screen').style.display = 'none';
    document.getElementById('hub-screen').style.display = 'flex';
    const feedBox = document.getElementById('ticker-feed-box');
    if (feedBox) feedBox.innerHTML = `Your custom squad takes on ${esc(tgt.name)}. Good luck, Gaffer — hit Simulate Season to play the matchdays.`;
    refreshHubDashboardUI();
    switchHubPane('table');
}

// ---------------------------------------------------------------------------
// SINGLE SEASON DRAFT — pick one of five real players per formation slot
// ---------------------------------------------------------------------------

// Team-id set for bottom-half / top-half draft-challenge pools (by squad strength).
function sbHalfTeamIds() {
    const ch = SB.challenge;
    const wantBottom = ch && ch.pool === 'bottom-half';
    const wantTop = ch && ch.pool === 'top-half';
    const ids = new Set();
    if (!wantBottom && !wantTop) return ids;
    for (const lk in activeDatabase.leagues) {
        const league = activeDatabase.leagues[lk];
        const teams = (league.teams || []).filter(t => t && t.id);
        if (teams.length < 2) continue;
        const sorted = teams.slice().sort((a, b) => sbRatedAvg(a) - sbRatedAvg(b));
        const half = Math.floor(sorted.length / 2);
        (wantBottom ? sorted.slice(0, half) : sorted.slice(sorted.length - half)).forEach(t => ids.add(t.id));
    }
    return ids;
}

// Real, NON-generated players from club leagues. Draft Challenge pools obey
// the preset guidelines (bottom/top-half clubs, seeded leagues, rating cap).
function sbBuildDraftPool() {
    const out = [];
    const ch = SB.mode === 'draftChallenge' ? SB.challenge : null;
    const halfIds = ch && (ch.pool === 'bottom-half' || ch.pool === 'top-half') ? sbHalfTeamIds() : null;
    const allowedKeys = ch && ch.poolLeagues && ch.poolLeagues.length ? new Set(ch.poolLeagues) : null;
    const clubIds = ch && (ch.pool === 'clubs' || ch.pool === 'one-club')
        ? new Set(sbClubIdsByName(ch.pool === 'one-club' ? [ch.clubName] : ch.clubNames))
        : null;
    for (const lk in activeDatabase.leagues) {
        if (allowedKeys && !allowedKeys.has(lk)) continue;
        const league = activeDatabase.leagues[lk];
        const label = (league.name || lk) + ' ' + lk;
        if (/world|cup|past|misc/i.test(label)) continue;
        (league.teams || []).forEach(t => {
            if (halfIds && !halfIds.has(t.id)) return;
            if (clubIds && !clubIds.has(t.id)) return;
            (t.players || []).forEach(p => {
                if (!p || !p.pos || !p.name) return;
                if (/\s\(Gen\)$/i.test(p.name)) return; // never offer generated players
                if (ch && ch.maxRating && (p.rating || 0) > ch.maxRating) return;
                out.push({ p, teamName: t.name, leagueKey: lk, leagueName: league.name || lk });
            });
        });
    }
    return out;
}

function sbEntryMatchesSlot(e, slot) {
    if (!e || !e.p || !e.p.pos) return false;
    if (slot.allowed.indexOf(e.p.pos) !== -1) return true;
    return (POS_GROUPS[e.p.pos] || '') === (POS_GROUPS[slot.pos] || '');
}

// Deal up to 5 DISTINCT real players who can cover the first empty slot.
function sbDealShortlist() {
    const idx = SB.xi.findIndex(x => !x);
    if (idx === -1) return [];
    const slot = curSlots()[idx];
    if (!SB.draftPool) SB.draftPool = sbBuildDraftPool();
    const taken = new Set(SB.xi.filter(Boolean).map(x => xiKey(x.player)));
    const eligible = SB.draftPool.filter(e => {
        if (taken.has(xiKey(e))) return false;
        return sbEntryMatchesSlot(e, slot);
    });
    if (!eligible.length) return [];
    const pool = eligible.slice();
    const dealt = [];
    while (dealt.length < 5 && pool.length) {
        const k = Math.floor(Math.random() * pool.length);
        dealt.push(pool.splice(k, 1)[0]);
    }
    return dealt;
}

// STEP 2 for the draft: five real candidates are dealt per open slot.
function renderDraftPickUI() {
    SB.draftPool = null;
    SB.shortlist = [];
    SB.shortlistSlot = -1;
    document.getElementById('sb-subtitle').innerText = SB.challenge
        ? `${sbModeMeta().name} — ${esc(SB.challenge.title)}. Dealt 5 real players per position, obeying the guideline; the squad must pass every rule before the season starts.`
        : `${sbModeMeta().name} — for every position you are dealt 5 real players from any league. Keep one.`;

    document.getElementById('sb-body').innerHTML = `
        <div class="sb-builder">
            <div class="sb-pool-col team-selector-pane">
                <div class="pane-head"><span class="pane-eyebrow">DRAFT BOARD</span><h3>${esc(SB.formation)} — 11 slots</h3></div>
                <p class="pane-hint">Slots fill in formation order. Keep one of the five dealt players for each position.</p>
                <div class="slot-grid" id="sb-slots"></div>
            </div>
            <div class="sb-pick-col roster-modifier-pane" id="sb-draft-zone"></div>
        </div>
        <div class="config-footer">
            <div class="config-footer-left"><button id="sb-back2" class="btn-secondary">← Back to Setup</button></div>
            <div id="sb-continue-wrap"></div>
        </div>`;
    document.getElementById('sb-back2').onclick = () => { renderSBScreen(1); };
    sbRefreshDraftUI();
}

function sbRefreshDraftUI() {
    renderSBSlots();
    const zone = document.getElementById('sb-draft-zone');
    if (!zone) return;
    const idx = SB.xi.findIndex(x => !x);
    const cw = document.getElementById('sb-continue-wrap');

    if (idx === -1) {
        const sum = SB.xi.reduce((s, x) => s + (x.player.p.rating || 0), 0);
        const reqs = sbRequirements();
        const allOk = reqs.every(r => r.ok);
        const isChallenge = SB.mode === 'draftChallenge';
        zone.innerHTML = `
            <div class="pane-head"><span class="pane-eyebrow">DRAFT COMPLETE</span><h3>Your XI is set</h3></div>
            <div class="notice-box" style="margin:14px 0;">✔ All ${curSlots().length} slots filled — combined OVR <strong>${sum}</strong>.</div>
            ${isChallenge ? `<div class="pane-head" style="margin-top:6px;"><span class="pane-eyebrow">GUIDELINE CHECK</span><h3>Pass every rule to continue</h3></div>
            <div class="req-list" style="margin-top:6px;">${reqs.map(r => `<div class="req-item ${r.ok ? 'ok' : 'bad'}">${r.ok ? '✔' : '✖'} ${esc(r.label)}</div>`).join('')}</div>
            <p class="pane-hint">Click any filled slot on the board to clear it and re-deal that position until the squad passes.</p>` : ''}`;
        if (cw) {
            if (allOk) {
                cw.innerHTML = `<button id="sb-review" class="launch-btn">Review & Start Season →</button>`;
                document.getElementById('sb-review').onclick = () => renderSBScreen(3);
            } else {
                const met = reqs.filter(r => r.ok).length;
                cw.innerHTML = `<button class="launch-btn" disabled style="opacity:.55;cursor:not-allowed;">Guidelines ${met}/${reqs.length} met — keep drafting</button>`;
            }
        }
        return;
    }

    const slot = curSlots()[idx];
    if (SB.shortlistSlot !== idx) {
        SB.shortlistSlot = idx;
        SB.shortlist = sbDealShortlist();
    }

    if (cw) cw.innerHTML = `<button class="launch-btn" disabled style="opacity:.55;cursor:not-allowed;">Slot ${idx + 1} of ${curSlots().length} — keep a ${slot.pos}</button>`;

    if (!SB.shortlist.length) {
        zone.innerHTML = `
            <div class="pane-head"><span class="pane-eyebrow">PICK ${idx + 1} OF ${curSlots().length} — ${esc(slot.pos)}</span><h3>No real players left for this position</h3></div>
            <div class="notice-box">The database has no non-generated players who can cover <strong>${esc(slot.pos)}</strong>. Go back and choose a formation that fits the database, or clear a pick to free players.</div>
            <div class="picker-tool-row">
                <button class="tool-btn" id="sb-draft-skip">↩ Back to Setup</button>
            </div>`;
        document.getElementById('sb-draft-skip').onclick = () => renderSBScreen(1);
        return;
    }

    const pickLabel = (slot.pos === 'GK' || slot.pos === 'RB' || slot.pos === 'LB') ? `a ${slot.pos}` : `an ${slot.pos}`;
    zone.innerHTML = `
        <div class="pane-head"><span class="pane-eyebrow">PICK ${idx + 1} OF ${curSlots().length} — ${esc(slot.pos)}</span><h3>Dealt for your ${esc(slot.pos)} slot</h3></div>
        <p class="pane-hint">Real players, drawn from clubs across every league. Click a card to draft ${pickLabel}. Players already in your XI are never re-dealt.</p>
        <div class="pick5-list" id="sb-shortlist">
            ${SB.shortlist.map((e, i) => {
                const p = e.p;
                return `<div class="team-picker-row pool-row pick5-row" data-k="${i}">
                    <div class="player-avatar mini-avatar"><span>${esc(initialsOf(p.name))}</span></div>
                    <span class="team-picker-name">${esc(p.name)}<small>${esc(p.pos)} · ${esc(e.teamName)} · <span class="pool-league">${esc(e.leagueName)}</span></small></span>
                    <span class="rating-badge">${esc(p.rating)}</span>
                </div>`;
            }).join('')}
        </div>
        <div class="picker-tool-row">
            <button id="sb-redraw" class="tool-btn">🔄 Deal another five</button>
        </div>`;

    document.querySelectorAll('#sb-shortlist .pick5-row').forEach(row => {
        row.onclick = () => {
            const entry = SB.shortlist[parseInt(row.dataset.k, 10)];
            if (!entry) return;
            SB.xi[idx] = { player: entry };
            SB.shortlist = [];
            SB.shortlistSlot = -1;
            SB.activeSlot = SB.xi.findIndex(x => !x);
            sbRefreshDraftUI();
        };
    });
    document.getElementById('sb-redraw').onclick = () => {
        SB.shortlist = sbDealShortlist();
        sbRefreshDraftUI();
    };
}
