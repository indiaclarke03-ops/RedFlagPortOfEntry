// Honest Traders, NGO investigator, Port Director, Rival Port — utility-scored agents.
import { chooseByUtility, createVoice, helpers, shortRegion } from './util.js';
import { FIRMS, ACTORS, VIOLATION_INFO, PRODUCT_BY_NAME, hsFamily } from '../data/world.js';
import { madeCountryOf } from '../data/manifest.js';
import { GAME } from '../core/config.js';

// ======================================================================= Honest traders
export function createTraders({ rng, emit, emitIntel, log, onLobby }) {
  const h = helpers(rng);
  const say = createVoice(rng);
  const self = {
    id: 'traders', goals: ['fast clearance', 'fair treatment'],
    firms: FIRMS.map(f => ({ ...f, grievance: 0, wrongDetains: 0, cleared: 0, reroutedUntilShiftEnd: false, pending: [] })),
    nextDecide: 5, lastScores: null,
  };
  const byId = (id) => self.firms.find(f => f.id === id);
  const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

  self.pickFirm = function pickFirm() {
    const avail = self.firms.filter(f => !f.reroutedUntilShiftEnd);
    const pool = avail.length ? avail : self.firms;
    // conglomerate ships more; aggrieved firms ship less
    const w = Object.fromEntries(pool.map(f => [f.id, (f.id === 'orbisant' ? 1.6 : 1) / (1 + f.grievance * 0.4)]));
    return byId(h.weighted(w));
  };

  self.onArrive = function onArrive(m) {
    const f = byId(m.firm.id); if (!f || !h.chance(0.12)) return;
    emitIntel({ agent: 'trader', name: f.name, text: say(f.id + 'arr', f.voice.arrive), tone: 'neutral' });
  };

  self.onWrongDetain = function onWrongDetain(world, m) {
    const f = byId(m.firm.id); if (!f) return;
    f.grievance += 1; f.wrongDetains++;
    f.pending.push({ at: world.t + h.range(1.5, 4), m });
  };

  self.onCleared = function onCleared(world, m, decisionSeconds) {
    const f = byId(m.firm.id); if (!f) return;
    f.cleared++; f.grievance = Math.max(0, f.grievance - 0.15);
    if (h.chance(decisionSeconds < 8 ? 0.22 : 0.08))
      emitIntel({ agent: 'trader', name: f.name, text: say(f.id + 'thx', f.voice.thanks), tone: 'good' });
  };

  /** React to grievances: utility over complain / lobby / reroute. */
  function react(world, f) {
    const g = f.grievance;
    const scores = {
      complain: 0.4 + g * 0.25 + (f.style === 'complain' ? 0.35 : 0),
      lobby: g * 0.3 * f.clout + (f.style === 'lobby' ? 0.3 : 0) - 0.1,
      reroute: g * (1 - f.patience) * 0.55 + (f.style === 'reroute' ? 0.25 : 0) + (f.style === 'mixed' && g >= 2 ? 0.3 : 0) - 0.35,
    };
    const { action, scores: noisy } = chooseByUtility(scores, rng);
    log?.('trader', { t: Math.round(world.t), firm: f.id, action, scores: noisy });
    if (action === 'complain') {
      const text = say(f.id + 'cmp', f.voice.complaint);
      emit('trader:complaint', { firm: f.name, text });
      emitIntel({ agent: 'trader', name: f.name, text, tone: 'warn' });
    } else if (action === 'lobby') {
      const text = say(f.id + 'lob', f.voice.lobby);
      emitIntel({ agent: 'trader', name: f.name, text, tone: 'warn' });
      emit('trader:complaint', { firm: f.name, text });
      onLobby?.(f.clout);
    } else {
      const ships = Math.min(3, 1 + Math.floor(g / 2));
      const text = fill(say(f.id + 'rr', f.voice.reroute), { n: ships });
      f.reroutedUntilShiftEnd = true; f.grievance = Math.max(0, g - 1);
      emit('trader:reroute', { firm: f.name, ships });
      emitIntel({ agent: 'trader', name: f.name, text, tone: 'alert' });
    }
  }

  self.decide = function decide(world) {
    const { t, state } = world;
    for (const f of self.firms) {
      while (f.pending.length && f.pending[0].at <= t) { f.pending.shift(); react(world, f); }
    }
    // impatience chatter when the queue is long
    const q = state.queueLength ?? 0;
    const scores = { hold: 0.3, grumble: q >= 5 ? 0.2 + q * 0.06 : -1 };
    const { action, scores: noisy } = chooseByUtility(scores, rng);
    self.lastScores = { t: Math.round(t), action, scores: noisy };
    if (action === 'grumble') {
      const f = h.pick(self.firms.filter(x => x.patience < 0.6)) || self.firms[0];
      emitIntel({ agent: 'trader', name: f.name, text: say(f.id + 'imp', f.voice.impatient), tone: 'warn' });
    }
    self.nextDecide = t + h.range(1.5, 3); // short: pending reactions are timestamped
  };

  self.startShift = () => { for (const f of self.firms) { f.reroutedUntilShiftEnd = false; f.pending = []; f.grievance *= 0.5; } self.nextDecide = 3; };
  return self;
}

