# RED FLAG: Port of Entry — module contract

Static site, no build step. `index.html` + native ES modules. Libraries:
- PixiJS v8 via importmap: `import * as PIXI from 'pixi.js'` (→ `https://cdn.jsdelivr.net/npm/pixi.js@8.6.6/dist/pixi.min.mjs`)
- pixi-filters v6 via importmap: `import { AdvancedBloomFilter, CRTFilter, ... } from 'pixi-filters'`
- GSAP 3 as a global `window.gsap` (classic script tag, loaded before modules)
- Howler as globals `window.Howl` / `window.Howler` (classic script tag)

All art is procedural. All companies/people are FICTIONAL. Real regions/regulations only as flavour.
Every module must fail soft: wrap optional calls to other modules in `?.` / try-catch so one missing piece never breaks the game.

## Ownership (do not edit files you don't own)
| Owner | Files |
|---|---|
| Lead (integration) | `index.html`, `js/core/*`, `CONTRACT.md`, `README.md` |
| Visuals | `js/scene/*`, `js/fx/*`, `css/fx.css` |
| AI engine | `js/ai/*`, `js/data/*` |
| Gameplay + UI | `js/main.js`, `js/game/*`, `js/ui/*`, `css/style.css` |
| Sound | `js/audio/*` |

## Shared
- `js/core/bus.js` — `bus.on(evt, fn) → unsubscribe`, `bus.off`, `bus.emit(evt, payload)`.
- `js/core/config.js` — `PALETTE` (hex ints), `CSS` (strings), `GAME` constants, `ACTIONS`.
  Palette: night `#05070f`, navy `#0a1028`, magenta `#ff2bd6`, cyan `#19f0ff`, amber `#ffb020`, red `#ff3355`, green `#2bff9a`.
- Fonts (loaded in index.html from Google Fonts): `'Orbitron'` (neon headings), `'Share Tech Mono'` (terminal/intel), `'Special Elite'` (typewriter manifest papers), `'Bebas Neue'` (stamps/newspaper).

## DOM layout (index.html provides these roots)
```
<div id="scene-root">   full-screen Pixi canvas, z 0 (Visuals)
<div id="ui-root">      all DOM UI, z 10 (Gameplay builds everything inside)
<div id="fx-root">      full-screen pointer-events:none overlay, z 50 (Visuals' DOM fx: stamps, popups, newspaper, alarm sweep)
<div id="crt-overlay">  scanlines + vignette, z 100, pointer-events:none (Visuals styles it in css/fx.css)
```
Screen layout during a shift: the top ~45% of the viewport is the open port (Pixi scene visible through it);
the bottom ~55% is the inspector's desk (DOM, semi-opaque, neon trim) with: manifest paper (left),
supply-chain route map + stamp buttons (centre), Intel Feed (right). HUD bar across the top.
Must work at 1280×720 (laptop projector) up to 1920×1080. Use `vh`/`clamp()` sizing.

