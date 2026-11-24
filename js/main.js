// RED FLAG: Port of Entry — entry point. Loads every module defensively and wires them together.
import { bus } from './core/bus.js';
import { GAME } from './core/config.js';
import { createDesk } from './ui/desk.js';
import { createScreens } from './ui/screens.js';
import { createMiniMap } from './ui/miniMap.js';
import { createGame } from './game/game.js';
import * as fallback from './game/fallbackData.js';

const load = (path) => import(path).catch(e => (console.error(`[main] could not load ${path}`, e), null));
const withTimeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);

const SETTINGS_KEY = 'redflag.settings.v1'; // mute / volume / reduced motion only. NEVER the API key.
function loadSettings() { try { return { muted: false, volume: 0.8, reducedMotion: false, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch { return { muted: false, volume: 0.8, reducedMotion: false }; } }
function saveSettings(s) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ muted: s.muted, volume: s.volume, reducedMotion: s.reducedMotion })); } catch { /* blocked */ } }

const settings = loadSettings();
window.__reducedMotion = !!settings.reducedMotion;
document.documentElement.classList.toggle('reduced-motion', window.__reducedMotion);

const mods = { fx: null, sound: null, scene: null, map: null, engine: null, world: fallback, info: fallback.VIOLATION_INFO };
const ctx = { bus, mods };
const g = (o, fn, ...a) => { try { return o?.[fn]?.(...a); } catch (e) { console.error(`[main] ${fn}`, e); } };

// ---------------- UI ----------------
let returnToPause = false;
const ui = {
  tutorialFromStart: false,
  sfx: n => g(mods.sound, 'play', n),
  onStart: async () => {
    ui.sfx('click');
    let seen = false; try { seen = localStorage.getItem('redflag.tutorialSeen') === '1'; } catch { /* */ }
    if (!seen) { ui.tutorialFromStart = true; game.setScreen('tutorial'); return; }
    await engineReady; game.startGame();
  },
  onTutorial: () => { ui.sfx('click'); ui.tutorialFromStart = false; game.setScreen('tutorial'); },
  onTutorialDone: async () => {
    try { localStorage.setItem('redflag.tutorialSeen', '1'); } catch { /* */ }
    ui.sfx('click');
    if (ui.tutorialFromStart) { ui.tutorialFromStart = false; await engineReady; game.startGame(); } else game.setScreen('title');
  },
  openLeaderboard: (hl) => { ui.sfx('click'); screens.openLeaderboard(hl); },
  openSettings: () => {
    ui.sfx('click');
    if (game.state.paused) returnToPause = true;
    screens.openSettings({ ...settings, claudeActive: !!g(mods.engine, 'isClaudeActive') || claudeOn });
  },
  onMute: v => { settings.muted = v; g(mods.sound, 'setMuted', v); saveSettings(settings); },
  onVolume: v => { settings.volume = v; try { window.Howler?.volume(v); } catch { /* */ } saveSettings(settings); },
  onReducedMotion: v => { settings.reducedMotion = v; window.__reducedMotion = v; document.documentElement.classList.toggle('reduced-motion', v); saveSettings(settings); },
  onClaudeKey: key => { claudeOn = !!key; g(mods.engine, 'setClaudeKey', key || null); game.state.claude = claudeOn; },
  onToggleRulebook: force => { desk.toggleRulebook(force); g(mods.sound, 'play', 'paper'); },
  onModalClose: () => {
    if (returnToPause) { returnToPause = false; setTimeout(() => screens.openPause(), 0); return; }
    if (game.state.paused) { game.state.paused = false; g(mods.sound, 'play', 'click'); }
  },
  onQuit: () => {
    returnToPause = false;
    game.state.running = false; game.state.paused = false;
    for (const q of [...game.state.queue, game.state.current].filter(Boolean)) g(mods.scene, 'shipDepart', q.id, 'reroute');
    game.state.queue = []; game.state.current = null;
    g(mods.map, 'clear');
    game.setScreen('title');
  },
  onNextShift: () => { ui.sfx('click'); game.nextShift(); },
  onSaveScore: initials => { const e = game.saveFinal(initials); ui.sfx('success'); return e; },
  onPlayAgain: async () => { ui.sfx('click'); await engineReady; game.startGame(); },
};
let claudeOn = false;

