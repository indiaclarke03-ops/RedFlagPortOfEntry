// RED FLAG — supply-chain route map. SVG low-poly world (equirectangular), neon hops drawn one by one.
const NS = 'http://www.w3.org/2000/svg';
const MW = 1000, LAT_TOP = 78, LAT_BOT = -58;
const MH = MW * (LAT_TOP - LAT_BOT) / 360;
const px = (lon) => ((lon + 180) / 360) * MW;
const py = (lat) => ((LAT_TOP - lat) / (LAT_TOP - LAT_BOT)) * MH;

// Default destination: the (fictional) Port of Entry, North Sea coast.
const PORT = { lat: 51.95, lon: 4.1, label: 'PORT OF ENTRY' };

// Hand-made low-poly land masses [lon, lat].
const LAND = [
  // North America
  [[-168, 66], [-162, 70], [-150, 71], [-140, 70], [-128, 70], [-115, 68], [-95, 72], [-82, 73], [-75, 68], [-62, 66], [-64, 58], [-56, 52], [-60, 47], [-66, 44], [-70, 42], [-74, 40], [-76, 35], [-81, 31], [-80, 25], [-82, 27], [-84, 30], [-90, 30], [-97, 27], [-97, 22], [-92, 18], [-87, 21], [-88, 16], [-84, 15], [-83, 9], [-79, 9], [-78, 7], [-82, 8], [-86, 11], [-92, 15], [-98, 16], [-105, 20], [-110, 23], [-112, 29], [-115, 30], [-117, 32], [-120, 34], [-124, 40], [-124, 48], [-130, 54], [-136, 58], [-146, 60], [-152, 58], [-158, 56], [-165, 54], [-160, 59], [-166, 62]],
  // Greenland
  [[-52, 60], [-43, 60], [-34, 66], [-22, 70], [-19, 76], [-20, 81], [-35, 83], [-55, 82], [-70, 78], [-60, 76], [-54, 70], [-52, 64]],
  // Cuba-ish / Caribbean
  [[-85, 22], [-79, 23], [-74, 20], [-78, 20], [-84, 21]],
  // South America
  [[-78, 9], [-72, 12], [-64, 10], [-58, 7], [-51, 4], [-50, 0], [-44, -2], [-35, -6], [-37, -12], [-39, -15], [-41, -22], [-48, -26], [-49, -29], [-53, -34], [-58, -36], [-57, -39], [-63, -41], [-65, -45], [-67, -48], [-69, -52], [-68, -55], [-73, -53], [-75, -48], [-74, -42], [-73, -36], [-71, -30], [-70, -20], [-71, -17], [-76, -14], [-79, -8], [-81, -5], [-80, -1], [-79, 2], [-77, 4], [-78, 7]],
  // Eurasia
  [[-10, 36], [-9, 39], [-9, 43], [-2, 43.5], [-1, 46], [-4, 48], [2, 51], [5, 53], [8, 54], [8, 57], [10, 58], [11, 55], [14, 54], [19, 54.5], [21, 57], [24, 59], [29, 60], [22, 61], [21, 64], [25, 65.5], [21, 66], [17, 62], [18, 59], [16, 56], [12, 56], [11, 59], [6, 58], [5, 62], [11, 64], [15, 68], [20, 70], [26, 71], [31, 70], [37, 68], [41, 67], [44, 68], [53, 68], [60, 69], [69, 73], [80, 73], [88, 75], [100, 77], [113, 74], [128, 72], [140, 72], [152, 71], [162, 70], [170, 70], [180, 68], [180, 65], [174, 62], [165, 60], [163, 56], [160, 53], [156, 51], [156, 57], [163, 62], [155, 60], [143, 59], [138, 55], [141, 52], [140, 48], [135, 43], [131, 43], [129, 40], [129, 35], [126, 35], [126, 38], [125, 40], [121, 40], [122, 37], [119, 35], [121, 32], [122, 29], [119, 25], [114, 22], [110, 21], [108, 18], [109, 12], [106, 9], [105, 10], [101, 13], [100, 8], [103, 3], [104, 1.3], [101, 3], [98, 8], [98, 16], [94, 17], [93, 20], [91, 22], [88, 21], [86, 20], [80, 15], [80, 10], [77, 8], [74, 14], [73, 20], [70, 21], [67, 24], [62, 25], [57, 26], [56, 24], [59, 22], [57, 19], [55, 17], [52, 16], [45, 13], [43, 15], [39, 22], [35, 28], [34, 30], [35, 33], [36, 36], [32, 36.5], [28, 37], [26, 40], [24, 38], [22, 37], [21, 39], [19.5, 41], [19, 42.5], [15, 45], [13, 45.7], [12, 44], [14, 42], [16, 40], [16, 38], [15.6, 38], [12, 42], [9, 44], [6, 43], [3, 43], [0, 39], [-2, 37], [-6, 36]],
  // Arabian Gulf filled loosely; Africa
  [[-17, 15], [-17, 21], [-13, 27], [-10, 30], [-9, 33], [-6, 35.8], [3, 37], [10, 37], [11, 33], [15, 32], [20, 31], [25, 32], [30, 31], [32, 31], [34, 29], [33, 27], [36, 22], [38, 18], [43, 12], [51, 12], [49, 7], [44, 1], [40, -3], [39, -7], [40, -11], [41, -15], [35, -20], [35, -24], [32, -29], [28, -33], [20, -35], [18, -32], [15, -27], [12, -18], [12, -14], [13, -9], [12, -5], [9, -1], [9, 4], [5, 5], [2, 6], [-4, 5], [-8, 4], [-12, 7], [-15, 11], [-17, 13]],
  // Madagascar
  [[44, -25], [47, -25], [50, -15], [49, -12], [44, -17]],
  // UK + Ireland
  [[-5.5, 50], [1.5, 51], [1.7, 52.8], [0, 53.5], [-1.5, 55], [-2, 57.5], [-3.5, 58.6], [-5.5, 58.3], [-5.5, 56], [-4.8, 54.8], [-3, 54], [-4.5, 53], [-4.2, 51.6]],
  [[-10, 51.7], [-6, 52], [-5.8, 54.5], [-8, 55.2], [-10, 54]],
  // Iceland
  [[-24, 64], [-14, 64.3], [-13.5, 65.8], [-17, 66.5], [-22.5, 66.4]],
  // Japan
  [[130, 31], [132, 33.5], [135, 33.7], [140, 35], [141, 38], [142, 40], [141.5, 42], [143, 42], [145.5, 43.4], [142, 45.5], [140, 43], [140, 40.5], [139.5, 38], [137, 37], [133, 35.5], [130.5, 34]],
  // Taiwan, Hainan, Sri Lanka
  [[120.2, 22.6], [121.9, 25], [121, 25.2], [120.1, 23.6]],
  [[108.6, 18.3], [111, 19.6], [110.2, 20.1], [108.7, 19.7]],
  [[79.8, 6], [81.8, 7], [80.2, 9.8]],
  // Philippines
  [[120, 18.5], [122.3, 18.4], [122, 14], [124, 12.5], [126.5, 7], [125, 6], [122, 7], [123.5, 10], [121, 13.5], [120.5, 15.5]],
  // Indonesia / New Guinea
  [[95.3, 5.5], [98, 4], [102, 1], [106, -3], [106, -6], [104.5, -5.8], [101, -2], [98, 1], [95, 3]],
  [[106, -6], [111, -6.8], [114.5, -7.6], [114.4, -8.7], [110, -8.2], [106, -7.3]],
  [[109, 1.5], [111, 1.6], [116.5, 6.8], [119, 5], [117.7, 1], [116.5, -2.5], [114.5, -3.5], [111, -3], [110, -1.5]],
  [[119.5, 0.5], [125, 1.5], [121, -0.8], [123, -4.5], [120.5, -5.5], [119, -3]],
  [[131, -1], [138, -1.6], [141, -2.6], [146, -5], [150.5, -10.5], [147, -10], [143, -9], [139, -8], [137.5, -5]],
  // Australia
  [[114, -22], [113.5, -26], [115, -34], [118, -35], [124, -33.5], [131, -31.5], [135, -34.5], [138, -35.5], [140, -38], [146, -39], [150, -37.5], [153, -32], [153.5, -25], [150, -22], [146, -19], [145.3, -15], [143.5, -14], [142.5, -10.7], [141.5, -13], [141.5, -17], [139.5, -17.5], [136, -15], [137, -12], [132, -11.2], [130, -13], [126, -14], [122, -17], [119, -20]],
  // New Zealand
  [[172.6, -34.5], [178.5, -37.7], [177, -39.5], [175, -41.5], [173, -40], [174, -38]],
  [[172.7, -40.5], [174.3, -41.7], [171, -44.5], [169, -46.6], [166.5, -46], [168, -44]],
];

