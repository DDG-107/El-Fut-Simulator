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
The complete experience. Pick the competing clubs from any leagues in the database, choose a format — **League** (double round robin) or **Knockout Tournament** (2–64 clubs, single elimination) — and configure your lineup before launching the season. Once play begins, rosters are locked apart from the dedicated transfer-window system. Simulate the whole season or step through it matchday by matchday. Careers autosave as you play and on exit.

### 📋 Single Season Draft
A one-session run. Choose a formation, name a club, and take over an existing club's slot in a league. Every position deals **five real players** drawn from clubs across the entire database — keep one per slot to build your starting XI, or hit auto-pick and let the game choose the best XI.

A **draft pot** selector offers a Champions League edition: every dealt player comes from one of the 36 qualified UCL clubs' squads, and the finished XI replaces a club of your choice and plays the full authentic Champions League format — league phase, playoffs and knockouts.

### 🥊 Draft Challenge
The same five-card draft, but preset guidelines decide the player pool and must be satisfied before the season can start. Every daily challenge now locks its competition league — for example, *Der Klassiker* can only be played in the Bundesliga, *El Clasico Kings* in La Liga, and *Milan Derby Draft* in Serie A — so the target league cannot be changed to bypass the scenario. Challenges include *Underdogs Only*, *Elite Poachers*, *The Wanderers*, *Moneyball*, *Under the Radar*, *Der Klassiker*, *El Clasico Kings*, *The Big Six*, *One-Club Wonder*, *Milan Derby Draft*, *Le Classique*, *Portuguese Pipeline*, *Youth Movement*, and *Brazilian Royalty*. Daily challenges also add modifiers such as minimum source-club diversity or using both sides of a rivalry, and the setup screen checks those rules before launch. Re-deal any position until the squad passes every rule.

### 👑 Omnipotent Mode
Unlimited budget and total control over your club. Same league structure, no financial limits.

### 🌍 National Team / World Cup
Pick any nation from the 48 qualified teams and play the 2026 World Cup: group stages that mirror the real format, then knockout rounds with penalty shootouts. Choose the full 48-nation field or a smaller custom one.

### 🏆 UEFA Champions League
Lead one of the 36 qualified clubs through the authentic 2026/27 Champions League: the Swiss-model league phase using the real draw (eight matchdays, two opponents from each pot, four home and four away), then the knockout phase — top 8 skip straight to the Round of 16 while teams 9–24 contest two-legged playoffs, with single-leg ties and penalties from there to the final.

Configure your squad before launch, then use **View Squad** from the hub as a read-only team profile. Realistic Careers can change the roster only through the dedicated transfer window; tournament and draft rosters remain fixed once play begins.

One-session modes (draft, World Cup, Champions League) end when you leave them — they are never written to the save list.

## Match Engine

Match results come from an expected-goals (xG) model: each side's xG derives from the rating gap to its opponent, and actual goals are drawn from a Poisson distribution around it. The practical effect — favorites win most of the time, evenly matched sides trade close games and draws, and underdogs still land a shock.

- **Chaos slider** (Realistic ↔ Arcade) scales how strongly rating gaps translate into results
- Knockout ties sharpen the quality gap, and shootouts favor the stronger side instead of being coin flips
- Goals and assists are distributed by position and rating, feeding the Top Players charts
- **Clean sheets are credited to goalkeepers only**, so the leaderboard ranks each club's actual keeper
- Standings track the full P / W / D / L / GF / GA / GD / Pts set

## Career Systems

League players now carry short-term form and morale. Wins build form streaks, defeats hurt confidence, and rivalry matches create extra atmosphere; current form is visible in squad profiles and influences team strength.

Completed realistic league seasons generate a three-player youth intake. Promote prospects from the **Career & Youth** dashboard, where each save also tracks a legacy score, career timeline, and transfer history.

Transfer-window mystery players now come with scouting hints and personality reveals after signing. The same dashboard records two-way deals, while matchdays create rivalry-aware headlines in the feed.

## Mid-Season Transfer Window
Once per league season — at the halfway matchday — the **transfer window** pops open: up to 3 of your players are randomly drawn into deals, each matched with a mystery player from another club in your save. The mystery player plays the same position, but their **rating is hidden until you sign them** — commit and gamble, or walk away and keep your squad intact. Signed deals are final and two-way (your outgoing player takes the mystery player's old slot at their club), count toward transfer achievements, and are reported in the match feed. The window never opens in knockout runs, drafts, the World Cup, or the Champions League.

## Achievements

Thirty-one achievements persist across **all** your saves — unlock them in any career, any game mode, and they stay unlocked. The 🏅 **Trophy Cabinet** on the main menu tracks them:

| Achievement | How to earn it |
| --- | --- |
| Invincible | Don't lose a game |
| 38-0 | Win every game |
| Transfer Market Apprentice | Make your first transfer |
| Transfer Market Master | Make 50 transfers |
| Overhaul | Replace and improve the entire starting XI of your team |
| Welcome back | Bring back an old player of your club |
| World champions | Win the World Cup |
| Hello, old friend | Reunite two players who were former teammates |
| Derby winner | Win a match against your team's rivals |
| Who's your daddy? | Win the double over your club rivals |
| After 16 years… | Win the World Cup with Italy |
| Totally not rigged… | Win the World Cup with Argentina without having Leo Messi |
| The best USA keeper | Select Brad Stuver to the USMNT as your starting GK |
| The dictator | With Mbappé on your team, have him win the golden boot |
| Road Warriors | Win every away league match in a season |
| Clean Sweep | Keep a clean sheet in every recorded league match |
| Goal Machine | Have one of your players score 20 league goals in a season |
| Golden Gloves | Have your goalkeeper record 10 clean sheets in a season |
| The Viking | With Haaland on your team, have him win the golden boot |
| Messi Magic | With Messi on your team, have him win the golden boot |
| The Maestro | Have one of your players lead the league in assists with 15 or more |
| Fast Start | Win your first three league matches |
| Long Haul | Go 20 league matches without a defeat |
| Home Fortress | Finish a season without losing at home |
| Centurions | Reach 100 points in a league season |
| Golden Generation | Win the league with at least three players rated 85+ |
| Three-Headed Attack | Have three players score at least 10 league goals each |
| Deadline Day | Complete three transfers in one save |
| Draft Master | Win a league using a drafted squad |
| Kings of Europe | Win the UEFA Champions League |
| Cup Lift | Win a knockout tournament |

Two notes on the trickier ones: Italy didn't actually qualify for 2026, so the World Cup setup quietly adds them as a selectable nation — and "The best USA keeper" works because Austin FC's Brad Stuver joins the USMNT squad when the World Cup league loads. A toast pops the moment an achievement unlocks, wherever you are in the app.

Transfers live only inside the save — the database itself is never modified, so every new career starts from real life.

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
| `achievements.js` | Cross-save achievements: definitions, unlock logic, toast, trophy cabinet |
| `database.js` | Built-in teams and players |
| `modes-draft.js` | Draft, Draft Challenge, and Omnipotent setup flows |
| `modes-worldcup.js` | World Cup setup, groups, and bracket |
| `modes-ucl.js` | Champions League setup, authentic league-phase draw, and knockout bracket |

Player photo paths in `database.js` (e.g. `assets/…png`) are optional — the UI hides missing images and falls back to initials.
