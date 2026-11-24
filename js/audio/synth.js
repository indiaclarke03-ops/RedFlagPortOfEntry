// Pure procedural synthesis for RED FLAG. No DOM, no WebAudio: computes samples
// directly so it runs in a Worker, on the main thread, or in Node (self-check).
// render(kind, name) -> { key: { data: Float32Array, sr } }

export const SFX_SR = 44100;
export const MUSIC_SR = 22050;
const TAU = Math.PI * 2;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const F = (n) => new Float32Array(n);

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- oscillators / filters ----------
function blep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}
function osc(wave, ph, dt) {
  switch (wave) {
    case 'saw': return 2 * ph - 1 - blep(ph, dt);
    case 'square': {
      let s = ph < 0.5 ? 1 : -1;
      s += blep(ph, dt);
      s -= blep((ph + 0.5) % 1, dt);
      return s;
    }
    case 'tri': return 4 * Math.abs(ph - 0.5) - 1;
    default: return Math.sin(TAU * ph);
  }
}

// Zero-delay-feedback state variable filter (Simper).
class SVF {
  constructor(sr) { this.sr = sr; this.ic1 = 0; this.ic2 = 0; this.lp = 0; this.bp = 0; this.hp = 0; }
  set(fc, q) {
    const f = Math.max(20, Math.min(fc, this.sr * 0.45));
    const g = Math.tan(Math.PI * f / this.sr);
    const k = 1 / q;
    this.k = k; this.a1 = 1 / (1 + g * (g + k)); this.a2 = g * this.a1; this.a3 = g * this.a2;
  }
  run(v0) {
    const v3 = v0 - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1; this.ic2 = 2 * v2 - this.ic2;
    this.lp = v2; this.bp = v1; this.hp = v0 - this.k * v1 - v2;
  }
}

// ---------- envelopes ----------
const perc = (a, d) => (t) => (t < a ? t / a : Math.exp(-(t - a) / d));
const adsr = (a, d, s, hold, r) => (t) =>
  t < a ? t / a
    : t < a + d ? 1 - (1 - s) * (t - a) / d
      : t < hold ? s
        : Math.max(0, s * (1 - (t - hold) / r));
const gate = (a, hold, r) => adsr(a, 1e-4, 1, hold, r);
// Smooth random curve in [0,1], `rate` points per second.
function rough(rand, rate, dur) {
  const n = Math.ceil(rate * dur) + 2;
  const v = Array.from({ length: n }, rand);
  return (t) => {
    const x = t * rate, i = Math.floor(x), f = x - i;
    const a = v[Math.min(i, n - 1)], b = v[Math.min(i + 1, n - 1)];
    return a + (b - a) * (f * f * (3 - 2 * f));
  };
}

// ---------- generic voice ----------
// o: { wave, f (num|fn t), amp fn t, gain, detune [cents], filter {type, fc num|fn, q}, rand }
function voice(out, sr, t0, dur, o) {
  const n0 = Math.round(t0 * sr), n = Math.round(dur * sr), len = out.length;
  const wave = o.wave || 'sine', gain = o.gain ?? 1, amp = o.amp || (() => 1);
  const det = o.detune || [0], nd = det.length;
  const mul = det.map((c) => Math.pow(2, c / 1200));
  const ph = det.map((_, i) => (i * 0.618) % 1);
  const norm = 1 / Math.sqrt(nd);
  const fFn = typeof o.f === 'function' ? o.f : null, fC = o.f || 0;
  const rand = o.rand || Math.random;
  let svf = null, fcFn = null, q = 0.707, ft = 0;
  if (o.filter) {
    svf = new SVF(sr);
    fcFn = typeof o.filter.fc === 'function' ? o.filter.fc : null;
    q = o.filter.q || 0.707;
    ft = o.filter.type === 'hp' ? 1 : o.filter.type === 'bp' ? 2 : 0;
    svf.set(fcFn ? fcFn(0) : o.filter.fc, q);
  }
  for (let i = 0; i < n; i++) {
    const idx = n0 + i;
    if (idx >= len) break;
    const t = i / sr;
    let s = 0;
    if (wave === 'noise') s = rand() * 2 - 1;
    else {
      const f = fFn ? fFn(t) : fC;
      for (let k = 0; k < nd; k++) {
        const dt = (f * mul[k]) / sr;
        let p = ph[k] + dt;
        if (p >= 1) p -= Math.floor(p);
        ph[k] = p;
        s += osc(wave, p, dt);
      }
      s *= norm;
    }
    if (svf) {
      if (fcFn && (i & 15) === 0) svf.set(fcFn(t), q);
      svf.run(s);
      s = ft === 0 ? svf.lp : ft === 1 ? svf.hp : svf.bp;
    }
    if (idx >= 0) out[idx] += s * amp(t) * gain;
  }
}

function peakOf(b) { let p = 0; for (let i = 0; i < b.length; i++) { const a = Math.abs(b[i]); if (a > p) p = a; } return p; }
function finalize(b, sr, peak = 0.89) {
  let mean = 0; for (let i = 0; i < b.length; i++) mean += b[i];
  mean /= b.length || 1;
  for (let i = 0; i < b.length; i++) b[i] -= mean;
  const fade = Math.min(b.length, Math.round(0.006 * sr));
  for (let i = 0; i < fade; i++) b[b.length - 1 - i] *= i / fade;
  const p = peakOf(b);
  if (p > 0) { const g = peak / p; for (let i = 0; i < b.length; i++) b[i] *= g; }
  return b;
}

