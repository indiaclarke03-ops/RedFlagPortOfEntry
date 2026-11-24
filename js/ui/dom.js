// Small DOM helpers shared by the UI modules.
export function h(tag, attrs = {}, ...kids) {
  if (attrs instanceof Node || Array.isArray(attrs) || typeof attrs !== 'object' || attrs === null) { if (attrs != null) kids.unshift(attrs); attrs = {}; }
  const [name, ...cls] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (cls.length) el.className = cls.join(' ');
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const gsap = () => (window.__reducedMotion ? null : window.gsap);

export function fadeIn(el, opts = {}) {
  el.style.display = '';
  const g = gsap();
  window.gsap?.killTweensOf(el);
  if (g) g.fromTo(el, { autoAlpha: 0, y: opts.y ?? 16, scale: opts.scale ?? 1 }, { autoAlpha: 1, y: 0, scale: 1, duration: opts.d ?? 0.45, ease: 'power3.out', delay: opts.delay ?? 0 });
  else { el.style.opacity = 1; el.style.visibility = 'visible'; }
}
export function fadeOut(el, opts = {}) {
  return new Promise(res => {
    const g = gsap();
    window.gsap?.killTweensOf(el);
    if (!g) { el.style.display = 'none'; return res(); }
    g.to(el, { autoAlpha: 0, y: opts.y ?? -10, duration: opts.d ?? 0.3, ease: 'power2.in', onComplete: () => { el.style.display = 'none'; res(); } });
  });
}
export function stagger(els, opts = {}) {
  const g = gsap();
  if (!g || !els.length) return;
  g.fromTo(els, { autoAlpha: 0, y: opts.y ?? 18 }, { autoAlpha: 1, y: 0, duration: 0.45, stagger: opts.stagger ?? 0.08, ease: 'power3.out', delay: opts.delay ?? 0 });
}
