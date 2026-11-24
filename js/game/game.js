// Core game flow: shifts, queue, desk, decisions, scoring, engine event handling.
import { GAME } from '../core/config.js';
import { SCORE, comboMult, computeFinal, implicated, auditHints, money, saveScore } from './rules.js';

const blankStats = () => ({ processed: 0, correct: 0, caught: 0, missed: 0, falseDetains: 0, approvals: 0, detains: 0, audits: 0, revenue: 0, overflow: 0 });

export function createGame(ctx) {
  const { bus, desk, screens } = ctx;
  const m = ctx.mods; // { fx, sound, scene, map, engine, world, info }
  const call = (obj, fn, ...a) => { try { return obj?.[fn]?.(...a); } catch (e) { console.error(`[game] ${fn} failed`, e); } };
  const fx = (fn, ...a) => call(m.fx, fn, ...a);
  const snd = (fn, ...a) => call(m.sound, fn, ...a);
  const scn = (fn, ...a) => call(m.scene, fn, ...a);
  const eng = (fn, ...a) => call(m.engine, fn, ...a);

  const state = {
    screen: 'title', shift: 0, timeLeft: GAME.SHIFT_SECONDS, running: false, paused: false,
    queue: [], current: null, deskSince: 0, auditing: false, auditLeft: 0, audited: false, busy: false,
    revenue: 0, reputation: SCORE.START_REP, points: 0, combo: 0, maxCombo: 0,
    stats: blankStats(), shiftStats: [blankStats(), blankStats(), blankStats()],
    decisionTimes: [], recentDecisions: [], missed: [], claude: false, suspended: false, final: null,
  };
  ctx.state = state;

  const clampRep = () => { state.reputation = Math.max(0, Math.min(100, state.reputation)); };
  const addStat = (k, v = 1) => { state.stats[k] += v; state.shiftStats[state.shift][k] += v; };
  const addRevenue = v => { state.revenue += v; state.shiftStats[state.shift].revenue += v; };
  const paperEl = () => desk.paper;
  const stampXY = a => { const r = desk.stampRect(a); return r ? [r.left + r.width / 2, r.top - 10] : [innerWidth / 2, innerHeight * 0.7]; };

  // ---------------- screens ----------------
  function setScreen(name) {
    state.screen = name;
    bus.emit('screen', { name });
    scn('setMode', name === 'tutorial' ? 'title' : name);
    snd('music', name === 'tutorial' ? 'title' : name);
    desk.root.style.display = name === 'shift' ? '' : 'none';
    if (name === 'shift') { if (window.gsap && !window.__reducedMotion) window.gsap.fromTo(desk.root.querySelector('.desk'), { y: 80, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease: 'power3.out' }); screens.show(null); }
    else screens.show(name);
  }

  function resetGame() {
    Object.assign(state, {
      shift: 0, queue: [], current: null, auditing: false, audited: false, busy: false, revenue: 0, reputation: SCORE.START_REP,
      points: 0, combo: 0, maxCombo: 0, stats: blankStats(), shiftStats: [blankStats(), blankStats(), blankStats()],
      decisionTimes: [], recentDecisions: [], missed: [], suspended: false, final: null, paused: false,
    });
    desk.clearFeed();
  }

  function startGame(fromShift = 0) {
    resetGame();
    state.shift = fromShift;
    startShift();
  }

  function startShift() {
    state.timeLeft = GAME.SHIFT_SECONDS;
    state.queue = []; state.current = null; state.auditing = false; state.audited = false; state.busy = false; state.paused = false;
    desk.clearManifest(); call(m.map, 'clear');
    desk.renderRulebook(m.world, state.shift, null);
    desk.toggleRulebook(false);
    setScreen('shift');
    state.running = true;
    eng('startShift', state.shift);
    bus.emit('shift:start', { shift: state.shift });
    snd('play', 'shift_start'); snd('play', 'horn');
    desk.addIntel({ agent: 'system', name: 'Port Authority', text: `SHIFT ${state.shift + 1} OPEN — ${state.shift === 0 ? 'Press R for the rulebook. A approve · Space audit · D detain.' : 'New rules are in force. Check the rulebook (R).'}`, tone: 'neutral' });
    if (state.shift > 0) { desk.nudgeRules(true); setTimeout(() => desk.toast('New regulations are in force — open the RULEBOOK [R].', 'notice'), 600); }
  }

  function endShift() {
    if (!state.running) return;
    state.running = false;
    if (state.current) { scn('shipDepart', state.current.id, 'reroute'); state.current = null; }
    for (const q of state.queue) scn('shipDepart', q.id, 'reroute');
    state.queue = [];
    desk.toggleRulebook(false);
    bus.emit('shift:end', { shift: state.shift });
    snd('play', 'shift_end');
    const res = eng('endShift') || {};
    if (state.shift >= GAME.SHIFTS - 1 || state.suspended) return finishGame();
    const world = m.world;
    const getActive = world?.getActiveRules || (s => (world?.RULES || []).filter(r => r.shift <= s));
    const prevIds = new Set((getActive(state.shift + 1) || []).map(r => r.id));
    const newRules = (getActive(state.shift + 2) || []).filter(r => !prevIds.has(r.id));
    setScreen('briefing');
    screens.showBriefing({ shift: state.shift, stats: state.shiftStats[state.shift], newRules, headlines: res.headlines, syndicateSummary: res.syndicateSummary });
  }

  function nextShift() { state.shift++; startShift(); }

  function finishGame() {
    state.running = false;
    state.final = computeFinal(state);
    setScreen('debrief');
    screens.showDebrief({ final: state.final, stats: state.stats, replay: eng('getReplay') || [], missed: state.missed, info: m.info, suspended: state.suspended, maxCombo: state.maxCombo });
    snd('play', state.final.gradeIndex >= 2 ? 'success' : 'paper');
  }

  function saveFinal(initials) { return saveScore({ initials, score: state.final?.score || 0, grade: state.final?.grade || 'Rookie' })?.find(e => e.score === (state.final?.score || 0)) || null; }

  // ---------------- queue / desk ----------------
  function onArrive(manifest) {
    if (!state.running || !manifest) return;
    scn('shipArrive', manifest);
    if (state.queue.length >= GAME.MAX_QUEUE) {
      addStat('overflow'); addRevenue(-SCORE.OVERFLOW_LOSS);
      setTimeout(() => scn('shipDepart', manifest.id, 'reroute'), 800);
      desk.toast(`${manifest.shipName} gave up waiting and diverted. ${money(-SCORE.OVERFLOW_LOSS)}`, 'bad');
      return;
    }
    state.queue.push(manifest);
    snd('play', 'horn');
    pullNext();
  }

  function pullNext() {
    if (state.current || state.busy || !state.running || !state.queue.length) return;
    const man = state.queue.shift();
    state.current = man; state.audited = false; state.auditing = false;
    state.deskSince = performance.now();
    const el = desk.setManifest(man, state.shift, m.world);
    desk.setAudited(false);
    bus.emit('inspect', man);
    scn('shipDock', man.id);
    fx('slideInPaper', el);
    snd('play', 'paper');
    call(m.map, 'show', man.chain || [], { highlightRisk: false });
  }

  // ---------------- decisions ----------------
  function act(action) {
    if (state.screen !== 'shift' || !state.running || state.paused) return;
    const man = state.current;
    if (!man || state.busy || state.auditing) { snd('play', 'error'); return; }
    desk.flashStamp(action);
    if (action === 'audit') return startAudit();
    decide(action);
  }

  function startAudit() {
    if (state.audited) { snd('play', 'error'); return; }
    state.auditing = true; state.auditLeft = GAME.AUDIT_SECONDS;
    addStat('audits'); addRevenue(-SCORE.AUDIT_COST);
    desk.setLocked(true, true);
    fx('stamp', 'audit', paperEl());
    snd('play', 'stamp_audit'); snd('play', 'audit_scan');
    bus.emit('audit:start', { manifest: state.current });
  }

  function finishAudit() {
    const man = state.current;
    state.auditing = false; state.audited = true;
    desk.setLocked(false, false); desk.setAudited(true);
    const impl = implicated(m.world, man);
    desk.revealAudit(man, impl, auditHints(man));
    call(m.map, 'revealRisk', impl.hops);
    snd('play', man.violations?.length ? 'alarm' : 'success');
    bus.emit('audit:done', { manifest: man });
  }

  function decide(action) {
    const man = state.current;
    const viol = man.violations || [];
    const bad = viol.length > 0;
    const correct = (action === 'approve' && !bad) || (action === 'detain' && bad);
    const missed = action === 'approve' ? viol.slice() : [];
    const decisionSeconds = (performance.now() - state.deskSince) / 1000;
    let pts = 0;
    addStat('processed'); addStat(action === 'approve' ? 'approvals' : 'detains');
    addRevenue(action === 'approve' ? SCORE.APPROVE_REVENUE : SCORE.DETAIN_REVENUE);
    if (correct) {
      state.combo++; state.maxCombo = Math.max(state.maxCombo, state.combo);
      addStat('correct');
      if (bad) addStat('caught');
      pts = Math.round((bad ? SCORE.CATCH_POINTS : SCORE.CLEAN_APPROVE_POINTS) * comboMult(state.combo));
      state.reputation += bad ? 2.5 : 0.75;
    } else {
      state.combo = 0;
      if (action === 'detain') { addStat('falseDetains'); state.reputation -= SCORE.FALSE_DETAIN_REP; pts = -40; }
      else { addStat('missed'); state.reputation -= SCORE.MISS_REP; pts = -100; }
    }
    clampRep();
    state.points += pts;
    state.decisionTimes.push(decisionSeconds);
    state.recentDecisions.push({ action, correct, violations: viol, tactic: man.tactic ?? null });
    if (state.recentDecisions.length > 12) state.recentDecisions.shift();

    // feedback
    const pe = paperEl();
    fx('stamp', action, pe);
    snd('play', action === 'approve' ? 'stamp_approve' : 'stamp_detain');
    const [x, y] = stampXY(action);
    const rev = action === 'approve' ? SCORE.APPROVE_REVENUE : SCORE.DETAIN_REVENUE;
    fx('popup', `${pts >= 0 ? '+' : ''}${pts} pts`, x, y, pts >= 0 ? (bad ? '#2bff9a' : '#19f0ff') : '#ff3355');
    setTimeout(() => fx('popup', `+${money(rev)}`, x + 60, y - 30, '#ffb020'), 160);
    if (correct) { snd('play', 'coin'); bus.emit('combo', { combo: state.combo }); if (state.combo >= 3) { fx('combo', state.combo); snd('play', 'combo'); } }
    if (missed.length) {
      state.missed.push({ manifest: man, violations: missed, shift: state.shift });
      setTimeout(() => { fx('alarm', 'VIOLATION SLIPPED THROUGH'); scn('alarm'); snd('play', 'alarm'); bus.emit('alarm', { reason: missed[0] }); fx('shake', 1.2); }, 350);
    } else if (!correct) {
      snd('play', 'error');
      desk.toast(`${man.firm?.name || 'Trader'} was clean. Wrongful detention.`, 'bad');
    }
    bus.emit('decision', { manifest: man, action, correct, missed, points: pts });
    eng('recordDecision', { manifest: man, action, correct, decisionSeconds });

    // clear the desk
    state.busy = true;
    desk.setLocked(true);
    setTimeout(() => {
      fx('slideOutPaper', pe, action);
      scn('shipDepart', man.id, action);
      setTimeout(() => {
        call(m.map, 'clear');
        state.current = null; state.busy = false;
        if (state.screen === 'shift') { desk.clearManifest(); desk.setLocked(true); }
        if (state.reputation <= 0 && state.running) { state.suspended = true; desk.toast('Integrity collapsed. You are suspended.', 'bad'); setTimeout(endShift, 1200); return; }
        pullNext();
      }, window.__reducedMotion ? 50 : 450);
    }, window.__reducedMotion ? 150 : 650);
  }

  // auto-correct helper for playtests
  function forceDecision(action) {
    const man = state.current;
    if (!man) return false;
    if (action === 'correct') action = man.violations?.length ? 'detain' : 'approve';
    if (action === 'wrong') action = man.violations?.length ? 'approve' : 'detain';
    if (state.auditing) { state.auditing = false; desk.setLocked(false); }
    state.busy = false;
    if (action === 'audit') return startAudit(), true;
    decide(action); return true;
  }

  // ---------------- engine events ----------------
  bus.on('ship:arrive', onArrive);
  bus.on('intel', msg => { if (state.screen === 'shift') desk.addIntel(msg); });
  bus.on('ngo:tip', ({ shipId, text, accurate } = {}) => {
    const s = state.queue.find(q => q.id === shipId) || (state.current?.id === shipId ? state.current : null);
    if (s && !s.tip) s.tip = { text, accurate };
    snd('play', 'tip');
  });
  bus.on('ngo:expose', ({ headline, subhead, repLoss } = {}) => {
    state.reputation -= repLoss ?? 10; clampRep();
    fx('newspaper', headline || 'PORT SCANDAL', subhead || '');
    snd('play', 'newspaper');
    if (state.running) desk.toast(`NGO exposé: −${repLoss ?? 10} integrity`, 'bad');
  });
  bus.on('director:memo', ({ text, urgency } = {}) => { if (!state.running) return; desk.toast(text, 'memo'); snd('play', 'memo'); if (urgency > 0.7) fx('shake', 0.3); });
  bus.on('director:dock_pay', ({ amount, reason } = {}) => { if (!state.running) return; addRevenue(-(amount || 0)); desk.toast(`Docked ${money(amount || 0)}: ${reason || 'queue delays'}`, 'bad'); });
  bus.on('trader:complaint', ({ firm, text } = {}) => { state.reputation -= 1; clampRep(); if (state.running) desk.toast(text || `${firm} filed a complaint. −1 integrity`, 'notice'); });
  bus.on('trader:reroute', ({ firm, ships } = {}) => { const loss = (ships || 1) * 600; addRevenue(-loss); if (state.running) desk.toast(`${firm} rerouted ${ships || 1} ship(s) to a rival port. ${money(-loss)}`, 'bad'); });
  bus.on('rival:steal', ({ ships, text } = {}) => { const loss = (ships || 1) * 500; addRevenue(-loss); if (state.running) desk.toast(text || `Rival port stole ${ships} ship(s). ${money(-loss)}`, 'bad'); });

  // ---------------- main loop ----------------
  let last = performance.now(), tensionT = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (state.running && !state.paused) {
      state.timeLeft -= dt;
      if (state.auditing) {
        state.auditLeft -= dt;
        desk.auditProgress(1 - Math.max(0, state.auditLeft) / GAME.AUDIT_SECONDS);
        if (state.auditLeft <= 0) finishAudit();
      }
      const avg = state.decisionTimes.length ? state.decisionTimes.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, state.decisionTimes.length) : 0;
      eng('tick', dt, {
        shift: state.shift, timeLeft: state.timeLeft, queueLength: state.queue.length, queueIds: state.queue.map(q => q.id),
        revenue: state.revenue, reputation: state.reputation, avgDecisionSeconds: avg, recentDecisions: state.recentDecisions.slice(-8),
      });
      tensionT += dt;
      if (tensionT > 0.5) {
        tensionT = 0;
        const t = Math.min(1, 0.6 * state.queue.length / GAME.MAX_QUEUE + 0.4 * Math.max(0, 1 - state.timeLeft / 45));
        scn('setTension', t); snd('setTension', t);
        state.claude = !!eng('isClaudeActive');
      }
      desk.updateHUD(state);
      if (!state.current) pullNext();
      if (state.timeLeft <= 0) endShift();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return { state, startGame, startShift, nextShift, endShift, finishGame, act, forceDecision, setScreen, saveFinal, resetGame };
}