// ---------- SFX building blocks ----------
function thunk(b, sr, t, g, rand) {
  voice(b, sr, t, 0.35, { f: (x) => 46 + 150 * Math.exp(-x / 0.022), amp: perc(0.001, 0.085), gain: 1.0 * g });
  voice(b, sr, t, 0.08, { wave: 'noise', rand, amp: perc(0.0004, 0.014), gain: 0.8 * g, filter: { type: 'lp', fc: 2800, q: 0.8 } });
  voice(b, sr, t + 0.003, 0.14, { wave: 'noise', rand, amp: perc(0.001, 0.03), gain: 0.5 * g, filter: { type: 'bp', fc: 380, q: 1.4 } });
}
function bell(b, sr, t, f, dec, g) {
  const parts = [[1, 1, 1], [2.76, 0.45, 0.55], [5.4, 0.22, 0.32], [8.93, 0.1, 0.2]];
  for (const [r, a, d] of parts) {
    if (f * r > sr * 0.45) continue;
    voice(b, sr, t, dec * d * 7, { f: f * r, amp: perc(0.0015, dec * d), gain: a * g });
  }
}

const SFX = {
  stamp_approve(sr, rand) {
    const b = F(Math.round(1.0 * sr));
    thunk(b, sr, 0, 1, rand);
    bell(b, sr, 0.05, 1568, 0.32, 0.32);
    bell(b, sr, 0.05, 2349, 0.22, 0.12);
    return b;
  },
  stamp_detain(sr, rand) {
    const b = F(Math.round(0.68 * sr));
    thunk(b, sr, 0, 1, rand);
    const env = gate(0.008, 0.42, 0.06);
    voice(b, sr, 0.07, 0.5, { wave: 'square', f: 98, detune: [-14, 14], amp: (t) => env(t) * (0.75 + 0.25 * Math.sin(TAU * 11 * t)), gain: 0.32, filter: { type: 'lp', fc: 1300, q: 1.2 } });
    voice(b, sr, 0.07, 0.5, { wave: 'saw', f: 49, amp: env, gain: 0.25, filter: { type: 'lp', fc: 500 } });
    return b;
  },
  stamp_audit(sr, rand) {
    const b = F(Math.round(0.62 * sr));
    thunk(b, sr, 0, 1, rand);
    const env = gate(0.005, 0.34, 0.06);
    const f = (t) => 520 * Math.pow(4.6, Math.min(t, 0.32) / 0.32);
    voice(b, sr, 0.06, 0.42, { wave: 'square', f, amp: (t) => env(t) * (0.55 + 0.45 * (Math.sin(TAU * 26 * t) > 0 ? 1 : 0)), gain: 0.16, filter: { type: 'lp', fc: 5000, q: 1.5 } });
    voice(b, sr, 0.06, 0.42, { f: (t) => f(t) * 0.5, amp: env, gain: 0.18 });
    return b;
  },
  paper(sr, rand) {
    const d = 0.38, b = F(Math.round(0.42 * sr));
    const r = rough(rand, 70, d), r2 = rough(rand, 150, d);
    const body = (t) => (t < d ? Math.pow(Math.sin(Math.PI * t / d), 1.3) : 0);
    voice(b, sr, 0, d, { wave: 'noise', rand, amp: (t) => body(t) * (0.35 + 0.65 * r(t)), gain: 0.7, filter: { type: 'bp', fc: (t) => 1500 + 3000 * t / d, q: 0.8 } });
    voice(b, sr, 0, d, { wave: 'noise', rand, amp: (t) => body(t) * Math.pow(r2(t), 3), gain: 0.5, filter: { type: 'hp', fc: 4500, q: 0.7 } });
    return b;
  },
  click(sr, rand) {
    const b = F(Math.round(0.06 * sr));
    voice(b, sr, 0, 0.02, { wave: 'noise', rand, amp: perc(0.0002, 0.003), gain: 0.6, filter: { type: 'hp', fc: 2000 } });
    voice(b, sr, 0, 0.05, { f: 1800, amp: perc(0.0005, 0.01), gain: 0.5 });
    voice(b, sr, 0, 0.05, { f: 900, amp: perc(0.0005, 0.008), gain: 0.3 });
    return b;
  },
  hover(sr) {
    const b = F(Math.round(0.08 * sr));
    voice(b, sr, 0, 0.08, { f: (t) => 2000 + 5000 * t, amp: perc(0.005, 0.02), gain: 0.5 });
    voice(b, sr, 0, 0.08, { f: 4100, amp: perc(0.005, 0.012), gain: 0.12 });
    return b;
  },
  alarm(sr) {
    const b = F(Math.round(1.25 * sr));
    const f = (t) => { const seg = Math.floor(t / 0.3), x = (t % 0.3) / 0.3; return (seg % 2 ? 680 : 520) * (1 + 0.22 * x); };
    const env = gate(0.02, 1.14, 0.08);
    voice(b, sr, 0, 1.25, { wave: 'saw', f, detune: [-7, 7], amp: env, gain: 0.5, filter: { type: 'lp', fc: 2600, q: 2.5 } });
    voice(b, sr, 0, 1.25, { wave: 'square', f: (t) => f(t) * 0.5, amp: env, gain: 0.22, filter: { type: 'lp', fc: 1500 } });
    return b;
  },
  horn(sr) {
    const b = F(Math.round(1.6 * sr));
    const env = adsr(0.14, 0.25, 0.85, 1.3, 0.28);
    const bend = (t) => 1 - 0.035 * Math.max(0, t - 1.15);
    voice(b, sr, 0, 1.6, { wave: 'saw', f: (t) => 73.4 * bend(t), detune: [-9, 0, 8], amp: env, gain: 0.6, filter: { type: 'lp', fc: (t) => 220 + 380 * Math.min(1, t / 0.25), q: 1.6 } });
    voice(b, sr, 0, 1.6, { wave: 'saw', f: (t) => 110.5 * bend(t), detune: [-5, 6], amp: env, gain: 0.28, filter: { type: 'lp', fc: 520, q: 1.2 } });
    voice(b, sr, 0, 1.6, { f: (t) => 36.7 * bend(t), amp: env, gain: 0.45 });
    return b;
  },
  combo(sr) {
    const b = F(Math.round(0.95 * sr));
    const notes = [69, 72, 76, 81, 84];
    notes.forEach((m, i) => {
      const last = i === notes.length - 1;
      const o = { wave: 'square', f: mtof(m), detune: [-8, 8], amp: perc(0.002, last ? 0.28 : 0.11), filter: { type: 'lp', fc: (t) => 900 + 5200 * Math.exp(-t / 0.09), q: 3 } };
      voice(b, sr, i * 0.065, last ? 0.7 : 0.45, { ...o, gain: 0.32 });
      voice(b, sr, i * 0.065 + 0.17, last ? 0.6 : 0.4, { ...o, gain: 0.1 });
    });
    return b;
  },
  error(sr) {
    const b = F(Math.round(0.38 * sr));
    voice(b, sr, 0, 0.12, { wave: 'square', f: 196, amp: gate(0.003, 0.1, 0.02), gain: 0.4, filter: { type: 'lp', fc: 1800 } });
    voice(b, sr, 0.14, 0.2, { wave: 'square', f: 147, amp: gate(0.003, 0.17, 0.03), gain: 0.4, filter: { type: 'lp', fc: 1500 } });
    return b;
  },
  success(sr) {
    const b = F(Math.round(0.85 * sr));
    [72, 76, 79, 84].forEach((m, i) => {
      voice(b, sr, i * 0.07, 0.6, { wave: 'tri', f: mtof(m), amp: perc(0.003, i === 3 ? 0.3 : 0.16), gain: 0.35 });
      voice(b, sr, i * 0.07, 0.6, { f: mtof(m + 12), amp: perc(0.003, 0.1), gain: 0.12 });
    });
    return b;
  },
  typewriter(sr, rand) {
    const b = F(Math.round(0.05 * sr));
    voice(b, sr, 0, 0.02, { wave: 'noise', rand, amp: perc(0.0002, 0.0025), gain: 0.8, filter: { type: 'hp', fc: 3500 } });
    voice(b, sr, 0, 0.05, { wave: 'noise', rand, amp: perc(0.0005, 0.01), gain: 0.6, filter: { type: 'bp', fc: 1200, q: 2 } });
    voice(b, sr, 0, 0.05, { f: 180, amp: perc(0.001, 0.012), gain: 0.4 });
    return b;
  },
  memo(sr) {
    const b = F(Math.round(0.75 * sr));
    bell(b, sr, 0, mtof(88), 0.18, 0.45);
    bell(b, sr, 0.11, mtof(95), 0.3, 0.4);
    return b;
  },
  newspaper(sr, rand) {
    const b = F(Math.round(0.95 * sr));
    voice(b, sr, 0, 0.6, { wave: 'noise', rand, amp: (t) => (t < 0.5 ? Math.pow(t / 0.5, 2) : Math.exp(-(t - 0.5) / 0.03)), gain: 0.55, filter: { type: 'bp', fc: (t) => 300 + 3600 * Math.pow(Math.min(t, 0.5) / 0.5, 2), q: 1.3 } });
    voice(b, sr, 0.5, 0.4, { f: (t) => 40 + 95 * Math.exp(-t / 0.03), amp: perc(0.001, 0.12), gain: 1.0 });
    voice(b, sr, 0.5, 0.15, { wave: 'noise', rand, amp: perc(0.0005, 0.035), gain: 0.5, filter: { type: 'lp', fc: 1300 } });
    voice(b, sr, 0.5, 0.2, { wave: 'noise', rand, amp: perc(0.001, 0.05), gain: 0.25, filter: { type: 'bp', fc: 3200, q: 1 } });
    return b;
  },
  neon(sr, rand) {
    const d = 0.62, b = F(Math.round(d * sr));
    const segs = []; let t = 0;
    while (t < d) { const len = 0.015 + rand() * 0.06; segs.push([t, rand() < 0.62 ? 1 : 0.08]); t += len; }
    segs[0][1] = 1;
    const flick = (x) => { let v = 1; for (const [s, on] of segs) { if (s > x) break; v = on; } return v; };
    const env = gate(0.004, d - 0.05, 0.04);
    const amp = (x) => env(x) * flick(x);
    voice(b, sr, 0, d, { wave: 'saw', f: 120, detune: [0, 4], amp, gain: 0.4, filter: { type: 'bp', fc: 950, q: 0.9 } });
    voice(b, sr, 0, d, { f: 60, amp, gain: 0.22 });
    voice(b, sr, 0, d, { wave: 'noise', rand, amp: (x) => amp(x) * (rand() < 0.02 ? 1 : 0.15), gain: 0.25, filter: { type: 'hp', fc: 4000 } });
    return b;
  },
  coin(sr, rand) {
    const b = F(Math.round(0.75 * sr));
    voice(b, sr, 0, 0.1, { f: 95, amp: perc(0.001, 0.04), gain: 0.4 });
    voice(b, sr, 0, 0.05, { wave: 'noise', rand, amp: perc(0.0005, 0.008), gain: 0.5, filter: { type: 'bp', fc: 4200, q: 4 } });
    bell(b, sr, 0.02, mtof(83), 0.12, 0.35);
    bell(b, sr, 0.09, mtof(88), 0.32, 0.4);
    return b;
  },
  shift_start(sr, rand) {
    const b = F(Math.round(1.9 * sr));
    const sw = 0.8;
    const amp = (t) => (t < sw ? Math.pow(t / sw, 2) : Math.exp(-(t - sw) / 0.32));
    for (const m of [45, 52, 57, 64]) voice(b, sr, 0, 1.9, { wave: 'saw', f: mtof(m), detune: [-11, -4, 4, 11], amp, gain: 0.22, filter: { type: 'lp', fc: (t) => 200 + 3200 * Math.pow(Math.min(t, sw) / sw, 2), q: 2.2 } });
    thunk(b, sr, sw, 0.9, rand);
    voice(b, sr, sw, 1.0, { wave: 'noise', rand, amp: perc(0.001, 0.35), gain: 0.22, filter: { type: 'hp', fc: 5000 } });
    bell(b, sr, sw, mtof(81), 0.4, 0.18);
    return b;
  },
  shift_end(sr) {
    const b = F(Math.round(2.1 * sr));
    [81, 76, 72, 69, 64].forEach((m, i) => voice(b, sr, i * 0.14, 0.7, { wave: 'saw', f: mtof(m), detune: [-6, 6], amp: perc(0.003, 0.22), gain: 0.25, filter: { type: 'lp', fc: (t) => 600 + 2500 * Math.exp(-t / 0.1), q: 2 } }));
    for (const m of [45, 57, 60, 64]) voice(b, sr, 0.6, 1.5, { wave: 'saw', f: mtof(m), detune: [-9, 0, 9], amp: adsr(0.12, 0.3, 0.7, 0.9, 0.55), gain: 0.16, filter: { type: 'lp', fc: (t) => 1400 * Math.exp(-t / 0.7) + 200 } });
    return b;
  },
  audit_scan(sr, rand) {
    const d = 1.5, b = F(Math.round(1.55 * sr));
    const env = gate(0.05, d - 0.15, 0.12);
    voice(b, sr, 0, d, { f: (t) => 1100 + 650 * Math.sin(TAU * (2 * t + 3 * t * t)), amp: env, gain: 0.3 });
    voice(b, sr, 0, d, { wave: 'square', f: (t) => 275 + 160 * Math.sin(TAU * (2 * t + 3 * t * t)), amp: env, gain: 0.08, filter: { type: 'lp', fc: 1800 } });
    voice(b, sr, 0, d, { wave: 'noise', rand, amp: env, gain: 0.3, filter: { type: 'bp', fc: (t) => 600 + 4200 * (0.5 + 0.5 * Math.sin(TAU * 1.3 * t - 1.5)), q: 7 } });
    voice(b, sr, d - 0.1, 0.15, { f: 2637, amp: perc(0.002, 0.04), gain: 0.25 });
    return b;
  },
  tip(sr) {
    const b = F(Math.round(0.85 * sr));
    voice(b, sr, 0, 0.7, { f: mtof(79), amp: perc(0.012, 0.22), gain: 0.4 });
    voice(b, sr, 0, 0.4, { f: mtof(91), amp: perc(0.01, 0.08), gain: 0.07 });
    voice(b, sr, 0.13, 0.7, { f: mtof(86), amp: perc(0.012, 0.3), gain: 0.4 });
    voice(b, sr, 0.13, 0.4, { f: mtof(98), amp: perc(0.01, 0.1), gain: 0.07 });
    return b;
  },
  thunder(sr, rand) {
    const d = 2.8, b = F(Math.round(d * sr));
    const r = rough(rand, 9, d), r2 = rough(rand, 25, d);
    voice(b, sr, 0, 0.8, { wave: 'noise', rand, amp: (t) => perc(0.01, 0.22)(t) * r2(t), gain: 0.35, filter: { type: 'lp', fc: (t) => 2200 * Math.exp(-t / 0.15) + 150 } });
    voice(b, sr, 0, d, { wave: 'noise', rand, amp: (t) => (t < 0.3 ? t / 0.3 : Math.exp(-(t - 0.3) / 0.85)) * (0.35 + 0.65 * r(t)), gain: 1.4, filter: { type: 'lp', fc: 120, q: 0.8 } });
    voice(b, sr, 0.15, d - 0.15, { wave: 'noise', rand, amp: (t) => (t < 0.5 ? t / 0.5 : Math.exp(-(t - 0.5) / 0.9)), gain: 1.2, filter: { type: 'lp', fc: 60, q: 0.7 } });
    return b;
  },
};
export const SFX_NAMES = Object.keys(SFX);

