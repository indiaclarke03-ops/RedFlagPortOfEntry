// Minimal internal world + engine used ONLY when js/data/world.js or js/ai/engine.js fail to load.
// The real AI engine always takes priority. All firms here are fictional.
import { GAME } from '../core/config.js';

export const REGIONS = [
  { name: 'Xinjiang (XUAR)', country: 'China', highRisk: true, lat: 43.8, lon: 87.6 },
  { name: 'North Kivu', country: 'DR Congo', highRisk: true, lat: -0.7, lon: 29.2 },
  { name: 'Shan State', country: 'Myanmar', highRisk: true, lat: 21.0, lon: 97.5 },
  { name: 'Jiangsu', country: 'China', lat: 32.0, lon: 119.6 },
  { name: 'Western Australia', country: 'Australia', lat: -26, lon: 121 },
  { name: 'Atacama', country: 'Chile', lat: -24.5, lon: -69.2 },
  { name: 'Katanga', country: 'DR Congo', lat: -10.7, lon: 25.5 },
  { name: 'Sulawesi', country: 'Indonesia', lat: -2.5, lon: 121.4 },
  { name: 'Johor', country: 'Malaysia', lat: 1.5, lon: 103.7 },
  { name: 'Hai Phong', country: 'Vietnam', lat: 20.8, lon: 106.7 },
  { name: 'Gyeonggi', country: 'South Korea', lat: 37.4, lon: 127.5 },
  { name: 'Rotterdam', country: 'Netherlands', lat: 51.9, lon: 4.5 },
];

export const HS_TABLE = {
  '2836': 'Carbonates (lithium carbonate)',
  '2605': 'Cobalt ores & concentrates',
  '7502': 'Unwrought nickel',
  '8507': 'Electric accumulators (battery cells/packs)',
  '8541': 'Photovoltaic cells & semiconductors',
  '5208': 'Woven cotton fabrics',
  '8471': 'Computers & data units',
};

export const ACCREDITED_AUDITORS = ['Veritrace Audit GmbH', 'Nordlys Assurance AS', 'Meridian Ethical Supply Ltd', 'Kestrel Compliance SA'];
const FAKE_AUDITORS = ['GreenTrust Global Certs', 'Ethica Fast-Track Ltd', 'Pacific Verify Co.'];

export const PRODUCTS = [
  { name: 'Lithium-ion battery cells', hs: '8507.60', unitLabel: 'cartons', unitWeightKg: 18, marketPrice: 46, mineral: 'lithium', origin: ['China', 'South Korea', 'Vietnam'] },
  { name: 'Lithium carbonate', hs: '2836.91', unitLabel: 'bags', unitWeightKg: 500, marketPrice: 6200, mineral: 'lithium', origin: ['Chile', 'Australia', 'China'] },
  { name: 'Cobalt hydroxide', hs: '2605.00', unitLabel: 'drums', unitWeightKg: 250, marketPrice: 3100, mineral: 'cobalt', origin: ['DR Congo', 'China'] },
  { name: 'Nickel cathodes', hs: '7502.10', unitLabel: 'bundles', unitWeightKg: 1000, marketPrice: 17500, mineral: 'nickel', origin: ['Indonesia', 'Australia'] },
  { name: 'Solar PV modules', hs: '8541.43', unitLabel: 'pallets', unitWeightKg: 620, marketPrice: 3900, mineral: null, origin: ['China', 'Vietnam', 'Malaysia'] },
  { name: 'Cotton twill fabric', hs: '5208.32', unitLabel: 'bales', unitWeightKg: 220, marketPrice: 900, mineral: null, origin: ['China', 'India'] },
];

