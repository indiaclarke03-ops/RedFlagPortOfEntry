// Shared constants. Colours as hex numbers (Pixi) and CSS strings.
export const PALETTE = {
  night: 0x05070f, navy: 0x0a1028, deep: 0x111a3a,
  magenta: 0xff2bd6, cyan: 0x19f0ff, amber: 0xffb020, red: 0xff3355, green: 0x2bff9a, white: 0xeaf6ff,
};
export const CSS = {
  night: '#05070f', navy: '#0a1028', deep: '#111a3a',
  magenta: '#ff2bd6', cyan: '#19f0ff', amber: '#ffb020', red: '#ff3355', green: '#2bff9a', white: '#eaf6ff',
};
export const GAME = {
  SHIFTS: 3,
  SHIFT_SECONDS: 180,
  AUDIT_SECONDS: 6,          // an audit locks the desk this long
  GAME_DATE: '2027-03-14',   // in-world "today" for certificate expiry checks
  MAX_QUEUE: 8,
};
export const ACTIONS = { APPROVE: 'approve', DETAIN: 'detain', AUDIT: 'audit' };