export function renderSfx(name, sr = SFX_SR) {
  const fn = SFX[name];
  if (!fn) throw new Error('unknown sfx ' + name);
  let seed = 7; for (const c of name) seed = (seed * 31 + c.charCodeAt(0)) | 0;
  return { data: finalize(fn(sr, mulberry(seed)), sr), sr };
}

// ---------- music ----------
function reverb(inp, sr, fb = 0.84, damp = 0.3) {
  const out = F(inp.length), sc = sr / 44100;
  const combs = [1116, 1188, 1277, 1356, 1422, 1491].map((d) => ({ b: F(Math.round(d * sc)), i: 0, s: 0 }));
  const aps = [556, 441, 341].map((d) => ({ b: F(Math.round(d * sc)), i: 0 }));
  for (let n = 0; n < inp.length; n++) {
    const x = inp[n] * 0.2;
    let y = 0;
    for (const c of combs) {
      const o = c.b[c.i];
      c.s = o * (1 - damp) + c.s * damp;
      c.b[c.i] = x + c.s * fb;
      if (++c.i >= c.b.length) c.i = 0;
      y += o;
    }
    for (const a of aps) {
      const bo = a.b[a.i];
      a.b[a.i] = y + bo * 0.5;
      if (++a.i >= a.b.length) a.i = 0;
      y = bo - y;
    }
    out[n] = y;
  }
  return out;
}
function delay(inp, sr, time, fb = 0.4, tone = 0.35) {
  const D = Math.round(time * sr), line = F(inp.length), wet = F(inp.length);
  let lp = 0;
  for (let n = 0; n < inp.length; n++) {
    const d = n >= D ? line[n - D] : 0;
    lp += (d - lp) * tone;
    line[n] = inp[n] + lp * fb;
    wet[n] = lp;
  }
  return wet;
}

