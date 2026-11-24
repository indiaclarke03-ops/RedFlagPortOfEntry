// RED FLAG — Pixi scene: rain-soaked neon container port at night.
import * as PIXI from 'pixi.js';
import { PALETTE } from '../core/config.js';
import { bus } from '../core/bus.js';

let Filters = null;
try { Filters = await import('pixi-filters'); } catch (e) { console.warn('[scene] pixi-filters unavailable; no bloom', e); }

// ---------- world constants (design space 1920×1080; camera maps it to the screen) ----------
const W = 1920, HZ = 470;               // horizon line
const X0 = -520, X1 = 2440;             // generous width for parallax
const LANE_Y = 556, BERTH = { x: 1215, y: 712 }, DETAIN = { x: 480, y: 694 }, ARRIVE = { x: -520, y: 506 };
const QUAY_Y = 846;
const C = PALETTE;
const CONTAINER_COLS = [0x7d2433, 0x1f4d6b, 0x7a5418, 0x245c46, 0x4f2f6e, 0x2b3350, 0x6b2a5a, 0x1a6670, 0x8a3c1c];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const persp = (y) => clamp(0.1 + (y - 482) / 280 * 0.98, 0.07, 1.4);
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function mix(c1, c2, t) {
  const r = lerp((c1 >> 16) & 255, (c2 >> 16) & 255, t), g = lerp((c1 >> 8) & 255, (c2 >> 8) & 255, t), b = lerp(c1 & 255, c2 & 255, t);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const G = () => window.gsap;
const reduced = () => { try { return (document.documentElement.classList.contains('reduced-motion') || window.__reducedMotion === true) || matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
function tween(target, vars) {
  const gs = G();
  if (gs) return gs.to(target, vars);
  const { onComplete, duration, ease, delay, repeat, yoyo, onUpdate, ...rest } = vars;
  Object.assign(target, rest); onUpdate?.(); onComplete?.();
  return null;
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  return PIXI.Texture.from(c);
}

// ---------- shared textures ----------
function makeTextures() {
  const T = {};
  T.glow = canvasTex(128, 128, (x, w) => {
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, 'rgba(255,255,255,.55)');
    g.addColorStop(0.5, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, w);
  });
  T.sky = canvasTex(4, 512, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#010208'); g.addColorStop(0.45, '#060a1e'); g.addColorStop(0.72, '#120d33');
    g.addColorStop(0.88, '#36103f'); g.addColorStop(0.96, '#5a1a44'); g.addColorStop(1, '#7a2a3a');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
  T.water = canvasTex(4, 512, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1a0c2c'); g.addColorStop(0.08, '#0b0d24'); g.addColorStop(0.5, '#050816'); g.addColorStop(1, '#020309');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
  T.ground = canvasTex(4, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#11142a'); g.addColorStop(0.2, '#0a0c1c'); g.addColorStop(1, '#030409');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
  T.rain = canvasTex(4, 64, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(200,235,255,0)'); g.addColorStop(1, 'rgba(220,245,255,1)');
    x.fillStyle = g; x.fillRect(1, 0, 2, h);
  });
  T.ripple = canvasTex(64, 24, (x) => {
    x.strokeStyle = 'rgba(210,240,255,.9)'; x.lineWidth = 2;
    x.beginPath(); x.ellipse(32, 12, 28, 9, 0, 0, Math.PI * 2); x.stroke();
  });
  T.fog = canvasTex(512, 128, (x, w, h) => {
    for (let i = 0; i < 14; i++) {
      const cx = 40 + Math.random() * (w - 80), cy = h / 2 + (Math.random() - 0.5) * 30, r = 40 + Math.random() * 60;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
    }
  });
  T.beam = canvasTex(256, 512, (x, w, h) => {
    const g = x.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.beginPath(); x.moveTo(w / 2 - 3, h); x.lineTo(w / 2 + 3, h); x.lineTo(w, 0); x.lineTo(0, 0); x.closePath(); x.fill();
  });
  T.cone = canvasTex(256, 64, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.moveTo(0, h / 2 - 2); x.lineTo(w, 0); x.lineTo(w, h); x.lineTo(0, h / 2 + 2); x.fill();
  });
  T.sweep = canvasTex(512, 4, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,40,70,0)'); g.addColorStop(0.7, 'rgba(255,40,70,.55)'); g.addColorStop(0.97, 'rgba(255,200,210,.95)'); g.addColorStop(1, 'rgba(255,40,70,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  });
  T.shimmer = canvasTex(1024, 512, (x, w, h) => {
    const cols = ['255,43,214', '25,240,255', '255,176,32', '200,220,255'];
    for (let i = 0; i < 700; i++) {
      const y = Math.pow(Math.random(), 1.6) * h, len = 6 + Math.random() * (20 + y * 0.15);
      x.fillStyle = `rgba(${cols[i % 4]},${0.12 + Math.random() * 0.35})`;
      x.fillRect(Math.random() * w, y, len, 1 + (y > h * 0.5 ? 1 : 0));
    }
  });
  T.disp = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = 'rgb(128,128,128)'; x.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      const v = 128 + Math.sin(y * 0.35) * 60 + (Math.random() - 0.5) * 70;
      x.fillStyle = `rgb(${v | 0},${(128 + (Math.random() - 0.5) * 40) | 0},128)`;
      x.fillRect(0, y, w, 2);
    }
  });
  try { T.disp.source.addressMode = 'repeat'; T.shimmer.source.addressMode = 'repeat'; } catch {}
  return T;
}

// Neon sign texture (canvas glow is far cheaper than a filter per sign).
function neonTex(text, color, { size = 34, font = 'Orbitron', weight = 900, vertical = false, frame = true, spacing = 4 } = {}) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = `${weight} ${size}px "${font}", sans-serif`;
  const chars = [...text];
  const tw = vertical ? size * 1.1 : ctx.measureText(text).width + spacing * chars.length;
  const th = vertical ? chars.length * size * 1.08 : size * 1.15;
  const pad = 30;
  c.width = Math.ceil(tw + pad * 2 + (frame ? 24 : 0)); c.height = Math.ceil(th + pad * 2 + (frame ? 20 : 0));
  ctx.font = `${weight} ${size}px "${font}", sans-serif`;
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  const draw = () => {
    if (vertical) chars.forEach((ch, i) => ctx.fillText(ch, c.width / 2, pad + (frame ? 10 : 0) + size * 0.55 + i * size * 1.08));
    else {
      let x = c.width / 2 - tw / 2;
      for (const ch of chars) { const w = ctx.measureText(ch).width; ctx.fillText(ch, x + w / 2, c.height / 2 + 1); x += w + spacing; }
    }
    if (frame) { ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(pad, pad, c.width - pad * 2, c.height - pad * 2, 8); ctx.stroke(); }
  };
  ctx.shadowColor = color; ctx.fillStyle = color; ctx.strokeStyle = color;
  ctx.shadowBlur = 26; draw(); ctx.shadowBlur = 12; draw();
  ctx.shadowBlur = 3; ctx.fillStyle = hex(mix(parseInt(color.slice(1), 16), 0xffffff, 0.55)); ctx.strokeStyle = ctx.fillStyle; draw();
  return PIXI.Texture.from(c);
}