## Data: Manifest (produced by AI engine, `js/data/manifest.js`)
```js
{
  id: 'SHP-0042',
  shipName: 'MV Halcyon Drift', shipColor: 0x19f0ff,   // hull light colour for the scene
  agent: 'syndicate' | 'trader',                        // who sent it (hidden from player)
  firm: { id, name, country, honest: bool },            // the importer of record (visible name/country)
  product: 'Lithium-ion battery cells',
  hsCode: '8507.60',                                    // as DECLARED
  declaredOrigin: 'Vietnam',
  units: 1200, unitLabel: 'cartons',
  unitWeightKg: 18,                                     // standard reference weight per unit (visible in rulebook/price guide)
  weightKg: 21600,                                      // declared gross weight
  unitPrice: 41.5, marketPrice: 46,                     // USD; marketPrice = reference shown in price guide
  chain: [                                              // 3–5 hops, upstream → port. Visible.
    { step: 'Mine' | 'Refinery' | 'Smelter' | 'Factory' | 'Assembly' | 'Warehouse' | 'Repackaging' | 'Exporter',
      firm: 'Qinghe Mineral Co.', country: 'China', region: 'Xinjiang (XUAR)', lat, lon,   // lat/lon for the map
      firmAgeMonths: 140, employees: 900 },             // shell tells: tiny age/employees
  ],
  certificate: { issuer: 'Veritrace Audit GmbH', id: 'VT-2026-88121', issued: '2026-04-02', expires: '2027-04-01', accredited: true },
  smelter: 'Tanaka Ridge Smelter (Indonesia)' | null,   // relevant once EU Battery Reg rule is active
  ddStatement: true | false,                            // relevant once CSDDD rule is active
  violations: ['forced_labour', ...],                   // GROUND TRUTH — never shown until debrief/audit
  auditFindings: ['Satellite-verified: mine site in XUAR ...'], // revealed on AUDIT (always ≥1 line; honest ships get clean findings)
  tactic: 'direct' | 'transship' | 'relabel' | 'shell' | 'forge' | 'lowball' | 'overweight' | 'decoy' | null,
  tip: null | { text, accurate: bool },                 // attached NGO tip-off, if any
}
```
Violation ids (and their visible "tell"):
| id | tell the player can spot |
|---|---|
| `forced_labour` | a chain hop in a listed high-risk region (rulebook list, e.g. Xinjiang (XUAR)) |
| `transshipment` | declaredOrigin ≠ the country where the goods were actually made; chain shows a `Repackaging` hop in a third country |
| `hs_mislabel` | HS code chapter doesn't match product (rulebook HS table) |
| `shell_company` | a hop firm with `firmAgeMonths < 12` and `employees < 5` |
| `forged_cert` | certificate expired vs GAME.GAME_DATE, or `accredited:false` (issuer not on the accredited list) |
| `underpriced` | unitPrice < 60% of marketPrice |
| `weight_mismatch` | weightKg differs from units × unitWeightKg by > 15% |
| `missing_smelter` | (rule from shift 2) lithium/cobalt/nickel product with `smelter: null` |
| `no_due_diligence` | (rule from shift 3) `ddStatement:false` |

`js/data/world.js` exports: `FIRMS` (honest traders), `REGIONS` (incl. `highRisk:true` ones), `HS_TABLE` (code → product family), `ACCREDITED_AUDITORS`, `RULES` (per-shift rule list, see below), `PRODUCTS`.
`RULES`: `[{ id, shift: 1|2|3, title, text, checks: ['forced_labour', ...] }]` — `getActiveRules(shift)` returns rules for shifts ≤ shift. The rulebook UI renders these.

## AI engine API (`js/ai/engine.js`)
```js
import { createEngine } from './ai/engine.js';
const engine = createEngine({ bus });
engine.startShift(shiftIndex /*0..2*/);        // resets per-shift spawn pacing; agents keep memory across shifts
engine.tick(dt /*seconds*/, state);            // call every frame while a shift is running; state below
engine.recordDecision({ manifest, action, correct, decisionSeconds }); // after the player stamps
engine.endShift() → { headlines: [string], syndicateSummary: string }  // for the between-shift briefing
engine.getReplay() → [{ t, shift, type: 'adapt'|'missed'|'caught'|'expose'|'tip', text, explain? }]
engine.setClaudeKey(keyOrNull);                // memory only; never persisted
engine.isClaudeActive() → bool
```
`state` passed to tick: `{ shift, timeLeft, queueLength, queueIds, revenue, reputation, avgDecisionSeconds, recentDecisions: [{action, correct, violations, tactic}] }`.

