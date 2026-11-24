// AI engine: owns spawn pacing and all agents. API per CONTRACT.md.
// No window/document access at import time (Node-safe).
import { GAME } from '../core/config.js';
import { generateManifest } from '../data/manifest.js';
import { VIOLATION_INFO, ACTORS } from '../data/world.js';
import { makeRng, helpers } from './util.js';
import { createSyndicate, TACTIC_LABEL } from './syndicate.js';
import { createTraders, createNGO, createDirector, createRival } from './actors.js';
import { createClaudeClient } from './claude.js';

const SHIFT_PACE = [1, 0.85, 0.72];       // spawn interval multiplier per shift
const SHIFT_VIOLATE = [0.35, 0.42, 0.48];  // baseline share of violating ships

/**
 * createEngine({ bus, seed?, debug?, fetchImpl? })
 *  debug: true → console.debug utility scores; or a function(who, data).
 */
export function createEngine({ bus, seed, debug, fetchImpl } = {}) {
  const rng = makeRng(seed);
  const h = helpers(rng);
  const replayLog = [];
  const debugLog = [];
  const ships = new Map();
  const decided = new Set();
  let gT = 0; // global seconds across shifts
  let shiftIndex = 0, shiftT = 0, running = false, spawnTimer = 1.5, lastClaudeSyn = -1e9, lastClaudeNgo = -1e9;
  const state = { shift: 0, timeLeft: GAME.SHIFT_SECONDS, queueLength: 0, queueIds: [], revenue: 0, reputation: 0, avgDecisionSeconds: 8, recentDecisions: [] };
  const shiftStats = { spawned: 0, violating: 0, caught: 0, missed: 0, wrongDetains: 0, cleared: 0 };

  let onAnyEmit = null;
  const emit = (evt, payload) => { try { onAnyEmit?.(evt); bus?.emit?.(evt, payload); } catch { /* fail soft */ } };
  const emitIntel = (p) => emit('intel', p);
  const log = (who, data) => {
    debugLog.push({ who, shift: shiftIndex + 1, ...data }); if (debugLog.length > 500) debugLog.shift();
    if (typeof debug === 'function') debug(who, data); else if (debug) console.debug('[ai]', who, JSON.stringify(data));
  };
  const replay = (_w, type, text, explain) => replayLog.push({ t: Math.round(shiftT), shift: shiftIndex + 1, type, text, ...(explain ? { explain } : {}) });

  const world = { get t() { return shiftT; }, get gt() { return gT; }, get shift() { return shiftIndex + 1; }, state, rng, isDecided: (id) => decided.has(id) };

  const director = createDirector({ rng, emit, emitIntel, log });
  const syndicate = createSyndicate({ rng, emitIntel, replay, log });
  const traders = createTraders({ rng, emit, emitIntel, log, onLobby: (c) => director.onLobby(c) });
  const ngo = createNGO({ rng, emit, emitIntel, replay, log });
  const rival = createRival({ rng, emit, emitIntel, log });
  const agents = [syndicate, traders, ngo, director, rival];
  onAnyEmit = (evt) => { if (evt === 'ngo:expose') director.onExpose(); }; // exposés rattle the director

  const claude = createClaudeClient({
    fetchImpl,
    onOffline: () => emitIntel({ agent: 'claude', name: 'Claude Mode', text: '[CLAUDE OFFLINE — local AI engaged]', tone: 'warn', claude: true }),
    onOnline: () => emitIntel({ agent: 'claude', name: 'Claude Mode', text: '✦ Claude link restored — agents planning with Claude', tone: 'good', claude: true }),
  });
  const claudeIntel = (via, text, tone) => emitIntel({ agent: 'claude', via, name: `${via === 'ngo' ? ACTORS.ngo.name : ACTORS.syndicate.name} ✦`, text, tone, claude: true });

  function askClaudeSyndicate() {
    lastClaudeSyn = shiftT;
    claude.plan('syndicate', syndicate.snapshot(state, shiftIndex + 1)).then(dec => {
      if (!dec || !running) return;
      syndicate.applyOverride(dec);
      if (dec.action === 'push' && dec.tactic) replay(world, 'adapt', `✦ Claude plan: push ${TACTIC_LABEL[dec.tactic]} next — "${dec.thought}"`);
      else if (dec.action !== 'wait') replay(world, 'adapt', `✦ Claude plan: ${dec.action.replace('_', ' ')} — "${dec.thought}"`);
      claudeIntel('syndicate', dec.thought, 'alert');
    }).catch(() => {});
  }
  function askClaudeNgo() {
    if (!claude.isActive() || claude.busy() || shiftT - lastClaudeNgo < 12) return;
    lastClaudeNgo = shiftT;
    claude.plan('ngo', ngo.snapshot(state, shiftIndex + 1)).then(dec => {
      if (!dec || !running) return;
      ngo.applyOverride(world, dec);
      claudeIntel('ngo', dec.thought, dec.action === 'wait' ? 'neutral' : 'alert');
    }).catch(() => {});
  }

  function spawnInterval() {
    let iv = h.range(9, 14) * SHIFT_PACE[shiftIndex] * syndicate.spawnRateMult;
    if (syndicate.isFlooding(shiftT)) iv *= 0.45;
    return iv;
  }

  function spawnShip() {
    const shift = shiftIndex + 1;
    let m;
    const pViol = Math.min(0.58, SHIFT_VIOLATE[shiftIndex] + Math.max(0, syndicate.boldness - 0.2) * 0.12);
    if (syndicate.isFlooding(shiftT) && h.chance(0.5)) {
      const front = syndicate.memory.fronts[0];
      m = generateManifest({ agent: 'syndicate', firm: front, violations: [], tactic: 'decoy', shift, rng });
    } else if (syndicate.override?.action === 'push' || h.chance(pViol)) {
      const plan = syndicate.planShip(world);
      m = generateManifest({ agent: 'syndicate', firm: plan.firm, violations: plan.violations, tactic: plan.tactic, shift, rng, hubId: plan.hubId, riskGroup: plan.riskGroup, subtle: plan.subtle });
    } else {
      const firm = traders.pickFirm();
      m = generateManifest({ agent: 'trader', firm, violations: [], tactic: null, shift, rng });
    }
    ships.set(m.id, m);
    shiftStats.spawned++; if (m.violations.length) shiftStats.violating++;
    if (m.agent === 'syndicate') syndicate.onSpawned(m);
    emit('ship:arrive', m);
    try { ngo.onArrive(world, m); if (m.agent === 'trader') traders.onArrive(m); } catch (e) { console.error('[ai] arrive hooks', e); }
    return m;
  }

  const engine = {
    startShift(idx = 0) {
      shiftIndex = Math.max(0, Math.min(GAME.SHIFTS - 1, idx | 0));
      shiftT = 0; running = true; spawnTimer = 1.5; lastClaudeSyn = -12; lastClaudeNgo = -1e9;
      Object.assign(shiftStats, { spawned: 0, violating: 0, caught: 0, missed: 0, wrongDetains: 0, cleared: 0 });
      for (const a of agents) a.startShift?.();
    },

    tick(dt, s) {
      if (!running) return;
      dt = Math.max(0, Math.min(0.5, Number(dt) || 0));
      shiftT += dt; gT += dt;
      if (s) Object.assign(state, s);
      // spawning
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        if ((state.queueLength ?? 0) < GAME.MAX_QUEUE && shiftT < GAME.SHIFT_SECONDS - 4) {
          try { spawnShip(); } catch (e) { console.error('[ai] spawn failed', e); }
          spawnTimer = spawnInterval();
        } else spawnTimer = 1;
      }
      // scheduled items
      try { ngo.update(world); director.update(world); } catch (e) { console.error('[ai] update', e); }
      // staggered agent decisions
      for (const a of agents) {
        if (shiftT >= a.nextDecide) {
          try { a.decide(world); } catch (e) { console.error(`[ai] ${a.id} decide`, e); a.nextDecide = shiftT + 5; }
        }
      }
      // Claude Mode: syndicate replans ~every 20s
      if (claude.isActive() && !claude.busy() && shiftT - lastClaudeSyn >= 20) askClaudeSyndicate();
    },

    recordDecision({ manifest, action, correct, decisionSeconds } = {}) {
      if (!manifest) return;
      const m = ships.get(manifest.id) || manifest;
      if (decided.has(m.id) && action !== 'audit') return; // already final
      if (action === 'audit') return; // not final — the stamp follows
      decided.add(m.id);
      const violating = m.violations.length > 0;
      const names = m.violations.map(v => VIOLATION_INFO[v]?.label || v).join(', ');
      if (action === 'detain') {
        if (violating) {
          shiftStats.caught++;
          replay(world, 'caught', `Caught ${m.shipName} (${m.firm.name}) — ${names}`);
          ngo.onCaught();
          if (m.agent === 'syndicate') syndicate.onOutcome(world, m, true);
        } else {
          shiftStats.wrongDetains++;
          if (m.agent === 'trader') traders.onWrongDetain(world, m);
          else syndicate.onOutcome(world, m, true); // decoy
          rival.onWrongDetain();
        }
      } else if (action === 'approve') {
        if (violating) {
          shiftStats.missed++;
          replay(world, 'missed', `Missed ${m.shipName} (${m.firm.name}) — ${names}`, VIOLATION_INFO[m.violations[0]]?.explain);
          ngo.onMissed(world, m);
          if (m.agent === 'syndicate') syndicate.onOutcome(world, m, false);
          askClaudeNgo();
        } else {
          shiftStats.cleared++;
          if (m.agent === 'trader') traders.onCleared(world, m, decisionSeconds ?? 8);
        }
      }
    },

    endShift() {
      running = false;
      const headlines = [...ngo.shiftHeadlines];
      if (!headlines.length) {
        headlines.push(shiftStats.caught > 0
          ? h.pick(['TIDEWATER WATCH PRAISES PORT VIGILANCE', 'SMUGGLERS STYMIED AT PORT OF ENTRY', 'PORT INSPECTORS HOLD THE LINE'])
          : 'QUIET SHIFT AT THE PORT OF ENTRY');
      }
      if (shiftStats.wrongDetains >= 3) headlines.push('TRADERS FUME OVER “OVERZEALOUS” PORT INSPECTIONS');
      if (rival.stolen >= 3) headlines.push(`PORT CALDER BOOMS AS SHIPPING LINES DIVERT`);
      return { headlines, syndicateSummary: syndicate.summary() };
    },

    getReplay() { return replayLog.map(e => ({ ...e })); },

    setClaudeKey(key) {
      claude.setKey(key || null);
      if (claude.hasKey()) emitIntel({ agent: 'claude', name: 'Claude Mode', text: '✦ Claude Mode engaged — Syndicate & Tidewater now plan with Claude', tone: 'good', claude: true });
    },
    isClaudeActive() { return claude.isActive(); },

    // ---- extras (not in CONTRACT; handy for debugging / sims)
    getDebug() { return debugLog.slice(); },
    getAgents() { return { syndicate, traders, ngo, director, rival }; },
    getShip(id) { return ships.get(id); },
    getShiftStats() { return { ...shiftStats }; },
  };
  return engine;
}