export const RULES = [
  { id: 'uflpa', shift: 1, title: 'Forced Labour Ban', text: 'Detain any shipment with a chain hop in a listed high-risk region.', checks: ['forced_labour'] },
  { id: 'hs', shift: 1, title: 'Tariff Classification', text: 'The HS code chapter must match the product (see HS table).', checks: ['hs_mislabel'] },
  { id: 'cert', shift: 1, title: 'Valid Certificates', text: `Certificate must be unexpired on ${GAME.GAME_DATE} and from an accredited auditor.`, checks: ['forged_cert'] },
  { id: 'weight', shift: 1, title: 'Weight Check', text: 'Declared weight must be within 15% of units × reference unit weight.', checks: ['weight_mismatch'] },
  { id: 'origin', shift: 2, title: 'Rules of Origin', text: 'Declared origin must equal the country of the LAST production hop (Mine/Farm/Refinery/Smelter/Factory/Assembly). A Warehouse in a third country is legal; a Repackaging hop = transshipment.', checks: ['transshipment'] },
  { id: 'shell', shift: 2, title: 'Shell Companies', text: 'Any hop firm younger than 12 months with fewer than 5 employees is a shell.', checks: ['shell_company'] },
  { id: 'price', shift: 2, title: 'Price Anomalies', text: 'Unit price below 60% of market reference = undervaluation.', checks: ['underpriced'] },
  { id: 'eubr', shift: 2, title: 'EU Battery Regulation', text: 'Lithium, cobalt and nickel goods must name their smelter/refiner.', checks: ['missing_smelter'] },
  { id: 'csddd', shift: 3, title: 'Due Diligence (CSDDD)', text: 'Importers must file a supply-chain due-diligence statement.', checks: ['no_due_diligence'] },
];
export function getActiveRules(shift) { return RULES.filter(r => r.shift <= shift); }

export const VIOLATION_INFO = {
  forced_labour: { title: 'Forced labour', explain: 'Goods linked to state-imposed labour (e.g. in Xinjiang) are presumed banned under the US UFLPA; the EU forced-labour ban applies from 2027.' },
  transshipment: { title: 'Transshipment', explain: 'Routing goods through a third country to relabel origin is a common way to dodge tariffs and import bans.' },
  hs_mislabel: { title: 'HS misclassification', explain: 'Declaring the wrong tariff code hides what a cargo really is from risk-screening systems.' },
  shell_company: { title: 'Shell company', explain: 'Newly formed firms with no staff often exist only to break the paper trail between a banned supplier and the buyer.' },
  forged_cert: { title: 'Forged / invalid certificate', explain: 'Expired or unaccredited audit certificates are bought cheaply to launder risky supply chains.' },
  underpriced: { title: 'Undervaluation', explain: 'Declaring prices far below market cuts duties and can signal dumping or trade-based money laundering.' },
  weight_mismatch: { title: 'Weight mismatch', explain: 'Weight that does not match the declared units suggests hidden or substituted cargo.' },
  missing_smelter: { title: 'Missing smelter', explain: 'The EU Battery Regulation requires due diligence on refiners/smelters — the chokepoint where conflict minerals get mixed in.' },
  no_due_diligence: { title: 'No due-diligence statement', explain: 'The EU CSDDD requires large firms to identify and address human-rights harms in their value chains.' },
};

const FIRMS = [
  { id: 'f1', name: 'Bluewater Energy Imports', country: 'Netherlands', honest: true },
  { id: 'f2', name: 'Harbourline Components', country: 'Germany', honest: true },
  { id: 'f3', name: 'Corvid Mobility GmbH', country: 'Germany', honest: true },
  { id: 'f4', name: 'Sunfield Retail Group', country: 'France', honest: true },
  { id: 'f5', name: 'Atlas Grid Storage', country: 'Belgium', honest: true },
];
const SYN_FIRMS = [
  { id: 's1', name: 'Goldcrest Trading FZE', country: 'UAE', honest: false },
  { id: 's2', name: 'Pallas Global Sourcing', country: 'Cyprus', honest: false },
  { id: 's3', name: 'Northpoint Supply Ltd', country: 'United Kingdom', honest: false },
];
const SHIPS = ['MV Halcyon Drift', 'MV Neon Tern', 'MV Cobalt Star', 'MV Saltmarsh', 'MV Orient Ember', 'MV Kite Runner', 'MV Grey Heron', 'MV Lumen Bay', 'MV Silent Reef', 'MV Copper Wake', 'MV Ninth Tide', 'MV Velvet Gale'];
const HOPFIRMS = ['Qinghe Mineral Co.', 'Southgate Refining', 'Ardent Cells Ltd', 'Lotus Assembly', 'Pearl River Exporters', 'Kivu Earthworks', 'Tanaka Ridge Smelter', 'Brightline Logistics', 'Morrow Processing'];

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const regionIn = c => REGIONS.find(r => r.country === c && !r.highRisk) || { name: c, country: c, lat: rnd(-20, 40), lon: rnd(0, 120) };

