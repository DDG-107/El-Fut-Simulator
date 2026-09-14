# El Fut Simulator

A football (soccer) management simulator that runs entirely in your browser. Pick any clubs from the built-in database — or build your own squad from every player in it — then simulate full league seasons, knockout cups, and the 2026 World Cup with a statistically grounded match engine.

No build step, no dependencies, no backend. Everything runs client-side and saves locally.

## Quick Start

Serve the folder with any static file server and open it in a browser:

```bash
# any one of these works
npx serve .
python3 -m http.server 8080
```

Then visit `http://localhost:8080` (or the port your server prints). Opening `index.html` directly from disk also works in most browsers, though a local server is recommended.

## Game Modes

### 🏟️ Realistic Career
The complete experience. Pick the competing clubs from any leagues in the database, choose a format — **League** (double round robin) or **Knockout Tournament** (2–64 clubs, single elimination) — and manage your club through the season. Swap any database player into your lineup, then simulate the whole season or step through it matchday by matchday. Careers autosave as you play and on exit.

### 📋 Single Season Draft
A one-session run. Choose a formation, name a club, and take over an existing club's slot in a league. Every position deals **five real players** drawn from clubs across the entire database — keep one per slot to build your starting XI, or hit auto-pick and let the game choose the best XI.

### 🥊 Draft Challenge
The same five-card draft, but preset guidelines decide the player pool and must be satisfied before the season can start. Challenges include *Underdogs Only*, *Elite Poachers*, *The Wanderers*, *Moneyball*, *Der Klassiker*, *El Clasico Kings*, *The Big Six*, and *One-Club Wonder*. Re-deal any position until the squad passes every rule.

### 👑 Omnipotent Mode
Unlimited budget and total control over your club. Same league structure, no financial limits.

### 🌍 National Team / World Cup
Pick any nation from the 48 qualified teams and play the 2026 World Cup: group stages that mirror the real format, then knockout rounds with penalty shootouts. Choose the full 48-nation field or a smaller custom one.

### 🏆 UEFA Champions League
Lead one of the 36 qualified clubs through the authentic 2026/27 Champions League: the Swiss-model league phase using the real draw (eight matchdays, two opponents from each pot, four home and four away), then the knockout phase — top 8 skip straight to the Round of 16 while teams 9–24 contest two-legged playoffs, with single-leg ties and penalties from there to the final.

One-session modes (draft, World Cup, Champions League) end when you leave them — they are never written to the save list.

## Match Engine

Match results come from an expected-goals (xG) model: each side's xG derives from the rating gap to its opponent, and actual goals are drawn from a Poisson distribution around it. The practical effect — favorites win most of the time, evenly matched sides trade close games and draws, and underdogs still land a shock.

- **Chaos slider** (Realistic ↔ Arcade) scales how strongly rating gaps translate into results
- Knockout ties sharpen the quality gap, and shootouts favor the stronger side instead of being coin flips
- Goals, assists, and clean sheets are distributed by position and rating, feeding the Top Players charts
- Standings track the full P / W / D / L / GF / GA / GD / Pts set

## Saves

Saving is automatic — there is no name to type. Careers are named from what they are:

```
Chelsea FC — Realistic Career — 14 Sept 2026
```

- Named the moment your season launches (when your club is final)
- Same-club, same-day collisions get a `(2)`, `(3)`, … suffix so nothing is ever overwritten
- Autosaved after simulated matchdays and when you exit to the menu
- Stored in your browser's `localStorage`; the load menu lists, resumes, and deletes them

## Custom Database

The built-in database (`database.js`) ships with 13 competitions — the Premier League, Championship, La Liga, Bundesliga, Serie A, Ligue 1, Eredivisie, Liga Portugal, the Belgian Pro League, Liga MX, MLS, Brasil Série A, the Saudi Pro League, the 48-nation World Cup 2026 field, and the 36-club UEFA Champions League 26/27 field — with real squads.

The in-app **Database Manager** (from the main menu) lets you edit any of it without touching code:

- Add, edit, and remove leagues, teams, and players
- Import and export the whole database as JSON
- Reset to the built-in defaults

Your edits are stored locally and override the built-in data on load. When the app is updated with new built-in teams or leagues, your stored copy is merged with them once on upgrade — your edits are preserved and the new content appears.

## Theming

The UI is a dark slate theme with a violet accent by default, plus a full **light theme** — toggle it from the menu, the hub sidebar, or the database manager. The choice persists between visits, and the saved theme is applied before first paint so there is no flash on load.

## Project Structure

| File | Purpose |
| --- | --- |
| `index.html` | App shell: menu, career hub, modals |
| `style.css` | Design system — tokens, themes, components |
| `app.js` | Core: save system, match engine, standings, hub UI |
| `database.js` | Built-in teams and players |
| `modes-draft.js` | Draft, Draft Challenge, and Omnipotent setup flows |
| `modes-worldcup.js` | World Cup setup, groups, and bracket |
| `modes-ucl.js` | Champions League setup, authentic league-phase draw, and knockout bracket |

Player photo paths in `database.js` (e.g. `assets/…png`) are optional — the UI hides missing images and falls back to initials.