const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
};
const g = () => (typeof window !== 'undefined' ? window.gsap : null);
const reduced = () => { try { return (document.documentElement.classList.contains('reduced-motion') || window.__reducedMotion === true) || matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

export function createRouteMap(containerEl, opts = {}) {
  const port = opts.port || PORT;
  const wrap = document.createElement('div');
  wrap.className = 'fx-routemap';
  containerEl?.appendChild(wrap);

  const svg = el('svg', { viewBox: `0 0 ${MW} ${MH}`, preserveAspectRatio: 'xMidYMid meet', role: 'img', 'aria-label': 'Supply chain route map' });
  wrap.appendChild(svg);
  const defs = el('defs', {}, svg);
  defs.innerHTML = `
    <filter id="rm-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <pattern id="rm-dots" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#19f0ff" opacity=".35"/></pattern>
    <radialGradient id="rm-sea" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#0b1434"/><stop offset="1" stop-color="#04060e"/></radialGradient>
    <linearGradient id="rm-route" x1="0" x2="1"><stop offset="0" stop-color="#ff2bd6"/><stop offset="1" stop-color="#19f0ff"/></linearGradient>`;
  el('rect', { x: -2000, y: -2000, width: MW + 4000, height: MH + 4000, fill: 'url(#rm-sea)' }, svg);
  const grat = el('g', { class: 'rm-grat' }, svg);
  for (let lon = -180; lon <= 180; lon += 30) el('line', { x1: px(lon), x2: px(lon), y1: 0, y2: MH }, grat);
  for (let lat = -45; lat <= 75; lat += 15) el('line', { x1: 0, x2: MW, y1: py(lat), y2: py(lat) }, grat);
  el('line', { x1: 0, x2: MW, y1: py(0), y2: py(0), class: 'rm-equator' }, grat);
  const land = el('g', { class: 'rm-land' }, svg);
  for (const poly of LAND) {
    const d = poly.map(([lo, la], i) => `${i ? 'L' : 'M'}${px(lo).toFixed(1)},${py(la).toFixed(1)}`).join('') + 'Z';
    el('path', { d }, land);
    el('path', { d, class: 'rm-land-dots', fill: 'url(#rm-dots)' }, land);
  }
  const routesG = el('g', { class: 'rm-routes' }, svg);
  const nodesG = el('g', { class: 'rm-nodes' }, svg);
  const labelsG = el('g', { class: 'rm-labels' }, svg);
  const hud = document.createElement('div');
  hud.className = 'rm-hud';
  wrap.appendChild(hud);

  let vb = { x: 0, y: 0, w: MW, h: MH };
  const setVB = () => svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  let tweens = [];
  let nodes = [];
  let chain = [];
  let placed = [];
  let token = 0;

  function aspect() {
    const r = wrap.getBoundingClientRect();
    return r.width > 10 && r.height > 10 ? r.width / r.height : 1.8;
  }
  function pxPerUnit() {
    const r = wrap.getBoundingClientRect();
    if (r.width < 10) return 1;
    return Math.min(r.width / vb.w, r.height / vb.h);
  }
  function fitTo(points) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of points) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    let w = Math.max(160, x1 - x0) * 1.35, h = Math.max(90, y1 - y0) * 1.75;
    const a = aspect();
    if (w / h < a) w = h * a; else h = w / a;
    w = Math.min(w, MW * 1.05); h = Math.min(h, MH * 1.2);
    return { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - h / 2 - h * 0.12, w, h }; // extra headroom: arcs bow upward and the header overlays the top
  }

  function clear() {
    token++;
    const G = g();
    tweens.forEach((t) => t?.kill?.());
    tweens = [];
    routesG.innerHTML = ''; nodesG.innerHTML = ''; labelsG.innerHTML = '';
    hud.textContent = '';
    nodes = []; chain = []; placed = [];
    if (G) G.killTweensOf(vb);
  }

  function arcPath(a, b) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const bend = Math.min(80, len * 0.28);
    const cx = mx + (dy / len) * bend * (dx >= 0 ? -1 : 1) * 0.3 , cy = my - bend;
    return `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
  }

  function addNode(p, i, label, sub, isPort, u) {
    const gN = el('g', { class: `rm-node${isPort ? ' rm-port' : ''}`, transform: `translate(${p.x},${p.y})` }, nodesG);
    const ring = el('circle', { r: 9 * u, class: 'rm-ring' }, gN);
    el('circle', { r: 4.2 * u, class: 'rm-dot', filter: 'url(#rm-glow)' }, gN);
    el('circle', { r: 1.6 * u, class: 'rm-core' }, gN);
    const lg = el('g', { class: 'rm-label', transform: `translate(${p.x},${p.y})` }, labelsG);
    // label placement with simple collision avoidance against earlier labels/nodes
    const lw = Math.max(label.length * 6.4, sub.length * 5.4) * u, lh = 24 * u;
    const cands = [[0, -16], [0, 30], [1, 6], [-1, 6], [0, -44], [0, 56], [1, -22], [-1, -22], [1, 34], [-1, 34]];
    let pick = cands[i % 2 ? 1 : 0], best = Infinity;
    for (const c of (i % 2 ? [cands[1], cands[0], ...cands.slice(2)] : cands)) {
      const [side, oy] = c;
      const cx = p.x + side * (lw / 2 + 12 * u), cy = p.y + oy * u - lh / 2;
      const box = { x0: cx - lw / 2, x1: cx + lw / 2, y0: cy - lh / 2, y1: cy + lh / 2 };
      let hit = 0;
      for (const b of placed) hit += Math.max(0, Math.min(box.x1, b.x1) - Math.max(box.x0, b.x0)) * Math.max(0, Math.min(box.y1, b.y1) - Math.max(box.y0, b.y0));
      if (hit < best) { best = hit; pick = c; }
      if (hit === 0) break;
    }
    const [side, oy] = pick;
    const lx = side * (lw / 2 + 12 * u), ly = oy * u;
    placed.push({ x0: p.x + lx - lw / 2, x1: p.x + lx + lw / 2, y0: p.y + ly - lh, y1: p.y + ly });
    placed.push({ x0: p.x - 8 * u, x1: p.x + 8 * u, y0: p.y - 8 * u, y1: p.y + 8 * u });
    const t1 = el('text', { x: lx, y: ly - 11 * u, 'text-anchor': 'middle', 'font-size': 10.5 * u, class: 'rm-t1' }, lg);
    t1.textContent = label;
    const t2 = el('text', { x: lx, y: ly, 'text-anchor': 'middle', 'font-size': 9 * u, class: 'rm-t2' }, lg);
    t2.textContent = sub;
    const n = { g: gN, ring, lg, t1, t2 };
    nodes.push(n);
    const G = g();
    if (G && !reduced()) {
      tweens.push(G.fromTo(gN, { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.45, ease: 'back.out(3)' }));
      tweens.push(G.fromTo(lg, { opacity: 0 }, { opacity: 1, duration: 0.4, delay: 0.1 }));
      tweens.push(G.fromTo(ring, { attr: { r: 4 * u }, opacity: 0.9 }, { attr: { r: 16 * u }, opacity: 0, duration: 1.6, repeat: -1, ease: 'power1.out' }));
    }
    return n;
  }

  async function show(hops = [], o = {}) {
    clear();
    const my = token;
    chain = hops.filter((h) => Number.isFinite(+h?.lat) && Number.isFinite(+h?.lon));
    const pts = chain.map((h) => ({ x: px(+h.lon), y: py(+h.lat) }));
    const portPt = { x: px(port.lon), y: py(port.lat) };
    const all = [...pts, portPt];
    const target = fitTo(all);
    const G = g();
    if (G && !reduced()) {
      tweens.push(G.to(vb, { ...target, duration: 0.9, ease: 'power2.inOut', onUpdate: setVB }));
    } else { vb = { ...target }; setVB(); }
    const u = target.w / Math.max(200, wrap.getBoundingClientRect().width || 600) * 1.15;
    placed = all.map((q) => ({ x0: q.x - 9 * u, x1: q.x + 9 * u, y0: q.y - 9 * u, y1: q.y + 9 * u }));
    hud.textContent = `ROUTE TRACE · ${chain.length} HOPS → ${port.label}`;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const stepMs = reduced() || !G ? 0 : 520;
    if (stepMs) await sleep(500);
    for (let i = 0; i <= chain.length; i++) {
      if (my !== token) return;
      const p = i < chain.length ? pts[i] : portPt;
      if (i > 0) {
        const a = pts[i - 1];
        const d = arcPath(a, p);
        const base = el('path', { d, class: 'rm-route-base' }, routesG);
        const path = el('path', { d, class: 'rm-route', 'data-hop': i - 1 }, routesG);
        const flow = el('path', { d, class: 'rm-route-flow' }, routesG);
        base.style.strokeWidth = path.style.strokeWidth = `${1.6 * u}`;
        flow.style.strokeWidth = `${1.6 * u}`;
        flow.style.strokeDasharray = `${2 * u} ${10 * u}`;
        const L = path.getTotalLength ? path.getTotalLength() : 300;
        path.style.strokeDasharray = `${L}`;
        path.style.strokeDashoffset = `${L}`;
        flow.style.opacity = '0';
        if (G && stepMs) {
          tweens.push(G.to(path.style, { strokeDashoffset: 0, duration: stepMs / 1000, ease: 'power1.inOut' }));
          tweens.push(G.to(flow.style, { opacity: 1, duration: 0.3, delay: stepMs / 1000 }));
          await sleep(stepMs);
          if (my !== token) return;
        } else { path.style.strokeDashoffset = '0'; flow.style.opacity = '1'; }
      }
      const h = chain[i];
      const label = i < chain.length ? `${String(i + 1).padStart(2, '0')} ${String(h.step || 'HOP').toUpperCase()}` : '▣ PORT OF ENTRY';
      const sub = i < chain.length ? `${h.country || ''}${h.region && h.region !== h.country ? ' · ' + h.region : ''}` : port.label === 'PORT OF ENTRY' ? 'Destination' : port.label;
      addNode(p, i, label, sub, i === chain.length, u);
      if (stepMs) await sleep(120);
    }
    if (o.highlightRisk) {
      const idx = chain.map((h, i) => (h.highRisk ? i : -1)).filter((i) => i >= 0);
      if (idx.length) revealRisk(idx);
    }
  }

  function revealRisk(hopIndexes = []) {
    const G = g();
    for (const i of hopIndexes) {
      const n = nodes[i];
      if (!n) continue;
      n.g.classList.add('rm-risk');
      n.lg.classList.add('rm-risk');
      if (!n.t1.textContent.startsWith('⚠')) n.t1.textContent = `⚠ ${n.t1.textContent} · HIGH RISK`;
      routesG.querySelectorAll(`.rm-route[data-hop="${i}"], .rm-route[data-hop="${i - 1}"]`).forEach((p) => p.classList.add('rm-risk'));
      if (G && !reduced()) {
        tweens.push(G.fromTo(n.g, { scale: 2.2 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1,0.4)' }));
      }
    }
    if (hopIndexes.length) hud.textContent = `RISK FLAGGED ON ${hopIndexes.length} HOP${hopIndexes.length > 1 ? 'S' : ''}`, hud.classList.add('rm-hud-risk');
  }

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
    if (!chain.length) return;
    const all = [...chain.map((h) => ({ x: px(+h.lon), y: py(+h.lat) })), { x: px(port.lon), y: py(port.lat) }];
    const G = g(); if (G) G.killTweensOf(vb);
    vb = fitTo(all); setVB();
  }) : null;
  ro?.observe(wrap);

  return {
    show,
    revealRisk,
    clear() { clear(); hud.classList.remove('rm-hud-risk'); vb = { x: 0, y: 0, w: MW, h: MH }; setVB(); },
    destroy() { clear(); ro?.disconnect(); wrap.remove(); },
    el: wrap,
  };
}

export default createRouteMap;
