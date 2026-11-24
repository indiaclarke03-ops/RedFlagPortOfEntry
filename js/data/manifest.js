// Manifest generator + tell detector.
// Shift numbering here is 1..3 (rulebook numbering). The engine converts from its 0-based shiftIndex.
import { GAME } from '../core/config.js';
import {
  REGIONS, EXPORT_PORTS, TRANSSHIP_HUBS, TRANSIT_HUBS, PRODUCTS, PRODUCT_BY_ID, PRODUCT_BY_NAME,
  ACCREDITED_AUDITORS, FAKE_AUDITORS, CERT_PREFIX, HS_TABLE, hsChapter, hsFamily, VIOLATION_INFO,
} from './world.js';

const DAY = 86400000;
/** riskGroup option for forced_labour ships: which listed regions to source from. */
export const RISK_GROUPS = { xuar: ['xuar'], drc: ['kolwezi_asm', 'kivu_asm'] };
const PRODUCTION_STEPS = new Set(['Mine', 'Farm', 'Refinery', 'Smelter', 'Factory', 'Assembly']);
const HIGH_RISK_NAMES = new Set(Object.values(REGIONS).filter(r => r.highRisk).map(r => r.name));

// ---------------------------------------------------------------- rng helpers
function helpers(rng = Math.random) {
  const r = () => rng();
  return {
    r,
    range: (a, b) => a + (b - a) * r(),
    int: (a, b) => Math.floor(a + (b - a + 1) * r()),
    pick: (arr) => arr[Math.floor(r() * arr.length)],
    chance: (p) => r() < p,
    shuffle: (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  };
}

const fmtDate = (ms) => new Date(ms).toISOString().slice(0, 10);
const gameDateMs = () => Date.parse(GAME.GAME_DATE + 'T00:00:00Z');

// ---------------------------------------------------------------- name generators (fictional)
const NAME_WORDS = ['Halvane', 'Corriden', 'Tessaly', 'Mirow', 'Quillon', 'Vantor', 'Ashgrove', 'Brenmoor', 'Dunmere', 'Everholt',
  'Farrowmere', 'Harrowgate', 'Larkspur', 'Merrowind', 'Norland', 'Pellam', 'Rookwood', 'Saltmarsh', 'Thornbury', 'Vellum',
  'Wexley', 'Yarrowby', 'Qinghe', 'Lanfeng', 'Baorun', 'Hexin', 'Jadeport', 'Sunreach', 'Ironleaf', 'Bluecairn',
  'Redmantle', 'Silvercrane', 'Kestwick', 'Orinoco Vale', 'Tamarind', 'Coralline', 'Westerly', 'Starling', 'Obsidia', 'Marrowgate'];
const STEP_SUFFIX = {
  Mine: ['Mineral Co.', 'Mining', 'Resources'], Farm: ['Growers', 'Agri Co-op', 'Farms'],
  Refinery: ['Refining', 'Chemical', 'Materials'], Smelter: ['Smelting', 'Metals', 'Alloys'],
  Factory: ['Manufacturing', 'Industrial', 'Works'], Assembly: ['Assembly', 'Finishing', 'Production'],
  Exporter: ['Export Trading', 'Global Trade', 'Shipping Agency'], Warehouse: ['Logistics Park', 'Bonded Warehouse', 'Distribution'],
  Repackaging: ['Repack Services', 'Re-Export', 'Packaging Solutions'],
};
const LEGAL_FORM = {
  'China': 'Co., Ltd', 'Vietnam': 'Co., Ltd', 'Thailand': 'Co., Ltd', 'Malaysia': 'Sdn Bhd', 'United Arab Emirates': 'FZE',
  'Mexico': 'S.A. de C.V.', 'Türkiye': 'A.Ş.', 'India': 'Pvt Ltd', 'Bangladesh': 'Ltd', 'Indonesia': 'PT', 'DR Congo': 'SARL',
  'Germany': 'GmbH', 'Italy': 'S.r.l.', 'Spain': 'S.L.', 'Norway': 'AS', 'Netherlands': 'B.V.', 'South Korea': 'Co.',
  'Australia': 'Pty Ltd', 'Chile': 'SpA', 'Canada': 'Inc.', 'United States': 'LLC', 'Ecuador': 'S.A.', 'Singapore': 'Pte Ltd',
};
export function firmName(h, step, country) {
  const form = LEGAL_FORM[country] || 'Ltd';
  const base = `${h.pick(NAME_WORDS)} ${h.pick(STEP_SUFFIX[step] || ['Trading'])}`;
  return form === 'PT' ? `PT ${base}` : `${base} ${form}`;
}
const SHIP_ADJ = ['Halcyon', 'Salt', 'Iron', 'Amber', 'Silent', 'Coral', 'Northern', 'Velvet', 'Lantern', 'Copper', 'Grey', 'Cobalt',
  'Midnight', 'Saffron', 'Tidal', 'Pale', 'Restless', 'Gilded', 'Southern', 'Hollow', 'Bright', 'Patient'];
const SHIP_NOUN = ['Drift', 'Meridian', 'Heron', 'Ledger', 'Current', 'Horizon', 'Petrel', 'Monsoon', 'Tern', 'Bastion', 'Reach',
  'Wake', 'Quill', 'Albatross', 'Promise', 'Lantern', 'Sparrow', 'Harbour', 'Tide', 'Compass', 'Gannet', 'Shoal'];
const SHIP_COLORS = [0x19f0ff, 0xff2bd6, 0xffb020, 0x2bff9a, 0xeaf6ff, 0x9d7bff, 0xff7a3d];
const SMELTER_WORDS = ['Tanaka Ridge', 'Kalimar Bay', 'Ostrava Peak', 'Morrow Point', 'Selwyn Basin', 'Harrow Delta', 'Copperline', 'Bellweather'];
const FRONT_WORDS = ['Brightway', 'Silver Junction', 'Evergain', 'Oceanic Prime', 'Goldleaf', 'Unity Bridge', 'Pacific Crest', 'Northwind',
  'Starlink Trade', 'Harbourmaster', 'Fairwind', 'Bluewater', 'Crescent Line', 'Summit Path'];
const FRONT_FORMS = ['Trading Ltd', 'Imports B.V.', 'Commodities GmbH', 'Global S.r.l.', 'Supply Ltd', 'Holdings Ltd'];
const FRONT_COUNTRIES = ['Netherlands', 'Germany', 'Belgium', 'Italy', 'Poland', 'Cyprus', 'Ireland', 'Malta'];

let frontSeq = 0;
export function makeFrontFirm(rng) {
  const h = helpers(rng);
  frontSeq++;
  return { id: `front-${frontSeq}`, name: `${h.pick(FRONT_WORDS)} ${h.pick(FRONT_FORMS)}`, country: h.pick(FRONT_COUNTRIES), honest: false };
}

let shipSeq = 0;
export function resetManifestIds() { shipSeq = 0; }

// ---------------------------------------------------------------- compatibility
export function productSupports(product, violation, shift) {
  switch (violation) {
    case 'forced_labour': return product.riskPaths.length > 0;
    case 'hs_mislabel': return product.mislabelAs.length > 0;
    case 'missing_smelter': return !!product.batteryMineral && shift >= 2;
    case 'no_due_diligence': return shift >= 3;
    default: return true;
  }
}
export function pickProductFor(violations, shift, rng, pool) {
  const h = helpers(rng);
  const base = (pool && pool.length ? pool.map(id => PRODUCT_BY_ID[id]).filter(Boolean) : PRODUCTS);
  let ok = base.filter(p => violations.every(v => productSupports(p, v, shift)));
  if (!ok.length) ok = PRODUCTS.filter(p => violations.every(v => productSupports(p, v, shift)));
  return ok.length ? h.pick(ok) : h.pick(base);
}

// ---------------------------------------------------------------- generator
/**
 * generateManifest({ agent, firm, violations, tactic, shift (1..3), rng, productId?, subtle?, hubId?, herrings? })
 * Returns a manifest per CONTRACT whose visible fields carry exactly the tells of `violations`.
 */
export function generateManifest(opts = {}) {
  const rng = opts.rng || Math.random;
  const h = helpers(rng);
  const shift = Math.max(1, Math.min(3, opts.shift || 1));
  const agent = opts.agent || 'trader';
  const subtle = opts.subtle ?? (shift >= 2 && h.chance(0.5 + 0.2 * (shift - 2)));
  let violations = [...new Set(opts.violations || [])].filter(v => VIOLATION_INFO[v]);

  // product
  let product = opts.productId ? PRODUCT_BY_ID[opts.productId] : null;
  if (!product || !violations.every(v => productSupports(product, v, shift))) {
    product = pickProductFor(violations, shift, rng, opts.firm?.products);
  }
  const grp = opts.riskGroup ? RISK_GROUPS[opts.riskGroup] : null;
  if (grp && violations.includes('forced_labour') && !opts.productId) {
    const fits = (p) => p.riskPaths.some(rp => rp.some(id => grp.includes(id))) && violations.every(v => productSupports(p, v, shift));
    if (!fits(product)) { const c = PRODUCTS.filter(fits); if (c.length) product = h.pick(c); }
  }
  violations = violations.filter(v => productSupports(product, v, shift));
  const has = (v) => violations.includes(v);

  // ---- chain
  let riskPaths = product.riskPaths;
  if (grp) { const f = riskPaths.filter(rp => rp.some(id => grp.includes(id))); if (f.length) riskPaths = f; }
  const path = has('forced_labour') ? h.pick(riskPaths) : h.pick(product.paths);
  const prodHops = product.steps.map((step, i) => ({ step, regionId: path[i] }));
  const madeCountry = REGIONS[path[path.length - 1]].country;
  const chainCountries = new Set(path.map(id => REGIONS[id].country));
  let declaredOrigin = madeCountry;
  const tail = [];
  if (has('transshipment')) {
    const hubs = TRANSSHIP_HUBS.filter(id => !chainCountries.has(REGIONS[id].country));
    const hubId = (opts.hubId && hubs.includes(opts.hubId)) ? opts.hubId : h.pick(hubs);
    const hub = REGIONS[hubId];
    declaredOrigin = hub.country;
    tail.push({ step: 'Repackaging', regionId: hubId });
    tail.push({ step: 'Exporter', regionId: h.pick(EXPORT_PORTS[hub.country] || [hubId]) });
  } else {
    tail.push({ step: 'Exporter', regionId: h.pick(EXPORT_PORTS[madeCountry] || [path[path.length - 1]]) });
  }

  // red herrings (legal oddities) — choose a couple
  const herringPool = ['young_staffed', 'old_tiny', 'cheap', 'heavy', 'transit', 'cert_soon', 'china_ok'];
  const herrings = new Set(opts.herrings || h.shuffle(herringPool).slice(0, h.int(agent === 'trader' ? 0 : 1, 2)));
  if (herrings.has('transit') && !has('transshipment') && prodHops.length + tail.length < 5) {
    const tid = h.pick(TRANSIT_HUBS.filter(id => REGIONS[id].country !== madeCountry));
    tail.push({ step: 'Warehouse', regionId: tid });
  } else herrings.delete('transit');

  const STAFF = { Mine: [200, 3000], Farm: [15, 400], Refinery: [150, 2500], Smelter: [300, 4000], Factory: [80, 3000],
    Assembly: [120, 5000], Exporter: [6, 120], Warehouse: [12, 300], Repackaging: [8, 60] };
  const chain = [...prodHops, ...tail].map(({ step, regionId }) => {
    const reg = REGIONS[regionId];
    const [lo, hi] = STAFF[step] || [10, 200];
    return { step, firm: firmName(h, step, reg.country), country: reg.country, region: reg.name, lat: reg.lat, lon: reg.lon,
      firmAgeMonths: h.int(24, 420), employees: h.int(lo, hi) };
  });

  const notes = []; // audit notes explaining herrings
  // shell company: tiny & young hop (prefer the trade-side hops)
  if (has('shell_company')) {
    const idxs = chain.map((c, i) => i).filter(i => ['Exporter', 'Repackaging', 'Warehouse', 'Refinery', 'Factory'].includes(chain[i].step));
    const i = h.pick(idxs.length ? idxs : [chain.length - 1]);
    chain[i].firmAgeMonths = subtle ? h.int(8, 11) : h.int(1, 6);
    chain[i].employees = subtle ? h.int(3, 4) : h.int(0, 2);
    chain[i].firm = `${h.pick(NAME_WORDS)} ${h.pick(['Holdings', 'Ventures', 'Trade Partners', 'Resources Intl'])} ${LEGAL_FORM[chain[i].country] || 'Ltd'}`;
    chain[i]._shell = true;
  }
  if (herrings.has('young_staffed')) {
    const c = h.pick(chain.filter(c => !c._shell));
    if (c) { c.firmAgeMonths = h.int(4, 11); c.employees = h.int(25, 90); notes.push(`Registry: ${c.firm} is only ${c.firmAgeMonths} months old but has ${c.employees} verified staff and a real plant — young, not a shell.`); }
  }
  if (herrings.has('old_tiny')) {
    const c = h.pick(chain.filter(c => !c._shell && c.firmAgeMonths >= 12 && ['Exporter', 'Warehouse', 'Farm'].includes(c.step)));
    if (c) { c.firmAgeMonths = h.int(60, 300); c.employees = h.int(2, 4); notes.push(`Registry: ${c.firm} has only ${c.employees} staff but has traded for ${Math.round(c.firmAgeMonths / 12)} years — small, not a shell.`); }
  }
  for (const c of chain) delete c._shell;

  // ---- quantities, weight, price
  const units = h.int(product.units[0], product.units[1]);
  const expectedKg = units * product.unitWeightKg;
  let wFactor;
  if (has('weight_mismatch')) {
    wFactor = h.chance(0.75) ? (subtle ? h.range(1.18, 1.26) : h.range(1.3, 1.65)) : (subtle ? h.range(0.74, 0.82) : h.range(0.5, 0.7));
  } else if (herrings.has('heavy')) {
    wFactor = h.chance(0.5) ? h.range(1.08, 1.12) : h.range(0.88, 0.92);
    notes.push(`Weighbridge: ${Math.round((wFactor - 1) * 100)}% off reference — within the 15% tolerance (packaging/moisture).`);
  } else wFactor = h.range(0.96, 1.05);
  const weightKg = Math.round(expectedKg * wFactor);

  const marketPrice = product.marketPrice;
  let pRatio;
  if (has('underpriced')) pRatio = subtle ? h.range(0.48, 0.56) : h.range(0.28, 0.45);
  else if (herrings.has('cheap')) { pRatio = h.range(0.66, 0.78); notes.push(`Invoice: ${Math.round(pRatio * 100)}% of market — a volume discount, above the 60% threshold.`); }
  else pRatio = h.range(0.86, 1.12);
  const roundP = (x) => marketPrice >= 1000 ? Math.round(x) : Math.round(x * 100) / 100;
  const unitPrice = roundP(marketPrice * pRatio);

  // ---- HS code
  const hsCode = has('hs_mislabel') ? h.pick(product.mislabelAs) : product.hs;

  // ---- certificate
  const today = gameDateMs();
  let issuer, accredited = true, expiresMs, certKind = 'valid';
  if (has('forged_cert')) {
    if (h.chance(0.5)) { // expired
      issuer = h.pick(ACCREDITED_AUDITORS);
      expiresMs = today - (subtle ? h.int(1, 20) : h.int(60, 400)) * DAY;
      certKind = 'expired';
    } else {
      issuer = h.pick(subtle || shift >= 2 ? FAKE_AUDITORS.subtle : FAKE_AUDITORS.obvious);
      accredited = false;
      expiresMs = today + h.int(60, 300) * DAY;
      certKind = 'fake';
    }
  } else {
    issuer = h.pick(ACCREDITED_AUDITORS);
    if (herrings.has('cert_soon')) { expiresMs = today + h.int(2, 14) * DAY; notes.push('Certificate expires within two weeks — but it is valid today.'); }
    else expiresMs = today + h.int(30, 330) * DAY;
  }
  const issuedMs = expiresMs - 364 * DAY;
  const prefix = CERT_PREFIX[issuer] || issuer.split(/\s+/).map(w => w[0]).join('').replace(/[^A-Z]/gi, '').slice(0, 3).toUpperCase();
  const certificate = { issuer, id: `${prefix}-${new Date(issuedMs).getUTCFullYear()}-${h.int(10000, 99999)}`,
    issued: fmtDate(issuedMs), expires: fmtDate(expiresMs), accredited };

  // ---- smelter / dd
  let smelter = null;
  if (product.batteryMineral && !has('missing_smelter')) {
    const sHop = chain.find(c => c.step === 'Smelter' || c.step === 'Refinery') || chain[0];
    smelter = `${h.pick(SMELTER_WORDS)} ${product.batteryMineral === 'nickel' ? 'Smelter' : 'Refinery'} (${sHop.country})`;
  }
  const ddStatement = !has('no_due_diligence');
  if (herrings.has('china_ok') && !has('forced_labour') && chain.some(c => c.country === 'China')) {
    const c = chain.find(c => c.country === 'China');
    notes.push(`${c.region} is in China but outside listed regions — no presumption applies.`);
  }

  // ---- audit findings
  const findings = [];
  const riskHop = chain.find(c => HIGH_RISK_NAMES.has(c.region));
  for (const v of violations) {
    switch (v) {
      case 'forced_labour': findings.push(`Satellite + trade records: ${riskHop.firm} operates in ${riskHop.region}. Listed region — forced-labour presumption, no rebuttal evidence filed.`); break;
      case 'transshipment': { const rp = chain.find(c => c.step === 'Repackaging');
        findings.push(`Bill-of-lading trace: goods made in ${madeCountry}, only repackaged by ${rp.firm} in ${rp.country}. Declared origin "${declaredOrigin}" is false.`); break; }
      case 'hs_mislabel': findings.push(`Lab sample: cargo is ${product.name} (HS ${product.hs}, ${product.family}) — declared as HS ${hsCode} (${hsFamily(hsCode)}).`); break;
      case 'shell_company': { const s = chain.find(c => c.firmAgeMonths < 12 && c.employees < 5);
        findings.push(`Registry: ${s.firm} incorporated ${s.firmAgeMonths} months ago, ${s.employees} staff, registered-agent address. Beneficial owner linked to a sanctioned trading network.`); break; }
      case 'forged_cert': findings.push(certKind === 'expired'
          ? `Issuer registry: certificate ${certificate.id} expired on ${certificate.expires}. No renewal audit on record.`
          : `Issuer registry: "${issuer}" is not an accredited auditor — lookalike name. Certificate ${certificate.id} is a forgery.`); break;
      case 'underpriced': findings.push(`Valuation: $${unitPrice}/unit is ${Math.round(unitPrice / marketPrice * 100)}% of market — undervalued; invoice does not match payment records.`); break;
      case 'weight_mismatch': findings.push(wFactor > 1
          ? `X-ray: ${weightKg.toLocaleString('en-US')} kg vs ${expectedKg.toLocaleString('en-US')} kg expected (+${Math.round((wFactor - 1) * 100)}%). Undeclared cargo behind the declared goods.`
          : `X-ray: ${weightKg.toLocaleString('en-US')} kg vs ${expectedKg.toLocaleString('en-US')} kg expected (${Math.round((wFactor - 1) * 100)}%). Quantity on the invoice is falsified.`); break;
      case 'missing_smelter': findings.push(`No smelter/refiner of origin declared for this ${product.batteryMineral} product — EU Battery Regulation chain of custody broken.`); break;
      case 'no_due_diligence': findings.push('No CSDDD due-diligence statement on file; importer cannot show any upstream risk assessment.'); break;
    }
  }
  if (!violations.length) findings.push(`Audit clean: chain of custody reconciles across all ${chain.length} hops; certificate ${certificate.id} verified with ${issuer}.`);
  findings.push(...notes);

  shipSeq++;
  const manifest = {
    id: `SHP-${String(shipSeq).padStart(4, '0')}`,
    shipName: `MV ${h.pick(SHIP_ADJ)} ${h.pick(SHIP_NOUN)}`,
    shipColor: h.pick(SHIP_COLORS),
    agent,
    firm: opts.firm ? { id: opts.firm.id, name: opts.firm.name, country: opts.firm.country, honest: !!opts.firm.honest } : makeFrontFirm(rng),
    product: product.name,
    productId: product.id,
    hsCode,
    declaredOrigin,
    units, unitLabel: product.unitLabel,
    unitWeightKg: product.unitWeightKg,
    weightKg,
    unitPrice, marketPrice,
    chain,
    certificate,
    smelter,
    ddStatement,
    violations: [...violations],
    auditFindings: findings,
    tactic: opts.tactic ?? null,
    tip: null,
    shift,
  };
  return manifest;
}

// ---------------------------------------------------------------- tell detection (shared with gameplay)
/** Last production hop's country (where goods were substantially made). */
export function madeCountryOf(m) {
  const prod = (m.chain || []).filter(c => PRODUCTION_STEPS.has(c.step));
  return prod.length ? prod[prod.length - 1].country : null;
}
/**
 * detectTells(manifest, shift 1..3) → Set of violation ids visible from the manifest's fields under active rules.
 * Every violation is detectable from visible fields (no audit-only violations); the audit adds explanatory detail
 * such as the shell firm's sanctioned beneficial owner.
 */
export function detectTells(m, shift = 3) {
  const out = new Set();
  const today = GAME.GAME_DATE;
  const product = PRODUCT_BY_NAME[m.product] || PRODUCT_BY_ID[m.productId];
  if ((m.chain || []).some(c => HIGH_RISK_NAMES.has(c.region))) out.add('forced_labour');
  const made = madeCountryOf(m);
  if (made && m.declaredOrigin !== made) out.add('transshipment');
  if (product && hsChapter(m.hsCode) !== hsChapter(product.hs)) out.add('hs_mislabel');
  if ((m.chain || []).some(c => c.firmAgeMonths < 12 && c.employees < 5)) out.add('shell_company');
  const c = m.certificate || {};
  if (!ACCREDITED_AUDITORS.includes(c.issuer) || c.accredited === false || !c.expires || c.expires < today) out.add('forged_cert');
  if (m.unitPrice < 0.6 * m.marketPrice) out.add('underpriced');
  const expected = m.units * m.unitWeightKg;
  if (Math.abs(m.weightKg - expected) / expected > 0.15) out.add('weight_mismatch');
  if (shift >= 2 && product?.batteryMineral && !m.smelter) out.add('missing_smelter');
  if (shift >= 3 && m.ddStatement === false) out.add('no_due_diligence');
  return out;
}
/** Audit-only violations (none — every violation has a visible tell). */
export const AUDIT_ONLY_VIOLATIONS = [];

/** Schema check → array of problems (empty = OK). */
export function validateManifest(m) {
  const p = [];
  const req = ['id', 'shipName', 'shipColor', 'agent', 'firm', 'product', 'hsCode', 'declaredOrigin', 'units', 'unitLabel',
    'unitWeightKg', 'weightKg', 'unitPrice', 'marketPrice', 'chain', 'certificate', 'ddStatement', 'violations', 'auditFindings'];
  for (const k of req) if (m[k] === undefined || m[k] === null) p.push(`missing ${k}`);
  if (!('smelter' in m)) p.push('missing smelter key');
  if (!('tactic' in m)) p.push('missing tactic key');
  if (!('tip' in m)) p.push('missing tip key');
  if (!Array.isArray(m.chain) || m.chain.length < 3 || m.chain.length > 5) p.push(`chain length ${m.chain?.length}`);
  for (const c of m.chain || []) for (const k of ['step', 'firm', 'country', 'region', 'lat', 'lon', 'firmAgeMonths', 'employees'])
    if (c[k] === undefined || c[k] === null || Number.isNaN(c[k])) p.push(`hop missing ${k}`);
  for (const k of ['issuer', 'id', 'issued', 'expires', 'accredited']) if (m.certificate?.[k] === undefined) p.push(`cert missing ${k}`);
  if (!m.firm?.name || !m.firm?.country || typeof m.firm?.honest !== 'boolean') p.push('bad firm');
  if (!HS_TABLE[hsChapter(m.hsCode)]) p.push(`hs chapter ${m.hsCode} not in HS_TABLE`);
  if (!m.auditFindings?.length) p.push('no audit findings');
  return p;
}