// ======================================================================= NGO investigator
const TIP_TRUE = {
  forced_labour: ['Field source: the {product} on {ship} traces back to {region}.', 'Satellite team flags {ship}: an upstream site sits in {region}.',
    'Worker testimony links {ship}’s {product} to {region}. Check the chain.'],
  transshipment: ['{ship}: cargo was only repackaged in {hub}. Real origin is {made}.', 'Relabelling op in {hub} — {ship}’s papers lie about origin.'],
  hs_mislabel: ['{ship} declared its {product} under the wrong HS chapter. Look it up.', 'Customs code on {ship} doesn’t match the cargo. Classic dodge.'],
  shell_company: ['A supplier on {ship} was registered months ago with no staff. Front?', '{ship}’s chain runs through a brand-new paper company.'],
  forged_cert: ['Whistleblower: the audit certificate on {ship} is not genuine.', 'Check the auditor on {ship} against the accredited list.'],
  underpriced: ['{ship}’s {product} is priced way below market. Ask why.', 'Too cheap to be clean: the invoice on {ship}.'],
  weight_mismatch: ['Dockworkers say {ship} is riding wrong for its declared load.', 'Weight on {ship} doesn’t add up. Something extra aboard.'],
  missing_smelter: ['{ship}’s {mineral} lists no smelter. Battery rules say it must.', 'No refiner on file for the {mineral} on {ship}.'],
  no_due_diligence: ['{firm} never filed a due-diligence statement for {ship}.', 'Check {ship}: no CSDDD statement on file.'],
};
const TIP_FALSE = ['Rumour: {ship}’s {product} routes through Xinjiang. Unconfirmed.', 'Hearing {firm} is a front company. Can’t verify yet.',
  'Anonymous source says the certificate on {ship} is fake.', 'Someone claims {ship} is overloaded. Second-hand.', 'Unverified: {ship}’s price is suspiciously low.'];
