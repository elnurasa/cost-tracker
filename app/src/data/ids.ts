let lastMs = 0;
let counter = 0;

/** UUIDv7 (time-ordered). */
export function uuidv7(): string {
  const ms = Date.now();
  const rnd = new Uint8Array(10);
  crypto.getRandomValues(rnd);
  const b = new Uint8Array(16);
  b[0] = Math.floor(ms / 2 ** 40) & 0xff;
  b[1] = Math.floor(ms / 2 ** 32) & 0xff;
  b[2] = Math.floor(ms / 2 ** 24) & 0xff;
  b[3] = Math.floor(ms / 2 ** 16) & 0xff;
  b[4] = Math.floor(ms / 2 ** 8) & 0xff;
  b[5] = ms & 0xff;
  b.set(rnd, 6);
  b[6] = (b[6] & 0x0f) | 0x70;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
export const nowIso = () => new Date().toISOString();

/** Hybrid logical clock string for the future sync contract (4.13). */
export function nextRev(deviceId = 'local'): string {
  const ms = Date.now();
  if (ms > lastMs) {
    lastMs = ms;
    counter = 0;
  } else counter += 1;
  return `${lastMs.toString(36).padStart(9, '0')}-${counter.toString(36).padStart(4, '0')}-${deviceId.slice(0, 8)}`;
}
