// Smuggler Syndicate ("The Gilt Current"): adaptive utility AI that tries to get contraband past the inspector.
import { chooseByUtility, createVoice, helpers, shortRegion } from './util.js';
import { makeFrontFirm } from '../data/manifest.js';
import { REGIONS, TRANSSHIP_HUBS, VIOLATION_INFO, ACTORS, activeViolations } from '../data/world.js';

export const TACTICS = ['direct', 'transship', 'relabel', 'shell', 'forge', 'lowball', 'overweight'];
export const TACTIC_VIOLATION = { direct: 'forced_labour', transship: 'transshipment', relabel: 'hs_mislabel', shell: 'shell_company',
  forge: 'forged_cert', lowball: 'underpriced', overweight: 'weight_mismatch' };
export const TACTIC_LABEL = { direct: 'direct listed-region', transship: 'transshipment', relabel: 'HS-relabelled', shell: 'shell-company',
  forge: 'forged-certificate', lowball: 'lowballed-price', overweight: 'overweight', decoy: 'decoy' };
// where to go when a tactic gets burned
const ALTERNATIVES = { direct: ['transship', 'relabel', 'shell'], transship: ['shell', 'relabel', 'forge'], relabel: ['lowball', 'transship', 'forge'],
  shell: ['forge', 'transship', 'lowball'], forge: ['shell', 'lowball', 'overweight'], lowball: ['overweight', 'relabel', 'forge'],
  overweight: ['lowball', 'shell', 'relabel'] };
const BOLD_CAP = [0.5, 0.8, 1]; // max boldness per shift
const BASE_WEIGHTS = { direct: 1.5, overweight: 0.7, lowball: 0.7, forge: 0.6, relabel: 0.45, transship: 0.35, shell: 0.35 };

const LINES = {
  plan: ['Next hull carries {what}. Keep the paperwork boring.', 'Loading {what}. Smile at the inspector.', 'Sending {what} — dress it up nice.',
    '{what} goes out on the next tide.', 'Another {what} run. Same faces, new stamps.'],
  caught: ['They flagged the {tactic} job. Noted.', 'Lost one to the {tactic} play. Inspector has eyes.', '{tactic} hull detained. Burn the contact.',
    'Inspector caught the {tactic} trick. Adjusting.', 'Dock rat says our {tactic} box is in the cage. Damn.'],
  passed: ['{tactic} job sailed clean. Ha.', 'Inspector stamped it. {tactic} works here.', 'Through! Pour one for the {tactic} crew.',
    'Another {tactic} hull past the desk. Easy money.'],
  escalate: ['Inspector stamps in {secs}s. Load two problems per hull.', 'They are not reading. Double the cargo.', 'Desk is asleep. Push harder, faster.',
    'Waved {missed} of ours through. Time to get greedy.'],
  lie_low: ['Too many seizures. Clean hulls only for a bit.', 'Heat is up. Fewer runs, smarter paper.', 'Inspector is sharp. Lie low, wait for a slip.'],
  flood: ['Flood the lane with clean decoys. Bury the real one.', 'Send the empties. Make the desk drown in paper.', 'Decoy convoy out — the queue is our cover.'],
  rotate: ['Fronts are burned. Register new ones tonight.', 'New shells, new letterheads. Old names are hot.', 'Retire {front}. Fresh company by morning.'],
  decoy_detained: ['They detained a clean decoy. Keep them busy.', 'Ha — wasted an inspection on an empty. Perfect.'],
  taunt: ['Every port has a price. Yours just costs patience.', 'Paper is cheap. Inspectors get tired.', 'The ledger always balances. Eventually.',
    'Somewhere a stamp is waiting for us.'],
};