function makeSong(bpm, bars, sr, seed) {
  const beat = 60 / bpm, bar = 4 * beat;
  const L = Math.round(bars * bar * sr), N = L + Math.round(3.5 * sr);
  const bus = {};
  for (const k of ['drums', 'snare', 'bass', 'pad', 'arp', 'lead']) bus[k] = F(N);
  return { sr, bpm, beat, bar, bars, L, N, bus, rand: mulberry(seed) };
}

// instruments
function kick(s, t, g = 1) {
  voice(s.bus.drums, s.sr, t, 0.4, { f: (x) => 44 + 120 * Math.exp(-x / 0.035), amp: perc(0.002, 0.16), gain: 0.9 * g });
  voice(s.bus.drums, s.sr, t, 0.02, { wave: 'noise', rand: s.rand, amp: perc(0.0003, 0.004), gain: 0.25 * g, filter: { type: 'lp', fc: 3000 } });
}
function snare(s, t, g = 1) {
  // gated: flat noise burst then hard cut (the 80s gated-reverb trick)
  voice(s.bus.snare, s.sr, t, 0.2, { wave: 'noise', rand: s.rand, amp: (x) => (x < 0.002 ? x / 0.002 : x < 0.15 ? 1 - x / 0.3 : Math.max(0, 0.5 * (1 - (x - 0.15) / 0.02))), gain: 0.38 * g, filter: { type: 'bp', fc: 1900, q: 0.6 } });
  voice(s.bus.snare, s.sr, t, 0.15, { f: (x) => 165 + 60 * Math.exp(-x / 0.02), amp: perc(0.001, 0.05), gain: 0.4 * g });
}
function clap(s, t, g = 1) {
  for (let k = 0; k < 3; k++) voice(s.bus.snare, s.sr, t + k * 0.011, 0.12, { wave: 'noise', rand: s.rand, amp: perc(0.0005, k === 2 ? 0.05 : 0.008), gain: 0.3 * g, filter: { type: 'bp', fc: 1300, q: 1.2 } });
}
function hat(s, t, g = 1, open = false) {
  voice(s.bus.drums, s.sr, t, open ? 0.35 : 0.08, { wave: 'noise', rand: s.rand, amp: perc(0.001, open ? 0.1 : 0.022), gain: 0.22 * g, filter: { type: 'hp', fc: 7000, q: 0.9 } });
}
function tom(s, t, m, g = 1) {
  voice(s.bus.drums, s.sr, t, 0.35, { f: (x) => mtof(m) * (1 + 0.6 * Math.exp(-x / 0.03)), amp: perc(0.001, 0.12), gain: 0.5 * g });
}
function bassNote(s, t, dur, m, g = 1, bright = 1) {
  voice(s.bus.bass, s.sr, t, dur + 0.05, { wave: 'saw', f: mtof(m), detune: [-5, 5], amp: adsr(0.003, 0.08, 0.6, dur, 0.04), gain: 0.32 * g, filter: { type: 'lp', fc: (x) => 220 + 1300 * bright * Math.exp(-x / 0.07), q: 1.6 } });
  voice(s.bus.bass, s.sr, t, dur + 0.05, { f: mtof(m - 12), amp: adsr(0.005, 0.05, 0.9, dur, 0.04), gain: 0.35 * g });
}
function padChord(s, t, dur, notes, g = 1, o = {}) {
  const att = o.att ?? 0.6, rel = o.rel ?? 1.0, base = o.fc ?? 900, depth = o.depth ?? 500, lfo = o.lfo ?? s.bar * 2;
  for (const m of notes) {
    voice(s.bus.pad, s.sr, t, dur + rel, { wave: 'saw', f: mtof(m), detune: [-12, -4, 5, 13], amp: adsr(att, 0.6, 0.8, dur, rel), gain: 0.09 * g, filter: { type: 'lp', fc: (x) => base + depth * Math.sin(TAU * (t + x) / lfo), q: 0.9 } });
  }
}
function pluck(s, busName, t, m, g = 1, o = {}) {
  voice(s.bus[busName], s.sr, t, o.len ?? 0.5, { wave: o.wave || 'square', f: mtof(m), detune: [-7, 7], amp: perc(0.002, o.dec ?? 0.16), gain: 0.18 * g, filter: { type: 'lp', fc: (x) => (o.fc ?? 600) + (o.env ?? 3200) * Math.exp(-x / 0.1), q: o.q ?? 2 } });
}
function bellNote(s, t, m, g = 1, dec = 0.6) {
  const sr = s.sr, f = mtof(m);
  voice(s.bus.lead, sr, t, dec * 5, { f, amp: perc(0.004, dec), gain: 0.2 * g });
  if (f * 2.76 < sr * 0.45) voice(s.bus.lead, sr, t, dec * 2, { f: f * 2.76, amp: perc(0.002, dec * 0.35), gain: 0.06 * g });
}
function sub(s, t, dur, m, g = 1) {
  voice(s.bus.bass, s.sr, t, dur + 0.6, { f: mtof(m), amp: adsr(0.4, 0.2, 0.9, dur, 0.6), gain: 0.3 * g });
}

