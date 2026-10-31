import { useSyncExternalStore } from 'react';
import type { Locale } from '../domain';

export interface Prefs {
  theme: 'system' | 'light' | 'dark';
  reduceMotion: boolean;
  locale: Locale | null; // explicit user choice (else workspace / detected)
  lock: { enabled: boolean; salt: string; hash: string; len: number; delayS: number; credId: string | null; fails: number; lockedUntil: number };
  quickSave: boolean;
  showPocket: boolean;
  telemetryOptIn: boolean | null;
  installId: string;
  dismissed: Record<string, string>; // card id -> ISO date until which it stays hidden
  nudgeIgnored: Record<string, number>;
  firstOpenAt: string;
  lastBackupAt: string | null;
  persistResult: 'granted' | 'denied' | 'unknown';
  firstExpenseShown: boolean;
  installHintDone: boolean;
  demo: boolean;
  lastEnvelopeId: string | null;
  csvSemicolon: boolean | null;
  thumbsAskedAt: string | null;
  coachDone: boolean;
  openCount: number;
  lockSuggested: boolean;
  nudges: boolean;
  evening: { enabled: boolean; time: string }; // opt-in, default OFF (AC-NUD-05)
  eveningLog: { ignored: number; dismissedOn: string };
}

const KEY = 'sakin.prefs.v1';
const defaults = (): Prefs => ({
  theme: 'system', reduceMotion: false, locale: null,
  lock: { enabled: false, salt: '', hash: '', len: 4, delayS: 30, credId: null, fails: 0, lockedUntil: 0 },
  quickSave: false, showPocket: true, telemetryOptIn: null, installId: '', dismissed: {}, nudgeIgnored: {},
  firstOpenAt: new Date().toISOString(), lastBackupAt: null, persistResult: 'unknown', firstExpenseShown: false, installHintDone: false,
  demo: false, lastEnvelopeId: null, csvSemicolon: null, thumbsAskedAt: null, coachDone: false, openCount: 0, lockSuggested: false, nudges: true,
  evening: { enabled: false, time: '20:30' }, eveningLog: { ignored: 0, dismissedOn: '' },
});

function read(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Prefs>;
      const d = defaults();
      return { ...d, ...p, lock: { ...d.lock, ...(p.lock ?? {}) }, evening: { ...d.evening, ...(p.evening ?? {}) }, eveningLog: { ...d.eveningLog, ...(p.eveningLog ?? {}) } };
    }
  } catch {
    /* blocked storage: run with in-memory prefs */
  }
  return defaults();
}
let state: Prefs = read();
if (!state.installId) state = { ...state, installId: Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('') };
const listeners = new Set<() => void>();

export const getPrefs = () => state;
export function setPrefs(patch: Partial<Prefs>) {
  state = { ...state, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}
export function resetPrefs() {
  state = { ...defaults(), installId: state.installId };
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribe, getPrefs, getPrefs);
}
export function dismissCard(id: string, days = 3) {
  const until = new Date(Date.now() + days * 86400000).toISOString();
  setPrefs({ dismissed: { ...state.dismissed, [id]: until } });
}
/** Two consecutive dismissals without action silence that nudge for 30 days (AC-NUD-02). */
export function nudgeNotNow(id: string, days = 3) {
  const n = (state.nudgeIgnored[id] ?? 0) + 1;
  if (n >= 2) setPrefs({ nudgeIgnored: { ...state.nudgeIgnored, [id]: 0 }, dismissed: { ...state.dismissed, [id]: new Date(Date.now() + 30 * 86400000).toISOString() } });
  else setPrefs({ nudgeIgnored: { ...state.nudgeIgnored, [id]: n }, dismissed: { ...state.dismissed, [id]: new Date(Date.now() + days * 86400000).toISOString() } });
}
export const nudgeActed = (id: string) => setPrefs({ nudgeIgnored: { ...state.nudgeIgnored, [id]: 0 } });
export const isDismissed = (p: Prefs, id: string) => !!p.dismissed[id] && p.dismissed[id] > new Date().toISOString();
// persist install id once
setPrefs({});
