import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_WAIT_S, registerBiometric, safeEqual, setPin, verifyBiometric, verifyPin, waitLeftS } from './lock';
import { getPrefs, setPrefs } from '../state/prefs';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('PIN storage (AC-LOCK-05)', () => {
  it('stores only a salted PBKDF2 hash, never the PIN, with a fresh salt each time', async () => {
    await setPin('4821');
    const a = getPrefs().lock;
    expect(a.enabled).toBe(true);
    expect(a.hash).toMatch(/^[A-Za-z0-9+/=]{40,}$/);
    expect(a.salt.length).toBeGreaterThanOrEqual(20);
    expect(JSON.stringify(getPrefs())).not.toContain('4821');
    await setPin('4821');
    const b = getPrefs().lock;
    expect(b.salt).not.toBe(a.salt);
    expect(b.hash).not.toBe(a.hash); // same PIN, different salt -> different hash
  });
  it('verifies the right PIN and counts wrong ones', async () => {
    await setPin('1357');
    expect(await verifyPin('1357')).toEqual({ ok: true });
    const r = await verifyPin('0000');
    expect(r).toEqual({ ok: false, triesLeft: 4, waitS: 0 });
    expect(getPrefs().lock.fails).toBe(1);
    expect(await verifyPin('1357')).toEqual({ ok: true });
    expect(getPrefs().lock.fails).toBe(0); // success resets the counter
  });
});

describe('rate limiting (AC-LOCK-02)', () => {
  it('5 wrong -> 30 s, next series 60 s, 120 s ... capped at 15 min; correct PIN is refused during the wait', async () => {
    await setPin('2468');
    let now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const waits: number[] = [];
    for (let series = 0; series < 8; series++) {
      let last = await verifyPin('0000');
      for (let i = 1; i < 5; i++) last = await verifyPin('0000');
      expect(last.ok).toBe(false);
      waits.push((last as { waitS: number }).waitS);
      // still locked: even the right PIN is refused
      expect(await verifyPin('2468')).toMatchObject({ ok: false, triesLeft: 0 });
      now += ((last as { waitS: number }).waitS + 1) * 1000;
    }
    expect(waits).toEqual([30, 60, 120, 240, 480, 900, 900, 900]);
    expect(await verifyPin('2468')).toEqual({ ok: true });
  });
  it('a device clock moved back cannot extend the wait beyond the cap, and a missing hash never validates', async () => {
    expect(waitLeftS(10_000_000, 0)).toBe(MAX_WAIT_S);
    expect(waitLeftS(1000, 5000)).toBe(0);
    expect(waitLeftS(31_000, 1000)).toBe(30);
    setPrefs({ lock: { ...getPrefs().lock, salt: '', hash: '', lockedUntil: 0 } });
    expect(await verifyPin('1234')).toMatchObject({ ok: false });
  });
  it('safeEqual compares whole strings', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('', '')).toBe(true);
  });
});

describe('WebAuthn flow sanity (AC-LOCK-03, mocked authenticator)', () => {
  const rawId = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer;
  it('register stores the credential id; verify accepts the same credential only', async () => {
    const create = vi.fn().mockResolvedValue({ rawId });
    const get = vi.fn().mockResolvedValue({ rawId });
    vi.stubGlobal('navigator', { credentials: { create, get } });
    expect(await registerBiometric()).toBe(true);
    const opts = create.mock.calls[0][0].publicKey;
    expect(opts.authenticatorSelection).toMatchObject({ authenticatorAttachment: 'platform', userVerification: 'required' });
    expect(opts.challenge).toBeInstanceOf(Uint8Array);
    expect(opts.challenge.length).toBe(32);
    expect(getPrefs().lock.credId).toBeTruthy();
    expect(await verifyBiometric()).toBe(true);
    expect(get.mock.calls[0][0].publicKey.userVerification).toBe('required');
    get.mockResolvedValue({ rawId: new Uint8Array([9, 9, 9]).buffer });
    expect(await verifyBiometric()).toBe(false); // someone else's credential
  });
  it('cancel / timeout / no authenticator fall back to the PIN (never throw, never unlock)', async () => {
    const get = vi.fn().mockRejectedValue(Object.assign(new Error('cancelled'), { name: 'NotAllowedError' }));
    vi.stubGlobal('navigator', { credentials: { create: vi.fn().mockRejectedValue(new Error('x')), get } });
    setPrefs({ lock: { ...getPrefs().lock, credId: 'AQIDBAUGBwg=' } });
    expect(await verifyBiometric()).toBe(false);
    expect(await registerBiometric()).toBe(false);
    setPrefs({ lock: { ...getPrefs().lock, credId: null } });
    expect(await verifyBiometric()).toBe(false);
  });
});