function mix(s, o = {}) {
  const { N, L, sr, bus } = s;
  const pumpDepth = o.pump ?? 0, beat = s.beat;
  const rv = o.rev || { pad: 0.35, arp: 0.35, snare: 0.25, lead: 0.5 };
  const dIn = F(N);
  for (let i = 0; i < N; i++) dIn[i] = bus.arp[i] * (o.dlyArp ?? 0.6) + bus.lead[i] * (o.dlyLead ?? 0.5);
  const dWet = delay(dIn, sr, o.dlyTime ?? beat * 0.75, o.dlyFb ?? 0.42);
  const rIn = F(N);
  for (let i = 0; i < N; i++) rIn[i] = bus.pad[i] * rv.pad + bus.arp[i] * rv.arp + bus.snare[i] * rv.snare + bus.lead[i] * rv.lead + dWet[i] * 0.3;
  const rWet = reverb(rIn, sr, o.revFb ?? 0.84);
  const out = F(N), dm = o.dlyMix ?? 0.45, rm = o.revMix ?? 1;
  for (let i = 0; i < N; i++) {
    const ph = ((i / sr) % beat);
    const pump = pumpDepth ? 1 - pumpDepth * Math.exp(-ph / 0.11) : 1;
    out[i] = bus.drums[i] + bus.snare[i] + bus.bass[i] + bus.pad[i] * pump + bus.arp[i] + bus.lead[i] + dWet[i] * dm + rWet[i] * rm;
  }
  // fold tails back onto the start so the loop is seamless
  const res = F(L);
  for (let i = 0; i < N; i++) res[i % L] += out[i];
  return res;
}
function master(bufs, peak = 0.9, drive = 1.3) {
  const p0 = Math.max(...bufs.map(peakOf), 1e-9);
  const sum = bufs.length > 1 ? (() => { const s = F(bufs[0].length); for (const b of bufs) for (let i = 0; i < s.length; i++) s[i] += b[i]; return s; })() : bufs[0];
  const pS = Math.max(peakOf(sum), p0);
  const g = drive / pS;
  const shaped = bufs.map((b) => { const o = F(b.length); for (let i = 0; i < b.length; i++) o[i] = Math.tanh(b[i] * g); return o; });
  const p1 = peakOf(shaped.length > 1 ? (() => { const s = F(shaped[0].length); for (const b of shaped) for (let i = 0; i < s.length; i++) s[i] += b[i]; return s; })() : shaped[0]);
  const k = peak / Math.max(p1, ...shaped.map(peakOf));
  for (const b of shaped) for (let i = 0; i < b.length; i++) b[i] *= k;
  return shaped;
}

