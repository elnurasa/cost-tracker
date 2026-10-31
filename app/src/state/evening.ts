import { useEffect, useState } from 'react';
import { eveningReminderDue } from '../domain/nudges';
import { getPrefs, setPrefs, type Prefs } from './prefs';
import { todayLocal, type Transaction } from '../domain';

/** True while the in-app evening card should show. Re-evaluated every minute and when the app returns to the foreground. */
export function useEveningDue(prefs: Prefs, today: string, txs: Transaction[]): boolean {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, 60000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  // "an entry made today": something the user added today (by entry date or by creation day), not an auto-posted bill
  const entryToday = txs.some((x) => x.status !== 'void' && x.source === 'manual' && (x.date === today || todayLocal(new Date(x.createdAt)) === today));
  return eveningReminderDue({
    enabled: prefs.evening.enabled, time: prefs.evening.time, now, entryToday, dismissedToday: prefs.eveningLog.dismissedOn === today,
    ignoredInRow: prefs.eveningLog.ignored, nudgesOn: prefs.nudges,
  });
}
/** "Not now" counts as ignored; three in a row pause the reminder until the user re-enables it. */
export function eveningNotNow(today: string) {
  const l = getPrefs().eveningLog;
  setPrefs({ eveningLog: { ignored: l.ignored + 1, dismissedOn: today } });
}
export function eveningActed() {
  setPrefs({ eveningLog: { ignored: 0, dismissedOn: '' } });
}
