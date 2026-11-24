# RED FLAG: Port of Entry

A *Papers, Please*-style customs inspection game about ethical sourcing. It's night at a rain-soaked neon container port, ships are queuing, and somewhere in the manifests is cargo made with forced labour. Your boss wants throughput. The smugglers are learning how you play.

**Play it:** open `index.html` from any static web server (see [Run locally](#run-locally)), or visit the GitHub Pages URL for this repo.

> All companies, ships and people in the game are **fictional**. The regions and regulations (UFLPA, the EU Forced Labour Regulation, the EU Battery Regulation, CSDDD) are real and are used to give the game real-world grounding.

---

## How to play

You work **3 shifts of 3 minutes**. Ships dock one at a time. For each one, read the **manifest** (left), the **supply chain map** (centre) and the **Intel Feed** (right), then stamp it.

| Key | Action | What it does |
|---|---|---|
| **A** | APPROVE | Clears the ship. Earns the most revenue, but if it carried a violation, an alarm goes off and the NGO may publish an exposé. |
| **D** | DETAIN | Holds the ship. Correct if it had a violation. If you detain an honest trader, they complain, lobby your boss, or take their business to the rival port. |
| **Space** | AUDIT | Spends ~6 seconds investigating and reveals hidden findings, highlighting the problem fields. The queue keeps filling while you audit. |
| **R** | Rulebook | Active rules, high-risk regions, HS code table, accredited auditors, and the price/weight reference for the current product. |
| **Esc / M** | Pause / Mute | |

### What to look for

| Violation | The tell |
|---|---|
| Forced labour | A supply-chain hop in a listed high-risk region (e.g. Xinjiang, artisanal cobalt zones in eastern DRC). |
| Transshipment | The declared origin doesn't match the country of the last production hop. Watch for a **Repackaging** hop in a third country. (A transit Warehouse is legal.) |
| HS mislabelling | The HS code chapter doesn't match the product. Check the rulebook's HS table. |
| Shell company | A supplier under 12 months old with fewer than 5 employees. |
| Forged / expired audit | The certificate expired before today's date, or the issuer isn't on the accredited list. |
| Under-pricing | Unit price below 60% of the market reference. |
| Weight mismatch | Declared weight is more than 15% off units × standard unit weight. |
| Missing smelter *(shift 2+)* | EU Battery Regulation: lithium, cobalt and nickel cargo must name its smelter of origin. |
| No due diligence *(shift 3+)* | CSDDD: a due-diligence statement is required. |

Some details look suspicious but are **legal**, for example a young firm with 40 staff, a price at 75% of market, or a transit warehouse. Over-detaining costs you money and reputation too.

### Scoring

You're balancing **Port Revenue** (throughput) against **Integrity** (violations caught). Correct calls build a **combo multiplier**. A missed violation sets off a red alarm, and later an NGO exposé hits your reputation. A backed-up queue makes the Port Director dock your pay. Your final grade runs **Rookie → Junior Inspector → Inspector → Senior Inspector → Chief Inspector**. Speed-stamping racks up points, but Senior needs ≥85% accuracy and Chief needs ≥92% with no more than 3 misses. Your initials go on the local **leaderboard** (stored in this browser only), so a class can compete on one machine.

---

## How the agents work

Every actor is an autonomous agent with **goals**, a **memory**, and a `decide()` step that runs every few seconds. `decide()` scores each possible action by utility and picks the best one, with some noise. The agents explain themselves in the **Intel Feed**, so you can watch them think.

| Agent | Goal | Memory and adaptation |
|---|---|---|
| **The Gilt Current** (smuggling syndicate) | Get contraband through | Tracks the catch rate for each tactic and each origin, with decay. If you keep catching direct Xinjiang shipments, it switches to transshipment through a third country, HS relabelling, fresh shell companies, forged certificates or lowball pricing. It floods the queue with clean decoys to rush you, and gets bolder if you stamp fast or miss things. |
| **Honest traders** (4 fictional firms with personalities) | Fast clearance | Remember wrongful detentions. Depending on temperament, they complain, lobby the Director, or reroute to the rival port. |
| **Tidewater Watch** (NGO) | Expose forced labour | Sends tip-offs that are about 75% accurate. If a violating ship gets through, it may publish an exposé, which appears as a spinning newspaper. |
| **Director Hollis Vane** (your boss) | Throughput | Memos get more frantic as the queue grows. Docks your pay if the backlog lasts too long or traders lobby. |
| **Port Calder** (rival port) | Steal traffic | Takes ships if you're slow or detain too many honest traders. |

At the end, the **Agent Replay** timeline shows how the syndicate adapted to your play style (for example, *"Caught 3/3 direct XUAR shipments → switching to transshipment via Vietnam"*). It also lists every violation you missed, with a one-line real-world explanation.

Code: `js/ai/syndicate.js` (smuggler), `js/ai/actors.js` (traders, NGO, director, rival), `js/ai/engine.js` (scheduling + events), `js/data/manifest.js` (manifests are generated so every violation has a visible tell and honest ships carry only legal red herrings).

### Claude Mode (optional)

In **Settings**, you can paste an Anthropic API key to let the **syndicate and the NGO** decide using Claude (`claude-haiku-5-5` via the Messages API, called directly from the browser). They return strict JSON `{action, tactic, thought}`, and those thoughts appear in the feed with a ✦ badge.

- The key is held **in memory only**. It is never saved to localStorage, never put in a URL, and never logged. Reloading the page forgets it.
- If anything goes wrong (network, bad key, bad JSON, timeout), the game silently falls back to the local utility AI. The game is fully playable without a key.
- Calling the API from a browser exposes the key to anyone who has the page open in their browser. Use your own key on your own machine, never a shared one.

---

## Tech

- Static site, no build step: `index.html` + native ES modules.
- [PixiJS v8](https://pixijs.com) + pixi-filters (bloom, CRT) for the port scene. All art is drawn in code.
- [GSAP](https://gsap.com) for animation. [Howler.js](https://howlerjs.com) for audio. All sound effects and music are synthesised in code (`js/audio/synth.js`, rendered in a Web Worker).
- Libraries load from the jsDelivr CDN, so the game needs an internet connection.

```
index.html
css/        style.css (UI), fx.css (stamps, newspaper, CRT overlay)
js/core/    event bus, shared config
js/scene/   Pixi port scene, supply-chain route map
js/fx/      stamps, shake, popups, alarm, newspaper, neon title
js/ai/      agent engine, syndicate, actors, Claude Mode client
js/data/    fictional world, products, HS codes, rules, manifest generator
js/game/    game loop, scoring, leaderboard
js/ui/      HUD, desk, screens, rulebook
js/audio/   procedural sound + music
```

## Run locally

ES modules need a web server (opening the file directly won't work):

```bash
npx http-server . -p 8080     # or: python3 -m http.server 8080
# open http://localhost:8080
```

Works best in a recent Chrome, Edge, Firefox or Safari, at 1280×720 or larger (a laptop on a projector is fine).

## Deploy to GitHub Pages

Push to a GitHub repo, then go to **Settings → Pages → Source: Deploy from a branch → `main` / root**. The `.nojekyll` file is already included.
