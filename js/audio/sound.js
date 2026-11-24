// RED FLAG sound engine. Every sound is synthesised procedurally (js/audio/synth.js),
// encoded to WAV and played through Howler. Fails soft: if Howler / AudioContext is
// missing or blocked, every method is a harmless no-op.

const SFX_LIST = ['stamp_approve', 'stamp_detain', 'stamp_audit', 'paper', 'click', 'hover', 'alarm', 'horn', 'combo',
  'error', 'success', 'typewriter', 'memo', 'newspaper', 'neon', 'coin', 'shift_start', 'shift_end', 'audit_scan', 'tip', 'thunder'];
const TRACKS = ['title', 'shift', 'briefing', 'debrief'];

// Base volume per SFX (all renders are peak-normalised) and how much random pitch drift each tolerates.
const SFX_VOL = {
  stamp_approve: 0.85, stamp_detain: 0.85, stamp_audit: 0.8, paper: 0.45, click: 0.35, hover: 0.12, alarm: 0.5,
  horn: 0.7, combo: 0.5, error: 0.35, success: 0.5, typewriter: 0.3, memo: 0.45, newspaper: 0.7, neon: 0.35,
  coin: 0.55, shift_start: 0.7, shift_end: 0.65, audit_scan: 0.5, tip: 0.4, thunder: 0.7,
};
const PITCH_VAR = { alarm: 0.01, horn: 0.03, combo: 0.01, success: 0.01, memo: 0.02, tip: 0.02, shift_start: 0.005, shift_end: 0.005 };
const MUSIC_VOL = { title: 0.42, shift: 0.36, shift_tense: 0.5, briefing: 0.4, debrief: 0.42 };
const AMB_VOL = 0.28;
const FADE_MS = 1400;

const S = {
  initPromise: null, ok: false, muted: false, volume: 1, tension: 0,
  sfx: {}, music: {}, current: null, wanted: null, amb: null, fadeTimers: {},
  worker: null, reqId: 0, pending: new Map(), stats: { initStart: 0, sfxReadyMs: null, allReadyMs: null, renders: {} },
};

const H = () => (typeof window !== 'undefined' && window.Howl && window.Howler) ? window : null;
const safe = (fn, fb) => { try { return fn(); } catch (e) { return fb; } };
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const yieldTick = () => new Promise((r) => setTimeout(r, 0));

// ---------- rendering (worker preferred, main-thread fallback) ----------
let synthMod = null;
async function renderMain(kind, name) {
  synthMod = synthMod || await import('./synth.js');
  await yieldTick();
  const out = synthMod.render(kind, name), wavs = {};
  for (const k in out) wavs[k] = synthMod.encodeWav(out[k].data, out[k].sr);
  return wavs;
}
function startWorker() {
  try {
    const w = new Worker(new URL('./synth-worker.js', import.meta.url), { type: 'module' });
    w.onmessage = (e) => {
      const { id, ok, wavs, error } = e.data || {};
      const p = S.pending.get(id); if (!p) return;
      S.pending.delete(id);
      ok ? p.resolve(wavs) : p.reject(new Error(error));
    };
    w.onerror = (e) => {
      // worker unusable (e.g. module workers unsupported): fall back for everything pending
      safe(() => e.preventDefault());
      S.worker = null; safe(() => w.terminate());
      for (const [, p] of S.pending) renderMain(p.kind, p.name).then(p.resolve, p.reject);
      S.pending.clear();
    };
    return w;
  } catch (e) { return null; }
}
function renderWav(kind, name) {
  const t0 = now();
  const done = (wavs) => { S.stats.renders[name] = Math.round(now() - t0); return wavs; };
  if (!S.worker) return renderMain(kind, name).then(done);
  return new Promise((resolve, reject) => {
    const id = ++S.reqId;
    S.pending.set(id, { resolve, reject, kind, name });
    S.worker.postMessage({ id, kind, name });
  }).then(done);
}
function howlFrom(buf, opts = {}) {
  const url = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  return new window.Howl({ src: [url], format: ['wav'], preload: true, ...opts });
}

// ---------- music ----------
function layersOf(track) { return track === 'shift' ? ['shift', 'shift_tense'] : [track]; }
function layerTarget(key) {
  if (key === 'shift_tense') return MUSIC_VOL.shift_tense * Math.pow(S.tension, 0.85);
  if (key === 'shift') return MUSIC_VOL.shift * (1 - 0.15 * S.tension);
  return MUSIC_VOL[key] ?? 0.4;
}
function trackReady(track) { return layersOf(track).every((k) => S.music[k]); }
function startTrack(track) {
  if (!trackReady(track)) return;
  for (const k of layersOf(track)) {
    const h = S.music[k];
    clearTimeout(S.fadeTimers[k]);
    safe(() => { h.stop(); h.volume(0); h.play(); h.fade(0, layerTarget(k), FADE_MS); });
  }
  S.current = track;
}
function stopTrack(track) {
  for (const k of layersOf(track)) {
    const h = S.music[k]; if (!h) continue;
    safe(() => h.fade(h.volume(), 0, FADE_MS));
    clearTimeout(S.fadeTimers[k]);
    S.fadeTimers[k] = setTimeout(() => safe(() => { if (!(S.current && layersOf(S.current).includes(k))) h.stop(); }), FADE_MS + 60);
  }
}

