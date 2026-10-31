import { loadAll } from '../data/repo';
import { EARLY_INCOME_DAYS, Engine, addDays, diffDays, floorMajor, currencyExponent } from '../domain';

/** Hero (whole major units) computed from fresh data, used by toasts right after a write. */
export async function currentHero(today: string): Promise<number> {
  const d = await loadAll();
  if (!d) return 0;
  const s = new Engine(d.ds, today).current();
  return s ? floorMajor(s.safe.leftToday, currencyExponent(d.ws.baseCurrency)) : 0;
}

// PWA install prompt capture (Chrome/Android); iOS has no event, so the card is hidden there.
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: InstallEvent | null = null;
const subs = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    subs.forEach((s) => s());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    subs.forEach((s) => s());
  });
}
export const canInstall = () => deferred !== null;
export const onInstallChange = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};
export async function promptInstall(): Promise<void> {
  if (!deferred) return;
  await deferred.prompt();
  deferred = null;
  subs.forEach((s) => s());
}

// Service worker update state
let updateReady = false;
let updater: ((reload?: boolean) => Promise<void>) | null = null;
export const swSubs = new Set<() => void>();
export function setUpdateReady(fn: (reload?: boolean) => Promise<void>) {
  updateReady = true;
  updater = fn;
  swSubs.forEach((s) => s());
}
export const isUpdateReady = () => updateReady;
export const applyUpdate = () => void updater?.(true);

/**
 * Toast text after "received" (E-08). A pay that arrives a few days early belongs to its own (next) period, so today's
 * number does not move; say that calmly instead of "Your plan is active. Today's number: 0".
 */
export function receivedMessage(
  t: (k: 'inc.planActive' | 'inc.earlyNext', p: Record<string, string | number>) => string,
  fmtDate: (d: string) => string, fmtNum: (n: number) => string,
  ev: { expectedDate: string | null } | undefined, periodEnd: string, today: string, n: number,
): string {
  const exp = ev?.expectedDate;
  if (exp && exp > periodEnd && exp > today && diffDays(exp, today) <= EARLY_INCOME_DAYS) return t('inc.earlyNext', { date: fmtDate(addDays(periodEnd, 1)), n: fmtNum(n) });
  return t('inc.planActive', { n: fmtNum(n) });
}