const desk = createDesk({
  onAction: a => game.act(a),
  onPause: () => pause(),
  onRulebook: () => ui.onToggleRulebook(),
});
document.getElementById('ui-root').append(desk.root);
const screens = createScreens(ui);
const game = createGame({ bus, mods, desk, screens, ui });

function pause() {
  if (game.state.screen !== 'shift' || !game.state.running) return;
  game.state.paused = true;
  g(mods.sound, 'play', 'click');
  screens.openPause();
}

// ---------------- module loading (all optional) ----------------
const engineReady = (async () => {
  const [worldMod, engMod] = await Promise.all([load('./data/world.js'), load('./ai/engine.js')]);
  if (worldMod && (worldMod.RULES || worldMod.REGIONS)) {
    mods.world = { ...fallback, ...worldMod, getActiveRules: worldMod.getActiveRules || (s => (worldMod.RULES || []).filter(r => r.shift <= s)) };
  }
  mods.info = worldMod?.VIOLATION_INFO || engMod?.VIOLATION_INFO || fallback.VIOLATION_INFO;
  try { mods.engine = engMod?.createEngine?.({ bus }) || null; } catch (e) { console.error('[main] createEngine threw', e); }
  if (!mods.engine) { console.warn('[main] using fallback engine'); mods.engine = fallback.createFallbackEngine({ bus }); mods.world = fallback; mods.info = fallback.VIOLATION_INFO; }
  return mods.engine;
})();

(async () => {
  const fxMod = await load('./fx/fx.js');
  mods.fx = fxMod?.fx || fxMod?.default || fxMod || null;
  g(mods.fx, 'neonTitle', screens.logo);
})();

(async () => {
  const sMod = await load('./audio/sound.js');
  mods.sound = sMod?.sound || sMod?.default || null;
  g(mods.sound, 'setMuted', !!settings.muted);
})();

// Thunder follows the scene's lightning flashes (sound travels slower than light).
bus.on('scene:lightning', d => setTimeout(() => g(mods.sound, 'play', 'thunder'), Math.max(0, (d?.delay ?? 1) * 1000)));

(async () => {
  const mapMod = await load('./scene/routeMap.js');
  try { mods.map = mapMod?.createRouteMap?.(desk.mapEl) || null; } catch (e) { console.error('[main] createRouteMap threw', e); }
  if (!mods.map) { desk.mapEl.replaceChildren(); mods.map = createMiniMap(desk.mapEl); }
})();

(async () => {
  const sceneMod = await load('./scene/scene.js');
  try { mods.scene = (await withTimeout(Promise.resolve(sceneMod?.createScene?.(document.getElementById('scene-root'))), 15000)) || null; } catch (e) { console.error('[main] createScene threw', e); }
  g(mods.scene, 'setMode', game.state.screen === 'tutorial' ? 'title' : game.state.screen);
})();

// first user gesture → audio
let audioInit = false;
async function initAudio() {
  if (audioInit) return; audioInit = true;
  try { await mods.sound?.init?.(); g(mods.sound, 'setMuted', !!settings.muted); try { window.Howler?.volume(settings.volume); } catch { /* */ } g(mods.sound, 'music', game.state.screen === 'tutorial' ? 'title' : game.state.screen); } catch (e) { console.warn('[main] audio init failed', e); }
}
addEventListener('pointerdown', initAudio, { capture: true });
addEventListener('keydown', initAudio, { capture: true });

// ---------------- keyboard ----------------
addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  const k = e.key.toLowerCase();
  if (k === 'm') { settings.muted = !(mods.sound?.isMuted?.() ?? settings.muted); g(mods.sound, 'setMuted', settings.muted); saveSettings(settings); desk.toast(settings.muted ? 'Sound muted' : 'Sound on', 'notice'); return; }
  if (screens.isModalOpen()) { if (k === 'escape') { e.preventDefault(); screens.closeModal(); } return; }
  const scr = game.state.screen;
  if (scr === 'title') { if (e.repeat || ['tab', 'shift', 'control', 'alt', 'meta'].includes(k)) return; e.preventDefault(); ui.onStart(); return; }
  if (scr === 'tutorial') { if (k === 'escape') ui.onTutorialDone(); else if (k === 'enter' || k === ' ' || k === 'arrowright') { e.preventDefault(); screens.tutNext(); } return; }
  if (scr === 'briefing') { if (k === 'enter') ui.onNextShift(); return; }
  if (scr !== 'shift') return;
  if (e.repeat) return;
  if (k === 'a') game.act('approve');
  else if (k === 'd') game.act('detain');
  else if (k === ' ') { e.preventDefault(); game.act('audit'); }
  else if (k === 'r') ui.onToggleRulebook();
  else if (k === 'escape') { if (desk.toggleRulebook.length && document.querySelector('.rulebook.open')) desk.toggleRulebook(false); else pause(); }
});