// ---------- ambience ----------
let ambTimer = null;
function scheduleAmbientEvents() {
  clearTimeout(ambTimer);
  ambTimer = setTimeout(() => {
    const r = Math.random();
    if (r < 0.65) sound.play('horn', { volume: 0.16, rate: 0.72 });
    else sound.play('thunder', { volume: 0.3, rate: 0.8 });
    scheduleAmbientEvents();
  }, 28000 + Math.random() * 42000);
}

// ---------- init ----------
async function doInit() {
  S.stats.initStart = now();
  if (!H()) return;
  S.ok = true;
  safe(() => window.Howler.volume(S.volume));
  safe(() => window.Howler.mute(S.muted));
  S.worker = startWorker();

  // SFX first, in parallel
  await Promise.all(SFX_LIST.map((n) => renderWav('sfx', n)
    .then((w) => { S.sfx[n] = howlFrom(w[n], { volume: SFX_VOL[n] }); })
    .catch((e) => console.warn('[sound] sfx failed', n, e))));
  safe(() => { const c = window.Howler.ctx; if (c && c.state === 'suspended') c.resume(); });
  S.stats.sfxReadyMs = Math.round(now() - S.stats.initStart);

  // then ambience + music in the background (wanted track first)
  (async () => {
    try {
      const a = await renderWav('music', 'amb');
      S.amb = howlFrom(a.amb, { loop: true, volume: 0 });
      safe(() => { S.amb.play(); S.amb.fade(0, AMB_VOL, 3000); });
      scheduleAmbientEvents();
    } catch (e) { console.warn('[sound] ambience failed', e); }
    const order = [...new Set([S.wanted, ...TRACKS].filter(Boolean))];
    for (const t of order) {
      try {
        const w = await renderWav('music', t);
        for (const k in w) S.music[k] = howlFrom(w[k], { loop: true, volume: 0 });
        if (S.wanted === t && S.current !== t) startTrack(t);
      } catch (e) { console.warn('[sound] track failed', t, e); }
    }
    S.stats.allReadyMs = Math.round(now() - S.stats.initStart);
    safe(() => S.worker && S.worker.terminate()); S.worker = null;
  })();
}

const clamp01 = (x) => Math.max(0, Math.min(1, Number(x) || 0));

export const sound = {
  init() {
    if (!S.initPromise) S.initPromise = doInit().catch((e) => { console.warn('[sound] init failed', e); });
    // resume on every call (cheap) so a later gesture can unlock a suspended context
    safe(() => { const c = H() && window.Howler.ctx; if (c && c.state === 'suspended') c.resume(); });
    return S.initPromise;
  },
  play(name, opts = {}) {
    if (!S.ok) return null;
    return safe(() => {
      const h = S.sfx[name]; if (!h) return null;
      const id = h.play();
      if (id == null) return null;
      const pv = PITCH_VAR[name] ?? 0.05;
      const vol = (SFX_VOL[name] ?? 0.5) * (opts.volume ?? 1) * (0.86 + Math.random() * 0.14);
      h.volume(Math.min(1, vol), id);
      h.rate((opts.rate ?? 1) * (1 - pv + Math.random() * 2 * pv), id);
      return id;
    }, null);
  },
  music(track) {
    if (track != null && !TRACKS.includes(track)) return;
    S.wanted = track || null;
    if (!S.ok || S.current === track) return;
    if (S.current) stopTrack(S.current);
    S.current = null;
    if (track) startTrack(track); // no-op until rendered; render loop starts it when ready
  },
  setTension(x) {
    S.tension = clamp01(x);
    if (!S.ok || S.current !== 'shift') return;
    for (const k of ['shift', 'shift_tense']) {
      const h = S.music[k];
      if (h) safe(() => h.fade(h.volume(), layerTarget(k), 450));
    }
  },
  setMuted(b) { S.muted = !!b; if (S.ok) safe(() => window.Howler.mute(S.muted)); },
  isMuted() { return S.muted; },
  setVolume(v) { S.volume = clamp01(v); if (S.ok) safe(() => window.Howler.volume(S.volume)); },
  getVolume() { return S.volume; },
  get stats() {
    const loaded = (o) => Object.values(o).filter((h) => safe(() => h.state() === 'loaded', false)).length;
    return { ...S.stats, current: S.current, tension: S.tension, ok: S.ok, sfxLoaded: loaded(S.sfx), musicLoaded: loaded(S.music) };
  },
  names: SFX_LIST.slice(),
  tracks: TRACKS.slice(),
};

if (typeof window !== 'undefined') window.__sound = sound; // debugging / playtests
