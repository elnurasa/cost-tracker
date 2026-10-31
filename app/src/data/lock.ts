import { useSyncExternalStore } from 'react';
import { getPrefs, setPrefs } from '../state/prefs';

const enc = new TextEncoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const ITER = 210_000;

async function hashPin(pin: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt as BufferSource, iterations: ITER, hash: 'SHA-256' }, key, 256);
  return b64(new Uint8Array(bits));
}
/** Only a salted PBKDF2 hash is stored, never the PIN (AC-LOCK-05). */
export async function setPin(pin: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await hashPin(pin, salt);
  setPrefs({ lock: { ...getPrefs().lock, enabled: true, salt: b64(salt), hash, len: pin.length, fails: 0, lockedUntil: 0 } });
}
export function disableLock() {
  setPrefs({ lock: { ...getPrefs().lock, enabled: false, salt: '', hash: '', credId: null, fails: 0, lockedUntil: 0 } });
  setLocked(false);
}
/** Compare without early exit so timing does not reveal how many leading characters matched. */
export function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
export const MAX_WAIT_S = 900;
/** Wait left before the next attempt. A device clock moved back cannot extend it beyond the 15 minute cap. */
export function waitLeftS(lockedUntil: number, now: number): number {
  return Math.max(0, Math.min(MAX_WAIT_S, Math.ceil((lockedUntil - now) / 1000)));
}
export type VerifyResult = { ok: true } | { ok: false; triesLeft: number; waitS: number };

/** 5 wrong PINs -> 30 s wait, doubling per extra series up to 15 min (AC-LOCK-02). */
export async function verifyPin(pin: string): Promise<VerifyResult> {
  const l = getPrefs().lock;
  const now = Date.now();
  const left = waitLeftS(l.lockedUntil, now);
  if (left > 0) return { ok: false, triesLeft: 0, waitS: left };
  if (!l.salt || !l.hash) return { ok: false, triesLeft: 0, waitS: 0 };
  const hash = await hashPin(pin, unb64(l.salt));
  if (safeEqual(hash, l.hash)) {
    setPrefs({ lock: { ...l, fails: 0, lockedUntil: 0 } });
    return { ok: true };
  }
  const fails = l.fails + 1;
  if (fails % 5 === 0) {
    const series = fails / 5 - 1;
    const waitS = Math.min(MAX_WAIT_S, 30 * 2 ** series);
    setPrefs({ lock: { ...l, fails, lockedUntil: now + waitS * 1000 } });
    return { ok: false, triesLeft: 0, waitS };
  }
  setPrefs({ lock: { ...l, fails } });
  return { ok: false, triesLeft: 5 - (fails % 5), waitS: 0 };
}

// ---- lock state (in memory; the app starts locked when the lock is enabled)
let locked = getPrefs().lock.enabled;
let hiddenAt: number | null = null;
let shield = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((s) => s());
export function setLocked(v: boolean) {
  locked = v;
  emit();
}
export const useLocked = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => locked, () => false);
export const useShield = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => shield, () => false);

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    const l = getPrefs().lock;
    if (!l.enabled) return;
    if (document.hidden) {
      hiddenAt = Date.now();
      shield = true; // blank preview in the app switcher
      if (l.delayS === 0) locked = true;
    } else {
      shield = false;
      if (hiddenAt !== null && (Date.now() - hiddenAt) / 1000 >= l.delayS) locked = true;
      hiddenAt = null;
    }
    emit();
  });
}

// ---- WebAuthn (optional UI gate). No server: this only proves the device owner is present.
const rnd = (n: number) => crypto.getRandomValues(new Uint8Array(n));
export async function biometricAvailable(): Promise<boolean> {
  try {
    return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}
export async function registerBiometric(): Promise<boolean> {
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: rnd(32), rp: { name: 'Sakin' }, user: { id: rnd(16), name: 'owner', displayName: 'Owner' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' }, timeout: 60000,
      },
    })) as PublicKeyCredential | null;
    if (!cred) return false;
    setPrefs({ lock: { ...getPrefs().lock, credId: b64(new Uint8Array(cred.rawId)) } });
    return true;
  } catch {
    return false;
  }
}
export async function verifyBiometric(): Promise<boolean> {
  const id = getPrefs().lock.credId;
  if (!id) return false;
  try {
    const r = await navigator.credentials.get({ publicKey: { challenge: rnd(32), allowCredentials: [{ type: 'public-key', id: unb64(id) as BufferSource }], userVerification: 'required', timeout: 60000 } });
    // the assertion must come from the credential we registered (there is no server to check a signature)
    const got = r as PublicKeyCredential | null;
    return !!got && b64(new Uint8Array(got.rawId)) === id;
  } catch {
    return false;
  }
}