const CH = {
  Am: [57, 60, 64], Am9: [57, 60, 64, 71], F: [53, 57, 60], Fmaj7: [53, 57, 60, 64], Dm: [50, 53, 57], Dm9: [50, 53, 57, 64],
  E: [52, 56, 59], Esus: [52, 57, 59], C: [48, 52, 55], Cmaj9: [48, 52, 55, 59, 62], G: [55, 59, 62], G6: [55, 59, 62, 64],
};
const ROOT = { Am: 45, Am9: 45, F: 41, Fmaj7: 41, Dm: 38, Dm9: 38, E: 40, Esus: 40, C: 36, Cmaj9: 36, G: 43, G6: 43 };

function title() {
  const s = makeSong(90, 8, MUSIC_SR, 101), { beat, bar } = s;
  const prog = ['Am9', 'Fmaj7', 'Dm9', 'E'];
  prog.forEach((c, i) => padChord(s, i * 2 * bar, 2 * bar, CH[c], 1, { att: 0.9, rel: 1.4, fc: 800, depth: 450 }));
  for (let b = 0; b < 8; b++) {
    const c = prog[b >> 1], t = b * bar, notes = CH[c].slice(0, 3).map((m) => m + 12);
    const pat = [0, 1, 2, 1, 0, 2, 1, 2];
    pat.forEach((k, j) => pluck(s, 'arp', t + j * beat / 2, notes[k] + (j === 4 ? 12 : 0), j % 2 ? 0.7 : 1, { fc: 500, env: 2200, dec: 0.2 }));
    sub(s, t, bar * 0.95, ROOT[c] - 12, 1);
    kick(s, t, 0.55);
    if (b >= 2) snare(s, t + 2 * beat, 0.5);
    for (let j = 0; j < 8; j++) if (b >= 4) hat(s, t + j * beat / 2, j % 2 ? 0.5 : 0.25);
  }
  return { title: master([mix(s, { pump: 0.15, dlyTime: beat * 0.75, dlyMix: 0.5 })])[0] };
}