const HEADLINES = {
  forced_labour: ['FORCED-LABOUR {PRODUCT} WAVED THROUGH PORT', '{REGION} {PRODUCT} SLIPS PAST INSPECTORS', 'PORT STAMPS {PRODUCT} FROM {REGION}'],
  transshipment: ['“MADE IN {ORIGIN}”? TRY {MADE}', 'RELABELLED {PRODUCT} FOOLS PORT', 'ORIGIN SWAP: {MADE} CARGO SAILS IN'],
  hs_mislabel: ['{PRODUCT} SMUGGLED IN AS “{FAMILY}”', 'WRONG CODE, RIGHT THROUGH: PORT MISSES {PRODUCT}'],
  shell_company: ['GHOST FIRM SAILS CARGO PAST PORT', 'PAPER COMPANY, REAL CONTRABAND'],
  forged_cert: ['FAKE AUDIT, REAL STAMP: PORT FOOLED', 'FORGED ETHICS CERTIFICATE CLEARS CUSTOMS'],
  underpriced: ['TOO-CHEAP {PRODUCT} RAISES ALARM', 'BARGAIN {PRODUCT}, HIDDEN COST'],
  weight_mismatch: ['SECRET TONNES: OVERLOADED SHIP CLEARED', 'PORT MISSES TONNES OF UNDECLARED CARGO'],
  missing_smelter: ['BATTERY METAL OF UNKNOWN ORIGIN CLEARS PORT', 'NO SMELTER, NO PROBLEM? PORT WAVES {PRODUCT}'],
  no_due_diligence: ['NO DUE DILIGENCE, NO QUESTIONS ASKED', 'PORT CLEARS IMPORTER WITH ZERO DUE DILIGENCE'],
};
const NGO_CHATTER = {
  praise: ['Good catch at the port today. That’s how it’s done.', 'Seizure confirmed. Our sources are cheering.', 'Detention noted. Supply chains are watching.'],
  warn: ['We’re tracking ships you cleared. Hope you checked.', 'Our desk is reviewing today’s approvals.', 'Something got through. We’ll find it.'],
  idle: ['Tidewater Watch monitoring inbound traffic.', 'Tip line open. Keep your rulebook close.', 'Our researchers are on the night shift too.'],
};