let seq = 9001; // distinct from engine ids (SHP-0001…)
export function makeManifest(shift, forceViolations = null) {
  const syndicate = forceViolations ? forceViolations.length > 0 : Math.random() < 0.42;
  const product = pick(PRODUCTS);
  const firm = syndicate ? pick(SYN_FIRMS) : pick(FIRMS);
  const origin = pick(product.origin);
  const units = Math.round(rnd(20, 120)) * (product.unitWeightKg < 50 ? 20 : 1);
  const steps = ['Mine', 'Refinery', 'Factory', 'Exporter'];
  const chain = steps.map(step => {
    const r = regionIn(origin);
    return { step, firm: pick(HOPFIRMS), country: r.country, region: r.name, lat: r.lat + rnd(-2, 2), lon: r.lon + rnd(-2, 2), firmAgeMonths: Math.round(rnd(40, 300)), employees: Math.round(rnd(40, 2500)) };
  });
  const m = {
    id: 'SHP-' + String(seq++).padStart(4, '0'), shipName: pick(SHIPS), shipColor: pick([0x19f0ff, 0xff2bd6, 0xffb020, 0x2bff9a]),
    agent: syndicate ? 'syndicate' : 'trader', firm, product: product.name, hsCode: product.hs, declaredOrigin: origin,
    units, unitLabel: product.unitLabel, unitWeightKg: product.unitWeightKg, weightKg: Math.round(units * product.unitWeightKg * rnd(0.95, 1.05)),
    unitPrice: +(product.marketPrice * rnd(0.85, 1.1)).toFixed(2), marketPrice: product.marketPrice, chain,
    certificate: { issuer: pick(ACCREDITED_AUDITORS), id: 'VT-2026-' + Math.floor(rnd(10000, 99999)), issued: '2026-0' + Math.floor(rnd(3, 9)) + '-12', expires: '2027-1' + Math.floor(rnd(0, 2)) + '-01', accredited: true },
    smelter: product.mineral ? 'Tanaka Ridge Smelter (Indonesia)' : null, ddStatement: true, violations: [], auditFindings: [], tactic: null, tip: null,
  };
  const active = getActiveRules(shift + 1).flatMap(r => r.checks);
  let viol = forceViolations || [];
  if (syndicate && !forceViolations) {
    const pool = active.filter(v => v !== 'missing_smelter' || product.mineral);
    viol = [pick(pool)];
    if (Math.random() < 0.25) viol.push(pick(pool));
    viol = [...new Set(viol)];
  }
  for (const v of viol) {
    if (v === 'forced_labour') { const h = m.chain[Math.random() < 0.5 ? 0 : 1]; Object.assign(h, { country: 'China', region: 'Xinjiang (XUAR)', lat: 43.8, lon: 87.6 }); m.auditFindings.push('Satellite-verified: upstream site sits inside Xinjiang (XUAR) labour-transfer zone.'); m.tactic = 'direct'; }
    if (v === 'transshipment') { m.declaredOrigin = 'Malaysia'; m.chain.forEach(h => { if (h.country === 'Malaysia') Object.assign(h, regionIn('China')); }); m.chain.splice(3, 0, { step: 'Repackaging', firm: 'Brightline Logistics', country: 'Malaysia', region: 'Johor', lat: 1.5, lon: 103.7, firmAgeMonths: 30, employees: 14 }); m.auditFindings.push('Bills of lading: goods made upstream, only relabelled in Malaysia.'); m.tactic = 'transship'; }
    if (v === 'hs_mislabel') { m.hsCode = pick(Object.keys(HS_TABLE).filter(k => k !== product.hs.slice(0, 4))) + '.90'; m.auditFindings.push(`Lab sample: cargo is ${product.name}, not HS ${m.hsCode}.`); m.tactic = 'relabel'; }
    if (v === 'shell_company') { const h = m.chain[2]; h.firm = 'Aurelia Holdings 7 Ltd'; h.firmAgeMonths = Math.round(rnd(2, 9)); h.employees = Math.round(rnd(0, 3)); m.auditFindings.push('Registry check: Aurelia Holdings 7 has no staff and a nominee director.'); m.tactic = 'shell'; }
    if (v === 'forged_cert') { if (Math.random() < 0.5) m.certificate.expires = '2026-11-30'; else { m.certificate.issuer = pick(FAKE_AUDITORS); m.certificate.accredited = false; } m.auditFindings.push('Certificate registry: no valid record for this certificate.'); m.tactic = 'forge'; }
    if (v === 'underpriced') { m.unitPrice = +(product.marketPrice * rnd(0.3, 0.5)).toFixed(2); m.auditFindings.push('Invoice trace: declared value far below market — duty evasion.'); m.tactic = 'lowball'; }
    if (v === 'weight_mismatch') { m.weightKg = Math.round(units * product.unitWeightKg * rnd(1.3, 1.6)); m.auditFindings.push('X-ray scan: undeclared dense cargo behind the pallets.'); m.tactic = 'overweight'; }
    if (v === 'missing_smelter') { m.smelter = null; m.auditFindings.push('No smelter disclosed: mineral source cannot be traced.'); }
    if (v === 'no_due_diligence') { m.ddStatement = false; m.auditFindings.push('Importer has never filed a due-diligence statement.'); }
  }
  m.violations = viol;
  if (!viol.length) { m.auditFindings.push('Audit clean: documents, weight and chain verified.'); if (Math.random() < 0.3 && m.smelter == null && product.mineral && shift < 1) m.smelter = null; }
  return m;
}