function shift() {
  const prog = ['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E'];
  const calm = makeSong(104, 8, MUSIC_SR, 202), tense = makeSong(104, 8, MUSIC_SR, 203);
  const { beat, bar } = calm;
  for (let b = 0; b < 8; b++) {
    const c = prog[b], t = b * bar, r = ROOT[c];
    padChord(calm, t, bar, CH[c], 0.75, { att: 0.25, rel: 0.6, fc: 1000, depth: 400 });
    for (let j = 0; j < 8; j++) bassNote(calm, t + j * beat / 2, beat / 2 * 0.8, r + (j % 2 ? 12 : 0), 1);
    for (let k = 0; k < 4; k++) kick(calm, t + k * beat, 1);
    snare(calm, t + beat, 1); snare(calm, t + 3 * beat, 1);
    for (let j = 0; j < 8; j++) hat(calm, t + j * beat / 2, j % 2 ? 0.8 : 0.35, j === 7 && b % 2 === 1);
    if (b % 2 === 0) [0, 2, 1].forEach((k, j) => pluck(calm, 'arp', t + (j * 3) * beat / 2, CH[c][k] + 12, 0.6, { dec: 0.25 }));

    // tense layer: 16th hats, pulsing 16th bass, minor-second ostinato, claps, tom fills
    for (let j = 0; j < 16; j++) {
      hat(tense, t + j * beat / 4, j % 4 === 2 ? 0.9 : 0.45);
      if (j % 4 !== 0) bassNote(tense, t + j * beat / 4, beat / 4 * 0.55, r + 12, 0.55, 1.6);
    }
    for (let j = 0; j < 8; j++) pluck(tense, 'arp', t + j * beat / 2, j % 2 ? 77 : 76, 0.45, { wave: 'saw', fc: 900, env: 1800, dec: 0.07, len: 0.2, q: 4 });
    clap(tense, t + beat, 0.8); clap(tense, t + 3 * beat, 0.8);
    kick(tense, t + 2.5 * beat, 0.6);
    if (b % 4 === 3) [52, 50, 47, 45].forEach((m, k) => tom(tense, t + 3 * beat + k * beat / 4, m, 0.9));
    voice(tense.bus.bass, tense.sr, t, bar, { wave: 'saw', f: mtof(r - 12), amp: adsr(0.05, 0.1, 0.8, bar - 0.05, 0.05), gain: 0.12, filter: { type: 'lp', fc: (x) => 160 + 140 * Math.sin(TAU * x / beat * 2), q: 3 } });
  }
  const opts = { pump: 0.35, dlyTime: beat * 0.75, dlyMix: 0.3 };
  const [a, b] = master([mix(calm, opts), mix(tense, { ...opts, dlyArp: 0.3, rev: { pad: 0.3, arp: 0.15, snare: 0.2, lead: 0.4 } })], 0.92, 1.4);
  return { shift: a, shift_tense: b };
}

