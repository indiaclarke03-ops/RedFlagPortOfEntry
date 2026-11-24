// Module worker: renders sounds off the main thread, returns WAV ArrayBuffers.
import { render, encodeWav } from './synth.js';

self.onmessage = (e) => {
  const { id, kind, name } = e.data || {};
  try {
    const t0 = performance.now();
    const out = render(kind, name);
    const wavs = {}, transfer = [];
    for (const k in out) { const w = encodeWav(out[k].data, out[k].sr); wavs[k] = w; transfer.push(w); }
    self.postMessage({ id, ok: true, wavs, ms: performance.now() - t0 }, transfer);
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message || err) });
  }
};