// Skyline textures (far + near) with lit windows. Returns { tex, buildings }.
function skylineTex(rng, { width, height, minH, maxH, base, edge, winDensity, tall = [] }) {
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const x = c.getContext('2d');
  const buildings = [];
  let bx = 0;
  while (bx < width) {
    const w = 40 + rng() * 110;
    let h = minH + Math.pow(rng(), 1.4) * (maxH - minH);
    for (const t of tall) if (bx < t.x + t.w && bx + w > t.x) h = Math.max(h, t.h);
    buildings.push({ x: bx, w, h });
    bx += w + (rng() < 0.3 ? rng() * 20 : -4);
  }
  for (const b of buildings) {
    const top = height - b.h;
    const g = x.createLinearGradient(0, top, 0, height);
    g.addColorStop(0, base[0]); g.addColorStop(1, base[1]);
    x.fillStyle = g;
    x.fillRect(b.x, top, b.w, b.h);
    // stepped roofs / spires
    if (rng() < 0.35) { x.fillRect(b.x + b.w * 0.25, top - 18, b.w * 0.5, 18); }
    if (rng() < 0.25) { x.fillRect(b.x + b.w * 0.5 - 1.5, top - 60, 3, 60); x.fillStyle = 'rgba(255,60,80,.95)'; x.fillRect(b.x + b.w * 0.5 - 2.5, top - 63, 5, 5); }
    x.fillStyle = edge; x.fillRect(b.x, top, 2, b.h);
    // windows
    const ww = 3 + Math.floor(rng() * 3), wh = 2 + Math.floor(rng() * 3), gx = ww + 3 + Math.floor(rng() * 4), gy = wh + 4 + Math.floor(rng() * 4);
    const tint = rng();
    for (let wy = top + 8; wy < height - 6; wy += gy) {
      const rowLit = rng() < 0.75;
      for (let wx = b.x + 5; wx < b.x + b.w - ww - 3; wx += gx) {
        if (!rowLit || rng() > winDensity) continue;
        const r = rng();
        x.fillStyle = tint < 0.5 ? (r < 0.8 ? `rgba(255,${200 + (r * 40) | 0},140,${0.45 + r * 0.5})` : 'rgba(25,240,255,.8)')
          : tint < 0.8 ? (r < 0.8 ? `rgba(140,220,255,${0.35 + r * 0.5})` : 'rgba(255,43,214,.8)') : `rgba(255,120,200,${0.3 + r * 0.5})`;
        x.fillRect(wx, wy, ww, wh);
      }
    }
    // occasional neon accent stripe
    if (rng() < 0.15) { x.fillStyle = rng() < 0.5 ? 'rgba(255,43,214,.9)' : 'rgba(25,240,255,.9)'; x.fillRect(b.x, top + 4, b.w, 2); }
  }
  return { tex: PIXI.Texture.from(c), buildings };
}

// ---------- ship ----------
function drawShip(g, color, rng, simple = false) {
  g.poly([-214, -46, 222, -50, 238, -46, 214, 6, -202, 6, -214, -14]).fill(mix(color, 0x080c1a, 0.8));
  g.moveTo(-214, -14).lineTo(-202, 6).lineTo(214, 6).lineTo(238, -46).stroke({ width: 1.5, color: mix(color, 0xffffff, 0.2), alpha: 0.55 });
  g.poly([-214, -46, 222, -50, 238, -46, 236, -42, -214, -40]).fill(0x161d36);
  g.poly([-204, 0, 216, 0, 214, 6, -202, 6]).fill(0x5a1022);
  g.rect(-212, -48, 446, 3).fill({ color, alpha: 1 });
  if (!simple) {
    for (let x = -186; x < 205; x += 15) g.circle(x, -30, 2.1).fill({ color: mix(color, 0xffffff, 0.55), alpha: rng() < 0.72 ? 0.95 : 0.2 });
  }
  // containers
  for (let x = -128; x < 192; x += 31) {
    const hgt = 1 + Math.floor(rng() * 3.6);
    for (let k = 0; k < hgt; k++) {
      const col = rng() < 0.1 ? mix(color, 0x000000, 0.35) : CONTAINER_COLS[Math.floor(rng() * CONTAINER_COLS.length)];
      const y = -50 - 16 * (k + 1);
      g.rect(x, y, 29, 15).fill(col);
      if (!simple) { g.rect(x, y, 29, 2).fill({ color: 0xffffff, alpha: 0.12 }); for (let r = 4; r < 28; r += 5) g.rect(x + r, y + 3, 1, 11).fill({ color: 0x000000, alpha: 0.28 }); }
    }
  }
  // bridge superstructure
  g.rect(-206, -112, 58, 64).fill(0x141a30);
  g.rect(-214, -122, 74, 10).fill(0x1d2442);
  g.rect(-214, -122, 74, 2).fill({ color, alpha: 0.9 });
  for (let row = 0; row < 3; row++) for (let i = 0; i < 6; i++) g.rect(-201 + i * 9, -104 + row * 16, 6, 5).fill({ color: rng() < 0.7 ? 0xffd9a0 : mix(color, 0xffffff, 0.4), alpha: rng() < 0.8 ? 0.95 : 0.15 });
  g.rect(-212, -120, 70, 4).fill({ color: 0xbff9ff, alpha: 0.7 });
  // funnel + masts
  g.rect(-196, -146, 22, 24).fill(0x1d2442); g.rect(-196, -140, 22, 4).fill({ color, alpha: 1 });
  g.rect(-170, -166, 2, 44).fill(0x2a3150); g.rect(-180, -150, 22, 1.5).fill(0x2a3150);
  g.rect(210, -86, 2, 36).fill(0x2a3150);
}

// ---------- crane ----------
function buildCrane(T, x, boom, phase) {
  const c = new PIXI.Container(); c.x = x; c.y = 604;
  const g = new PIXI.Graphics();
  const steel = 0x1a2142, edge = 0x33416e;
  const legs = [-70, 46];
  for (const lx of legs) {
    g.rect(lx, -300, 14, 300).fill(steel); g.rect(lx, -300, 3, 300).fill(edge);
    g.rect(lx - 6, -8, 26, 8).fill(0x2a2f44);
  }
  g.rect(-76, -150, 142, 10).fill(steel);
  g.moveTo(-64, -140).lineTo(52, -10).stroke({ width: 3, color: steel });
  g.moveTo(52, -140).lineTo(-64, -10).stroke({ width: 3, color: steel });
  g.moveTo(-64, -290).lineTo(52, -160).stroke({ width: 3, color: steel });
  g.moveTo(52, -290).lineTo(-64, -160).stroke({ width: 3, color: steel });
  // boom
  g.rect(-boom, -312, boom + 150, 16).fill(steel); g.rect(-boom, -312, boom + 150, 2).fill(edge);
  for (let bx = -boom; bx < 140; bx += 24) g.moveTo(bx, -297).lineTo(bx + 12, -311).stroke({ width: 1.5, color: edge });
  // apex + stays
  g.rect(-10, -400, 12, 90).fill(steel);
  g.moveTo(-4, -400).lineTo(-boom, -312).stroke({ width: 2, color: edge });
  g.moveTo(-4, -400).lineTo(-boom * 0.5, -312).stroke({ width: 1.5, color: edge });
  g.moveTo(-4, -400).lineTo(145, -312).stroke({ width: 2, color: edge });
  // machinery house
  g.rect(70, -342, 80, 30).fill(0x232b4f); g.rect(70, -342, 80, 3).fill({ color: C.amber, alpha: 0.9 });
  g.rect(78, -334, 10, 6).fill({ color: 0xffd9a0, alpha: 0.9 }); g.rect(94, -334, 10, 6).fill({ color: 0xffd9a0, alpha: 0.5 });
  // cyan strip lights along boom underside
  for (let bx = -boom + 8; bx < 140; bx += 20) g.rect(bx, -296, 6, 2).fill({ color: C.cyan, alpha: 0.9 });
  // operator cab
  g.rect(-boom * 0.55 - 12, -296, 24, 18).fill(0x1d2442); g.rect(-boom * 0.55 - 10, -292, 20, 8).fill({ color: 0xffd9a0, alpha: 0.85 });
  c.addChild(g);

  // hanging load (swinging)
  const load = new PIXI.Container();
  load.x = -boom * 0.72; load.y = -296;
  const lg = new PIXI.Graphics();
  const drop = 150 + Math.random() * 60;
  lg.rect(-16, -8, 32, 10).fill(0x2a3150);
  lg.moveTo(-10, 0).lineTo(-30, drop).stroke({ width: 1.5, color: 0x8899bb, alpha: 0.7 });
  lg.moveTo(10, 0).lineTo(30, drop).stroke({ width: 1.5, color: 0x8899bb, alpha: 0.7 });
  lg.rect(-44, drop, 88, 6).fill(C.amber);
  const col = CONTAINER_COLS[Math.floor(Math.random() * CONTAINER_COLS.length)];
  lg.rect(-42, drop + 6, 84, 34).fill(col);
  lg.rect(-42, drop + 6, 84, 3).fill({ color: 0xffffff, alpha: 0.15 });
  for (let r = -38; r < 40; r += 7) lg.rect(r, drop + 11, 1.5, 26).fill({ color: 0x000000, alpha: 0.3 });
  load.addChild(lg);
  const loadGlow = new PIXI.Sprite(T.glow); loadGlow.anchor.set(0.5); loadGlow.tint = C.amber; loadGlow.alpha = 0.5; loadGlow.scale.set(1.1, 0.35); loadGlow.y = drop + 3;
  loadGlow.blendMode = 'add';
  load.addChild(loadGlow);
  c.addChild(load);

  // aviation lights
  const lights = [];
  for (const [lx, ly] of [[-4, -404], [-boom, -314], [146, -314]]) {
    const s = new PIXI.Sprite(T.glow); s.anchor.set(0.5); s.x = lx; s.y = ly; s.tint = C.red; s.scale.set(0.45); s.blendMode = 'add';
    c.addChild(s); lights.push(s);
  }
  return { c, load, lights, phase, boom, drop };
}

