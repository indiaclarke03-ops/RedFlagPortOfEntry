// Tiny global event bus shared by every module.
const handlers = new Map();
export const bus = {
  on(evt, fn) { if (!handlers.has(evt)) handlers.set(evt, new Set()); handlers.get(evt).add(fn); return () => bus.off(evt, fn); },
  off(evt, fn) { handlers.get(evt)?.delete(fn); },
  emit(evt, payload) {
    for (const fn of [...(handlers.get(evt) || [])]) {
      try { fn(payload); } catch (e) { console.error(`[bus] handler for "${evt}" threw`, e); }
    }
  },
};
if (typeof window !== 'undefined') window.__bus = bus; // debugging / playtests
