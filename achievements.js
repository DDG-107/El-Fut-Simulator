// achievements.js - Cross-save achievements for El Fut Simulator
// ---------------------------------------------------------------------------
// Achievements persist ACROSS saves: the unlocked set lives under its own
// localStorage key, never inside a career save. Progress is evaluated from
// cheap counters stored next to the achievements (transfers made, matchday
// results, ...) which each game mode feeds through achRecordX() helpers.
//
// Philosophy: every achievement is checked with pure predicates over data the
// game already has (saveState, activeDatabase, ach counters), so adding a new
// one is a data-only change.

const ACH_STORAGE_KEY = 'elfut_achievements_v1';

// --- Persistent counters (shared across every save) ---
function achLoadState() {
    try {
        const raw = localStorage.getItem(ACH_STORAGE_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) { /* storage unavailable */ }
    return { unlocked: {}, transfers: 0, matches: {} };
}

function achSaveState(st) {
    try { localStorage.setItem(ACH_STORAGE_KEY, JSON.stringify(st)); } catch (e) { /* ignore */ }
}

let achState = achLoadState();

function achRecordTransfer(count) {
    if (!count) return;
    achState.transfers = (achState.transfers || 0) + count;
    achSaveState(achState);
    achEvaluate();
}

// One row per simulated match involving the user's team. The caller passes
// goals from the user's perspective (goalsFor is ALWAYS the user's goals).
// Used by the rivalry and perfection achievements.
function achRecordUserMatch(result) {
    if (!result || typeof result.goalsFor !== 'number') return null;
    // Tag derby fixtures against the user's classic rivals.
    try {
        const team = achUserTeam();
        if (team) {
            const oppName = result.homeId === team.id ? result.to : result.from;
            const oppId = result.homeId === team.id ? result.awayId : result.homeId;
            result.rival = oppId !== team.id && achAreRivals(team.name, oppName);
            if (result.rival) result.rivalName = oppName;
        }
    } catch (e) { /* ignore */ }
    result.draw = result.goalsFor === result.goalsAgainst && !result.penaltyWin;
    achState.matches = achState.matches || {};
    const list = achState.matches[saveState.saveName] = achState.matches[saveState.saveName] || [];
    list.push(result);
    if (list.length > 400) list.splice(0, list.length - 400);
    achSaveState(achState);
    // Pass this row as context so match-based achievements (Derby winner)
    // can unlock the moment the result happens.
    achEvaluate(result);
    return result;
}

// Called by the engines after a level game is decided on penalties. A decided
// game is never a draw, whichever way it went.
function achTagShootout(row, userWon) {
    if (!row) return;
    row.penaltyWin = !!userWon;
    row.draw = false;
    if (typeof achSaveState === 'function') achSaveState(achState);
    achEvaluate(row);
}

// The most recently recorded user match row — lets engines that log inside a
// render helper (UCL) attach shootout results right after the fact.
function achLastMatchRow() {
    const list = (achState.matches && achState.matches[saveState.saveName]) || [];
    return list.length ? list[list.length - 1] : null;
}

// A win is a scoreline win, or a penalty-shootout win in a level game (the
// shootout decides, so a drawn tie that is won on penalties counts as a win,
// and one lost on penalties counts as a defeat).
function achIsWon(r) { return r.goalsFor > r.goalsAgainst || (!!r.penaltyWin && r.goalsFor === r.goalsAgainst); }

// --- Helper predicates over the live save / database ---

// The user's club for the current run.
function achUserTeam() {
    if (typeof saveState === 'undefined' || !saveState.teams) return null;
    return saveState.teams.find(t => t.id === saveState.userTeamId) || null;
}

// Set of every club name in the database plus special tournament ids.
function achAllClubNames() {
    const out = new Set();
    if (typeof activeDatabase !== 'undefined' && activeDatabase && activeDatabase.leagues) {
        for (const k in activeDatabase.leagues) {
            (activeDatabase.leagues[k].teams || []).forEach(t => out.add(t.name));
        }
    }
    if (typeof saveState !== 'undefined' && saveState.teams) {
        saveState.teams.forEach(t => out.add(t.name));
    }
    return out;
}

// Resolve the name of a database club from loose input ("Bayern", "losc", ...).
function achResolveClubName(input) {
    if (!input) return null;
    const needle = String(input).trim().toLowerCase();
    if (!needle) return null;
    let best = null;
    achAllClubNames().forEach(name => {
        const low = name.toLowerCase();
        if (low === needle) best = name;
        else if (!best && (low.includes(needle) || needle.includes(low))) best = name;
    });
    return best;
}

// The player's CURRENT club (the team whose roster the player is in).
function achPlayerClubName(playerName) {
    if (typeof activeDatabase === 'undefined' || !activeDatabase || !activeDatabase.leagues) return null;
    if (typeof saveState !== 'undefined' && saveState.teams) {
        for (const t of saveState.teams) {
            if ((t.players || []).some(p => p.name === playerName)) return t.name;
        }
    }
    for (const k in activeDatabase.leagues) {
        for (const t of activeDatabase.leagues[k].teams || []) {
            if ((t.players || []).some(p => p.name === playerName)) return t.name;
        }
    }
    return null;
}

// True when the two players have overlapping calendar-year ranges at a club.
// Legacy season rows are still understood while old saves migrate.
function achWereTeammates(aName, bName) {
    if (typeof activeDatabase === 'undefined' || !activeDatabase || !activeDatabase.leagues) return false;
    const histOf = (name) => {
        for (const k in activeDatabase.leagues) {
            for (const t of activeDatabase.leagues[k].teams || []) {
                const p = (t.players || []).find(q => q.name === name);
                if (p) return Array.isArray(p.transferHistory) ? p.transferHistory : [];
            }
        }
        return [];
    };
    const rangeOf = (h) => {
        if (!h || !h.club) return null;
        if (h.startYear != null || h.endYear != null) {
            const start = Number(h.startYear) || 0;
            return { club: String(h.club).trim().toLowerCase(), start, end: Math.max(start, Number(h.endYear) || start) };
        }
        const match = String(h.season || '').match(/(\d{4})\s*[/-]\s*(\d{2,4})/);
        if (!match) return { club: String(h.club).trim().toLowerCase(), start: 0, end: 9999 };
        const start = Number(match[1]);
        const end = Number(match[2].length === 2 ? String(start).slice(0, 2) + match[2] : match[2]);
        return { club: String(h.club).trim().toLowerCase(), start, end: Math.max(start, end) };
    };
    const a = histOf(aName), b = histOf(bName);
    if (!a.length || !b.length) return false;
    return b.some(h => {
        const right = rangeOf(h);
        return right && a.some(x => { const left = rangeOf(x); return left && left.club === right.club && left.start <= right.end && right.start <= left.end; });
    });
}

// Classic rivalries by club name (both directions of each pair).
const ACH_RIVAL_PAIRS = [
    ['Manchester United', 'Manchester City'],
    ['Manchester United', 'Liverpool FC'],
    ['Arsenal', 'Tottenham Hotspur'],
    ['Arsenal', 'Chelsea FC'],
    ['Chelsea FC', 'Tottenham Hotspur'],
    ['Liverpool FC', 'Everton FC'],
    ['Real Madrid', 'FC Barcelona'],
    ['Atlético Madrid', 'Real Madrid'],
    ['Atlético Madrid', 'FC Barcelona'],
    ['Inter Milan', 'AC Milan'],
    ['Juventus', 'AC Milan'],
    ['AS Roma', 'SS Lazio'],
    ['Paris Saint-Germain', 'Olympique de Marseille'],
    ['Bayern Munich', 'Borussia Dortmund'],
    ['FC Bayern München', 'Borussia Dortmund'],
    ['AFC Ajax', 'Feyenoord'],
    ['PSV Eindhoven', 'AFC Ajax'],
    ['Celtic FC', 'Rangers FC'],
    ['Sporting CP', 'SL Benfica'],
    ['SL Benfica', 'FC Porto'],
    ['Sporting CP', 'FC Porto'],
    ['Flamengo', 'Fluminense'],
    ['Palmeiras', 'Corinthians'],
    ['Boca Juniors', 'River Plate'],
    ['River Plate', 'CA Boca Juniors'],
    ['Los Angeles FC', 'Los Angeles Galaxy'],
    ['LA Galaxy', 'Los Angeles FC'],
    ['LAFC', 'LA Galaxy'],
    ['Newcastle United', 'Sunderland'],
    ['Real Sociedad', 'Athletic Club'],
    ['Villarreal CF', 'Valencia CF'],
    ['Real Betis', 'Sevilla FC'],
    ['Nottingham Forest', 'Derby County'],
    ['Aston Villa', 'Birmingham City']
];

function achTeamRivalNames(teamName) {
    const out = [];
    ACH_RIVAL_PAIRS.forEach(([a, b]) => {
        if (teamName === a) out.push(b);
        else if (teamName === b) out.push(a);
    });
    // Same-city / same-region heuristics for clubs not covered above.
    const cityOf = (n) => n.replace(/^(afc|as|cd|cf|fc|sc|ss|ssc|ac|rc|ca)\s+/i, '').split(' ')[0];
    return out;
}

function achAreRivals(nameA, nameB) {
    if (!nameA || !nameB || nameA === nameB) return false;
    if (achTeamRivalNames(nameA).includes(nameB)) return true;
    // Generic same-city derby heuristic: two distinct clubs sharing the first
    // meaningful word of their name (Inter Miami CF vs Miami FC etc.).
    const strip = (n) => n.replace(/\b(afc|as|cd|cf|fc|sc|ss|ssc|ac|rc|ca|club|de|del)\b/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    const aWords = strip(nameA).split(' ').filter(Boolean);
    const bWords = strip(nameB).split(' ').filter(Boolean);
    return aWords.length && bWords.length && aWords[0] === bWords[0];
}

// --- Achievement definitions ---
// test(ctx) receives { team, opponent, matchRow, goldenBootWinner, } — or the
// season-context object for end-of-run checks. All tests are pure functions.
const ACHIEVEMENTS = [
    {
        id: 'invincible',
        icon: '🛡️',
        title: 'Invincible',
        desc: "Don't lose a game.",
        check: () => {
            const rows = achState.matches[saveState.saveName] || [];
            // "Don't lose a game": wins and draws are fine, defeats are not.
            return rows.length >= 5 && rows.every(r => achIsWon(r) || r.draw);
        }
    },
    {
        id: 'perfect38',
        icon: '💯',
        title: '38-0',
        desc: 'Win every game.',
        check: () => {
            const rows = achState.matches[saveState.saveName] || [];
            return rows.length >= 5 && rows.every(r => achIsWon(r) && !r.draw);
        }
    },
    {
        id: 'transfer1',
        icon: '🤝',
        title: 'Transfer Market Apprentice',
        desc: 'Make your first transfer.',
        check: () => (achState.transfers || 0) >= 1
    },
    {
        id: 'transfer50',
        icon: '📈',
        title: 'Transfer Market Master',
        desc: 'Make 50 transfers.',
        check: () => (achState.transfers || 0) >= 50
    },
    {
        id: 'overhaul',
        icon: '🔄',
        title: 'Overhaul',
        desc: 'Replace and improve the entire starting XI of your team.',
        check: () => {
            const snaps = achRosterHistory();
            if (snaps.length < 2) return false;
            const first = achParseSnapshot(snaps[0]);
            const last = achParseSnapshot(snaps[snaps.length - 1]);
            if (!first || !last) return false;
            // Every starting name replaced...
            const firstNameSet = new Set(first.map(p => p.n));
            const anyOverlap = last.some(p => firstNameSet.has(p.n));
            // ...and the squad is at least as strong on average ("improve").
            const avg = (list) => list.reduce((s, p) => s + p.r, 0) / list.length;
            return first.length >= 11 && last.length >= 11 && !anyOverlap && avg(last) >= avg(first);
        }
    },
    {
        id: 'welcomeback',
        icon: '🏠',
        title: 'Welcome back',
        desc: 'Bring back an old player of your club.',
        check: () => achSigsThisSave().some(s => s.kind === 'homecoming')
    },
    {
        id: 'worldchamps',
        icon: '🌍',
        title: 'World champions',
        desc: 'Win the World Cup.',
        check: (ctx) => !!(ctx && ctx.wonWorldCup)
    },
    {
        id: 'reunite',
        icon: '👯',
        title: 'Hello, old friend',
        desc: 'Reunite two players who were former teammates.',
        check: () => achSigsThisSave().some(s => s.kind === 'reunion')
    },
    {
        id: 'derby',
        icon: '🏟️',
        title: 'Derby winner',
        desc: "Win a match against your team's rivals.",
        check: (ctx) => {
            // Accept both shapes: the raw match row (natural call path from
            // achRecordUserMatch) or a wrapper { matchRow }.
            const row = ctx && ctx.matchRow ? ctx.matchRow : ctx;
            return !!(row && row.rival && achIsWon(row));
        }
    },
    {
        id: 'doublederby',
        icon: '🎩',
        title: "Who's your daddy?",
        desc: 'Win the double over your club rivals.',
        check: () => {
            const rows = achState.matches[saveState.saveName] || [];
            const team = achUserTeam();
            const rivalNames = team ? achTeamRivalNames(team.name) : [];
            return rivalNames.some(r => {
                const wins = rows.filter(x => x.rival && x.rivalName === r && achIsWon(x)).length;
                const losses = rows.filter(x => x.rival && x.rivalName === r && !achIsWon(x)).length;
                return wins >= 2 && losses === 0;
            });
        }
    },
    {
        id: 'roadwarriors',
        icon: '🛣️',
        title: 'Road Warriors',
        desc: 'Win every away league match in a season.',
        check: () => {
            const team = achUserTeam();
            const rows = achState.matches[saveState.saveName] || [];
            const away = team ? rows.filter(r => r.homeId !== team.id) : [];
            return away.length >= 5 && away.every(r => achIsWon(r));
        }
    },
    {
        id: 'clean-sweep',
        icon: '🧱',
        title: 'Clean Sweep',
        desc: 'Keep a clean sheet in every recorded league match.',
        check: () => {
            const rows = achState.matches[saveState.saveName] || [];
            return rows.length >= 5 && rows.every(r => r.goalsAgainst === 0);
        }
    },
    {
        id: 'goal-machine',
        icon: '⚡',
        title: 'Goal Machine',
        desc: 'Have one of your players score 20 league goals in a season.',
        check: (ctx) => !!(ctx && ctx.userTopScorerGoals >= 20)
    },
    {
        id: 'golden-gloves',
        icon: '🧤',
        title: 'Golden Gloves',
        desc: 'Have your goalkeeper record 10 clean sheets in a season.',
        check: (ctx) => !!(ctx && ctx.userBestGoalkeeperCleanSheets >= 10)
    },
    {
        id: 'the-viking',
        icon: '🇳🇴',
        title: 'The Viking',
        desc: 'With Erling Haaland on your team, have him win the golden boot.',
        check: (ctx) => {
            const team = achUserTeam();
            return !!(ctx && /haaland/i.test(ctx.goldenBootWinner || '') && team && (team.players || []).some(p => /haaland/i.test(p.name)));
        }
    },
    {
        id: 'messi-magic',
        icon: '✨',
        title: 'Messi Magic',
        desc: 'With Lionel Messi on your team, have him win the golden boot.',
        check: (ctx) => {
            const team = achUserTeam();
            return !!(ctx && /messi/i.test(ctx.goldenBootWinner || '') && team && (team.players || []).some(p => /messi/i.test(p.name)));
        }
    },
    {
        id: 'maestro',
        icon: '🎯',
        title: 'The Maestro',
        desc: 'Have one of your players lead the league in assists with 15 or more.',
        check: (ctx) => !!(ctx && ctx.userTopAssists >= 15)
    },
    {
        id: 'fast-start',
        icon: '🚀',
        title: 'Fast Start',
        desc: 'Win your first three league matches.',
        check: () => {
            const rows = achState.matches[saveState.saveName] || [];
            return rows.length >= 3 && rows.slice(0, 3).every(r => achIsWon(r));
        }
    },
    {
        id: 'long-haul',
        icon: '⏱️',
        title: 'Long Haul',
        desc: 'Go 20 league matches without a defeat.',
        check: () => {
            const rows = achState.matches[saveState.saveName] || [];
            for (let i = 0; i <= rows.length - 20; i++) {
                if (rows.slice(i, i + 20).every(r => achIsWon(r) || r.draw)) return true;
            }
            return false;
        }
    },
    {
        id: 'home-fortress',
        icon: '🏰',
        title: 'Home Fortress',
        desc: 'Finish a season without losing at home.',
        check: () => {
            const team = achUserTeam();
            const rows = achState.matches[saveState.saveName] || [];
            const home = team ? rows.filter(r => r.homeId === team.id) : [];
            return home.length >= 5 && home.every(r => achIsWon(r) || r.draw);
        }
    },
    {
        id: 'centurions',
        icon: '💯',
        title: 'Centurions',
        desc: 'Reach 100 points in a league season.',
        check: () => {
            const team = achUserTeam();
            return !!(team && isLeagueFormat() && (team.points || 0) >= 100);
        }
    },
    {
        id: 'golden-generation',
        icon: '🌟',
        title: 'Golden Generation',
        desc: 'Win the league with at least three players rated 85 or higher.',
        check: (ctx) => {
            const team = achUserTeam();
            return !!(ctx && ctx.wonLeague && team && (team.players || []).filter(p => (p.rating || 0) >= 85).length >= 3);
        }
    },
    {
        id: 'three-headed-attack',
        icon: '🐉',
        title: 'Three-Headed Attack',
        desc: 'Have three players score at least 10 league goals each.',
        check: (ctx) => !!(ctx && ctx.userPlayersWithTenGoals >= 3)
    },
    {
        id: 'deadline-day',
        icon: '⏰',
        title: 'Deadline Day',
        desc: 'Complete three transfers in one save.',
        check: () => achSigsThisSave().length >= 3
    },
    {
        id: 'draft-master',
        icon: '🃏',
        title: 'Draft Master',
        desc: 'Win a league using a drafted squad.',
        check: (ctx) => !!(ctx && ctx.wonLeague && saveState.mode === 'draft')
    },
    {
        id: 'kings-of-europe',
        icon: '👑',
        title: 'Kings of Europe',
        desc: 'Win the UEFA Champions League.',
        check: (ctx) => !!(ctx && ctx.wonUcl)
    },
    {
        id: 'cup-lift',
        icon: '🏆',
        title: 'Cup Lift',
        desc: 'Win a knockout tournament.',
        check: (ctx) => !!(ctx && ctx.wonTournament)
    },
    {
        id: 'italy16',
        icon: '🇮🇹',
        title: 'After 16 years…',
        desc: 'Win the World Cup with Italy.',
        check: (ctx) => !!(ctx && ctx.wonWorldCup && /ital/i.test(ctx.championName || ''))
    },
    {
        id: 'notrigged',
        icon: '🇦🇷',
        title: 'Totally not rigged…',
        desc: 'Win the World Cup with Argentina without having Leo Messi.',
        check: (ctx) => {
            if (!ctx || !ctx.wonWorldCup || !/argentin/i.test(ctx.championName || '')) return false;
            const t = achUserTeam();
            return !!t && !(t.players || []).some(p => /messi/i.test(p.name));
        }
    },
    {
        id: 'usakeeper',
        icon: '🧤',
        title: 'The best USA keeper',
        desc: 'Select Brad Stuver to the USMNT as your starting GK.',
        check: (ctx) => !!(ctx && ctx.stuverStarted)
    },
    {
        id: 'dictator',
        icon: '👑',
        title: 'The dictator',
        desc: 'With Mbappé on your team, have him win the golden boot.',
        check: (ctx) => {
            if (!ctx || !ctx.goldenBootWinner) return false;
            const t = achUserTeam();
            if (!t || !(t.players || []).some(p => /mbapp/i.test(p.name))) return false;
            return /mbapp/i.test(ctx.goldenBootWinner);
        }
    }
];

// --- Unlock plumbing ---
function achUnlock(id) {
    if (achState.unlocked[id]) return false;
    const def = ACHIEVEMENTS.find(a => a.id === id);
    if (!def) return false;
    achState.unlocked[id] = Date.now();
    achState.unlockedMeta = achState.unlockedMeta || {};
    achState.unlockedMeta[id] = { save: saveState.saveName, date: achState.unlocked[id] };
    achSaveState(achState);
    achShowToast(def);
    return true;
}

function achUnlockedCount() {
    return Object.keys(achState.unlocked).filter(id => ACHIEVEMENTS.some(a => a.id === id)).length;
}

function achProgressText(def) {
    try {
        const rows = (achState.matches && achState.matches[saveState.saveName]) || [];
        const team = achUserTeam();
        if (def.id === 'transfer50') return `${Math.min(achState.transfers || 0, 50)}/50 transfers`;
        if (def.id === 'transfer1') return `${Math.min(achState.transfers || 0, 1)}/1 transfer`;
        if (def.id === 'deadline-day') return `${Math.min(achSigsThisSave().length, 3)}/3 transfers`;
        if (def.id === 'fast-start') return `${Math.min(rows.slice(0, 3).filter(r => achIsWon(r)).length, 3)}/3 opening wins`;
        if (def.id === 'long-haul') return `${Math.min(rows.length, 20)}/20 matches tracked`;
        if (def.id === 'golden-gloves' && team) {
            const gk = (team.players || []).filter(p => p.pos === 'GK').sort((a, b) => (b.stats?.cleanSheets || 0) - (a.stats?.cleanSheets || 0))[0];
            return `${Math.min(gk?.stats?.cleanSheets || 0, 10)}/10 clean sheets`;
        }
        return '';
    } catch (e) { return ''; }
}

// Evaluate every achievement against the current context. Safe to call often —
// unlocks are one-way and the toast only fires once per achievement.
function achEvaluate(ctx) {
    // saveState is a `let` binding declared in app.js — before that script has
    // run, touching it throws (TDZ), so guard with try/catch.
    try { if (!saveState || !saveState.saveName) return; } catch (e) { return; }
    ACHIEVEMENTS.forEach(def => {
        if (achState.unlocked[def.id]) return;
        try {
            if (def.check(ctx || {})) achUnlock(def.id);
        } catch (e) { /* one broken check must not break the rest */ }
    });
}

// --- UI: toast + trophy cabinet modal ---
function achShowToast(def) {
    const box = document.getElementById('ach-toast');
    if (!box) return;
    box.innerHTML = `<span class="ach-toast-icon">${def.icon}</span><div class="ach-toast-text"><strong>Achievement unlocked!</strong><span>${esc(def.icon + ' ' + def.title)}</span></div>`;
    box.classList.add('show');
    clearTimeout(achShowToast._t);
    achShowToast._t = setTimeout(() => box.classList.remove('show'), 4200);
}

function achOpenModal() {
    const listEl = document.getElementById('ach-list');
    const countEl = document.getElementById('ach-progress-label');
    if (!listEl) return;
    const total = ACHIEVEMENTS.length;
    const got = achUnlockedCount();
    if (countEl) countEl.innerHTML = `<strong>${got}</strong> of <strong>${total}</strong> unlocked`;
    const bar = document.getElementById('ach-progress-bar');
    if (bar) bar.style.width = total ? `${Math.round((got / total) * 100)}%` : '0%';
    listEl.innerHTML = ACHIEVEMENTS.map(a => {
        const when = achState.unlocked[a.id];
        const meta = achState.unlockedMeta && achState.unlockedMeta[a.id];
        const progress = when ? `Unlocked ${new Date(when).toLocaleDateString()}${meta && meta.save ? ` · ${meta.save}` : ''}` : achProgressText(a);
        return `<div class="ach-card ${when ? 'unlocked' : 'locked'}">
            <span class="ach-card-icon">${when ? a.icon : '🔒'}</span>
            <div class="ach-card-body">
                <strong>${esc(a.title)}</strong>
                <span>${esc(a.desc)}</span>
                ${progress ? `<small class="ach-progress-note">${esc(progress)}</small>` : ''}
            </div>
            <span class="ach-card-state">${when ? '✔' : '—'}</span>
        </div>`;
    }).join('');
    document.getElementById('ach-modal').style.display = 'flex';
}

function achCloseModal() {
    document.getElementById('ach-modal').style.display = 'none';
}

// [playerName, clubTheyReturnTo] — the club they played for earlier in their
// career and are now rejoining.
const ACH_HOMECOMINGS = [
    ['Neymar', 'Santos FC'],
    ['L. Suárez', ' Nacional'],
    ['C. Ronaldo', 'Sporting CP'],
    ['C. Ronaldo', 'Manchester United'],
    ['R. Lukaku', 'Chelsea FC'],
    ['T. Werner', 'Chelsea FC'],
    ['R. Sterling', 'Chelsea FC'],
    ['P. Pogba', 'Manchester United'],
    ['D. Zagadou', 'Borussia Dortmund'],
    ['H. Mkhitaryan', 'Borussia Dortmund']
];

// --- Signing classification -------------------------------------------------
// Called after any transfer lands a player in the user's club. Decides what
// kind of achievement-worthy move this was:
//   kind: 'homecoming' → the player returns to a club from their history
//   kind: 'reunion'    → the destination squad already holds a former teammate
// Returns null for an ordinary transfer.
function achClassifySigning(playerName, destClubName, destSquad) {
    if (!playerName || !destClubName) return null;
    // Homecoming: the player's transfer history contains this club.
    const hist = achHistoryOf(playerName);
    if (hist.some(h => h && h.club && achClubNameLooselyEquals(h.club, destClubName))) {
        return { kind: 'homecoming' };
    }

    // Reunion: someone already in the destination squad shared a past stop.
    const mates = new Set(getFormerTeammates({ name: playerName, transferHistory: hist }, activeDatabase).map(x => x.name));
    const reunitedWith = (destSquad || []).find(p => mates.has(p.name));
    if (reunitedWith) return { kind: 'reunion', with: reunitedWith.name };
    return null;
}

// Loose club-name equality: "Bayern" matches "FC Bayern München".
function achClubNameLooselyEquals(a, b) {
    if (!a || !b) return false;
    const norm = (s) => String(s).toLowerCase().replace(/\b(fc|cf|sc|ac|as|afc|cd|ca|rc|ss|ssc|club|de|del)\b/g, ' ').replace(/[^a-z0-9]/g, '');
    const na = norm(a), nb = norm(b);
    return na === nb || (na.length > 3 && nb.includes(na)) || (nb.length > 3 && na.includes(nb));
}

function achHistoryOf(playerName) {
    // Players can exist in several leagues (e.g. Messi in both MLS and the
    // World Cup squad) — merge every copy's history so classification and
    // teammate matching see the full picture.
    const out = [];
    const push = (p) => { if (p && Array.isArray(p.transferHistory)) out.push(...p.transferHistory); };
    if (typeof activeDatabase !== 'undefined' && activeDatabase && activeDatabase.leagues) {
        for (const k in activeDatabase.leagues) {
            for (const t of activeDatabase.leagues[k].teams || []) {
                (t.players || []).forEach(q => { if (q.name === playerName) push(q); });
            }
        }
    }
    try {
        if (saveState && saveState.teams) {
            for (const t of saveState.teams) {
                (t.players || []).forEach(q => { if (q.name === playerName) push(q); });
            }
        }
    } catch (e) { /* ignore */ }
    return out;
}

// --- Roster snapshots ("Overhaul") ---
// Snapshots are stored as compact strings "Name|rating,Name|rating,..." so the
// persistent blob stays tiny. `matchday` keeps the newest-only rule honest.
function achMarkRosterSnapshot(team, matchday) {
    if (!team || !Array.isArray(team.players) || !saveState.saveName) return;
    achState.matchdayRosters = achState.matchdayRosters || {};
    const list = achState.matchdayRosters[saveState.saveName] = achState.matchdayRosters[saveState.saveName] || [];
    const md = matchday || saveState.currentMatchday || list.length + 1;
    const snap = team.players.slice(0, 11)
        .map(p => `${p.name}|${p.rating}`)
        .sort().join(',') + `@${md}`;
    if (list[list.length - 1] === snap) return;
    list.push(snap);
    if (list.length > 200) list.splice(0, list.length - 200);
    achSaveState(achState);
}

function achParseSnapshot(snap) {
    if (!snap) return null;
    const body = String(snap).split('@')[0];
    if (!body) return null;
    return body.split(',').map(chunk => {
        const idx = chunk.lastIndexOf('|');
        if (idx === -1) return { n: chunk, r: 0 };
        return { n: chunk.slice(0, idx), r: parseFloat(chunk.slice(idx + 1)) || 0 };
    });
}

function achRosterHistory() {
    return (achState.matchdayRosters && achState.matchdayRosters[saveState.saveName]) || [];
}

// Signings already logged for this save (kind-tagged).
function achSigsThisSave() {
    return (achState.signings && achState.signings[saveState.saveName]) || [];
}

// Called by the swap modal whenever a player joins the user's club.
function achRecordSigning(playerName, destClubName, destSquad) {
    if (!playerName || !destClubName || !saveState || !saveState.saveName) return null;
    const cls = achClassifySigning(playerName, destClubName, destSquad);
    achState.signings = achState.signings || {};
    const list = achState.signings[saveState.saveName] = achState.signings[saveState.saveName] || [];
    const row = Object.assign({ name: playerName, club: destClubName }, cls || { kind: 'normal' });
    list.push(row);
    if (list.length > 300) list.splice(0, list.length - 300);
    achSaveState(achState);
    achEvaluate();
    return cls;
}

// --- Bridge called from app.js after a swap lands ---------------------------
function achOnSwapApplied(teamObj, chosen) {
    try {
        if (!teamObj || !chosen || !saveState || !saveState.teams) return;
        // Only transfers INTO the user's own live squad count.
        if (!saveState.teams.includes(teamObj)) return;
        achRecordTransfer(1);
        achRecordSigning(chosen.name, teamObj.name, teamObj.players);
        const modal = document.getElementById('ach-modal');
        if (modal && modal.style.display === 'flex') achOpenModal();
    } catch (e) { /* never block the swap */ }
}

// --- Season-end evaluation ---------------------------------------------------
function achCheckStuverStartingGK() {
    try {
        const t = achUserTeam();
        if (!t || !/united states/i.test(t.name || '')) return;
        const gk = (t.players || []).find(p => p.pos === 'GK');
        if (gk && /stuver/i.test(gk.name)) achUnlock('usakeeper');
    } catch (e) { /* ignore */ }
}

// Called from triggerEndgameModalDisplay — the season is over and a champion
// exists. Evaluates World Cup wins, golden boot and the USMNT keeper.
function achEvaluateSeasonEnd() {
    try {
        if (!saveState || !saveState.saveName) return;
        const ctx = { championName: null };

        // Golden boot: top league goal scorer of this run.
        let best = null;
        saveState.teams.forEach(t => (t.players || []).forEach(p => {
            const g = p.stats ? p.stats.goals : 0;
            if (!best || g > best.g) best = { name: p.name, g };
        }));
        if (best && best.g > 0) {
            ctx.goldenBootWinner = best.name;
            ctx.goldenBootGoals = best.g;
        }
        const user = achUserTeam();
        if (user) {
            const userScorers = (user.players || []).slice().sort((a, b) => (b.stats ? b.stats.goals : 0) - (a.stats ? a.stats.goals : 0));
            const userAssisters = (user.players || []).slice().sort((a, b) => (b.stats ? b.stats.assists : 0) - (a.stats ? a.stats.assists : 0));
            const userKeepers = (user.players || []).filter(p => p.pos === 'GK').sort((a, b) => (b.stats ? b.stats.cleanSheets : 0) - (a.stats ? a.stats.cleanSheets : 0));
            ctx.userTopScorer = userScorers[0] ? userScorers[0].name : null;
            ctx.userTopScorerGoals = userScorers[0] && userScorers[0].stats ? userScorers[0].stats.goals : 0;
            ctx.userPlayersWithTenGoals = userScorers.filter(p => p.stats && p.stats.goals >= 10).length;
            ctx.userTopAssists = userAssisters[0] && userAssisters[0].stats ? userAssisters[0].stats.assists : 0;
            ctx.userBestGoalkeeperCleanSheets = userKeepers[0] && userKeepers[0].stats ? userKeepers[0].stats.cleanSheets : 0;
        }

        // Champion detection per competition format.
        if (typeof isWorldCupFormat === 'function' && isWorldCupFormat()) {
            const remaining = saveState.teams.filter(t => !t.isEliminated);
            const champ = remaining.length ? remaining[0] : null;
            ctx.championName = champ ? champ.name : null;
            if (champ && user && champ.id === user.id) ctx.wonWorldCup = true;
        } else if (typeof isUclFormat === 'function' && isUclFormat()) {
            const champId = saveState.uclBracket && saveState.uclBracket.champion;
            const champ = saveState.teams.find(t => t.id === champId);
            ctx.championName = champ ? champ.name : null;
            ctx.wonUcl = !!(champ && user && champ.id === user.id);
        } else if (typeof isLeagueFormat === 'function' && isLeagueFormat()) {
            const sorted = [...saveState.teams].sort((a, b) => b.points - a.points || b.gd - a.gd);
            ctx.championName = sorted[0] ? sorted[0].name : null;
            ctx.wonLeague = !!(sorted[0] && user && sorted[0].id === user.id);
        } else if (typeof isKnockoutFormat === 'function' && isKnockoutFormat()) {
            const remaining = saveState.teams.filter(t => !t.isEliminated);
            const champ = remaining.length === 1 ? remaining[0] : null;
            ctx.championName = champ ? champ.name : null;
            ctx.wonTournament = !!(champ && user && champ.id === user.id);
        }

        achEvaluate(ctx);
        achCheckStuverStartingGK();
    } catch (e) { /* ignore */ }
}

// --- Per-save context reset --------------------------------------------------
// Called when a NEW run receives its auto name: wipes stale per-save tracking
// under that name. Unlocked achievements are never touched.
function achResetSaveContext() {
    try {
        if (!saveState || !saveState.saveName) return;
        const name = saveState.saveName;
        ['matches', 'matchdayRosters', 'signings'].forEach(k => {
            if (achState[k] && achState[k][name]) delete achState[k][name];
        });
        achSaveState(achState);
    } catch (e) { /* ignore */ }
}

// --- Static UI wiring (welcome-screen entry point) ---------------------------
// The Trophy Cabinet button lives on the welcome screen; bound defensively so
// the module also loads in headless test harnesses without the full DOM.
(function achBindUi() {
    const btn = document.getElementById('achievements-btn');
    if (btn) btn.onclick = achOpenModal;
    document.querySelectorAll('#ach-modal .ach-close-trigger').forEach(el => { el.onclick = achCloseModal; });
    const overlay = document.getElementById('ach-modal');
    if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) achCloseModal(); });
})();