// ---------- scene ----------
export async function createScene(rootEl, opts = {}) {
  rootEl = rootEl || document.getElementById('scene-root') || document.body;
  const app = new PIXI.Application();
  await app.init({
    resizeTo: rootEl, background: C.night, antialias: true, autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 1.5), powerPreference: 'high-performance',
  });
  rootEl.appendChild(app.canvas);

  try {
    await Promise.race([
      Promise.all(['900 40px Orbitron', '400 40px "Bebas Neue"', '16px "Share Tech Mono"'].map((f) => document.fonts?.load(f))),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {}

  const T = makeTextures();
  const rng = mulberry32(1337);
  const stage = app.stage;
  const root = new PIXI.Container();
  stage.addChild(root);
  const layer = (depth) => { const l = new PIXI.Container(); l.depth = depth; root.addChild(l); return l; };

  // --- displacement for water reflections
  const dispSprite = new PIXI.Sprite(T.disp);
  dispSprite.scale.set(3, 1.2);
  dispSprite.alpha = 0;
  stage.addChild(dispSprite);
  let dispFilter = null;
  try { dispFilter = new PIXI.DisplacementFilter({ sprite: dispSprite, scale: { x: 12, y: 4 } }); } catch (e) { console.warn('[scene] displacement unavailable', e); }

  // ===== SKY =====
  const Lsky = layer(0.03);
  const sky = new PIXI.Sprite(T.sky); sky.x = X0 - 200; sky.y = -700; sky.width = X1 - X0 + 400; sky.height = HZ + 700 + 10;
  Lsky.addChild(sky);
  // cloud masses
  const clouds = [];
  for (let i = 0; i < 9; i++) {
    const s = new PIXI.Sprite(T.fog); s.anchor.set(0.5);
    s.x = X0 + rng() * (X1 - X0); s.y = -60 + rng() * 260; s.scale.set(3 + rng() * 3, 1.6 + rng() * 1.4);
    s.tint = mix(0x2a1c4a, 0x0c1230, rng()); s.alpha = 0.55; clouds.push(s); Lsky.addChild(s);
  }
  const bolt = new PIXI.Graphics(); Lsky.addChild(bolt);
  // horizon city-glow haze
  const haze = new PIXI.Sprite(T.glow); haze.anchor.set(0.5); haze.x = W / 2; haze.y = HZ; haze.width = 3400; haze.height = 520; haze.tint = 0xff2b8a; haze.alpha = 0.28; haze.blendMode = 'add';
  Lsky.addChild(haze);
  const haze2 = new PIXI.Sprite(T.glow); haze2.anchor.set(0.5); haze2.x = 1400; haze2.y = HZ - 30; haze2.width = 1600; haze2.height = 300; haze2.tint = C.cyan; haze2.alpha = 0.12; haze2.blendMode = 'add';
  Lsky.addChild(haze2);
  // searchlight beams
  const beams = [];
  for (const [bx, tint, ph] of [[180, C.cyan, 0], [1700, 0xbfd8ff, 2.1], [820, C.magenta, 4]]) {
    const b = new PIXI.Sprite(T.beam); b.anchor.set(0.5, 1); b.x = bx; b.y = HZ - 10; b.width = 420; b.height = 900;
    b.tint = tint; b.alpha = 0.09; b.blendMode = 'add'; b.phase = ph; beams.push(b); Lsky.addChild(b);
  }

  // ===== WATER base =====
  const Lwater = layer(0.1);
  const water = new PIXI.Sprite(T.water); water.x = X0 - 200; water.y = HZ; water.width = X1 - X0 + 400; water.height = 1300;
  Lwater.addChild(water);

  // ===== CITY (far + near + signs) with reflections =====
  const Lcity = layer(0.1);
  const CW = X1 - X0 + 200;
  const signs = [
    { text: 'KAIJU COLA', color: '#ff2bd6', x: 300, y: 300, size: 30 },
    { text: 'NEXUS//BANK', color: '#19f0ff', x: 760, y: 282, size: 26 },
    { text: 'HALOGEN', color: '#ffb020', x: 1250, y: 330, size: 28 },
    { text: 'OKAMI', color: '#ff2bd6', x: 1590, y: 250, size: 28, vertical: true },
    { text: 'TRADE IS TRUST', color: '#19f0ff', x: 1950, y: 330, size: 20 },
    { text: 'ZEROHOUR', color: '#ff3355', x: -80, y: 320, size: 24 },
    { text: 'SUNDA', color: '#2bff9a', x: 1010, y: 250, size: 22, vertical: true },
  ];
  const far = skylineTex(mulberry32(7), { width: CW, height: 330, minH: 50, maxH: 250, base: ['#0d1233', '#0a0e26'], edge: 'rgba(80,110,200,.18)', winDensity: 0.28 });
  const nearTall = signs.map((s) => ({ x: s.x - X0 + 100 - 70, w: 140, h: HZ - s.y + 50 + (s.vertical ? 60 : 0) }));
  const near = skylineTex(mulberry32(42), { width: CW, height: 440, minH: 70, maxH: 300, base: ['#0a0d22', '#05070f'], edge: 'rgba(25,240,255,.15)', winDensity: 0.4, tall: nearTall });
  const farS = new PIXI.Sprite(far.tex); farS.anchor.set(0, 1); farS.x = X0 - 100; farS.y = HZ; farS.alpha = 0.95;
  const nearS = new PIXI.Sprite(near.tex); nearS.anchor.set(0, 1); nearS.x = X0 - 100; nearS.y = HZ + 2;
  const signLayer = new PIXI.Container();
  const signSprites = [];
  for (const s of signs) {
    const tex = neonTex(s.text, s.color, { size: s.size, vertical: s.vertical });
    const sp = new PIXI.Sprite(tex); sp.anchor.set(0.5, 0); sp.x = s.x; sp.y = s.y;
    sp.flick = 0; sp.base = 1; signSprites.push(sp); signLayer.addChild(sp);
  }
  // reflections
  const refl = new PIXI.Container();
  const farR = new PIXI.Sprite(far.tex); farR.anchor.set(0, 1); farR.scale.y = -0.85; farR.x = farS.x; farR.y = HZ; farR.alpha = 0.5;
  const nearR = new PIXI.Sprite(near.tex); nearR.anchor.set(0, 1); nearR.scale.y = -0.85; nearR.x = nearS.x; nearR.y = HZ + 2; nearR.alpha = 0.7;
  refl.addChild(farR, nearR);
  const signRefl = [];
  for (const sp of signSprites) {
    const r = new PIXI.Sprite(sp.texture); r.anchor.set(0.5, 0); r.x = sp.x; r.y = HZ + (HZ - sp.y) * 0.85; r.scale.y = -0.85; r.alpha = 0.75;
    signRefl.push(r); refl.addChild(r);
  }
  const shimmer = new PIXI.TilingSprite({ texture: T.shimmer, width: X1 - X0 + 400, height: 520 });
  shimmer.x = X0 - 200; shimmer.y = HZ + 4; shimmer.alpha = 0.55; shimmer.blendMode = 'add';
  refl.addChild(shimmer);
  refl.alpha = 0.55;
  if (dispFilter) refl.filters = [dispFilter];
  Lcity.addChild(farS, nearS, signLayer, refl);
  // horizon fog band
  const fogs = [];
  const addFog = (parent, y, alpha, tint, n, sx = 5) => {
    for (let i = 0; i < n; i++) {
      const f = new PIXI.Sprite(T.fog); f.anchor.set(0.5); f.x = X0 + rng() * (X1 - X0); f.y = y + (rng() - 0.5) * 30;
      f.scale.set(sx + rng() * 2, 0.9 + rng() * 0.6); f.alpha = alpha; f.tint = tint; f.speed = 6 + rng() * 14;
      fogs.push(f); parent.addChild(f);
    }
  };
  addFog(Lcity, HZ - 4, 0.22, 0x6a5aa8, 6);

  // ===== PIER, CONTAINERS, CRANES =====
  const Lpier = layer(0.32);
  const pier = new PIXI.Graphics();
  const PX = 1020;
  // container stacks on the pier
  const stackRng = mulberry32(99);
  for (let x = PX + 20; x < X1 + 100; x += 64) {
    const h = 1 + Math.floor(stackRng() * 4);
    for (let k = 0; k < h; k++) {
      const col = CONTAINER_COLS[Math.floor(stackRng() * CONTAINER_COLS.length)];
      const y = 600 - 26 * (k + 1);
      pier.rect(x, y, 60, 25).fill(mix(col, 0x05070f, 0.25));
      pier.rect(x, y, 60, 2).fill({ color: 0xffffff, alpha: 0.1 });
      for (let r = 5; r < 58; r += 6) pier.rect(x + r, y + 4, 1, 18).fill({ color: 0x000000, alpha: 0.3 });
    }
  }
  pier.rect(PX, 600, X1 - PX + 200, 12).fill(0x1b2036);
  pier.rect(PX, 600, X1 - PX + 200, 2).fill({ color: C.cyan, alpha: 0.85 });
  pier.rect(PX, 612, X1 - PX + 200, 52).fill(0x0c0f1e);
  for (let x = PX + 30; x < X1 + 100; x += 90) { pier.roundRect(x, 620, 16, 30, 5).fill(0x05060c); }
  for (let x = PX; x < X1 + 100; x += 18) pier.rect(x, 662, 9, 3).fill({ color: C.amber, alpha: 0.5 });
  Lpier.addChild(pier);
  // pier reflection
  const pierR = new PIXI.Graphics();
  pierR.rect(PX, 664, X1 - PX + 200, 40).fill({ color: 0x000000, alpha: 0.45 });
  for (let x = PX; x < X1 + 100; x += 18) pierR.rect(x, 668 + (x % 5), 9, 2).fill({ color: C.amber, alpha: 0.18 });
  pierR.rect(PX, 690, X1 - PX + 200, 2).fill({ color: C.cyan, alpha: 0.18 });
  Lpier.addChild(pierR);
  // lamp posts (sodium)
  const lamps = [];
  const streaks = [];
  for (const lx of [1060, 1380, 1700, 2020]) {
    const lp = new PIXI.Graphics(); lp.rect(lx, 470, 4, 130).fill(0x252b44); lp.rect(lx - 14, 468, 22, 5).fill(0x252b44);
    Lpier.addChild(lp);
    const gl = new PIXI.Sprite(T.glow); gl.anchor.set(0.5); gl.x = lx - 8; gl.y = 474; gl.scale.set(0.9); gl.tint = 0xffa64a; gl.alpha = 0.55; gl.blendMode = 'add';
    Lpier.addChild(gl); lamps.push(gl);
    const pool = new PIXI.Sprite(T.glow); pool.anchor.set(0.5); pool.x = lx - 8; pool.y = 600; pool.scale.set(2.2, 0.3); pool.tint = 0xffa64a; pool.alpha = 0.35; pool.blendMode = 'add';
    Lpier.addChild(pool);
    const st = new PIXI.Sprite(T.glow); st.anchor.set(0.5, 0); st.x = lx - 8; st.y = 664; st.scale.set(0.28, 2.2); st.tint = 0xffa64a; st.alpha = 0.3; st.blendMode = 'add'; st.phase = lx;
    Lpier.addChild(st); streaks.push(st);
  }
  // inspection berth sign
  const berthSign = new PIXI.Sprite(neonTex('INSPECTION BERTH 01', '#19f0ff', { size: 15, font: 'Share Tech Mono', weight: 400, spacing: 2 }));
  berthSign.anchor.set(0.5); berthSign.x = PX + 110; berthSign.y = 548; berthSign.scale.set(0.85);
  const bsPole = new PIXI.Graphics(); bsPole.rect(PX + 30, 558, 4, 44).fill(0x252b44); bsPole.rect(PX + 186, 558, 4, 44).fill(0x252b44); Lpier.addChild(bsPole);
  Lpier.addChild(berthSign);
  const cranes = [buildCrane(T, 1380, 300, 0), buildCrane(T, 1760, 330, 1.7)];
  cranes.forEach((cr) => Lpier.addChild(cr.c));

  // ===== SHIPS =====
  const Lships = layer(0.42);
  Lships.sortableChildren = true;
  // detention zone props: buoys + sign
  const detainZone = new PIXI.Container(); detainZone.zIndex = 700; Lships.addChild(detainZone);
  const buoys = [];
  for (let i = 0; i < 7; i++) {
    const bx = DETAIN.x - 290 + i * 95, by = 730 + Math.sin(i) * 5;
    const b = new PIXI.Graphics(); b.poly([-7, 0, 7, 0, 4, -14, -4, -14]).fill(0x2a1d0a); b.rect(-6, -10, 12, 3).fill(C.amber);
    b.x = bx; b.y = by; detainZone.addChild(b);
    const gl = new PIXI.Sprite(T.glow); gl.anchor.set(0.5); gl.x = bx; gl.y = by - 16; gl.scale.set(0.35); gl.tint = C.amber; gl.blendMode = 'add'; gl.phase = i * 0.7;
    detainZone.addChild(gl); buoys.push(gl);
  }
  const detainSign = new PIXI.Sprite(neonTex('DETENTION', '#ffb020', { size: 16, font: 'Share Tech Mono', weight: 400, spacing: 3 }));
  detainSign.anchor.set(0.5); detainSign.x = DETAIN.x + 330; detainSign.y = 640; detainSign.scale.set(0.9);
  const dsPole = new PIXI.Graphics(); dsPole.rect(DETAIN.x + 328, 652, 4, 80).fill(0x252b44);
  detainZone.addChild(dsPole, detainSign);

  const scan = new PIXI.Container(); scan.zIndex = 5000; scan.visible = false; Lships.addChild(scan);
  const scanLine = new PIXI.Graphics(); scanLine.rect(-1.5, -150, 3, 160).fill({ color: C.cyan, alpha: 0.9 });
  const scanGlow = new PIXI.Sprite(T.glow); scanGlow.anchor.set(0.5); scanGlow.scale.set(0.5, 2.6); scanGlow.y = -70; scanGlow.tint = C.cyan; scanGlow.alpha = 0.5; scanGlow.blendMode = 'add';
  scan.addChild(scanGlow, scanLine);

  // ===== FOREGROUND quay + customs tower =====
  const Lfg = layer(0.75);
  const ground = new PIXI.Sprite(T.ground); ground.x = X0 - 400; ground.y = QUAY_Y; ground.width = X1 - X0 + 800; ground.height = 900;
  Lfg.addChild(ground);
  const quay = new PIXI.Graphics();
  quay.rect(X0 - 400, QUAY_Y - 6, X1 - X0 + 800, 8).fill(0x1a1f36);
  for (let x = X0 - 400; x < X1 + 400; x += 40) quay.poly([x, QUAY_Y + 2, x + 20, QUAY_Y + 2, x + 30, QUAY_Y + 10, x + 10, QUAY_Y + 10]).fill({ color: C.amber, alpha: 0.75 });
  for (let x = X0; x < X1 + 200; x += 260) { quay.roundRect(x, QUAY_Y - 24, 22, 22, 6).fill(0x0d1020); quay.rect(x - 3, QUAY_Y - 26, 28, 5).fill(0x1d2442); }
  // fg container stack right
  for (const [cx, cy, col] of [[1780, QUAY_Y - 70, 0x6b2a5a], [1850, QUAY_Y - 140, 0x1f4d6b], [1700, QUAY_Y - 140, 0x7a5418], [2000, QUAY_Y - 70, 0x245c46]]) {
    quay.rect(cx, cy, 200, 70).fill(mix(col, 0x000000, 0.45)); quay.rect(cx, cy, 200, 3).fill({ color: 0xffffff, alpha: 0.08 });
    for (let r = 8; r < 196; r += 10) quay.rect(cx + r, cy + 6, 2, 58).fill({ color: 0x000000, alpha: 0.35 });
  }
  Lfg.addChild(quay);
  // puddle reflections of lights
  const puddles = [];
  for (let i = 0; i < 16; i++) {
    const p = new PIXI.Sprite(T.glow); p.anchor.set(0.5, 0);
    p.x = X0 + rng() * (X1 - X0); p.y = QUAY_Y + 20 + rng() * 120; p.scale.set(0.25 + rng() * 0.4, 1.2 + rng() * 2);
    p.tint = [C.magenta, C.cyan, C.amber, 0xffa64a][i % 4]; p.alpha = 0.3 + rng() * 0.25; p.scale.y *= 1.8; p.blendMode = 'add'; p.phase = rng() * 6;
    puddles.push(p); Lfg.addChild(p);
  }
  // foreground railing silhouette
  const rail = new PIXI.Graphics();
  for (let x = X0; x < X1 + 300; x += 120) { rail.rect(x, 965, 8, 120).fill(0x04050b); rail.rect(x, 965, 2, 120).fill({ color: C.cyan, alpha: 0.25 }); }
  rail.rect(X0, 962, X1 - X0 + 300, 7).fill(0x05060d); rail.rect(X0, 962, X1 - X0 + 300, 1.5).fill({ color: C.magenta, alpha: 0.45 });
  rail.rect(X0, 1010, X1 - X0 + 300, 5).fill(0x05060d); rail.rect(X0, 1010, X1 - X0 + 300, 1).fill({ color: C.cyan, alpha: 0.3 });
  Lfg.addChild(rail);
  // customs tower (left)
  const tower = new PIXI.Graphics();
  tower.rect(-120, 330, 330, QUAY_Y - 330).fill(0x080b1a);
  tower.rect(-120, QUAY_Y - 60, 330, 60).fill(0x0c1024); tower.rect(20, QUAY_Y - 52, 60, 52).fill({ color: 0xffd9a0, alpha: 0.25 });
  tower.rect(-120, 330, 330, 3).fill({ color: C.magenta, alpha: 0.9 });
  tower.rect(150, 330, 60, QUAY_Y - 330).fill(0x0c1024);
  for (let y = 360; y < QUAY_Y - 30; y += 34) for (let x = -100; x < 140; x += 30) tower.rect(x, y, 18, 12).fill({ color: rng() < 0.6 ? 0x7fdcff : 0xffd9a0, alpha: rng() < 0.55 ? 0.55 : 0.08 });
  tower.rect(-60, 250, 6, 80).fill(0x252b44);
  Lfg.addChild(tower);
  const towerSign = new PIXI.Sprite(neonTex('CUSTOMS', '#ff2bd6', { size: 36, vertical: true }));
  towerSign.anchor.set(0.5, 0); towerSign.x = 180; towerSign.y = 360; towerSign.scale.set(0.95); Lfg.addChild(towerSign);
  const flag = new PIXI.Graphics(); flag.poly([-54, 252, -10, 262, -54, 276]).fill(C.red); Lfg.addChild(flag);
  const flagGlow = new PIXI.Sprite(T.glow); flagGlow.anchor.set(0.5); flagGlow.x = -40; flagGlow.y = 262; flagGlow.tint = C.red; flagGlow.scale.set(0.9); flagGlow.blendMode = 'add'; Lfg.addChild(flagGlow);
  const towerBeacon = new PIXI.Sprite(T.cone); towerBeacon.anchor.set(0, 0.5); towerBeacon.x = -57; towerBeacon.y = 250; towerBeacon.scale.set(1.6, 1.4); towerBeacon.tint = C.red; towerBeacon.alpha = 0; towerBeacon.blendMode = 'add';
  Lfg.addChild(towerBeacon);
  // near fog over the water & quay
  addFog(Lfg, 800, 0.08, 0x8aa0d0, 6, 6);
  addFog(Lfg, 640, 0.06, 0xb58ad6, 5, 7);
  // splash ripples pool
  const splashes = [];
  for (let i = 0; i < 46; i++) { const s = new PIXI.Sprite(T.ripple); s.anchor.set(0.5); s.visible = false; s.blendMode = 'add'; splashes.push(s); Lfg.addChild(s); }

  // ===== SCREEN-SPACE overlays =====
  const rainC = new PIXI.Container(); stage.addChild(rainC);
  const drops = [];
  for (let i = 0; i < 600; i++) {
    const d = new PIXI.Sprite(T.rain); d.anchor.set(0.5, 1);
    d.z = 0.3 + Math.random() * 0.7; d.alpha = 0.08 + d.z * 0.32; d.scale.set(0.35 + d.z * 0.5, 0.35 + d.z * 0.9);
    d.tint = Math.random() < 0.1 ? 0xffc0f0 : 0xd0ecff;
    d.x = Math.random() * 2000; d.y = Math.random() * 1200;
    drops.push(d); rainC.addChild(d);
  }
  const flash = new PIXI.Graphics(); flash.rect(0, 0, 10, 10).fill(0xcfe0ff); flash.alpha = 0; flash.blendMode = 'add'; stage.addChild(flash);
  const redTint = new PIXI.Graphics(); redTint.rect(0, 0, 10, 10).fill(0xff1030); redTint.alpha = 0; redTint.blendMode = 'add'; stage.addChild(redTint);
  const sweep = new PIXI.Sprite(T.sweep); sweep.anchor.set(1, 0); sweep.alpha = 0; sweep.blendMode = 'add'; stage.addChild(sweep);
  const dim = new PIXI.Graphics(); dim.rect(0, 0, 10, 10).fill(0x02030a); dim.alpha = 0; stage.addChild(dim);

  // ===== bloom =====
  let bloom = null;
  if (Filters?.AdvancedBloomFilter && opts.bloom !== false) {
    try {
      bloom = new Filters.AdvancedBloomFilter({ threshold: 0.42, bloomScale: 1.15, brightness: 1.0, blur: 6, quality: 4 });
      bloom.resolution = 0.5;
      root.filters = [bloom];
    } catch (e) { console.warn('[scene] bloom failed', e); }
  }

  // ===== state =====
  const ships = new Map();
  const queue = []; // ids waiting in lane (ordered)
  let docked = null;
  const detained = [];
  const ambient = [];
  let mode = 'title';
  let tension = 0.2;
  let t = 0;
  let nextLightning = 4;
  let nextAmbient = 2;
  let alarmT = 0;
  const cam = { x: 960, y: 560, s: 1, dimA: 0 };
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let splashAcc = 0;
  // adaptive quality: if the machine cannot hold ~40fps, shed bloom then displacement and rain
  const perf = { acc: 0, n: 0, level: 0, wait: 3 };
  let rainCap = 600;

  function camTarget(m) {
    const sw = app.screen.width, sh = app.screen.height;
    if (m === 'shift') {
      const s = Math.max(sw / 1760, (0.45 * sh) / 520);
      return { s, x: 1010, y: 742 + (0.5 - 0.43) * sh / s, dimA: 0 };
    }
    const s = Math.max(sw / 1760, sh / 1000);
    if (m === 'briefing' || m === 'debrief') return { s: s * 1.04, x: 960, y: 520, dimA: 0.42 };
    return { s, x: 960, y: 515, dimA: 0 };
  }
  function applyResize() {
    const sw = app.screen.width, sh = app.screen.height;
    flash.width = redTint.width = dim.width = sw; flash.height = redTint.height = dim.height = sh;
    sweep.height = sh; sweep.width = Math.max(600, sw * 0.6);
    const tg = camTarget(mode);
    G()?.killTweensOf(cam);
    Object.assign(cam, tg);
  }
  app.renderer.on?.('resize', applyResize);
  window.addEventListener('resize', () => setTimeout(applyResize, 30));
  applyResize();

  const onMove = (e) => { mouse.tx = (e.clientX / innerWidth) * 2 - 1; mouse.ty = (e.clientY / innerHeight) * 2 - 1; };
  window.addEventListener('pointermove', onMove, { passive: true });

  // ----- ships -----
  function makeShip(m, opts = {}) {
    const color = Number.isFinite(m?.shipColor) ? m.shipColor : C.cyan;
    const seed = hashStr(m?.id || m?.shipName || Math.random());
    const c = new PIXI.Container();
    // water glow + reflection
    const wglow = new PIXI.Sprite(T.glow); wglow.anchor.set(0.5); wglow.y = 8; wglow.width = 620; wglow.height = 80; wglow.tint = color; wglow.alpha = 0.5; wglow.blendMode = 'add';
    const reflG = new PIXI.Graphics(); drawShip(reflG, color, mulberry32(seed), true); reflG.scale.y = -0.7; reflG.y = 10; reflG.alpha = 0.22;
    const body = new PIXI.Graphics(); drawShip(body, color, mulberry32(seed));
    const strip = new PIXI.Sprite(T.glow); strip.anchor.set(0.5); strip.y = -47; strip.width = 520; strip.height = 26; strip.tint = color; strip.alpha = 0.55; strip.blendMode = 'add';
    const bridgeGlow = new PIXI.Sprite(T.glow); bridgeGlow.anchor.set(0.5); bridgeGlow.x = -178; bridgeGlow.y = -90; bridgeGlow.scale.set(1.3, 0.9); bridgeGlow.tint = 0xffc070; bridgeGlow.alpha = 0.35; bridgeGlow.blendMode = 'add';
    const mast = new PIXI.Sprite(T.glow); mast.anchor.set(0.5); mast.x = -169; mast.y = -168; mast.scale.set(0.35); mast.blendMode = 'add';
    const bow = new PIXI.Sprite(T.glow); bow.anchor.set(0.5); bow.x = 211; bow.y = -88; bow.scale.set(0.32); bow.tint = C.green; bow.blendMode = 'add';
    const status = new PIXI.Sprite(T.glow); status.anchor.set(0.5); status.x = -169; status.y = -168; status.scale.set(1.1); status.alpha = 0; status.blendMode = 'add';
    const name = new PIXI.Text({ text: String(m?.shipName || m?.id || 'UNKNOWN').toUpperCase(), style: { fontFamily: 'Share Tech Mono, monospace', fontSize: 15, fill: 0xeaf6ff, letterSpacing: 2 } });
    name.anchor.set(0.5); name.y = -31; name.x = 40; name.alpha = 0.95;
    const nameBg = new PIXI.Graphics(); nameBg.rect(-name.width / 2 - 6, -10, name.width + 12, 20).fill({ color: 0x05070f, alpha: 0.85 }); nameBg.x = 40; nameBg.y = -31;
    const beacons = new PIXI.Container(); beacons.visible = false;
    for (const [bx, by, col] of [[-180, -126, C.red], [210, -92, C.amber], [10, -120, C.red]]) {
      const cone = new PIXI.Sprite(T.cone); cone.anchor.set(0, 0.5); cone.x = bx; cone.y = by; cone.scale.set(1.1, 1); cone.tint = col; cone.blendMode = 'add'; cone.alpha = 0.7;
      const gl = new PIXI.Sprite(T.glow); gl.anchor.set(0.5); gl.x = bx; gl.y = by; gl.scale.set(0.7); gl.tint = col; gl.blendMode = 'add';
      cone.spin = 4 + Math.random() * 2; beacons.addChild(cone, gl);
    }
    c.addChild(wglow, reflG, body, strip, bridgeGlow, nameBg, name, mast, bow, status, beacons);
    const s = {
      id: m?.id ?? `amb${seed}`, m, c, name, nameBg, beacons, status, mast, bow, strip,
      pos: { x: opts.x ?? ARRIVE.x, y: opts.y ?? ARRIVE.y }, dir: 1, alpha: 0, phase: Math.random() * 6, speedBob: 1, ambient: !!opts.ambient,
      state: 'arriving',
    };
    Lships.addChild(c);
    return s;
  }
  function removeShip(s) {
    G()?.killTweensOf(s.pos); G()?.killTweensOf(s);
    s.c.destroy({ children: true });
    if (s.tug) s.tug.destroy({ children: true });
    ships.delete(s.id);
    const ai = ambient.indexOf(s); if (ai >= 0) ambient.splice(ai, 1);
  }
  function slotX(i) { const sp = Math.min(165, 1050 / Math.max(1, queue.length)); return 870 - i * sp; }
  function reflow() {
    queue.forEach((id, i) => {
      const s = ships.get(id); if (!s) return;
      const x = slotX(i);
      if (s.state === 'arriving') {
        G()?.killTweensOf(s.pos);
        const d = Math.abs(x - s.pos.x);
        tween(s.pos, { x, y: LANE_Y, duration: clamp(d / 160, 2, 9), ease: 'sine.out', onComplete: () => { s.state = 'queued'; } });
        s.state = 'arriving';
      } else if (s.state === 'queued') {
        G()?.killTweensOf(s.pos);
        tween(s.pos, { x, y: LANE_Y, duration: 1.6, ease: 'sine.inOut' });
      }
    });
  }
  function makeTug() {
    const g = new PIXI.Container();
    const b = new PIXI.Graphics();
    b.poly([-40, -10, 30, -10, 44, -16, 36, 4, -36, 4]).fill(0x0d1122);
    b.rect(-24, -32, 30, 22).fill(0x1b2240); b.rect(-20, -27, 22, 6).fill({ color: 0xffd9a0, alpha: 0.9 });
    b.rect(-40, -12, 84, 2).fill(C.amber);
    const l = new PIXI.Sprite(T.glow); l.anchor.set(0.5); l.y = -38; l.x = -8; l.scale.set(0.6); l.tint = C.amber; l.blendMode = 'add';
    g.addChild(b, l); g.light = l;
    Lships.addChild(g);
    return g;
  }

  function spawnAmbient() {
    const fake = { id: `amb-${Math.random().toString(36).slice(2)}`, shipName: '', shipColor: [C.cyan, C.magenta, C.amber, 0x8fa8ff][Math.floor(Math.random() * 4)] };
    const s = makeShip(fake, { x: -560, y: 494 + Math.random() * 10, ambient: true });
    s.name.visible = s.nameBg.visible = false;
    s.state = 'ambient';
    ambient.push(s);
    const dur = 70 + Math.random() * 40;
    tween(s.pos, { x: X1 + 400, duration: dur, ease: 'none', onComplete: () => removeShip(s) });
  }

  // ----- lightning -----
  function lightning() {
    const bx = 100 + Math.random() * 1700;
    bolt.clear();
    let x = bx, y = -120;
    const pts = [[x, y]];
    while (y < HZ - 120 - Math.random() * 120) { x += (Math.random() - 0.5) * 70; y += 20 + Math.random() * 40; pts.push([x, y]); }
    const path = (g, w, col, a) => { g.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) g.lineTo(p[0], p[1]); g.stroke({ width: w, color: col, alpha: a }); };
    path(bolt, 9, 0x9fb8ff, 0.25); path(bolt, 3, 0xe8f0ff, 1);
    const br = pts[Math.floor(pts.length / 2)];
    bolt.moveTo(br[0], br[1]).lineTo(br[0] + 60, br[1] + 70).lineTo(br[0] + 80, br[1] + 120).stroke({ width: 1.5, color: 0xe8f0ff, alpha: 0.8 });
    bolt.alpha = 1;
    const gs = G();
    const seq = [0.45, 0.05, 0.3, 0];
    if (gs) {
      const tl = gs.timeline();
      const fk = (mode === 'shift' ? 0.6 : 1) * (reduced() ? 0.25 : 1);
      seq.forEach((a, i) => tl.to(flash, { alpha: a * fk, duration: i === 3 ? 0.5 : 0.06 }));
      gs.to(bolt, { alpha: 0, duration: 0.5, delay: 0.25 });
    }
    clouds.forEach((cl) => { cl.lit = 1; });
    try { bus.emit('scene:lightning', { delay: 0.6 + Math.random() * 1.6 }); } catch {}
  }

  // ----- ticker -----
  app.ticker.add((tk) => {
    const dt = Math.min(0.05, tk.deltaMS / 1000);
    t += dt;
    if ((perf.rmCheck = (perf.rmCheck || 0) - dt) <= 0) { perf.rm = reduced(); perf.rmCheck = 0.5; }
    const calm = perf.rm ? 0.2 : 1;
    perf.acc += tk.deltaMS; perf.n++;
    if (opts.adaptive !== false && t > perf.wait && perf.n > 30) {
      const avg = perf.acc / perf.n;
      if (avg > 25 && perf.level < 2) {
        perf.level++;
        if (perf.level === 1 && root.filters) { root.filters = null; console.info('[scene] low fps, bloom off'); }
        else { refl.filters = null; rainCap = 300; console.info('[scene] low fps, reduced fx'); }
      }
      perf.acc = 0; perf.n = 0; perf.wait = t + 3;
    }
    const sw = app.screen.width, sh = app.screen.height;
    // camera + parallax
    mouse.x = lerp(mouse.x, mouse.tx, dt * 2); mouse.y = lerp(mouse.y, mouse.ty, dt * 2);
    const driftX = Math.sin(t * 0.07) * 18 * calm, driftY = Math.sin(t * 0.11) * 5 * calm;
    root.scale.set(cam.s);
    root.x = sw / 2 - (cam.x + driftX) * cam.s;
    root.y = sh / 2 - (cam.y + driftY + mouse.y * 6) * cam.s;
    for (const l of root.children) if (l.depth != null) l.x = -mouse.x * l.depth * 70 * calm;
    dim.alpha = cam.dimA;

    // water / reflections
    dispSprite.x = (dispSprite.x + dt * 18) % 768; dispSprite.y = (dispSprite.y + dt * 9) % 256;
    shimmer.tilePosition.x -= dt * 6; shimmer.tilePosition.y = Math.sin(t * 0.8) * 2;
    for (const f of fogs) { f.x += f.speed * dt; if (f.x > X1 + 300) f.x = X0 - 300; }
    for (const cl of clouds) { cl.x += dt * 4; if (cl.x > X1 + 400) cl.x = X0 - 400; if (cl.lit) { cl.lit = Math.max(0, cl.lit - dt * 2.5); } cl.alpha = 0.55 + (cl.lit || 0) * 0.45; cl.tint = cl.lit > 0.05 ? mix(0x2a1c4a, 0x9fb0ff, cl.lit) : cl.baseTint ?? (cl.baseTint = cl.tint); }
    beams.forEach((b) => { b.rotation = Math.sin(t * 0.18 + b.phase) * 0.55; b.alpha = 0.06 + 0.04 * Math.sin(t * 0.5 + b.phase); });

    // neon flicker
    signSprites.forEach((sp, i) => {
      if (sp.flick > 0) { sp.flick -= dt; sp.alpha = Math.random() < 0.5 ? 0.2 : 1; } else { sp.alpha = 0.92 + Math.sin(t * 30 + i) * 0.04; if (!perf.rm && Math.random() < dt * 0.25) sp.flick = 0.15 + Math.random() * 0.4; }
      signRefl[i].alpha = sp.alpha * 0.75;
    });
    towerSign.alpha = 0.9 + Math.sin(t * 23) * 0.05 * (Math.random() < 0.02 ? 8 : 1);

    // cranes
    for (const cr of cranes) {
      cr.load.rotation = Math.sin(t * 0.55 + cr.phase) * 0.05 + Math.sin(t * 1.3 + cr.phase) * 0.012;
      cr.load.x = -cr.boom * (0.6 + 0.18 * Math.sin(t * 0.05 + cr.phase));
      const blink = (Math.sin(t * (2 + tension * 4 + (alarmT > 0 ? 10 : 0)) + cr.phase) > 0.2) ? 1 : 0.15;
      cr.lights.forEach((l) => { l.alpha = blink; });
    }
    lamps.forEach((l, i) => { l.alpha = 0.5 + Math.sin(t * 40 + i * 3) * 0.03 + (Math.random() < 0.003 ? -0.5 : 0); });
    streaks.forEach((st) => { st.alpha = 0.26 + Math.sin(t * 5 + st.phase) * 0.06; st.scale.x = 0.26 + Math.sin(t * 7 + st.phase) * 0.04; });
    puddles.forEach((p) => { p.alpha = 0.34 + Math.sin(t * 2.4 + p.phase) * 0.1; p.scale.x = (0.3 + Math.sin(t * 3 + p.phase) * 0.06); });
    buoys.forEach((b) => { b.alpha = (Math.sin(t * 3 + b.phase) > 0 ? 0.9 : 0.15); });
    flagGlow.alpha = 0.5 + Math.sin(t * 2) * 0.2;
    towerBeacon.rotation += dt * (alarmT > 0 ? 7 : 1.2 + tension * 2);
    towerBeacon.alpha = alarmT > 0 ? 0.9 : tension > 0.55 ? 0.35 * tension : 0;

    // ships
    const all = [...ships.values(), ...ambient];
    for (const s of all) {
      const sc = persp(s.pos.y);
      s.c.x = s.pos.x; s.c.y = s.pos.y + Math.sin(t * 1.1 + s.phase) * 1.5 * sc;
      s.c.rotation = Math.sin(t * 0.8 + s.phase) * 0.008;
      s.c.scale.set(sc * s.dir, sc);
      s.c.zIndex = Math.round(s.pos.y);
      const sgn = s.dir < 0 ? -1 : 1;
      s.name.scale.x = sgn; s.nameBg.scale.x = 1;
      s.c.alpha = s.ambient ? clamp((s.pos.x + 560) / 400, 0, 0.75) : s.alpha;
      s.mast.alpha = Math.sin(t * 3 + s.phase) > 0 ? 1 : 0.25;
      if (s.beacons.visible) s.beacons.children.forEach((ch, i) => { if (ch.spin) ch.rotation += dt * ch.spin * (i % 2 ? -1 : 1); });
      if (s.status.alpha > 0 && s.statusPulse) s.status.alpha = 0.6 + Math.sin(t * 8) * 0.35;
      if (s.tug) { s.tug.x = s.pos.x - 290 * sc; s.tug.y = s.c.y + 4; s.tug.scale.set(sc * 0.85); s.tug.zIndex = s.c.zIndex + 1; s.tug.light.alpha = Math.sin(t * 6) > 0 ? 1 : 0.2; }
    }
    if (docked && ships.get(docked)?.state === 'docked') {
      const s = ships.get(docked); const sc = persp(s.pos.y);
      scan.visible = true; scan.x = s.pos.x + Math.sin(t * 1.4) * 215 * sc; scan.y = s.pos.y; scan.scale.set(1, sc * 1.05); scan.alpha = 0.55 + Math.sin(t * 9) * 0.2;
    } else scan.visible = false;

    // ambient traffic
    nextAmbient -= dt;
    if (nextAmbient <= 0) { if (ambient.length < 3) spawnAmbient(); nextAmbient = 14 + Math.random() * 16; }

    // rain (screen space)
    const active = Math.min(rainCap, Math.floor(220 + tension * 380));
    const wind = 120 + tension * 260;
    const ang = Math.atan2(wind, 1400);
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      if (i >= active) { d.visible = false; continue; }
      d.visible = true;
      const sp = 900 + d.z * 900;
      d.y += sp * dt; d.x += wind * d.z * dt;
      d.rotation = -ang;
      if (d.y > sh + 40) { d.y = -20 - Math.random() * 100; d.x = Math.random() * (sw + 200) - 150; }
      if (d.x > sw + 60) d.x -= sw + 200;
    }
    // splashes
    splashAcc += dt * (18 + tension * 40);
    while (splashAcc > 1) {
      splashAcc -= 1;
      const s = splashes.find((p) => !p.visible); if (!s) break;
      const viewL = cam.x - sw / 2 / cam.s, viewR = cam.x + sw / 2 / cam.s, viewB = cam.y + sh / 2 / cam.s;
      const y = 490 + Math.random() * (Math.min(viewB, 1100) - 490);
      s.x = viewL + Math.random() * (viewR - viewL); s.y = y; s.life = 0; s.visible = true; s.ps = persp(Math.min(y, 900)) * 0.9;
      s.tint = y > QUAY_Y ? 0xc8d8ff : 0x9fe8ff;
    }
    for (const s of splashes) {
      if (!s.visible) continue;
      s.life += dt * 2.6;
      if (s.life >= 1) { s.visible = false; continue; }
      s.scale.set(s.ps * (0.2 + s.life), s.ps * (0.2 + s.life));
      s.alpha = (1 - s.life) * 0.45;
    }

    // lightning
    nextLightning -= dt;
    if (nextLightning <= 0) { lightning(); nextLightning = lerp(14, 4, tension) + Math.random() * 8; }

    // alarm
    if (alarmT > 0) {
      alarmT -= dt;
      const p = 1 - alarmT / 2.2;
      sweep.alpha = alarmT > 0 ? 0.85 : 0;
      sweep.x = (p * 2 % 1) * (sw + sweep.width);
      redTint.alpha = (0.14 + Math.sin(p * Math.PI * (perf.rm ? 2 : 8)) * 0.1) * Math.min(1, alarmT * 2) * (perf.rm ? 0.6 : 1);
      if (alarmT <= 0) { redTint.alpha = 0; sweep.alpha = 0; }
    } else if (tension > 0.75) {
      redTint.alpha = (Math.sin(t * 2) * 0.5 + 0.5) * 0.04 * (tension - 0.75) * 4;
    } else redTint.alpha = 0;
    haze.tint = mix(0xff2b8a, 0xff2030, tension * 0.6);
  });

  // ===== public API =====
  const api = {
    app,
    setMode(m) {
      mode = m || 'title';
      const tg = camTarget(mode);
      const gs = G();
      if (gs) gs.to(cam, { ...tg, duration: 1.6, ease: 'power3.inOut', overwrite: true });
      else Object.assign(cam, tg);
    },
    shipArrive(manifest) {
      if (!manifest) return;
      const id = manifest.id ?? `ship-${Math.random().toString(36).slice(2)}`;
      if (ships.has(id)) return;
      const s = makeShip({ ...manifest, id });
      ships.set(id, s);
      queue.push(id);
      tween(s, { alpha: 1, duration: 2 });
      reflow();
    },
    shipDock(id) {
      let s = ships.get(id);
      if (!s) return;
      const qi = queue.indexOf(id); if (qi >= 0) queue.splice(qi, 1);
      // if something is still docked, push it out of the way (approve by default)
      if (docked && docked !== id && ships.get(docked)?.state === 'docked') api.shipDepart(docked, 'approve');
      docked = id;
      G()?.killTweensOf(s.pos);
      G()?.killTweensOf(s, 'alpha');
      s.state = 'docking';
      s.alpha = 1;
      const gs = G();
      if (gs) {
        gs.timeline()
          .to(s.pos, { x: BERTH.x - 120, y: (LANE_Y + BERTH.y) / 2 + 30, duration: 1.6, ease: 'sine.in' })
          .to(s.pos, { x: BERTH.x, y: BERTH.y, duration: 1.8, ease: 'power2.out', onComplete: () => { if (s.state === 'docking') s.state = 'docked'; } });
      } else { Object.assign(s.pos, BERTH); s.state = 'docked'; }
      reflow();
    },
    shipDepart(id, outcome = 'approve') {
      const s = ships.get(id);
      if (!s) return;
      const qi = queue.indexOf(id); if (qi >= 0) { queue.splice(qi, 1); reflow(); }
      if (docked === id) docked = null;
      const gs = G();
      gs?.killTweensOf(s.pos);
      s.state = 'leaving';
      if (outcome === 'detain') {
        s.beacons.visible = true;
        s.status.tint = C.red; s.status.alpha = 1; s.statusPulse = true;
        s.tug = makeTug();
        // older detainees drift off / fade
        detained.push(s);
        while (detained.length > 2) { const old = detained.shift(); tween(old, { alpha: 0, duration: 2, onComplete: () => removeShip(old) }); }
        detained.forEach((d, i) => { if (d !== s) tween(d.pos, { x: DETAIN.x - 260 - i * 40, y: DETAIN.y - 18, duration: 3, ease: 'sine.inOut' }); });
        if (gs) {
          gs.timeline()
            .to(s.pos, { x: s.pos.x - 60, y: s.pos.y + 14, duration: 1.4, ease: 'sine.inOut', delay: 0.4 })
            .to(s.pos, { x: DETAIN.x, y: DETAIN.y, duration: 4.5, ease: 'power1.inOut', onComplete: () => {
              s.state = 'detained';
              if (s.tug) { const tg = s.tug; s.tug = null; gs.to(tg, { alpha: 0, x: tg.x - 200, duration: 3, onComplete: () => tg.destroy({ children: true }) }); }
            } });
        } else { Object.assign(s.pos, DETAIN); s.state = 'detained'; }
      } else if (outcome === 'reroute') {
        s.status.tint = C.amber; s.status.alpha = 1; s.statusPulse = true;
        if (gs) {
          gs.timeline()
            .to(s, { dir: -1, duration: 2.4, ease: 'sine.inOut' }, 0)
            .to(s.pos, { y: s.pos.y - 40, x: s.pos.x - 60, duration: 2.4, ease: 'sine.inOut' }, 0)
            .to(s.pos, { x: -620, y: ARRIVE.y - 4, duration: 10, ease: 'power1.in' }, 2.4)
            .to(s, { alpha: 0, duration: 3 }, 9.4)
            .add(() => removeShip(s));
        } else removeShip(s);
      } else {
        s.status.tint = C.green; s.status.alpha = 1; s.statusPulse = true;
        s.strip.tint = C.green;
        if (gs) {
          gs.timeline()
            .to(s.pos, { x: X1 + 500, y: s.pos.y + 20, duration: 7, ease: 'power2.in', delay: 0.3 })
            .add(() => removeShip(s));
        } else removeShip(s);
      }
    },
    setTension(v) { tension = clamp(+v || 0, 0, 1); },
    alarm() {
      alarmT = 2.2;
      cranes.forEach((cr) => cr.lights.forEach((l) => { l.tint = C.red; }));
    },
    lightning,
    _debug: () => [...ships.values()].map((s) => ({ id: s.id, st: s.state, x: s.pos.x, y: s.pos.y, a: s.alpha, ca: s.c.alpha, sx: s.c.scale.x, p: !!s.c.parent })),
    destroy() { window.removeEventListener('pointermove', onMove); app.destroy(true, { children: true }); },
  };
  api.setMode('title');
  Object.assign(cam, camTarget('title'));
  if (typeof window !== 'undefined') window.__scene = api;
  return api;
}

export default createScene;