Engine → bus events:
| event | payload | consumer |
|---|---|---|
| `ship:arrive` | manifest | Gameplay adds to queue; Visuals sails a ship in |
| `intel` | `{ agent: 'syndicate'|'trader'|'ngo'|'director'|'rival'|'claude', name, text, tone: 'neutral'|'warn'|'alert'|'good' }` | Gameplay's Intel Feed |
| `ngo:tip` | `{ shipId, text, accurate }` | Gameplay flags the ship in queue |
| `ngo:expose` | `{ shipId, headline, subhead, repLoss }` | Gameplay: −reputation; Visuals: newspaper spin |
| `director:memo` | `{ text, urgency: 0..1 }` | Gameplay shows memo toast |
| `director:dock_pay` | `{ amount, reason }` | Gameplay: −revenue |
| `trader:complaint` | `{ firm, text }` | Gameplay: small −reputation |
| `trader:reroute` | `{ firm, ships }` | Gameplay: −revenue (lost traffic) |
| `rival:steal` | `{ ships, text }` | Gameplay: −revenue |

## Gameplay → bus events (Gameplay emits; others may listen)
| event | payload |
|---|---|
| `screen` | `{ name: 'title'|'tutorial'|'shift'|'briefing'|'debrief' }` |
| `shift:start` / `shift:end` | `{ shift }` |
| `inspect` | manifest (now on desk) |
| `audit:start` / `audit:done` | `{ manifest }` |
| `decision` | `{ manifest, action, correct, missed: [violation ids], points }` |
| `combo` | `{ combo }` |
| `alarm` | `{ reason }` (a violation slipped through) |

## Visuals API
`js/scene/scene.js`:
```js
const scene = await createScene(document.getElementById('scene-root'));
scene.setMode('title' | 'shift' | 'briefing' | 'debrief');  // camera framing / mood
scene.shipArrive(manifest);           // ship glides into queue lane with hull lights
scene.shipDock(shipId);               // move ship to inspection berth
scene.shipDepart(shipId, outcome);    // 'approve' sails off | 'detain' red beacons, towed aside | 'reroute' leaves toward horizon
scene.setTension(0..1);               // rain intensity, alarm-light frequency
scene.alarm();                        // red sweep across the port
```
`js/fx/fx.js` (DOM + GSAP into #fx-root, plus applies to given elements):
```js
fx.slideInPaper(el); fx.slideOutPaper(el, outcome);
fx.stamp(type /*'approve'|'detain'|'audit'*/, targetEl);   // big rubber stamp slams onto targetEl: shake + ink splatter
fx.shake(strength = 1);
fx.popup(text, x, y, color);          // floating score popup
fx.combo(n);                          // combo burst
fx.alarm(text);                       // full-screen red sweep + text
fx.newspaper(headline, subhead);      // spinning newspaper front page, auto-dismiss ~3.5s or click
fx.neonTitle(el);                     // flickering neon sign effect on the title logo element
fx.typeText(el, text, speed);         // typewriter reveal
```
`js/scene/routeMap.js`:
```js
const map = createRouteMap(containerEl);    // SVG world sketch, neon routes
map.show(manifest.chain, { highlightRisk: false }); // draws hops one at a time with animated dashes
map.revealRisk(hopIndexes);                       // after audit: pulse red on hops
map.clear();
```

## Sound API (`js/audio/sound.js`)
All sound procedurally synthesised (WebAudio → WAV → Howler). Must not throw if audio is blocked.
```js
import { sound } from './audio/sound.js';
await sound.init();                    // call on first user gesture
sound.play(name);                      // names below
sound.music(track);                    // 'title' | 'shift' | 'briefing' | 'debrief' | null
sound.setTension(0..1);
sound.setMuted(bool); sound.isMuted();
```
Names: `stamp_approve stamp_detain stamp_audit paper click hover alarm horn combo error success typewriter memo newspaper neon coin shift_start shift_end audit_scan tip thunder`.

## Claude Mode
Settings toggle in the UI; user pastes an Anthropic API key → `engine.setClaudeKey(key)`. Kept in a JS variable only: never localStorage, never logged. Smuggler + NGO then decide via the Messages API (model `claude-haiku-5-5`, header `anthropic-dangerous-direct-browser-access: true`) returning strict JSON `{action, tactic, thought}`; any error/timeout → local utility AI.

## Leaderboard
localStorage key `redflag.leaderboard.v1`, wrapped in try/catch, top 10 `{ initials, score, grade, date }`.