export function createNGO({ rng, emit, emitIntel, replay, log }) {
  const h = helpers(rng);
  const say = createVoice(rng);
  const self = { id: 'ngo', name: ACTORS.ngo.name, goals: ['expose forced labour', 'feed accurate tips'],
    pendingTips: [], pendingExposes: [], tipBoost: 1, focus: null, nextDecide: 6, lastScores: null,
    shiftHeadlines: [], stats: { tips: 0, accurate: 0, exposes: 0 }, recentCatches: 0, recentMisses: 0 };
  const intel = (text, tone = 'alert', extra) => emitIntel({ agent: 'ngo', name: self.name, text, tone, ...extra });

  function vars(m) {
    const risk = m.chain.find(c => /XUAR|artisanal/i.test(c.region));
    const rp = m.chain.find(c => c.step === 'Repackaging');
    const p = PRODUCT_BY_NAME[m.product];
    return { ship: m.shipName, product: m.product.toLowerCase(), firm: m.firm.name, region: risk ? shortRegion(risk.region) : 'a listed region',
      hub: rp?.country || 'a third country', made: madeCountryOf(m), mineral: p?.batteryMineral || 'metal', origin: m.declaredOrigin,
      family: hsFamily(m.hsCode) };
  }
  const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => (k === k.toUpperCase() ? String(v[k.toLowerCase()] ?? '').toUpperCase() : (v[k] ?? '')));

  self.onArrive = function onArrive(world, m) {
    const violating = m.violations.length > 0;
    const p = (violating ? 0.3 + 0.04 * world.shift : 0.06) * self.tipBoost;
    if (!h.chance(p)) return;
    self.pendingTips.push({ at: world.t + h.range(1.5, 4), m });
  };

  function sendTip(world, m) {
    const v = vars(m);
    let text, accurate;
    if (m.violations.length) {
      const target = (self.focus && m.violations.includes(self.focus)) ? self.focus : h.pick(m.violations);
      text = fill(say('tip_' + target, TIP_TRUE[target]), v); accurate = true;
    } else { text = fill(say('tipF', TIP_FALSE), v); accurate = false; }
    m.tip = { text, accurate };
    self.stats.tips++; if (accurate) self.stats.accurate++;
    emit('ngo:tip', { shipId: m.id, text, accurate });
    intel(`TIP: ${text}`.slice(0, 110), 'alert');
    replay(world, 'tip', `Tip on ${m.shipName}: ${text}${accurate ? '' : ' (false lead)'}`);
  }

  self.onMissed = function onMissed(world, m) {
    self.recentMisses++;
    const p = 0.55 + (m.violations.includes('forced_labour') ? 0.25 : 0) + 0.05 * world.shift;
    if (h.chance(p)) self.pendingExposes.push({ at: world.t + h.range(8, 18), m });
  };
  self.onCaught = function onCaught() { self.recentCatches++; };
  self.forceExpose = function forceExpose(world) { for (const e of self.pendingExposes) e.at = Math.min(e.at, world.t + 3); };

  function publish(world, m) {
    const main = m.violations.includes('forced_labour') ? 'forced_labour' : h.pick(m.violations);
    const v = vars(m);
    const headline = fill(say('hl_' + main, HEADLINES[main]), v);
    const detail = { forced_labour: `to ${v.region}`, transshipment: `to ${v.made}, relabelled in ${v.hub}`, hs_mislabel: 'under a false customs code',
      shell_company: 'through a months-old shell firm', forged_cert: 'behind a forged audit certificate', underpriced: 'at a suspiciously low price',
      weight_mismatch: 'with tonnes of undeclared cargo', missing_smelter: 'with no smelter of origin', no_due_diligence: 'with no due-diligence filing' }[main];
    const subhead = `${self.name} traces ${v.product} imported by ${m.firm.name} ${detail}. Port inspectors approved it.`;
    const repLoss = Math.min(10, 4 + 2 * m.violations.length);
    self.stats.exposes++; self.shiftHeadlines.push(headline);
    emit('ngo:expose', { shipId: m.id, headline, subhead, repLoss });
    intel(`EXPOSÉ: ${headline}`.slice(0, 110), 'alert');
    replay(world, 'expose', `${headline} — ${m.shipName} (${m.firm.name})`, VIOLATION_INFO[main].explain);
  }

  self.update = function update(world) { // every tick: fire due scheduled items
    const t = world.t;
    while (self.pendingTips.length && self.pendingTips[0].at <= t) {
      const { m } = self.pendingTips.shift();
      if (!world.isDecided(m.id)) sendTip(world, m);
    }
    self.pendingTips.sort((a, b) => a.at - b.at);
    self.pendingExposes.sort((a, b) => a.at - b.at);
    while (self.pendingExposes.length && self.pendingExposes[0].at <= t) publish(world, self.pendingExposes.shift().m);
  };

  self.decide = function decide(world) {
    const t = world.t;
    const scores = { hold: 0.35, praise: self.recentCatches * 0.25, warn: self.recentMisses * 0.3, idle: 0.1 };
    const { action, scores: noisy } = chooseByUtility(scores, rng);
    self.lastScores = { t: Math.round(t), action, scores: noisy };
    log?.('ngo', self.lastScores);
    if (action === 'praise') { intel(say('praise', NGO_CHATTER.praise), 'good'); self.recentCatches = 0; }
    else if (action === 'warn') { intel(say('warn', NGO_CHATTER.warn), 'warn'); self.recentMisses = Math.max(0, self.recentMisses - 1); }
    else if (action === 'idle') intel(say('idle', NGO_CHATTER.idle), 'neutral');
    self.tipBoost += (1 - self.tipBoost) * 0.2;
    self.nextDecide = t + h.range(5, 9);
  };

  self.applyOverride = function applyOverride(world, dec) {
    if (dec.action === 'expose') self.forceExpose(world);
    else if (dec.action === 'tip') { self.tipBoost = 2.2; self.focus = VIOLATION_INFO[dec.tactic] ? dec.tactic : null; }
  };
  self.startShift = () => { self.pendingTips = []; self.shiftHeadlines = []; self.recentCatches = 0; self.recentMisses = 0; self.nextDecide = 6; };
  self.snapshot = (state, shift) => ({ shift, tips: self.stats.tips, exposes: self.stats.exposes, pendingExposes: self.pendingExposes.length,
    recentCatches: self.recentCatches, recentMisses: self.recentMisses, queueLength: state?.queueLength ?? 0 });
  return self;
}