// --- tiny fallback engine ---------------------------------------------------
export function createFallbackEngine({ bus }) {
  let shift = 0, t = 0, nextSpawn = 2, total = 0, replay = [], claude = null, adaptCount = 0;
  const caughtTactics = {};
  const syn = text => bus.emit('intel', { agent: 'syndicate', name: 'The Syndicate', text, tone: 'warn' });
  return {
    startShift(i) {
      shift = i; t = 0; nextSpawn = 1.5;
      bus.emit('intel', { agent: 'director', name: 'Port Director', text: `Shift ${i + 1} is open. Keep those ships moving, inspector.`, tone: 'neutral' });
    },
    tick(dt, state) {
      t += dt; total += dt;
      if (t >= nextSpawn) {
        const m = makeManifest(shift);
        bus.emit('ship:arrive', m);
        if (Math.random() < 0.18 && m.violations.length) {
          const tip = { shipId: m.id, text: `Source says ${m.shipName} is hiding something in its paperwork.`, accurate: true };
          bus.emit('ngo:tip', tip);
          bus.emit('intel', { agent: 'ngo', name: 'Clean Chains NGO', text: `TIP: check ${m.shipName} closely.`, tone: 'good' });
        }
        nextSpawn = t + Math.max(5, 11 - shift * 2 - (state?.queueLength < 2 ? 3 : 0)) + Math.random() * 3;
      }
      if (state?.queueLength > GAME.MAX_QUEUE - 2 && Math.random() < dt * 0.08) {
        bus.emit('director:memo', { text: 'The queue is backing up. Every hour at anchor costs us.', urgency: 0.7 });
        bus.emit('director:dock_pay', { amount: 500, reason: 'demurrage on waiting ships' });
      }
    },
    recordDecision({ manifest, action, correct }) {
      const missed = action === 'approve' && manifest.violations.length;
      if (manifest.violations.length && action === 'detain') {
        caughtTactics[manifest.tactic] = (caughtTactics[manifest.tactic] || 0) + 1;
        replay.push({ t: total, shift: shift + 1, type: 'caught', text: `Caught ${manifest.shipName} (${manifest.tactic || manifest.violations[0]}).` });
        if (caughtTactics[manifest.tactic] === 2) {
          adaptCount++;
          const text = `"They keep catching our ${manifest.tactic} runs. Switch it up."`;
          syn(text); replay.push({ t: total, shift: shift + 1, type: 'adapt', text: `Syndicate abandons "${manifest.tactic}" after repeated seizures.` });
        }
      }
      if (missed) {
        replay.push({ t: total, shift: shift + 1, type: 'missed', text: `${manifest.shipName} slipped through with ${manifest.violations.join(', ')}.`, explain: manifest.violations[0] });
        setTimeout(() => {
          bus.emit('ngo:expose', { shipId: manifest.id, headline: 'PORT WAVED THROUGH TAINTED CARGO', subhead: `${manifest.shipName} cargo linked to ${VIOLATION_INFO[manifest.violations[0]]?.title?.toLowerCase() || 'abuse'}, NGO reveals.`, repLoss: 10 });
          replay.push({ t: total, shift: shift + 1, type: 'expose', text: `NGO exposé on ${manifest.shipName}.` });
        }, 9000);
      }
      if (!correct && action === 'detain') bus.emit('trader:complaint', { firm: manifest.firm.name, text: `${manifest.firm.name}: "Our paperwork was spotless. We will reconsider this port."` });
    },
    endShift() {
      return {
        headlines: ['Port throughput steady as inspections tighten', adaptCount ? 'Smuggling networks said to be changing routes' : 'Traders praise fast clearance'],
        syndicateSummary: adaptCount ? `The Syndicate adapted ${adaptCount} time(s) after your seizures.` : 'The Syndicate is probing your weak spots.',
      };
    },
    getReplay() { return replay.slice(); },
    setClaudeKey(k) { claude = k || null; },
    isClaudeActive() { return false; },
  };
}
