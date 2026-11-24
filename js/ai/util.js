// Shared helpers for the AI agents: seedable RNG, utility choice, varied text templates.

/** mulberry32 seedable RNG → () => [0,1) */
export function makeRng(seed = (Date.now() ^ 0x9e3779b9) >>> 0) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function helpers(rng) {
  const r = () => rng();
  return {
    r,
    range: (a, b) => a + (b - a) * r(),
    int: (a, b) => Math.floor(a + (b - a + 1) * r()),
    pick: (arr) => arr[Math.floor(r() * arr.length)],
    chance: (p) => r() < p,
    weighted(obj) { // {key: weight} → key
      const entries = Object.entries(obj).filter(([, w]) => w > 0);
      const total = entries.reduce((s, [, w]) => s + w, 0);
      let x = r() * total;
      for (const [k, w] of entries) { x -= w; if (x <= 0) return k; }
      return entries.length ? entries[entries.length - 1][0] : null;
    },
  };
}

/** Pick the best-scoring action. scores: {action: utility}. Adds small noise so ties vary. Returns {action, scores}. */
export function chooseByUtility(scores, rng, noise = 0.06) {
  let best = null, bestU = -Infinity;
  const noisy = {};
  for (const [a, u] of Object.entries(scores)) {
    const v = u + (rng() - 0.5) * 2 * noise;
    noisy[a] = Math.round(v * 100) / 100;
    if (v > bestU) { bestU = v; best = a; }
  }
  return { action: best, scores: noisy };
}

/** Template voice: picks lines from pools without repeating recent ones; fills {vars}; caps length. */
export function createVoice(rng, maxLen = 110) {
  const recent = new Map(); // poolKey → recent indices
  return function say(key, pool, vars = {}) {
    if (!pool || !pool.length) return '';
    const used = recent.get(key) || [];
    let candidates = pool.map((_, i) => i).filter(i => !used.includes(i));
    if (!candidates.length) candidates = pool.map((_, i) => i);
    const idx = candidates[Math.floor(rng() * candidates.length)];
    used.push(idx);
    while (used.length > Math.min(4, Math.max(1, pool.length - 1))) used.shift();
    recent.set(key, used);
    let s = pool[idx].replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
    if (s.length > maxLen) s = s.slice(0, maxLen - 1).trimEnd() + '…';
    return s;
  };
}

export const shortRegion = (name = '') => name.includes('XUAR') ? 'XUAR'
  : name.includes('Lualaba') ? 'DRC artisanal cobalt'
  : name.includes('Kivu') ? 'Kivu artisanal mines' : name;