// ======================================================================= Port Director
const MEMO = {
  calm: ['Queue at {q}. Keep it moving, inspector.', 'Shipping lines are watching our clearance times. {q} waiting.', 'A tidy port is a profitable port. {q} in line.'],
  anxious: ['{q} ships waiting. The lines are calling ME now.', 'Inspector, {q} hulls idling. Speed. It. Up.', 'Board meeting in an hour. {q} ships in queue is NOT a slide I want.'],
  frantic: ['{q} SHIPS. CLEAR THE QUEUE. NOW.', 'WHY ARE THERE {q} SHIPS IN MY HARBOUR?!', 'I am getting calls from the MINISTER. {q} ships!!'],
  praise: ['Queue clear. Revenue up. Keep this pace.', 'Smooth shift so far. The board is pleased.'],
  expose: ['We are in the PAPERS, inspector. Do you know what that costs?', 'A Tidewater exposé? On MY port? Read the rulebook.'],
  lobby: ['Our biggest client called me personally. Ease off the clean cargo.', 'Three complaints this hour. Do not detain honest traders.'],
};
export function createDirector({ rng, emit, emitIntel, log }) {
  const h = helpers(rng);
  const say = createVoice(rng);
  const self = { id: 'director', name: ACTORS.director.name, goals: ['throughput', 'revenue', 'no scandals'],
    queueHighSince: null, pressure: 0, nextDecide: 8, cooldowns: {}, lastScores: null, exposeFlag: false };
  const memo = (text, urgency) => { emit('director:memo', { text, urgency }); emitIntel({ agent: 'director', name: self.name, text, tone: urgency > 0.7 ? 'alert' : urgency > 0.4 ? 'warn' : 'neutral' }); };
  const cd = (k, t) => ((self.cooldowns[k] || -1e9) > t ? 1 : 0);

  self.update = function update(world) {
    const q = world.state.queueLength ?? 0;
    if (q >= 6) { if (self.queueHighSince === null) self.queueHighSince = world.t; } else self.queueHighSince = null;
  };
  self.onLobby = (clout) => { self.pressure += 0.4 + clout * 0.5; };
  self.onExpose = () => { self.exposeFlag = true; };

  self.decide = function decide(world) {
    const { t, state } = world;
    const q = state.queueLength ?? 0;
    const urgency = Math.min(1, q / GAME.MAX_QUEUE);
    const highFor = self.queueHighSince === null ? 0 : t - self.queueHighSince;
    const scores = {
      hold: 0.3,
      memo: q >= 3 ? 0.2 + urgency * 0.7 - cd('memo', t) : -1,
      dock_pay: (highFor >= 15 ? 0.6 + highFor / 60 : 0) + (self.pressure >= 1 ? 0.7 : 0) - cd('dock', t) * 2 - (highFor < 15 && self.pressure < 1 ? 1 : 0),
      praise: q <= 1 && (state.recentDecisions || []).slice(-4).filter(d => d.correct).length >= 3 ? 0.35 - cd('praise', t) : -1,
      scold: self.exposeFlag ? 0.9 : self.pressure >= 0.6 ? 0.45 - cd('scold', t) : -1,
    };
    const { action, scores: noisy } = chooseByUtility(scores, rng);
    self.lastScores = { t: Math.round(t), action, scores: noisy };
    log?.('director', self.lastScores);
    if (action === 'memo') {
      const tier = urgency >= 0.85 ? 'frantic' : urgency >= 0.55 ? 'anxious' : 'calm';
      memo(say(tier, MEMO[tier], { q }).replace('{q}', q), urgency); self.cooldowns.memo = t + (tier === 'frantic' ? 9 : 14);
    } else if (action === 'dock_pay') {
      const lobby = self.pressure >= 1;
      const amount = Math.round((lobby ? 400 : 250 + highFor * 8) / 50) * 50;
      const reason = lobby ? 'Trader complaints reached the board' : `Queue at ${q}+ for ${Math.round(highFor)}s`;
      emit('director:dock_pay', { amount, reason });
      memo(`Docking your pay $${amount}. ${reason}.`, 0.9);
      self.cooldowns.dock = t + 30; if (lobby) self.pressure = 0; self.queueHighSince = self.queueHighSince === null ? null : t;
    } else if (action === 'praise') { memo(say('praise', MEMO.praise), 0.1); self.cooldowns.praise = t + 45; }
    else if (action === 'scold') {
      memo(self.exposeFlag ? say('expose', MEMO.expose) : say('lobby', MEMO.lobby), 0.6);
      self.exposeFlag = false; self.cooldowns.scold = t + 20; self.pressure *= 0.7;
    }
    self.nextDecide = t + h.range(4, 8);
  };
  self.startShift = () => { self.queueHighSince = null; self.pressure = 0; self.cooldowns = {}; self.nextDecide = 10; self.exposeFlag = false; };
  return self;
}

