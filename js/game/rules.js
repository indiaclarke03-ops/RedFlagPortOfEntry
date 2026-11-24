// Scoring constants, grades, leaderboard and "tell" detection (used to highlight fields after an audit).
import { GAME } from '../core/config.js';

export const SCORE = {
  APPROVE_REVENUE: 1200,   // port fees for a cleared ship
  DETAIN_REVENUE: 400,     // inspection fee
  AUDIT_COST: 150,         // lab fee per audit
  CATCH_POINTS: 150,
  CLEAN_APPROVE_POINTS: 40,
  FALSE_DETAIN_REP: 5,
  MISS_REP: 5,
  OVERFLOW_LOSS: 300,
  START_REP: 80,
};

export const comboMult = combo => Math.min(3, 1 + Math.floor(combo / 3) * 0.5);

export const GRADES = ['Rookie', 'Junior Inspector', 'Inspector', 'Senior Inspector', 'Chief Inspector'];
const THRESH = [0, 2000, 4000, 6500, 9500];

export function computeFinal(s) {
  const revenuePts = Math.round(s.revenue / 100);
  const repBonus = Math.round(s.reputation * 10);
  const score = Math.max(0, revenuePts + Math.round(s.points) + repBonus);
  let g = 0; THRESH.forEach((t, i) => { if (score >= t) g = i; });
  // Accuracy floor: careful players are never punished for a slow queue.
  const n = s.stats.processed, acc = n ? s.stats.correct / n : 0;
  let ga = 0;
  if (n >= 6 && acc >= 0.7) ga = 1;
  if (n >= 10 && acc >= 0.85 && s.reputation >= 50) ga = 2;
  if (n >= 18 && acc >= 0.93 && s.reputation >= 70) ga = 3;
  if (n >= 26 && acc >= 0.97 && s.reputation >= 85) ga = 4;
  // Accuracy ceiling: speed-stamping racks up points, but top grades demand integrity.
  const missed = s.stats.missed || 0;
  let cap = 4;
  if (acc < 0.92 || missed > 3) cap = 3;
  if (acc < 0.85) cap = 2;
  if (acc < 0.7) cap = 1;
  const gi = Math.min(Math.max(g, ga), Math.max(cap, ga));
  return { score, revenuePts, repBonus, points: Math.round(s.points), accuracy: acc, grade: GRADES[gi], gradeIndex: gi };
}

// ---- tell detection ---------------------------------------------------------
const digits = code => String(code || '').replace(/\D/g, '');
/** Returns [chapterKey, family] for a declared HS code (works with 2- or 4-digit tables, object or array). */
export function hsLookup(world, code) {
  const t = world?.HS_TABLE; if (!t) return null;
  const d = digits(code);
  const rows = Array.isArray(t) ? t.map(r => [String(r.code ?? r.hs ?? r[0]), r.family ?? r.product ?? r.desc ?? r[1]]) : Object.entries(t).map(([k, v]) => [k, typeof v === 'string' ? v : (v.family ?? v.name ?? '')]);
  let best = null;
  for (const [k, v] of rows) { const kd = digits(k); if (kd && d.startsWith(kd) && (!best || kd.length > digits(best[0]).length)) best = [k, v]; }
  return best;
}
export const hsFamily = (world, code) => hsLookup(world, code)?.[1] ?? null;

export function highRiskRegions(world) {
  const r = world?.REGIONS;
  const list = Array.isArray(r) ? r : r ? Object.values(r) : [];
  return list.filter(x => x && x.highRisk);
}

export function isHighRiskHop(world, hop) {
  const hr = highRiskRegions(world);
  return hr.some(r => (r.name && (r.name === hop.region || (hop.region || '').includes(r.name.split(' (')[0]))) || (r.id && r.id === hop.regionId));
}

export const isShellHop = h => h.firmAgeMonths < 12 && h.employees < 5;

/** Which fields / hop indexes are implicated by the manifest's (ground truth) violations. Used after AUDIT. */
export function implicated(world, m) {
  const fields = new Set(), hops = new Set();
  for (const v of m.violations || []) {
    if (v === 'forced_labour') m.chain.forEach((h, i) => { if (isHighRiskHop(world, h)) hops.add(i); });
    if (v === 'transshipment') { fields.add('origin'); m.chain.forEach((h, i) => { if (h.step === 'Repackaging') hops.add(i); }); }
    if (v === 'hs_mislabel') fields.add('hs');
    if (v === 'shell_company') m.chain.forEach((h, i) => { if (isShellHop(h)) hops.add(i); });
    if (v === 'forged_cert') fields.add('cert');
    if (v === 'underpriced') fields.add('price');
    if (v === 'weight_mismatch') fields.add('weight');
    if (v === 'missing_smelter') fields.add('smelter');
    if (v === 'no_due_diligence') fields.add('dd');
  }
  return { fields, hops: [...hops] };
}

/** Computed hints, shown only after audit. */
export function auditHints(m) {
  const exp = m.units * m.unitWeightKg;
  const wDiff = exp ? (m.weightKg - exp) / exp : 0;
  const pr = m.marketPrice ? m.unitPrice / m.marketPrice : 1;
  const expired = m.certificate?.expires && m.certificate.expires < GAME.GAME_DATE;
  return [
    `Expected weight ${fmt(exp)} kg → declared is ${wDiff >= 0 ? '+' : ''}${Math.round(wDiff * 100)}% ${Math.abs(wDiff) > 0.15 ? '⚠' : '✓'}`,
    `Unit price is ${Math.round(pr * 100)}% of market ${pr < 0.6 ? '⚠' : '✓'}`,
    `Certificate ${expired ? 'EXPIRED ⚠' : 'in date ✓'}${m.certificate?.accredited === false ? ' · issuer NOT accredited ⚠' : ''}`,
  ];
}

export const fmt = n => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
export const money = n => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');

// ---- leaderboard -------------------------------------------------------------
const LB_KEY = 'redflag.leaderboard.v1';
export function loadBoard() {
  try { const a = JSON.parse(localStorage.getItem(LB_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch { return []; }
}
export function saveScore(entry) {
  const board = loadBoard();
  board.push({ initials: String(entry.initials || '???').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3).padEnd(3, '-'), score: entry.score | 0, grade: entry.grade, date: new Date().toISOString().slice(0, 10) });
  board.sort((a, b) => b.score - a.score);
  const top = board.slice(0, 10);
  try { localStorage.setItem(LB_KEY, JSON.stringify(top)); } catch { /* storage blocked */ }
  return top;
}