export function createSyndicate({ rng, emitIntel, replay, log }) {
  const h = helpers(rng);
  const say = createVoice(rng);
  const self = {
    id: 'syndicate', name: ACTORS.syndicate.name,
    goals: ['get contraband through', 'stay unpredictable', 'overwhelm the inspector when careful'],
    weights: { ...BASE_WEIGHTS },
    boldness: 0.2, // 0..1 → more violations per ship, more violating ships, faster spawns
    hubWeights: Object.fromEntries(TRANSSHIP_HUBS.map(id => [id, 1])),
    memory: {
      tactics: Object.fromEntries(TACTICS.map(t => [t, { sent: 0, caught: 0, passed: 0, success: 0.5, recent: [] }])),
      hubs: {}, origins: {}, fronts: [], burnedFronts: 0,
      totals: { sent: 0, caught: 0, passed: 0, decoys: 0 }, shift: { sent: 0, caught: 0, passed: 0, decoys: 0 },
      outcomes: [], // recent: true=caught
    },
    floodUntil: -1, spawnRateMult: 1, doubled: {}, originWeights: { xuar: 1.3, drc: 0.6 }, originStreak: { xuar: 0, drc: 0 }, nextDecide: 4, cooldowns: {}, lastScores: null, override: null, adaptations: 0,
  };
  for (let i = 0; i < 3; i++) self.memory.fronts.push({ ...makeFrontFirm(rng), caught: 0 });

  const intel = (text, tone = 'warn') => emitIntel({ agent: 'syndicate', name: self.name, text, tone });
  const adapt = (world, text, explain) => { self.adaptations++; replay(world, 'adapt', text, explain); };

  function hubLabel(id) { return REGIONS[id]?.country || id; }

  function catchRate(n = 6) {
    const o = self.memory.outcomes.slice(-n);
    return o.length ? o.filter(Boolean).length / o.length : 0.5;
  }

  self.isFlooding = (t) => t < self.floodUntil;

  /** Plan the next contraband ship. world.shift is 1..3. */
  self.planShip = function planShip(world) {
    const shift = world.shift;
    const allowed = new Set(activeViolations(shift));
    let tactic = null, forced = false;
    if (self.override?.tactic && TACTICS.includes(self.override.tactic)) { tactic = self.override.tactic; forced = true; self.override = null; }
    if (!tactic) tactic = h.weighted(self.weights) || 'direct';
    const primary = TACTIC_VIOLATION[tactic];
    const violations = [primary];
    // extras scale with shift & boldness
    const extraPool = [...allowed].filter(v => v !== primary && !(v === 'transshipment' && tactic === 'direct'));
    let nExtra = 0;
    if (shift === 1) nExtra = h.chance(self.boldness * 0.25) ? 1 : 0;
    else if (shift === 2) nExtra = (h.chance(0.25 + self.boldness * 0.4) ? 1 : 0) + (h.chance(self.boldness * 0.2) ? 1 : 0);
    else nExtra = (h.chance(0.45 + self.boldness * 0.4) ? 1 : 0) + (h.chance(0.1 + self.boldness * 0.3) ? 1 : 0);
    // newer rules are favourite extras: the syndicate tests whether the inspector learned them
    const pref = extraPool.filter(v => v === 'missing_smelter' || v === 'no_due_diligence');
    for (let i = 0; i < nExtra && extraPool.length; i++) {
      const src = pref.length && h.chance(0.55) ? pref : extraPool;
      const v = h.pick(src);
      violations.push(v);
      extraPool.splice(extraPool.indexOf(v), 1);
      if (pref.includes(v)) pref.splice(pref.indexOf(v), 1);
    }
    // transshipment in shift 3 sometimes still hides a listed-region input visibly (EU FLR)
    const hubId = tactic === 'transship' ? h.weighted(self.hubWeights) : undefined;
    const riskGroup = violations.includes('forced_labour') ? h.weighted(self.originWeights) : undefined;
    // front company: reuse unburned one or make new
    let front = self.memory.fronts.find(f => f.caught < 2 && h.chance(0.7)) || self.memory.fronts[0];
    if (!front || front.caught >= 2) { front = { ...makeFrontFirm(rng), caught: 0 }; self.memory.fronts.unshift(front); }
    const subtle = shift === 1 ? false : h.chance(shift === 2 ? 0.4 + self.boldness * 0.2 : 0.65);
    if (forced || h.chance(0.35)) intel(say('plan', LINES.plan, { what: `a ${TACTIC_LABEL[tactic]} cargo` }));
    return { tactic, violations, hubId, riskGroup, firm: front, subtle };
  };

  self.onSpawned = function onSpawned(m) {
    self.memory.totals.sent++; self.memory.shift.sent++;
    if (m.tactic === 'decoy') { self.memory.totals.decoys++; self.memory.shift.decoys++; return; }
    const st = self.memory.tactics[m.tactic]; if (st) st.sent++;
  };

  function originKey(m) {
    if (m.tactic === 'direct') { const hop = m.chain.find(c => /XUAR|artisanal/i.test(c.region)); return hop ? shortRegion(hop.region) : 'listed region'; }
    if (m.tactic === 'transship') { const rp = m.chain.find(c => c.step === 'Repackaging'); return rp ? rp.country : 'third country'; }
    return null;
  }

  /** Outcome feedback from the player's decision on a syndicate ship. */
  self.onOutcome = function onOutcome(world, m, caught) {
    if (m.tactic === 'decoy') { if (caught) intel(say('decoy_detained', LINES.decoy_detained), 'neutral'); return; }
    const t = m.tactic; const st = self.memory.tactics[t]; if (!st) return;
    const front = self.memory.fronts.find(f => f.id === m.firm.id);
    self.memory.outcomes.push(caught); if (self.memory.outcomes.length > 12) self.memory.outcomes.shift();
    st.recent.push(caught); if (st.recent.length > 4) st.recent.shift();
    st.success = st.success * 0.7 + (caught ? 0 : 1) * 0.3; // EMA with decay
    const ok = originKey(m);
    if (ok) { const o = self.memory.origins[ok] ||= { caught: 0, passed: 0 }; caught ? o.caught++ : o.passed++; }
    if (t === 'direct' && ok) {
      const g = ok === 'XUAR' ? 'xuar' : 'drc', other = g === 'xuar' ? 'drc' : 'xuar';
      if (caught) {
        self.originWeights[g] = Math.max(0.1, self.originWeights[g] * 0.55);
        self.originStreak[g] = Math.max(1, self.originStreak[g] + 1);
        if (self.originStreak[g] === 2) {
          self.originWeights[other] += 0.8;
          adapt(world, `Caught 2/2 direct ${ok} shipments → sourcing from ${other === 'xuar' ? 'XUAR' : 'DRC artisanal zones'} instead`, VIOLATION_INFO.forced_labour.explain);
        }
      } else { self.originWeights[g] = Math.min(3, self.originWeights[g] * 1.3); self.originStreak[g] = 0; }
    }
    if (caught) {
      st.caught++; self.memory.totals.caught++; self.memory.shift.caught++;
      if (front) front.caught++;
      intel(say('caught', LINES.caught, { tactic: TACTIC_LABEL[t] }), 'neutral');
      if (t === 'transship') { const rp = m.chain.find(c => c.step === 'Repackaging'); const hid = TRANSSHIP_HUBS.find(id => REGIONS[id].name === rp?.region); if (hid) self.hubWeights[hid] *= 0.4; }
      const c = st.recent.filter(Boolean).length;
      if (st.recent.length >= 3 && c >= Math.max(2, st.recent.length - 1)) {
        const alts = ALTERNATIVES[t].filter(a => self.weights[a] > 0.15);
        const alt = (h.chance(0.65) ? alts[0] : alts.sort((a, b) => self.memory.tactics[b].success - self.memory.tactics[a].success)[0]) || ALTERNATIVES[t][0];
        self.weights[t] = Math.max(0.05, self.weights[t] * 0.3);
        self.weights[alt] += 0.9;
        let altDesc = TACTIC_LABEL[alt];
        if (alt === 'transship') { const hub = h.weighted(self.hubWeights); altDesc = `transshipment via ${hubLabel(hub)}`; self.hubWeights[hub] += 1.5; }
        const what = ok && t === 'direct' ? `direct ${ok}` : ok && t === 'transship' ? `${ok}-transshipped` : TACTIC_LABEL[t];
        adapt(world, `Caught ${c}/${st.recent.length} ${what} shipments → switching to ${altDesc}`, VIOLATION_INFO[TACTIC_VIOLATION[alt]].explain);
        intel(`Inspector reads ${TACTIC_LABEL[t]} paper now. Switching to ${altDesc}.`, 'alert');
        st.recent = [];
      }
    } else {
      st.passed++; self.memory.totals.passed++; self.memory.shift.passed++;
      self.weights[t] += 0.25; self.boldness = Math.min(1, self.boldness + 0.05);
      intel(say('passed', LINES.passed, { tactic: TACTIC_LABEL[t] }), 'warn');
      const lastTwo = st.recent.slice(-2);
      if (lastTwo.length === 2 && lastTwo.every(x => !x) && (self.doubled[t] ?? -1e9) < world.gt - 120 && (self.doubled._any ?? -1e9) < world.gt - 30) {
        self.doubled[t] = self.doubled._any = world.gt;
        const via = ok ? ` (${ok})` : '';
        adapt(world, `2/2 ${TACTIC_LABEL[t]}${via} shipments slipped through → doubling down on ${TACTIC_LABEL[t]}`, VIOLATION_INFO[TACTIC_VIOLATION[t]].explain);
      }
    }
  };

  function cd(name, t) { return (self.cooldowns[name] || -1e9) > t ? 1 : 0; }

  /** Staggered utility decision. world: { t, shift, state, rng } */
  self.decide = function decide(world) {
    const { t, state } = world;
    const avg = state.avgDecisionSeconds || 8;
    const recent = (state.recentDecisions || []).slice(-6);
    const ours = recent.filter(d => d.violations?.length);
    const missRate = ours.length ? ours.filter(d => d.action === 'approve').length / ours.length : 0;
    const cr = catchRate();
    const burned = self.memory.fronts.filter(f => f.caught >= 2).length;
    const cap = BOLD_CAP[world.shift - 1] ?? 1;
    const nOut = self.memory.outcomes.length;
    const scores = {
      hold: 0.25,
      escalate: (avg < 5 ? (5 - avg) / 5 * 0.6 : 0) + missRate * 0.7 + (self.boldness < cap - 0.05 ? 0 : -1) - cd('escalate', t),
      lie_low: (nOut >= 3 ? (cr - 0.55) * 1.6 : -1) + (self.boldness > 0.25 ? 0.15 : -0.5) - cd('lie_low', t),
      flood: (avg > 6 ? 0.2 + (avg - 6) * 0.05 : -0.2) + (nOut >= 3 ? (cr - 0.4) * 0.6 : 0) + ((state.queueLength ?? 0) < 4 ? 0.1 : -0.5)
        + world.shift * 0.03 - (self.isFlooding(t) ? 1 : 0) - cd('flood', t),
      rotate_fronts: burned * 0.45 - cd('rotate', t),
      taunt: 0.12 + (cd('taunt', t) ? -1 : 0),
    };
    let { action, scores: noisy } = chooseByUtility(scores, rng);
    // Claude override (if any) for the meta-action
    if (self.override?.action && self.override.action !== 'push') { action = self.override.action === 'wait' ? 'hold' : self.override.action; if (!self.override.tactic) self.override = null; else self.override.action = 'push'; }
    self.lastScores = { t: Math.round(t), action, scores: noisy };
    log?.('syndicate', self.lastScores);
    switch (action) {
      case 'escalate': {
        self.boldness = Math.min(cap, self.boldness + 0.15); self.spawnRateMult = Math.max(0.6, self.spawnRateMult * 0.88);
        self.cooldowns.escalate = t + 35;
        const reason = avg < 5 ? `Inspector averaging ${avg.toFixed(1)}s per stamp` : `${Math.round(missRate * 100)}% of recent contraband approved`;
        adapt(world, `${reason} → ${world.shift === 1 ? 'more contraband' : 'more violations per ship'}, faster sailings (boldness ${self.boldness.toFixed(2)})`);
        intel(say('escalate', LINES.escalate, { secs: avg.toFixed(1), missed: ours.filter(d => d.action === 'approve').length }), 'alert');
        break; }
      case 'lie_low': {
        self.boldness = Math.max(0.05, self.boldness - 0.2); self.spawnRateMult = Math.min(1.2, self.spawnRateMult * 1.1);
        self.cooldowns.lie_low = t + 35;
        adapt(world, `${Math.round(cr * 100)}% of recent runs seized → lying low, subtler paperwork`);
        intel(say('lie_low', LINES.lie_low), 'neutral');
        break; }
      case 'flood': {
        self.floodUntil = t + 22; self.cooldowns.flood = t + 50;
        adapt(world, avg > 6 ? `Inspector slow and careful (${avg.toFixed(1)}s/stamp) → flooding the queue with clean decoys`
          : `${Math.round(cr * 100)}% of runs seized → flooding the queue with clean decoys to rush the desk`);
        intel(say('flood', LINES.flood), 'alert');
        break; }
      case 'rotate_fronts': {
        const old = self.memory.fronts.filter(f => f.caught >= 2);
        self.memory.fronts = self.memory.fronts.filter(f => f.caught < 2);
        self.memory.burnedFronts += old.length;
        for (let i = 0; i < Math.max(2, old.length); i++) self.memory.fronts.push({ ...makeFrontFirm(rng), caught: 0 });
        self.weights.shell += 0.3;
        self.cooldowns.rotate = t + 30;
        adapt(world, `${old.length} front compan${old.length === 1 ? 'y' : 'ies'} burned (${old.map(f => f.name).join(', ')}) → registering new shells`, VIOLATION_INFO.shell_company.explain);
        intel(say('rotate', LINES.rotate, { front: old[0]?.name || 'the old front' }), 'warn');
        break; }
      case 'taunt': self.cooldowns.taunt = t + 40; intel(say('taunt', LINES.taunt), 'neutral'); break;
      default: break;
    }
    // weights drift back toward base (memory decay)
    for (const k of TACTICS) self.weights[k] += (BASE_WEIGHTS[k] - self.weights[k]) * 0.03;
    self.nextDecide = t + h.range(3, 8);
    return action;
  };

  self.applyOverride = function applyOverride(dec) { self.override = { ...dec }; };

  self.startShift = function startShift() {
    self.memory.shift = { sent: 0, caught: 0, passed: 0, decoys: 0 }; self.floodUntil = -1; self.cooldowns = {};
    self.spawnRateMult = Math.max(0.75, self.spawnRateMult); self.nextDecide = 8;
  };

  self.summary = function summary() {
    const s = self.memory.shift;
    const fav = Object.entries(self.weights).sort((a, b) => b[1] - a[1])[0][0];
    const best = Object.entries(self.memory.tactics).filter(([, v]) => v.passed > 0).sort((a, b) => b[1].passed - a[1].passed)[0];
    let txt = `${self.name} sent ${s.sent - s.decoys} contraband ships${s.decoys ? ` (plus ${s.decoys} clean decoys)` : ''}: ${s.caught} caught, ${s.passed} slipped through.`;
    if (best) txt += ` What worked for them: ${TACTIC_LABEL[best[0]]}.`;
    txt += ` Intercepts suggest they now favour ${TACTIC_LABEL[fav]} tactics${self.boldness > 0.5 ? ' and are getting bolder' : ''}.`;
    return txt;
  };

  /** Compact state for Claude planning. */
  self.snapshot = function snapshot(state, shift) {
    const tac = {}; for (const [k, v] of Object.entries(self.memory.tactics)) tac[k] = { sent: v.sent, caught: v.caught, passed: v.passed };
    return { shift, boldness: +self.boldness.toFixed(2), tactics: tac, origins: self.memory.origins,
      inspector: { avgDecisionSeconds: +(state?.avgDecisionSeconds || 0).toFixed(1), queueLength: state?.queueLength ?? 0,
        recent: (state?.recentDecisions || []).slice(-5).map(d => ({ action: d.action, correct: d.correct, tactic: d.tactic })) } };
  };

  return self;
}