// ======================================================================= Rival port
const RIVAL = {
  steal: ['Port Calder: {n} ships diverted to us. We clear in 20 minutes.', 'Calder here. Thanks for the traffic — {n} more berths filled.',
    'Shipping lines prefer Calder today. {n} vessels rerouted.'],
  taunt: ['Port Calder: no queues, no questions.', 'Calder’s inspectors go home on time.', 'Our harbour master sends regards. And invoices.'],
};
export function createRival({ rng, emit, emitIntel, log }) {
  const h = helpers(rng);
  const say = createVoice(rng);
  const self = { id: 'rival', name: ACTORS.rival.name, goals: ['steal traffic'], nextDecide: 15, cooldowns: {}, wrongDetains: 0, lastScores: null, stolen: 0 };
  const cd = (k, t) => ((self.cooldowns[k] || -1e9) > t ? 1 : 0);
  self.onWrongDetain = () => { self.wrongDetains++; };
  self.decide = function decide(world) {
    const { t, state } = world;
    const avg = state.avgDecisionSeconds || 0;
    const q = state.queueLength ?? 0;
    const slow = avg > 9 ? Math.min(1, (avg - 9) / 6) : 0;
    const stealU = slow * 0.6 + (q >= 5 ? 0.25 + (q - 5) * 0.1 : 0) + self.wrongDetains * 0.22;
    const scores = { hold: 0.4, steal: stealU - cd('steal', t) * 2, taunt: 0.12 + (q >= 4 ? 0.1 : 0) - cd('taunt', t) };
    const { action, scores: noisy } = chooseByUtility(scores, rng);
    self.lastScores = { t: Math.round(t), action, scores: noisy };
    log?.('rival', self.lastScores);
    if (action === 'steal') {
      const ships = stealU > 1 ? 2 : 1;
      const text = say('steal', RIVAL.steal, { n: ships });
      emit('rival:steal', { ships, text });
      emitIntel({ agent: 'rival', name: self.name, text, tone: 'alert' });
      self.stolen += ships; self.wrongDetains = Math.max(0, self.wrongDetains - 1); self.cooldowns.steal = t + 25;
    } else if (action === 'taunt') { emitIntel({ agent: 'rival', name: self.name, text: say('taunt', RIVAL.taunt), tone: 'neutral' }); self.cooldowns.taunt = t + 45; }
    self.nextDecide = t + h.range(5, 9);
  };
  self.startShift = () => { self.cooldowns = {}; self.nextDecide = 15; self.wrongDetains = 0; };
  return self;
}
