// RED FLAG — DOM effects layer (stamps, shakes, popups, newspaper, alarm, neon, typewriter).
// Everything renders into #fx-root (or onto a given element). Fails soft without GSAP.

const g = () => (typeof window !== 'undefined' ? window.gsap : null);
const reduced = () => {
  try { return (document.documentElement.classList.contains('reduced-motion') || window.__reducedMotion === true) || window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};
const root = () => {
  let el = document.getElementById('fx-root');
  if (!el) { el = document.createElement('div'); el.id = 'fx-root'; document.body.appendChild(el); }
  return el;
};
const rand = (a, b) => a + Math.random() * (b - a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const make = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const STAMPS = {
  approve: { label: 'APPROVED', ink: '#1fe08a', sub: 'CLEARED · PORT OF ENTRY' },
  detain: { label: 'DETAINED', ink: '#ff2e4d', sub: 'HOLD · CUSTOMS ORDER' },
  audit: { label: 'AUDIT', ink: '#ffb020', sub: 'REFERRED · FORENSIC CHECK' },
};

let uid = 0;
// Stamp face SVG: double border, label, sub-line, rough ink via turbulence displacement + speckle mask.
function stampFaceSVG(type, rough = true) {
  const s = STAMPS[type] || STAMPS.audit;
  const id = `fxink${++uid}`;
  const fs = s.label.length > 6 ? 62 : 74;
  return `<svg class="fx-stamp-face" viewBox="0 0 320 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <filter id="${id}" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="${rough ? 0.9 : 0.6}" numOctaves="2" seed="${Math.floor(Math.random() * 99)}" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="${rough ? 5 : 3}" xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feTurbulence type="fractalNoise" baseFrequency="2.2" numOctaves="1" seed="${Math.floor(Math.random() * 99)}" result="s"/>
      <feColorMatrix in="s" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 1.75" result="m"/>
      <feComposite in="d" in2="m" operator="in"/>
    </filter>
  </defs>
  <g filter="url(#${id})" fill="none" stroke="${s.ink}">
    <rect x="8" y="8" width="304" height="124" rx="14" stroke-width="7"/>
    <rect x="20" y="20" width="280" height="100" rx="8" stroke-width="2.5"/>
    <text x="160" y="${fs > 70 ? 92 : 88}" text-anchor="middle" fill="${s.ink}" stroke="none"
      font-family="'Bebas Neue', Impact, sans-serif" font-size="${fs}" letter-spacing="5">${s.label}</text>
    <text x="160" y="113" text-anchor="middle" fill="${s.ink}" stroke="none"
      font-family="'Share Tech Mono', monospace" font-size="11" letter-spacing="2">${s.sub}</text>
  </g>
</svg>`;
}

function stampToolSVG(type) {
  const s = STAMPS[type] || STAMPS.audit;
  return `<svg class="fx-stamp-tool" viewBox="0 0 200 230" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="wood${uid}" x1="0" x2="1"><stop offset="0" stop-color="#3b1d10"/><stop offset=".45" stop-color="#7a4424"/><stop offset="1" stop-color="#2a140b"/></linearGradient>
    <linearGradient id="metal${uid}" x1="0" x2="1"><stop offset="0" stop-color="#4b5570"/><stop offset=".5" stop-color="#c8d2e8"/><stop offset="1" stop-color="#394258"/></linearGradient>
    <linearGradient id="block${uid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#1b2033"/><stop offset="1" stop-color="#0b0e18"/></linearGradient>
  </defs>
  <ellipse cx="100" cy="38" rx="40" ry="34" fill="url(#wood${uid})"/>
  <ellipse cx="88" cy="26" rx="12" ry="8" fill="#fff" opacity=".18"/>
  <rect x="84" y="62" width="32" height="70" rx="6" fill="url(#wood${uid})"/>
  <rect x="40" y="128" width="120" height="16" rx="4" fill="url(#metal${uid})"/>
  <rect x="22" y="142" width="156" height="62" rx="6" fill="url(#block${uid})" stroke="${s.ink}" stroke-width="2" stroke-opacity=".7"/>
  <text x="100" y="182" text-anchor="middle" fill="${s.ink}" font-family="'Bebas Neue', Impact, sans-serif" font-size="30" letter-spacing="3">${s.label}</text>
  <rect x="18" y="202" width="164" height="14" rx="3" fill="${s.ink}" opacity=".9"/>
</svg>`;
}

function setStyles(el, o) { for (const k in o) el.style[k] = o[k]; }

function centerOf(el) {
  if (!el || !el.getBoundingClientRect) return { x: innerWidth / 2, y: innerHeight * 0.6, w: 300, h: 300 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
}

function splatter(x, y, color, n = 16) {
  const R = root();
  const G = g();
  for (let i = 0; i < n; i++) {
    const d = make('div', 'fx-ink-drop');
    const size = rand(4, i < 4 ? 18 : 10);
    setStyles(d, { left: `${x}px`, top: `${y}px`, width: `${size}px`, height: `${size * rand(0.7, 1.3)}px`, background: color });
    R.appendChild(d);
    const ang = rand(0, Math.PI * 2), dist = rand(60, 190);
    if (G) {
      G.fromTo(d, { x: 0, y: 0, scale: 0.4, opacity: 1 }, {
        x: Math.cos(ang) * dist, y: Math.sin(ang) * dist * 0.7, scale: rand(0.6, 1.3), duration: rand(0.25, 0.45), ease: 'power3.out',
        onComplete: () => G.to(d, { opacity: 0, duration: 0.6, delay: 0.2, onComplete: () => d.remove() }),
      });
    } else setTimeout(() => d.remove(), 300);
  }
}

const neonLoops = new WeakMap();
const typeTokens = new WeakMap();

export const fx = {
  slideInPaper(el) {
    if (!el) return Promise.resolve();
    const G = g();
    if (!G || reduced()) { setStyles(el, { opacity: '1', transform: 'none' }); return Promise.resolve(); }
    return new Promise((res) => {
      G.killTweensOf(el);
      G.fromTo(el, { y: '110%', x: rand(-40, 40), rotation: rand(-9, -4), opacity: 0 }, {
        y: 0, x: 0, rotation: rand(-1.6, 1.6), opacity: 1, duration: 0.6, ease: 'back.out(1.3)', onComplete: res,
      });
    });
  },

  slideOutPaper(el, outcome = 'approve') {
    if (!el) return Promise.resolve();
    const G = g();
    if (!G || reduced()) { el.style.opacity = '0'; return Promise.resolve(); }
    const to = {
      approve: { x: '130%', y: -30, rotation: 14, opacity: 0, duration: 0.55, ease: 'power2.in' },
      detain: { y: '120%', x: -20, rotation: -10, opacity: 0, duration: 0.6, ease: 'power3.in' },
      audit: { y: '-120%', rotation: 6, opacity: 0, duration: 0.55, ease: 'power2.in' },
      reroute: { x: '-130%', rotation: -14, opacity: 0, duration: 0.55, ease: 'power2.in' },
    }[outcome] || { opacity: 0, duration: 0.4 };
    return new Promise((res) => { G.killTweensOf(el); G.to(el, { ...to, onComplete: res }); });
  },

  // Big rubber stamp drops, slams, splatters ink and leaves an impression on targetEl. Resolves when done.
  stamp(type = 'approve', targetEl) {
    const s = STAMPS[type] || STAMPS.audit;
    const R = root();
    const c = centerOf(targetEl);
    const rot = rand(-14, 10);
    const impress = () => {
      if (!targetEl) return;
      try {
        if (getComputedStyle(targetEl).position === 'static') targetEl.style.position = 'relative';
        const imp = make('div', `fx-ink-impression fx-ink-${type}`, stampFaceSVG(type));
        // The AUDIT mark stays on a paper the player still has to read, so keep it small,
        // faint and tucked into the top-right corner instead of over the fields.
        const isAudit = type === 'audit';
        const w = isAudit ? Math.min(150, Math.max(100, c.w * 0.3)) : Math.min(320, Math.max(160, c.w * 0.62));
        const pos = isAudit
          ? { right: `${rand(6, 18)}px`, top: `${rand(26, 40)}px`, left: 'auto' }
          : { left: `calc(50% - ${w / 2}px + ${rand(-20, 20)}px)`, top: `calc(50% - ${w * 0.22}px + ${rand(-30, 30)}px)` };
        const op = isAudit ? 0.5 : 0.92;
        setStyles(imp, { width: `${w}px`, ...pos, transform: `rotate(${rot}deg)` });
        targetEl.appendChild(imp);
        const G = g();
        if (G) G.fromTo(imp, { scale: 1.12, opacity: 0 }, { scale: 1, opacity: op, duration: 0.14, ease: 'power2.out' });
        else imp.style.opacity = String(op);
      } catch (e) { /* fail soft */ }
    };
    const G = g();
    if (!G) { impress(); fx.shake(1); return Promise.resolve(); }

    const tool = make('div', `fx-stamp fx-stamp-${type}`, stampToolSVG(type));
    const tw = Math.min(260, Math.max(170, innerWidth * 0.14));
    setStyles(tool, { width: `${tw}px`, left: `${c.x - tw / 2}px`, top: `${c.y - tw * 1.05}px` });
    R.appendChild(tool);
    const shadow = make('div', 'fx-stamp-shadow');
    setStyles(shadow, { left: `${c.x - tw * 0.45}px`, top: `${c.y - 20}px`, width: `${tw * 0.9}px` });
    R.appendChild(shadow);

    return new Promise((res) => {
      const tl = G.timeline({ onComplete: () => { tool.remove(); shadow.remove(); res(); } });
      tl.fromTo(tool, { y: -innerHeight * 0.75, scale: 1.9, rotation: rot - 18, opacity: 1, transformOrigin: '50% 100%' },
        { y: -40, scale: 1.25, rotation: rot - 4, duration: 0.24, ease: 'power2.out' }, 0);
      tl.fromTo(shadow, { opacity: 0, scale: 0.3 }, { opacity: 0.45, scale: 0.8, duration: 0.3 }, 0);
      tl.to(tool, { y: 0, scale: 1, rotation: rot, duration: 0.12, ease: 'power4.in' }, 0.3);
      tl.to(shadow, { opacity: 0.85, scale: 1, duration: 0.12, ease: 'power4.in' }, 0.3);
      tl.add(() => { impress(); fx.shake(type === 'detain' ? 1.6 : 1.1); splatter(c.x, c.y + 10, s.ink, type === 'detain' ? 22 : 14); }, 0.42);
      tl.to(tool, { scaleY: 0.82, scaleX: 1.12, duration: 0.06, ease: 'power1.out' }, 0.42);
      tl.to(tool, { scaleY: 1, scaleX: 1, duration: 0.18, ease: 'elastic.out(1,0.4)' }, 0.48);
      tl.to(tool, { y: -innerHeight * 0.5, rotation: rot + 12, opacity: 0, duration: 0.38, ease: 'power2.in' }, 0.72);
      tl.to(shadow, { opacity: 0, scale: 0.4, duration: 0.3 }, 0.72);
    });
  },

  shake(strength = 1) {
    const G = g();
    const els = ['ui-root', 'scene-root'].map((i) => document.getElementById(i)).filter(Boolean);
    if (!G || !els.length) return;
    const k = (reduced() ? 0.25 : 1) * strength;
    const amp = 14 * k;
    els.forEach((el, idx) => {
      G.killTweensOf(el, 'x,y,rotation');
      const m = idx === 0 ? 1 : 0.6;
      const tl = G.timeline();
      for (let i = 0; i < 6; i++) {
        const f = (1 - i / 6) * amp * m;
        tl.to(el, { x: rand(-f, f), y: rand(-f, f), rotation: rand(-0.4, 0.4) * k, duration: 0.045, ease: 'none' });
      }
      tl.to(el, { x: 0, y: 0, rotation: 0, duration: 0.12, ease: 'power2.out', clearProps: 'transform' });
    });
  },

  popup(text, x, y, color = '#2bff9a') {
    const R = root();
    const el = make('div', 'fx-popup');
    el.textContent = text;
    setStyles(el, { left: `${x ?? innerWidth / 2}px`, top: `${y ?? innerHeight / 2}px`, color, '--glow': color });
    R.appendChild(el);
    const G = g();
    if (!G) { setTimeout(() => el.remove(), 1200); return; }
    G.timeline({ onComplete: () => el.remove() })
      .fromTo(el, { y: 10, scale: 0.4, opacity: 0 }, { y: -16, scale: 1.15, opacity: 1, duration: 0.22, ease: 'back.out(3)' })
      .to(el, { y: -90, scale: 1, opacity: 0, duration: 1.1, ease: 'power1.in' }, '+=0.25');
  },

  combo(n) {
    const R = root();
    const hue = n >= 6 ? '#ffb020' : n >= 4 ? '#ff2bd6' : '#19f0ff';
    const el = make('div', 'fx-combo', `<span class="fx-combo-word">COMBO</span><span class="fx-combo-x">×${esc(n)}</span>`);
    el.style.setProperty('--glow', hue);
    const ring = make('div', 'fx-combo-ring');
    ring.style.setProperty('--glow', hue);
    R.appendChild(ring); R.appendChild(el);
    const G = g();
    if (!G) { setTimeout(() => { el.remove(); ring.remove(); }, 1400); return; }
    G.fromTo(ring, { scale: 0.2, opacity: 0.9 }, { scale: 3.2, opacity: 0, duration: 0.8, ease: 'power2.out', onComplete: () => ring.remove() });
    G.timeline({ onComplete: () => el.remove() })
      .fromTo(el, { scale: 0.2, rotation: -12, opacity: 0 }, { scale: 1.25, rotation: -4, opacity: 1, duration: 0.22, ease: 'back.out(3)' })
      .to(el, { scale: 1, duration: 0.25, ease: 'power2.out' })
      .to(el, { opacity: 0.6, duration: 0.05, yoyo: true, repeat: 3 }, '+=0.15')
      .to(el, { y: -60, scale: 0.8, opacity: 0, duration: 0.45, ease: 'power2.in' }, '+=0.3');
  },

  alarm(text = 'VIOLATION CLEARED') {
    const R = root();
    const wrap = make('div', 'fx-alarm', `<div class="fx-alarm-vignette"></div><div class="fx-alarm-bar"></div>
      <div class="fx-alarm-text"><span class="fx-alarm-icon">▲</span> ${esc(text)}</div>`);
    R.appendChild(wrap);
    const G = g();
    if (!G) { setTimeout(() => wrap.remove(), 2200); return Promise.resolve(); }
    const bar = wrap.querySelector('.fx-alarm-bar');
    const vig = wrap.querySelector('.fx-alarm-vignette');
    const txt = wrap.querySelector('.fx-alarm-text');
    if (!reduced()) fx.shake(0.6);
    return new Promise((res) => {
      const tl = G.timeline({ onComplete: () => { wrap.remove(); res(); } });
      tl.fromTo(bar, { xPercent: -120 }, { xPercent: 120, duration: 0.7, ease: 'power1.inOut', repeat: 1 }, 0);
      tl.fromTo(vig, { opacity: 0 }, { opacity: 1, duration: 0.25, yoyo: true, repeat: 5, ease: 'sine.inOut' }, 0);
      tl.fromTo(txt, { scale: 1.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.25, ease: 'back.out(2)' }, 0.1);
      tl.to(txt, { opacity: 0.25, duration: 0.12, yoyo: true, repeat: 5 }, 0.5);
      tl.to(wrap, { opacity: 0, duration: 0.35 }, 1.9);
    });
  },

  // Spinning front page. Resolves when dismissed (click or ~4s).
  newspaper(headline = 'PORT SCANDAL', subhead = '') {
    const R = root();
    const date = new Date(2027, 2, 14).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const filler = (n) => Array.from({ length: n }, () => `<i style="width:${Math.round(rand(60, 100))}%"></i>`).join('');
    const back = make('div', 'fx-news-backdrop');
    const paper = make('div', 'fx-news', `
      <div class="fx-news-top"><span>Vol. CXII · No. 73</span><span>${esc(date)}</span><span>Price 2 credits</span></div>
      <div class="fx-news-mast">THE HARBOUR HERALD</div>
      <div class="fx-news-rule"><span>EXCLUSIVE</span><span>LATE CITY EDITION</span><span>WATERFRONT · TRADE · CRIME</span></div>
      <h1 class="fx-news-head">${esc(headline)}</h1>
      ${subhead ? `<h2 class="fx-news-sub">${esc(subhead)}</h2>` : ''}
      <div class="fx-news-body">
        <div class="fx-news-photo"><span>PHOTO: HERALD STAFF</span></div>
        <div class="fx-news-col">${filler(9)}</div>
        <div class="fx-news-col">${filler(9)}</div>
      </div>
      <div class="fx-news-hint">click to dismiss</div>`);
    back.appendChild(paper);
    R.appendChild(back);
    const G = g();
    return new Promise((res) => {
      let done = false;
      const close = () => {
        if (done) return; done = true;
        if (G) G.to(paper, { scale: 0.2, rotation: 25, opacity: 0, y: 200, duration: 0.35, ease: 'power2.in', onComplete: () => { back.remove(); res(); } });
        else { back.remove(); res(); }
        if (G) G.to(back, { opacity: 0, duration: 0.35 });
      };
      back.addEventListener('click', close);
      setTimeout(close, 4200);
      if (!G) return;
      if (reduced()) { G.fromTo(paper, { opacity: 0 }, { opacity: 1, rotation: -2, duration: 0.3 }); return; }
      G.fromTo(back, { opacity: 0 }, { opacity: 1, duration: 0.3 });
      G.fromTo(paper, { scale: 0.04, rotation: -1080, opacity: 0.3 }, { scale: 1, rotation: -3, opacity: 1, duration: 1.05, ease: 'power3.out',
        onComplete: () => { fx.shake(0.5); } });
    });
  },

  // Neon-sign flicker that loops until the element leaves the DOM.
  neonTitle(el) {
    if (!el || neonLoops.has(el)) return;
    el.classList.add('fx-neon');
    let letters = [];
    if (el.childElementCount === 0 && el.textContent.trim()) {
      const txt = el.textContent;
      el.setAttribute('aria-label', txt);
      el.innerHTML = [...txt].map((ch) => `<span class="fx-neon-l" aria-hidden="true">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('');
      letters = [...el.querySelectorAll('.fx-neon-l')].filter((s) => s.textContent.trim());
    }
    const faulty = letters.length ? [letters[Math.floor(Math.random() * letters.length)]] : [];
    if (letters.length > 6) faulty.push(letters[Math.floor(Math.random() * letters.length)]);
    faulty.forEach((f) => f.classList.add('fx-neon-faulty'));
    const state = { alive: true };
    neonLoops.set(el, state);
    const red = reduced();
    const tick = () => {
      if (!el.isConnected) { neonLoops.delete(el); return; }
      const r = Math.random();
      if (!red && r < 0.12) {
        // full-sign stutter
        el.classList.add('fx-neon-off');
        setTimeout(() => el.classList.remove('fx-neon-off'), rand(40, 110));
        setTimeout(() => { el.classList.add('fx-neon-off'); setTimeout(() => el.classList.remove('fx-neon-off'), rand(30, 70)); }, 160);
      } else if (r < 0.5) {
        faulty.forEach((f) => {
          f.classList.add('fx-neon-dead');
          setTimeout(() => f.classList.remove('fx-neon-dead'), rand(60, red ? 200 : 600));
        });
      } else if (r < 0.62) {
        el.classList.add('fx-neon-dim');
        setTimeout(() => el.classList.remove('fx-neon-dim'), rand(200, 700));
      }
      setTimeout(tick, rand(red ? 1500 : 350, red ? 4000 : 1900));
    };
    setTimeout(tick, 600);
    // power-on sequence
    const G = g();
    if (G && !red) {
      G.fromTo(el, { opacity: 0 }, { keyframes: [{ opacity: 0.9, duration: 0.05 }, { opacity: 0.1, duration: 0.08 }, { opacity: 1, duration: 0.05 }, { opacity: 0.3, duration: 0.1 }, { opacity: 1, duration: 0.2 }], delay: 0.2 });
    }
  },

  // Typewriter reveal. speed = ms per character. Resolves when done (or superseded).
  typeText(el, text = '', speed = 22) {
    if (!el) return Promise.resolve();
    const token = {};
    typeTokens.set(el, token);
    text = String(text);
    if (reduced() || speed <= 0) { el.textContent = text; return Promise.resolve(); }
    el.textContent = '';
    const out = document.createTextNode('');
    const caret = make('span', 'fx-caret');
    caret.textContent = '▌';
    el.append(out, caret);
    return new Promise((res) => {
      let i = 0;
      const step = () => {
        if (typeTokens.get(el) !== token) return res();
        if (i >= text.length) { caret.remove(); return res(); }
        const n = Math.max(1, Math.round(16 / speed));
        out.data += text.slice(i, i + n);
        i += n;
        const ch = text[i - 1];
        setTimeout(step, speed * (ch === '.' || ch === ',' ? 5 : 1) * rand(0.6, 1.4));
      };
      step();
    });
  },
};

export default fx;
if (typeof window !== 'undefined') window.__fx = fx;