// ---------------- playtest hooks ----------------
window.__game = {
  get state() { return game.state; },
  startGame: async (shift = 0) => { await engineReady; game.startGame(shift); },
  forceDecision: a => game.forceDecision(a),
  act: a => game.act(a),
  endShift: () => game.endShift(),
  mods,
};

// ---------------- boot + test hashes ----------------
game.setScreen('title');
const test = new URLSearchParams(location.hash.slice(1)).get('test');
if (test) runTest(test);

async function runTest(t) {
  await engineReady;
  const ensureShip = () => setTimeout(() => { if (!game.state.current && !game.state.queue.length) bus.emit('ship:arrive', fallback.makeManifest(game.state.shift, t === 'clean' ? [] : null)); }, 1200);
  if (t === 'tutorial') return game.setScreen('tutorial');
  if (t === 'settings') return ui.openSettings();
  if (t === 'leaderboard') return ui.openLeaderboard();
  if (/^shift[123]?$/.test(t) || t === 'audit' || t === 'rulebook') {
    const s = t === 'shift2' ? 1 : t === 'shift3' ? 2 : 0;
    game.startGame(s);
    ensureShip();
    if (t === 'rulebook') setTimeout(() => desk.toggleRulebook(true), 1500);
    if (t === 'audit') {
      setTimeout(() => {
        if (!game.state.current) bus.emit('ship:arrive', fallback.makeManifest(game.state.shift, ['forced_labour', 'weight_mismatch']));
        setTimeout(() => { game.act('audit'); game.state.auditLeft = 0.6; }, 300);
      }, 1500);
    }
    return;
  }
  if (t === 'briefing') {
    game.startGame(0);
    Object.assign(game.state.shiftStats[0], { processed: 14, correct: 12, caught: 5, missed: 1, falseDetains: 1, audits: 3, revenue: 13800 });
    setTimeout(() => game.endShift(), 300);
    return;
  }
  if (t === 'debrief') {
    const s = game.state;
    game.resetGame();
    Object.assign(s, { revenue: 41200, reputation: 74, points: 3150, maxCombo: 9, shift: 2 });
    Object.assign(s.stats, { processed: 38, correct: 33, caught: 14, missed: 3, falseDetains: 2, approvals: 22, detains: 16, audits: 7 });
    s.missed = [
      { manifest: fallback.makeManifest(0, ['forced_labour']), violations: ['forced_labour'], shift: 0 },
      { manifest: fallback.makeManifest(1, ['shell_company', 'transshipment']), violations: ['shell_company', 'transshipment'], shift: 1 },
      { manifest: fallback.makeManifest(2, ['no_due_diligence']), violations: ['no_due_diligence'], shift: 2 },
    ];
    const replay = [
      { t: 30, shift: 1, type: 'caught', text: 'You seized MV Cobalt Star (direct Xinjiang sourcing).' },
      { t: 70, shift: 1, type: 'missed', text: 'MV Neon Tern slipped through.', explain: 'forced_labour' },
      { t: 95, shift: 1, type: 'adapt', text: 'Syndicate stops shipping direct; starts transshipping via Malaysia.' },
      { t: 30, shift: 2, type: 'tip', text: 'Clean Chains NGO tipped off MV Grey Heron.' },
      { t: 80, shift: 2, type: 'adapt', text: 'You audit everything over 2 hops. Syndicate switches to shell companies.' },
      { t: 120, shift: 2, type: 'expose', text: 'NGO exposé: "Port waved through slave-linked cells".' },
      { t: 60, shift: 3, type: 'adapt', text: 'Syndicate floods the queue with decoys to rush you.' },
      { t: 140, shift: 3, type: 'missed', text: 'MV Ninth Tide had no due-diligence statement.', explain: 'no_due_diligence' },
    ];
    mods.engine = { ...mods.engine, getReplay: () => replay, endShift: () => ({}) };
    game.finishGame();
  }
}

console.info(`[RED FLAG] UI ready · ${GAME.SHIFTS} shifts × ${GAME.SHIFT_SECONDS}s`);
