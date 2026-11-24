// Shift screen: HUD bar + inspector's desk (manifest paper, route map + hops + stamps, intel feed, rulebook drawer).
import { h, esc, gsap } from './dom.js';
import { GAME } from '../core/config.js';
import { fmt, money, hsLookup, highRiskRegions } from '../game/rules.js';

const AGENTS = {
  syndicate: { label: 'SYNDICATE', icon: '☠', cls: 'a-syn' },
  trader: { label: 'TRADERS', icon: '⚓', cls: 'a-trd' },
  ngo: { label: 'NGO', icon: '✚', cls: 'a-ngo' },
  director: { label: 'DIRECTOR', icon: '★', cls: 'a-dir' },
  rival: { label: 'RIVAL PORT', icon: '⚑', cls: 'a-rvl' },
  claude: { label: 'CLAUDE', icon: '✦', cls: 'a-cld' },
  system: { label: 'SYSTEM', icon: '■', cls: 'a-sys' },
};

export function createDesk({ onAction, onPause, onRulebook }) {
  // ---- HUD ----
  const hud = {
    shift: h('span.hud-val', {}, '1/3'),
    timer: h('span.hud-val.hud-timer', {}, '3:00'),
    revenue: h('span.hud-val', {}, '$0'),
    repFill: h('div.rep-fill'),
    repVal: h('span.rep-val', {}, '80'),
    combo: h('span.hud-val.hud-combo', {}, 'x1'),
    queue: h('div.queue-ships'),
    queueN: h('span.hud-val', {}, '0'),
    claude: h('div.claude-badge', { title: 'Claude Mode: the Smuggler and NGO are thinking with Claude' }, '✦ CLAUDE MODE'),
  };
  const rulesBtn = h('button.hud-btn.rules-btn', { onclick: () => onRulebook(), title: 'Rulebook [R]' }, '📖 RULES [R]');
  const hudEl = h('header.hud.glass',
    h('div.hud-cell', h('span.hud-lbl', {}, 'SHIFT'), hud.shift),
    h('div.hud-cell', h('span.hud-lbl', {}, 'TIME'), hud.timer),
    h('div.hud-cell', h('span.hud-lbl', {}, 'PORT REVENUE'), hud.revenue),
    h('div.hud-cell.hud-rep', h('span.hud-lbl', {}, 'INTEGRITY'), h('div.rep-bar', hud.repFill), hud.repVal),
    h('div.hud-cell', h('span.hud-lbl', {}, 'COMBO'), hud.combo),
    h('div.hud-cell.hud-queue', h('span.hud-lbl', {}, 'QUEUE'), hud.queueN, hud.queue),
    hud.claude,
    h('div.hud-spacer'),
    rulesBtn,
    h('button.hud-btn', { onclick: () => onPause(), title: 'Pause [Esc]' }, '❚❚'),
  );

  // ---- left: manifest paper ----
  const paperWrap = h('div.paper-wrap');
  const left = h('section.desk-col.desk-left', paperWrap);

  // ---- centre: route map + hops + stamps ----
  const mapEl = h('div.route-map', { id: 'route-map' });
  const hopsEl = h('div.hops');
  const auditBar = h('div.audit-bar', h('div.audit-fill'), h('span.audit-txt', {}, 'AUDITING…'));
  const mkStamp = (action, label, key, cls) => h('button.stamp-btn.' + cls, { 'data-action': action, onclick: () => onAction(action) }, h('span.stamp-lbl', {}, label), h('span.stamp-key', {}, key));
  const stamps = {
    approve: mkStamp('approve', 'APPROVE', 'A', 's-approve'),
    audit: mkStamp('audit', 'AUDIT', 'SPACE', 's-audit'),
    detain: mkStamp('detain', 'DETAIN', 'D', 's-detain'),
  };
  const centre = h('section.desk-col.desk-centre.glass',
    h('div.panel-title', {}, 'SUPPLY CHAIN ROUTE'),
    h('div.map-frame', mapEl, auditBar),
    hopsEl,
    h('div.stamps', stamps.approve, stamps.audit, stamps.detain),
  );

  // ---- right: intel feed ----
  const feed = h('div.feed');
  const right = h('section.desk-col.desk-right.glass',
    h('div.panel-title', {}, h('span.blink-dot'), 'INTEL FEED'),
    feed,
  );

  // ---- rulebook drawer ----
  const rbBody = h('div.rb-body');
  const rulebook = h('aside.rulebook.glass', h('div.rb-head', h('span', {}, 'INSPECTOR’S RULEBOOK'), h('button.rb-close', { onclick: () => onRulebook() }, '✕ [R]')), rbBody);

  const deskEl = h('div.desk', left, centre, right);
  const toastBox = h('div.toasts');
  const idle = h('div.desk-idle', {}, 'Waiting for the next ship…');
  const root = h('div.screen.screen-shift', hudEl, h('div.port-window'), deskEl, rulebook, toastBox);
  root.style.display = 'none';

  let paper = null, lastTimer = '', lastRep = -1, rbOpen = false;

  function updateHUD(s) {
    hud.shift.textContent = `${s.shift + 1}/${GAME.SHIFTS}`;
    const t = Math.max(0, Math.ceil(s.timeLeft));
    const ts = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    if (ts !== lastTimer) { hud.timer.textContent = ts; lastTimer = ts; hud.timer.classList.toggle('urgent', t <= 20); }
    hud.revenue.textContent = money(s.revenue);
    hud.revenue.classList.toggle('neg', s.revenue < 0);
    const rep = Math.round(s.reputation);
    if (rep !== lastRep) {
      hud.repFill.style.width = rep + '%';
      hud.repFill.className = 'rep-fill ' + (rep < 35 ? 'low' : rep < 65 ? 'mid' : 'high');
      hud.repVal.textContent = rep;
      lastRep = rep;
    }
    hud.combo.textContent = s.combo >= 1 ? `${s.combo} · x${(Math.min(3, 1 + Math.floor(s.combo / 3) * 0.5)).toFixed(1)}` : 'x1.0';
    hud.combo.classList.toggle('hot', s.combo >= 3);
    const n = s.queue.length;
    hud.queueN.textContent = n;
    hud.queueN.classList.toggle('warn', n >= GAME.MAX_QUEUE - 2);
    if (hud.queue.childElementCount !== n) {
      hud.queue.replaceChildren(...s.queue.slice(0, GAME.MAX_QUEUE).map(m => h('span.qship' + (m.tip ? '.tipped' : ''), { title: m.shipName, style: { color: '#' + (m.shipColor ?? 0x19f0ff).toString(16).padStart(6, '0') } }, shipSvg())));
    }
    hud.claude.style.display = s.claude ? '' : 'none';
  }

  function field(key, label, value, extra = '') {
    return h('div.mf-field', { 'data-field': key, class: extra }, h('span.mf-lbl', {}, label), h('span.mf-val', { html: value }));
  }

  function setManifest(m, shift, world) {
    const c = m.certificate || {};
    const fields = [
      field('ship', 'Vessel', esc(m.shipName)),
      field('firm', 'Importer of record', `${esc(m.firm?.name)} <small>(${esc(m.firm?.country)})</small>`),
      field('product', 'Product', esc(m.product)),
      field('hs', 'HS code', esc(m.hsCode)),
      field('origin', 'Declared origin', esc(m.declaredOrigin)),
      field('units', 'Quantity', `${fmt(m.units)} ${esc(m.unitLabel)}`),
      field('weight', 'Gross weight', `${fmt(m.weightKg)} kg`),
      field('price', 'Unit price', `$${fmt(m.unitPrice)}`),
      field('cert', 'Certificate', `${esc(c.issuer)}<br><small>${esc(c.id)} · ${esc(c.issued)} → ${esc(c.expires)}</small>`, 'wide'),
    ];
    const battery = Array.isArray(world?.BATTERY_MINERAL_PRODUCTS) ? world.BATTERY_MINERAL_PRODUCTS.includes(m.product)
      : (world?.PRODUCTS || []).find(p => p.name === m.product)?.mineral != null;
    if (shift >= 1 && battery) fields.push(field('smelter', 'Smelter / refiner', m.smelter ? esc(m.smelter) : '<i class="blank">— none declared —</i>'));
    if (shift >= 2) fields.push(field('dd', 'Due-diligence stmt', m.ddStatement ? 'FILED ✓' : '<i class="blank">NOT FILED</i>'));
    const tip = m.tip ? h('div.sticky', h('b', {}, 'NGO TIP-OFF'), h('span', {}, m.tip.text || 'Look closely at this one.')) : null;
    const findings = h('div.findings');
    const rot = (Math.random() * 1.6 - 0.8).toFixed(2);
    paper = h('div.paper', { style: { '--rot': rot + 'deg' } },
      h('div.coffee'),
      h('div.paper-head', h('span', {}, 'CARGO MANIFEST'), h('span.paper-id', {}, m.id)),
      h('div.mf-grid', fields),
      findings,
      tip,
    );
    paperWrap.replaceChildren(paper);
    // hops
    hopsEl.replaceChildren(...(m.chain || []).map((hop, i) => h('div.hop', { 'data-hop': i },
      h('div.hop-step', {}, `${i + 1}. ${hop.step}`),
      h('div.hop-firm', {}, hop.firm),
      h('div.hop-loc', {}, `${hop.region && hop.region !== hop.country ? hop.region + ', ' : ''}${hop.country}`),
      h('div.hop-meta', {}, `${fmtAge(hop.firmAgeMonths)} · ${fmt(hop.employees)} staff`),
    )));
    setLocked(false);
    renderRulebook(world, shift, m);
    return paper;
  }

  function clearManifest() {
    paperWrap.replaceChildren(idle);
    hopsEl.replaceChildren();
    paper = null;
  }

  function setLocked(locked, auditing = false) {
    for (const b of Object.values(stamps)) b.disabled = locked || !paper;
    centre.classList.toggle('auditing', auditing);
    paper?.classList.toggle('scanning', auditing);
  }
  function setAudited(done) { stamps.audit.disabled = done || !paper; stamps.audit.classList.toggle('used', done); }
  function auditProgress(f) { auditBar.querySelector('.audit-fill').style.width = Math.round(f * 100) + '%'; auditBar.querySelector('.audit-txt').textContent = `AUDITING… ${Math.ceil((1 - f) * GAME.AUDIT_SECONDS)}s`; }

  function revealAudit(m, impl, hints) {
    if (!paper) return;
    const box = paper.querySelector('.findings');
    box.replaceChildren(h('div.findings-head', {}, m.violations?.length ? '⚠ AUDIT FINDINGS' : '✓ AUDIT FINDINGS'),
      ...(m.auditFindings || []).map(t => h('div.finding' + (m.violations?.length ? '.bad' : '.ok'), {}, t)),
      h('div.hints', {}, hints.map(t => h('div', {}, t))));
    box.classList.add('show');
    box.onclick = () => box.classList.toggle('collapsed');
    for (const f of impl.fields) paper.querySelector(`[data-field="${f}"]`)?.classList.add('flagged');
    for (const i of impl.hops) hopsEl.querySelector(`[data-hop="${i}"]`)?.classList.add('flagged');
    const g = gsap(); if (g) g.from(box, { height: 0, autoAlpha: 0, duration: 0.4, ease: 'power2.out' });
  }

  const MAX_FEED = 40;
  function addIntel(msg) {
    const isClaude = msg.agent === 'claude' || msg.claude || msg.source === 'claude';
    // Claude-driven lines are coloured by the agent they speak for (via); status lines keep the Claude colour.
    const a = (isClaude && msg.via && AGENTS[msg.via]) || AGENTS[msg.agent] || AGENTS.system;
    const line = h('div.intel.' + a.cls + '.tone-' + (msg.tone || 'neutral'),
      h('div.intel-head', h('span.intel-icon', {}, a.icon), h('span.intel-agent', {}, a.label), msg.name ? h('span.intel-name', {}, '· ' + msg.name) : null, isClaude ? h('span.claude-tag', { title: 'Generated by Claude' }, '✦') : null),
      h('div.intel-text', {}, msg.text || ''));
    feed.prepend(line);
    while (feed.childElementCount > MAX_FEED) feed.lastElementChild.remove();
    const g = gsap(); if (g) g.from(line, { x: 30, autoAlpha: 0, duration: 0.35, ease: 'power2.out' });
  }

  function toast(text, kind = 'memo') {
    const t = h('div.toast.t-' + kind, h('b', {}, kind === 'memo' ? '★ DIRECTOR MEMO' : kind === 'bad' ? '▼ PENALTY' : '● NOTICE'), h('span', {}, text));
    toastBox.prepend(t);
    const g = gsap();
    if (g) { g.from(t, { y: -20, autoAlpha: 0, duration: 0.3 }); g.to(t, { autoAlpha: 0, delay: 4, duration: 0.5, onComplete: () => t.remove() }); }
    else setTimeout(() => t.remove(), 4500);
    while (toastBox.childElementCount > 3) toastBox.lastElementChild.remove();
  }

  function renderRulebook(world, shift, m) {
    const getActive = world?.getActiveRules || (s => (world?.RULES || []).filter(r => r.shift <= s));
    const rules = getActive(shift + 1) || [];
    const hr = highRiskRegions(world);
    const hs = world?.HS_TABLE ? (Array.isArray(world.HS_TABLE) ? world.HS_TABLE.map(r => [r.code ?? r.hs ?? r[0], r.family ?? r.product ?? r.desc ?? r[1]]) : Object.entries(world.HS_TABLE).map(([k, v]) => [k, typeof v === 'string' ? v : (v.family ?? v.name ?? '')])) : [];
    const aud = (world?.ACCREDITED_AUDITORS || []).map(a => typeof a === 'string' ? a : a.name);
    const ref = m ? h('div.rb-sec', h('h4', {}, `REFERENCE · ${m.product}`), h('table.rb-table',
      h('tr', h('td', {}, 'Market price / unit'), h('td', {}, `$${fmt(m.marketPrice)}`)),
      h('tr', h('td', {}, 'Undervaluation below'), h('td', {}, `$${fmt(m.marketPrice * 0.6)}`)),
      h('tr', h('td', {}, 'Std. weight / unit'), h('td', {}, `${fmt(m.unitWeightKg)} kg`)),
      h('tr', h('td', {}, `Expected weight (${fmt(m.units)} ${m.unitLabel})`), h('td', {}, `${fmt(m.units * m.unitWeightKg)} kg ±15%`)),
      h('tr', h('td', {}, `Declared HS ${m.hsCode} is chapter`), h('td', {}, (() => { const r = hsLookup(world, m.hsCode); return r ? `${r[0]} = ${r[1]}` : 'not in table ⚠'; })())),
    )) : null;
    rbBody.replaceChildren(
      h('div.rb-sec', h('h4', {}, `ACTIVE RULES · SHIFT ${shift + 1}`), rules.map(r => h('div.rb-rule' + (r.shift === shift + 1 && shift > 0 ? '.new' : ''), h('b', {}, r.title, r.shift === shift + 1 && shift > 0 ? h('span.new-tag', {}, 'NEW') : null), h('p', {}, r.text)))),
      ref,
      h('div.rb-sec', h('h4', {}, 'HIGH-RISK REGIONS'), h('ul.rb-list', hr.map(r => h('li', {}, `${r.name}${r.country ? ' — ' + r.country : ''}`)))),
      h('div.rb-sec', h('h4', {}, 'HS TABLE'), h('table.rb-table', hs.map(([k, v]) => h('tr', h('td', {}, k), h('td', {}, v))))),
      h('div.rb-sec', h('h4', {}, 'ACCREDITED AUDITORS'), h('ul.rb-list', aud.map(a => h('li', {}, a)))),
      h('div.rb-sec', h('h4', {}, 'QUICK TELLS'), h('ul.rb-list.small',
        h('li', {}, 'Shell firm: under 12 months old AND under 5 staff'),
        h('li', {}, 'Origin = country of the LAST production hop (Mine/Farm/Refinery/Smelter/Factory/Assembly)'),
        h('li', {}, 'Warehouse in a third country is legal; a Repackaging hop = transshipment'),
        h('li', {}, `Certificates expire vs today: ${GAME.GAME_DATE}`))),
    );
  }
  function toggleRulebook(force) {
    rbOpen = force ?? !rbOpen;
    if (rbOpen) rulesBtn.classList.remove('nudge');
    rulebook.classList.toggle('open', rbOpen);
    return rbOpen;
  }

  function stampRect(action) { return stamps[action]?.getBoundingClientRect(); }
  function flashStamp(action) { const b = stamps[action]; if (!b) return; b.classList.add('pressed'); setTimeout(() => b.classList.remove('pressed'), 160); }

  clearManifest();
  return { root, mapEl, updateHUD, setManifest, clearManifest, setLocked, setAudited, auditProgress, revealAudit, addIntel, toast, renderRulebook, toggleRulebook, nudgeRules: on => rulesBtn.classList.toggle('nudge', on), stampRect, flashStamp, get paper() { return paper; }, clearFeed: () => feed.replaceChildren() };
}

function fmtAge(mo) {
  if (mo == null) return '?';
  return mo < 24 ? `${mo} mo old` : `${Math.round(mo / 12)} yrs old`;
}
function shipSvg() {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 12');
  s.innerHTML = '<path d="M1 6h22l-3 5H4z" fill="currentColor"/><rect x="6" y="2" width="5" height="4" fill="currentColor" opacity=".7"/><rect x="12" y="3" width="4" height="3" fill="currentColor" opacity=".5"/>';
  return s;
}