function briefing() {
  const s = makeSong(84, 8, MUSIC_SR, 303), { beat, bar } = s;
  const prog = ['Am9', 'Am9', 'Fmaj7', 'Fmaj7', 'Dm9', 'Dm9', 'Esus', 'E'];
  [[0, 'Am9', 2], [2, 'Fmaj7', 2], [4, 'Dm9', 2], [6, 'Esus', 1], [7, 'E', 1]].forEach(([b, c, n]) =>
    padChord(s, b * bar, n * bar, CH[c], 0.9, { att: 1.5, rel: 1.6, fc: 650, depth: 300, lfo: s.bar * 4 }));
  const mel = [[0, 2, 76], [1, 1, 72], [2, 3, 74], [3, 2, 69], [4, 0, 77], [5, 2, 76], [6, 1, 71], [7, 2.5, 68]];
  mel.forEach(([b, be, m]) => bellNote(s, b * bar + be * beat, m + 12, 0.9, 0.7));
  for (let b = 0; b < 8; b++) {
    sub(s, b * bar, bar * 0.98, ROOT[prog[b]] - 12, 0.8);
    for (let k = 0; k < 4; k++) hat(s, b * bar + k * beat, k % 2 ? 0.18 : 0.28);
  }
  return { briefing: master([mix(s, { revFb: 0.86, dlyTime: beat, dlyMix: 0.55, rev: { pad: 0.4, arp: 0.3, snare: 0.2, lead: 0.7 } })])[0] };
}

function debrief() {
  const s = makeSong(80, 8, MUSIC_SR, 404), { beat, bar } = s;
  const prog = ['Fmaj7', 'G6', 'Am9', 'Am9', 'Fmaj7', 'G6', 'Cmaj9', 'Cmaj9'];
  prog.forEach((c, b) => {
    const t = b * bar;
    padChord(s, t, bar, CH[c], 0.85, { att: 0.7, rel: 1.2, fc: 1000 + (c === 'Cmaj9' ? 400 : 0), depth: 350 });
    sub(s, t, bar * 0.95, ROOT[c] - 12 + (ROOT[c] < 40 ? 12 : 0), 0.8);
    CH[c].slice(0, 4).forEach((m, k) => pluck(s, 'arp', t + k * beat, m + 12, 0.55, { wave: 'tri', fc: 1200, env: 1500, dec: 0.35, len: 0.9 }));
    kick(s, t, 0.4);
    hat(s, t + 2 * beat, 0.25, true);
  });
  bellNote(s, 6 * bar, 76, 0.8, 1.0);
  bellNote(s, 6 * bar + 1.5 * beat, 79, 0.6, 1.0);
  return { debrief: master([mix(s, { pump: 0.1, dlyTime: beat * 1.5, dlyMix: 0.4 })])[0] };
}

function ambience() {
  const sr = MUSIC_SR, L = 16 * sr, X = Math.round(1.5 * sr), N = L + X, rand = mulberry(505);
  const b = F(N), T = N / sr;
  const swell = (t) => 0.75 + 0.15 * Math.sin(TAU * t / 8) + 0.1 * Math.sin(TAU * t / 5.333);
  voice(b, sr, 0, T, { wave: 'noise', rand, amp: swell, gain: 0.5, filter: { type: 'bp', fc: 2600, q: 0.4 } });
  voice(b, sr, 0, T, { wave: 'noise', rand, amp: swell, gain: 0.35, filter: { type: 'lp', fc: 450, q: 0.6 } });
  for (let k = 0; k < 160; k++) {
    const t = rand() * (T - 0.1);
    voice(b, sr, t, 0.03, { wave: 'noise', rand, amp: perc(0.0005, 0.004), gain: 0.15 + rand() * 0.35, filter: { type: 'bp', fc: 2000 + rand() * 4500, q: 4 } });
  }
  // harbour hum: integer cycles per 16 s, slow beating
  voice(b, sr, 0, T, { f: 55, amp: (t) => 0.7 + 0.3 * Math.sin(TAU * t / 4), gain: 0.07 });
  voice(b, sr, 0, T, { f: 55.25, gain: 0.05 });
  voice(b, sr, 0, T, { wave: 'saw', f: 82.5, gain: 0.03, filter: { type: 'lp', fc: 220 } });
  const out = F(L);
  for (let i = 0; i < L; i++) out[i] = b[i];
  for (let i = 0; i < X; i++) { const x = i / X; out[i] = b[i] * Math.sqrt(x) + b[L + i] * Math.sqrt(1 - x); }
  return { amb: master([out], 0.8, 1.0)[0] };
}

const MUSIC = { title, shift, briefing, debrief, amb: ambience };
export const MUSIC_NAMES = ['title', 'shift', 'briefing', 'debrief'];

// Unified entry: returns { key: { data, sr } }
export function render(kind, name) {
  if (kind === 'sfx') return { [name]: renderSfx(name) };
  const fn = MUSIC[name];
  if (!fn) throw new Error('unknown track ' + name);
  const out = fn(), res = {};
  for (const k in out) res[k] = { data: out[k], sr: MUSIC_SR };
  return res;
}

export function encodeWav(f32, sr) {
  const n = f32.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0, o = 44; i < n; i++, o += 2) {
    const s = Math.max(-1, Math.min(1, f32[i]));
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}
