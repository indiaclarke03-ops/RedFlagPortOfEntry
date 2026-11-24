// Title, tutorial, briefing, debrief screens + settings / pause / leaderboard modals.
import { h, esc, fadeIn, fadeOut, stagger, gsap } from './dom.js';
import { GAME } from '../core/config.js';
import { money, loadBoard, GRADES } from '../game/rules.js';

export function createScreens(ui) {
  const root = document.getElementById('ui-root');
  const screens = {};

  // ---------- TITLE ----------
  const logo = h('h1.logo', { 'data-text': 'RED FLAG' }, 'RED FLAG');
  const titleBoard = h('div.title-board');
  screens.title = h('div.screen.screen-title',
    h('div.title-stack',
      logo,
      h('div.subtitle', {}, 'PORT OF ENTRY'),
      h('p.tagline', {}, 'Customs inspection in the age of forced labour, shell companies and adaptive smugglers.'),
      h('div.menu',
        h('button.btn.btn-primary', { onclick: () => ui.onStart() }, '▶ START SHIFT'),
        h('button.btn', { onclick: () => ui.onTutorial() }, 'HOW TO PLAY'),
        h('button.btn', { onclick: () => ui.openLeaderboard() }, 'LEADERBOARD'),
        h('button.btn', { onclick: () => ui.openSettings() }, 'SETTINGS'),
      ),
      h('div.press-any', {}, 'PRESS ANY KEY'),
    ),
    h('aside.title-side.glass', h('div.panel-title', {}, 'TOP INSPECTORS'), titleBoard),
    h('div.disclaimer', {}, 'All companies, ships and people are fictional. Regions and regulations are real.'),
  );

  // ---------- TUTORIAL ----------
  const CARDS = [
    { icon: '⚓', title: 'YOUR JOB', body: `Ships queue at the port. Each brings a <b>manifest</b>. You have ${GAME.SHIFT_SECONDS / 60} minutes per shift, ${GAME.SHIFTS} shifts. <b>APPROVE</b> [A] clean cargo for full port fees. <b>DETAIN</b> [D] anything that breaks a rule. Waving through tainted cargo sets off the alarm — and the press will find out.` },
    { icon: '📖', title: 'CHECK IT AGAINST THE RULEBOOK', body: 'Open the <b>RULEBOOK</b> [R]. Look for: chain hops in <b>high-risk regions</b>, wrong <b>HS codes</b>, <b>expired/unaccredited certificates</b>, weight that doesn\'t add up, prices far below market, brand-new <b>shell firms</b>, sneaky <b>repackaging</b> stops. Unsure? <b>AUDIT</b> [Space] reveals the truth — but locks your desk for ' + GAME.AUDIT_SECONDS + 's while the queue grows. New rules arrive each shift.' },
    { icon: '👁', title: 'THE AGENTS ARE WATCHING', body: 'This is not a fixed puzzle. <b class="c-mag">The Syndicate</b> learns which tricks you catch and switches tactics. <b class="c-cyan">Honest traders</b> reroute if you harass them. <b class="c-green">NGOs</b> send tips — and exposés. <b class="c-amber">The Director</b> wants revenue. Watch the <b>Intel Feed</b>. At the end, the <b>Agent Replay</b> shows how they adapted to you.' },
  ];
  let tutIdx = 0;
  const tutCards = h('div.tut-cards');
  const tutDots = h('div.tut-dots');
  const tutNext = h('button.btn.btn-primary', { onclick: () => tutGo(tutIdx + 1) }, 'NEXT ▶');
  screens.tutorial = h('div.screen.screen-tutorial',
    h('div.tut-wrap.glass', tutCards, h('div.tut-nav', h('button.btn.btn-ghost', { onclick: () => ui.onTutorialDone() }, 'SKIP'), tutDots, tutNext)));
  function tutGo(i) {
    if (i >= CARDS.length) return ui.onTutorialDone();
    tutIdx = i;
    const c = CARDS[i];
    const card = h('div.tut-card', h('div.tut-icon', {}, c.icon), h('div.tut-step', {}, `${i + 1} / ${CARDS.length}`), h('h2', {}, c.title), h('p', { html: c.body }));
    tutCards.replaceChildren(card);
    tutDots.replaceChildren(...CARDS.map((_, j) => h('span.dot' + (j === i ? '.on' : ''))));
    tutNext.textContent = i === CARDS.length - 1 ? (ui.tutorialFromStart ? 'START SHIFT ▶' : 'GOT IT ▶') : 'NEXT ▶';
    const g = gsap(); if (g) g.fromTo(card, { x: 60, autoAlpha: 0, rotateY: -12 }, { x: 0, autoAlpha: 1, rotateY: 0, duration: 0.5, ease: 'power3.out' });
    ui.sfx('paper');
  }

  // ---------- BRIEFING ----------
  const briefBody = h('div.brief-body');
  screens.briefing = h('div.screen.screen-briefing', h('div.brief-wrap.glass', briefBody));

  // ---------- DEBRIEF ----------
  const debBody = h('div.deb-body');
  screens.debrief = h('div.screen.screen-debrief', h('div.deb-wrap.glass', debBody));

  // ---------- MODALS ----------
  const modalLayer = h('div.modal-layer');
  modalLayer.style.display = 'none';
  modalLayer.addEventListener('click', e => { if (e.target === modalLayer && !modalLayer.dataset.sticky) closeModal(); });

  for (const s of Object.values(screens)) { s.style.display = 'none'; root.append(s); }
  root.append(modalLayer);

  let current = null;
  async function show(name) {
    const next = screens[name];
    const prev = current && screens[current];
    current = name;
    for (const [k, el] of Object.entries(screens)) if (el !== prev && el !== next) el.style.display = 'none';
    if (prev && prev !== next) await fadeOut(prev, { d: 0.25 });
    if (current !== name || !next) return; // superseded by a later show()
    fadeIn(next, { d: 0.5 });
    if (name === 'title') { renderBoard(titleBoard); stagger([...screens.title.querySelectorAll('.menu .btn')], { delay: 0.3 }); }
    if (name === 'tutorial') tutGo(0);
  }
  function addScreen(name, el) { screens[name] = el; el.style.display = 'none'; root.insertBefore(el, modalLayer); }

  function renderBoard(el, highlight) {
    const b = loadBoard();
    el.replaceChildren(b.length
      ? h('table.lb', h('tr', h('th', {}, '#'), h('th', {}, 'INIT'), h('th', {}, 'SCORE'), h('th', {}, 'GRADE'), h('th', {}, 'DATE')),
        b.map((r, i) => h('tr' + (highlight && r.date === highlight.date && r.score === highlight.score && r.initials === highlight.initials ? '.me' : ''), h('td', {}, i + 1), h('td.lb-init', {}, r.initials), h('td', {}, r.score.toLocaleString()), h('td', {}, r.grade), h('td.lb-date', {}, r.date))))
      : h('p.muted', {}, 'No inspectors on the board yet. Be the first.'));
  }

  function openModal(content, { sticky = false } = {}) {
    modalLayer.dataset.sticky = sticky ? '1' : '';
    if (!sticky) delete modalLayer.dataset.sticky;
    modalLayer.replaceChildren(h('div.modal.glass', content));
    modalLayer.style.display = '';
    const g = gsap(); if (g) g.fromTo(modalLayer.firstChild, { scale: 0.92, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.25, ease: 'back.out(1.6)' });
  }
  function closeModal() { modalLayer.style.display = 'none'; modalLayer.replaceChildren(); ui.onModalClose?.(); }
  const isModalOpen = () => modalLayer.style.display !== 'none';

  function openLeaderboard(highlight) {
    const el = h('div');
    renderBoard(el, highlight);
    openModal([h('h2.modal-title', {}, 'LEADERBOARD'), el, h('div.modal-actions', h('button.btn', { onclick: closeModal }, 'CLOSE'))]);
  }

  function openSettings(s) {
    const keyInput = h('input.key-input', { type: 'password', placeholder: s.claudeActive ? '•••••••• (key set — paste to replace)' : 'sk-ant-…', autocomplete: 'off', spellcheck: 'false' });
    const status = h('div.key-status' + (s.claudeActive ? '.on' : ''), {}, s.claudeActive ? '✦ Claude Mode ACTIVE' : 'Claude Mode off — local AI');
    const vol = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: s.volume, oninput: e => ui.onVolume(+e.target.value) });
    const content = [
      h('h2.modal-title', {}, 'SETTINGS'),
      h('label.set-row', h('span', {}, 'Mute [M]'), h('input', { type: 'checkbox', checked: s.muted, onchange: e => ui.onMute(e.target.checked) })),
      h('label.set-row', h('span', {}, 'Volume'), vol),
      h('label.set-row', h('span', {}, 'Reduced motion'), h('input', { type: 'checkbox', checked: s.reducedMotion, onchange: e => ui.onReducedMotion(e.target.checked) })),
      h('div.claude-box',
        h('h3', {}, '✦ CLAUDE MODE'),
        h('p', {}, 'Paste an Anthropic API key and the Smuggler and NGO will think with claude-haiku-5-5 instead of the local AI. The key is kept in memory only — never saved, never sent anywhere except the Anthropic API — and is forgotten when you close the tab. Any error falls back to the local AI.'),
        h('div.key-row', keyInput,
          h('button.btn.btn-primary', { onclick: () => { const k = keyInput.value.trim(); keyInput.value = ''; if (k) { ui.onClaudeKey(k); status.textContent = '✦ Claude Mode ACTIVE'; status.className = 'key-status on'; } } }, 'ENABLE'),
          h('button.btn', { onclick: () => { keyInput.value = ''; ui.onClaudeKey(null); status.textContent = 'Claude Mode off — local AI'; status.className = 'key-status'; } }, 'DISABLE')),
        status),
      h('div.modal-actions', h('button.btn', { onclick: closeModal }, 'CLOSE')),
    ];
    openModal(content);
  }

  function openPause() {
    openModal([
      h('h2.modal-title', {}, 'PAUSED'),
      h('div.pause-menu',
        h('button.btn.btn-primary', { onclick: () => { closeModal(); } }, '▶ RESUME [Esc]'),
        h('button.btn', { onclick: () => ui.openSettings() }, 'SETTINGS'),
        h('button.btn', { onclick: () => { closeModal(); ui.onToggleRulebook(true); } }, 'RULEBOOK'),
        h('button.btn.btn-danger', { onclick: () => { closeModal(); ui.onQuit(); } }, 'QUIT TO TITLE')),
    ], { sticky: true });
  }

  // ---------- briefing render ----------
  function showBriefing(d) {
    const st = d.stats;
    briefBody.replaceChildren(
      h('div.brief-head', h('div.kicker', {}, `END OF SHIFT ${d.shift + 1} / ${GAME.SHIFTS}`), h('h2', {}, 'SHIFT BRIEFING')),
      h('div.stat-row',
        stat('Ships cleared', st.processed), stat('Violations caught', st.caught, 'c-green'), stat('Slipped through', st.missed, st.missed ? 'c-red' : ''),
        stat('Honest detained', st.falseDetains, st.falseDetains ? 'c-amber' : ''), stat('Audits', st.audits), stat('Revenue', money(st.revenue))),
      h('div.brief-grid',
        h('div.brief-col',
          h('h3', {}, 'NEW REGULATIONS'),
          d.newRules.length ? d.newRules.map(r => h('div.rule-card', h('span.new-tag', {}, 'NEW'), h('b', {}, r.title), h('p', {}, r.text))) : h('p.muted', {}, 'No new rules this shift.')),
        h('div.brief-col',
          h('h3', {}, 'HEADLINES'),
          (d.headlines || []).map(t => h('div.headline', {}, t)),
          h('h3', {}, 'SYNDICATE INTEL'),
          h('div.syn-summary', {}, d.syndicateSummary || 'No chatter intercepted.')),
      ),
      h('div.modal-actions', h('button.btn.btn-primary.btn-big', { onclick: () => ui.onNextShift() }, `START SHIFT ${d.shift + 2} ▶`)),
    );
    stagger([...briefBody.querySelectorAll('.stat, .rule-card, .headline, .syn-summary')], { stagger: 0.06, delay: 0.3 });
  }

  // ---------- debrief render ----------
  function showDebrief(d) {
    const { final: f, stats: st, replay, missed, info } = d;
    const initials = h('input.initials', { maxlength: 3, placeholder: 'AAA', autocomplete: 'off', spellcheck: 'false' });
    initials.addEventListener('input', () => { initials.value = initials.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
    const saveBtn = h('button.btn.btn-primary', {}, 'SUBMIT');
    const saveRow = h('div.save-row', h('span', {}, 'ENTER INITIALS'), initials, saveBtn);
    const submit = () => {
      if (saveBtn.disabled) return;
      saveBtn.disabled = true; initials.disabled = true;
      const entry = ui.onSaveScore(initials.value || '???');
      saveRow.replaceChildren(h('span.c-green', {}, `Saved as ${entry?.initials || initials.value}.`), h('button.btn', { onclick: () => ui.openLeaderboard(entry) }, 'VIEW LEADERBOARD'));
    };
    saveBtn.addEventListener('click', submit);
    initials.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') submit(); });

    // timeline grouped by shift
    const byShift = [0, 1, 2].map(i => ({ i, items: (replay || []).filter(r => (r.shift ?? 1) === i + 1) })); // engine replay shift is 1-based
    const typeLabel = { adapt: 'SYNDICATE ADAPTS', missed: 'MISSED', caught: 'CAUGHT', expose: 'EXPOSÉ', tip: 'NGO TIP' };
    const timeline = h('div.timeline', byShift.map(g => h('div.tl-shift',
      h('div.tl-shift-head', {}, `SHIFT ${g.i + 1}`),
      g.items.length ? g.items.map(r => h('div.tl-item.tl-' + r.type,
        h('span.tl-dot'),
        h('div.tl-content', h('span.tl-type', {}, typeLabel[r.type] || r.type.toUpperCase()), h('span.tl-text', {}, r.text),
          r.explain ? h('div.tl-explain', {}, explainText(info, r.explain)) : null)))
        : h('div.tl-empty', {}, 'Quiet shift.'))));

    const missedList = missed.length
      ? missed.map(x => h('div.missed', h('b', {}, `${x.manifest.shipName} · ${x.manifest.product}`), x.violations.map(v => h('div.missed-v', h('span.vtag', {}, (info?.[v]?.title || info?.[v]?.label || v)), h('span', {}, explainText(info, v))))))
      : [h('p.c-green', {}, 'Nothing slipped past you. The NGOs have nothing to print.')];

    debBody.replaceChildren(
      h('div.deb-head', h('div.kicker', {}, d.suspended ? 'SUSPENDED — INTEGRITY COLLAPSED' : 'FINAL DEBRIEF'),
        h('div.deb-score', h('span.big-score', {}, '0'), h('span.score-lbl', {}, 'POINTS')),
        h('div.grade', {}, f.grade),
        h('div.grade-ladder', GRADES.map((g, i) => h('span' + (i === f.gradeIndex ? '.on' : i < f.gradeIndex ? '.past' : ''), {}, g)))),
      h('div.stat-row',
        stat('Revenue pts', f.revenuePts), stat('Integrity pts', f.points), stat('Reputation bonus', f.repBonus),
        stat('Accuracy', Math.round(f.accuracy * 100) + '%'), stat('Caught', st.caught, 'c-green'), stat('Missed', st.missed, st.missed ? 'c-red' : ''), stat('Honest detained', st.falseDetains), stat('Best combo', d.maxCombo)),
      saveRow,
      h('div.deb-grid',
        h('div.deb-col', h('h3', {}, 'AGENT REPLAY — HOW THE SYNDICATE ADAPTED'), timeline),
        h('div.deb-col', h('h3', {}, 'WHAT SLIPPED THROUGH — AND WHY IT MATTERS'), missedList)),
      h('div.modal-actions', h('button.btn.btn-primary.btn-big', { onclick: () => ui.onPlayAgain() }, 'PLAY AGAIN'), h('button.btn', { onclick: () => ui.onQuit() }, 'TITLE')),
    );
    const g = gsap(), big = debBody.querySelector('.big-score');
    if (g) { const o = { v: 0 }; g.to(o, { v: f.score, duration: 1.6, ease: 'power2.out', delay: 0.4, onUpdate: () => { big.textContent = Math.round(o.v).toLocaleString(); } }); g.from(debBody.querySelector('.grade'), { scale: 2.5, autoAlpha: 0, duration: 0.6, delay: 1.9, ease: 'back.out(2)' }); }
    else big.textContent = f.score.toLocaleString();
    stagger([...debBody.querySelectorAll('.tl-item')], { stagger: 0.04, delay: 0.8, y: 10 });
    setTimeout(() => initials.focus(), 600);
  }

  return { show, addScreen, openModal, closeModal, isModalOpen, openLeaderboard, openSettings, openPause, showBriefing, showDebrief, logo, get current() { return current; }, tutNext: () => tutGo(tutIdx + 1) };
}

function stat(label, value, cls = '') { return h('div.stat', h('span.stat-val' + (cls ? '.' + cls : ''), {}, value), h('span.stat-lbl', {}, label)); }
function explainText(info, v) {
  const x = info?.[v];
  if (!x) return String(v);
  return typeof x === 'string' ? x : (x.explain || x.text || x.why || x.description || x.title || String(v));
}
void esc;
