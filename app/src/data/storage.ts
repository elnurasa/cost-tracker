import { getPrefs, setPrefs } from '../state/prefs';

export interface StorageStatus {
  persisted: boolean | null;
  usage: number | null;
  quota: number | null;
  ratio: number | null;
}

/** Asks the browser to keep our data when space is tight (AC-DATA-10). Safe where the API is missing or blocked. */
export async function ensurePersisted(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null;
    const already = (await navigator.storage.persisted?.()) ?? false;
    const ok = already || (await navigator.storage.persist());
    setPrefs({ persistResult: ok ? 'granted' : 'denied' });
    return ok;
  } catch {
    return null;
  }
}
export async function storageStatus(): Promise<StorageStatus> {
  try {
    const [persisted, est] = await Promise.all([navigator.storage?.persisted?.() ?? Promise.resolve(null), navigator.storage?.estimate?.() ?? Promise.resolve({} as StorageEstimate)]);
    const usage = est.usage ?? null;
    const quota = est.quota ?? null;
    return { persisted, usage, quota, ratio: usage != null && quota ? usage / quota : null };
  } catch {
    return { persisted: null, usage: null, quota: null, ratio: null };
  }
}
export const persistState = () => getPrefs().persistResult;