// --- World Cup extras --------------------------------------------------------
// Italy is absent from the real 2026 field (they did not qualify), but the
// "After 16 years…" achievement needs them selectable; Brad Stuver is not in
// the USMNT squad, but "The best USA keeper" needs him pickable. Both are
// injected into the in-memory World Cup league when the setup screen opens.
let achWcExtrasDone = false;
function achEnsureWorldCupExtras(wcLeague) {
    try {
        if (!wcLeague || !Array.isArray(wcLeague.teams)) return;
        if (achWcExtrasDone) return;
        // Italy — a squad built from real Azzurri players already in the
        // database (cloned in, never moved from their clubs).
        if (!wcLeague.teams.some(t => /ital/i.test(t.name || ''))) {
            wcLeague.teams.push({
                id: 'ita',
                name: 'Italy',
                players: [
                    { name: 'G. Vicario', pos: 'GK', rating: 84 },
                    { name: 'G. Di Lorenzo', pos: 'RB', rating: 84 },
                    { name: 'A. Bastoni', pos: 'CB', rating: 87 },
                    { name: 'A. Buongiorno', pos: 'CB', rating: 86 },
                    { name: 'F. Dimarco', pos: 'LB', rating: 86 },
                    { name: 'S. Tonali', pos: 'CDM', rating: 85 },
                    { name: 'N. Barella', pos: 'CM', rating: 88 },
                    { name: 'M. Locatelli', pos: 'CDM', rating: 84 },
                    { name: 'M. Zaccagni', pos: 'LW', rating: 81 },
                    { name: 'N. Zaniolo', pos: 'RW', rating: 80 },
                    { name: 'M. Retegui', pos: 'ST', rating: 85 }
                ]
            });
        }
        // USA — Austin FC's cult hero takes the starting spot in goal.
        const usa = wcLeague.teams.find(t => t.id === 'usa' || /united states/i.test(t.name || ''));
        if (usa && Array.isArray(usa.players) && usa.players.length && !usa.players.some(p => /stuver/i.test(p.name || ''))) {
            const gkIdx = usa.players.findIndex(p => p.pos === 'GK');
            const incoming = { name: 'B. Stuver', pos: 'GK', rating: 75 };
            if (gkIdx >= 0) usa.players[gkIdx] = incoming;
            else usa.players.unshift(incoming);
        }
        achWcExtrasDone = true;
    } catch (e) { /* ignore */ }
}
