const KEY = 'sakin.deviceId';
let mem: string | null = null;

export function getDeviceId(): string {
  if (mem) return mem;
  try {
    const v = localStorage.getItem(KEY);
    if (v) return (mem = v);
  } catch {
    /* storage may be blocked */
  }
  const id = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('');
  mem = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
  return id;
}
