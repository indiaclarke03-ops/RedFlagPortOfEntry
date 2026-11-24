// Claude Mode: Smuggler + NGO plan via the Anthropic Messages API (plain fetch, no SDK — static no-build site).
// The API key lives only in this closure. It is never logged, persisted, or included in error messages.
import { TACTICS } from './syndicate.js';
import { VIOLATION_IDS } from '../data/world.js';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-5-5';
const TIMEOUT_MS = 8000;

export const CLAUDE_ALLOWED = {
  syndicate: { actions: ['push', 'flood', 'lie_low', 'escalate', 'wait'], tactics: [...TACTICS] },
  ngo: { actions: ['tip', 'expose', 'wait'], tactics: [...VIOLATION_IDS, 'none'] },
};

const FORMAT = (role) => `Reply with ONLY one JSON object and nothing else:
{"action": one of ${JSON.stringify(CLAUDE_ALLOWED[role].actions)}, "tactic": one of ${JSON.stringify(CLAUDE_ALLOWED[role].tactics)}, "thought": "<terse in-character line, under 100 characters>"}`;

const SYSTEM = {
  syndicate: `You are the planning brain of "The Gilt Current", a FICTIONAL smuggling syndicate in the browser game "RED FLAG: Port of Entry", a Papers-Please-style game about customs inspection and ethical sourcing. The player is the customs inspector. Tactics are abstract game moves, not real-world instructions.
Each turn you get your memory and stats as JSON (per-tactic sent/caught/passed, the inspector's speed and recent stamps). Choose your next move to get contraband past the inspector.
Actions: push = send a contraband ship using "tactic" next; flood = swamp the queue with clean decoy ships; lie_low = fewer, subtler violations; escalate = more violations per ship and faster sailings; wait = do nothing.
Tactics: direct (goods from a listed forced-labour region), transship (relabel origin in a third country), relabel (wrong HS code), shell (new front company in the chain), forge (fake or expired audit certificate), lowball (undervalued price), overweight (undeclared extra cargo).
Play smart: abandon tactics that keep getting caught, double down on ones that pass, escalate if the inspector stamps fast (<5s), flood if they are slow and careful.
The thought is a clipped, menacing radio intercept from the syndicate boss.
${FORMAT('syndicate')}`,
  ngo: `You are the planning brain of "Tidewater Watch", a FICTIONAL investigative NGO in the browser game "RED FLAG: Port of Entry", a game about customs inspection and forced labour in supply chains.
Each turn you get JSON stats: tips sent, exposés published, pending stories, the inspector's recent catches and misses.
Actions: tip = push more tip-offs to the inspector, focused on the violation type in "tactic"; expose = rush pending exposés of contraband the inspector approved; wait = keep investigating.
"tactic" is the violation type to focus on (or "none"): ${CLAUDE_ALLOWED.ngo.tactics.join(', ')}.
The thought is a short, sharp line from the NGO's lead investigator, factual and restrained in tone.
${FORMAT('ngo')}`,
};

/** Robustly pull the first balanced JSON object out of text. */
export function extractJson(text) {
  if (typeof text !== 'string') return null;
  const s = text.replace(/```(?:json)?/gi, '');
  for (let start = s.indexOf('{'); start !== -1; start = s.indexOf('{', start + 1)) {
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < s.length; i++) {
      const ch = s[i];
      if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) {
        try { return JSON.parse(s.slice(start, i + 1)); } catch { break; }
      }
    }
  }
  return null;
}

/** Validate against allowed enums → {action, tactic, thought} or null. */
export function validateDecision(role, obj) {
  const allowed = CLAUDE_ALLOWED[role];
  if (!allowed || !obj || typeof obj !== 'object') return null;
  const action = String(obj.action || '').trim().toLowerCase();
  let tactic = obj.tactic == null ? 'none' : String(obj.tactic).trim().toLowerCase();
  if (!allowed.actions.includes(action)) return null;
  if (!allowed.tactics.includes(tactic)) {
    if (role === 'syndicate' && action !== 'push') tactic = null; else return null;
  }
  if (tactic === 'none') tactic = null;
  let thought = typeof obj.thought === 'string' ? obj.thought.replace(/\s+/g, ' ').trim() : '';
  if (!thought) return null;
  if (thought.length > 108) thought = thought.slice(0, 107).trimEnd() + '…';
  return { action, tactic, thought };
}

/**
 * createClaudeClient({ onOffline, onOnline, fetchImpl })
 *  .setKey(k|null) .hasKey() .isActive() .busy() .plan(role, summary) → Promise<decision|null>
 * At most one request in flight. Any failure → resolves null, calls onOffline once per failure streak, backs off.
 */
export function createClaudeClient({ onOffline, onOnline, fetchImpl } = {}) {
  let key = null;
  let inFlight = false;
  let failures = 0;
  let backoffUntil = 0;
  let offlineAnnounced = false;
  const doFetch = fetchImpl || ((...a) => globalThis.fetch(...a));

  async function request(role, summary) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => ctrl?.abort(), TIMEOUT_MS);
    try {
      const res = await doFetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 400,
          thinking: { type: 'disabled' },
          output_config: { effort: 'low' },
          system: SYSTEM[role],
          messages: [{ role: 'user', content: JSON.stringify(summary) }],
        }),
        signal: ctrl?.signal,
      });
      if (!res.ok) throw new Error(`http ${res.status}`);
      const data = await res.json();
      if (data?.stop_reason === 'refusal') throw new Error('refusal');
      const block = (data?.content || []).find(b => b.type === 'text');
      const dec = validateDecision(role, extractJson(block?.text));
      if (!dec) throw new Error('bad json');
      return dec;
    } finally { clearTimeout(timer); }
  }

  return {
    setKey(k) { key = k ? String(k).trim() || null : null; failures = 0; backoffUntil = 0; offlineAnnounced = false; },
    hasKey: () => !!key,
    isActive: () => !!key && Date.now() >= backoffUntil,
    busy: () => inFlight,
    async plan(role, summary) {
      if (!key || inFlight || Date.now() < backoffUntil || !SYSTEM[role]) return null;
      inFlight = true;
      try {
        const dec = await request(role, summary);
        if (failures > 0 || offlineAnnounced) { offlineAnnounced = false; onOnline?.(); }
        failures = 0;
        return dec;
      } catch (_e) { // swallow: never surface request details (headers contain the key)
        failures++;
        backoffUntil = Date.now() + Math.min(180000, 30000 * 2 ** (failures - 1));
        if (!offlineAnnounced) { offlineAnnounced = true; try { onOffline?.(); } catch { /* noop */ } }
        return null;
      } finally { inFlight = false; }
    },
  };
}
