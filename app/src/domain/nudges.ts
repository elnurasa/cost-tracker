/** In-app evening reminder (AC-NUD-05, product 4.x nudge #6). Pure: the clock and the facts are passed in. */
export interface EveningInput {
  enabled: boolean; // opt-in, default OFF
  time: string; // "HH:MM" local, default 20:30
  now: Date; // local device time
  entryToday: boolean; // any entry the user made today (expense, refund or income)
  dismissedToday: boolean; // max one per day
  ignoredInRow: number; // paused after 3
  nudgesOn: boolean; // master switch
}
export const EVENING_DEFAULT_TIME = '20:30';
const QUIET_FROM = 22 * 60; // quiet hours 22:00-08:00
const QUIET_TO = 8 * 60;

export function parseHM(s: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return 20 * 60 + 30;
  const h = Math.min(23, +m[1]);
  return h * 60 + Math.min(59, +m[2]);
}

export function eveningReminderDue(i: EveningInput): boolean {
  if (!i.enabled || !i.nudgesOn) return false;
  if (i.entryToday || i.dismissedToday) return false;
  if (i.ignoredInRow >= 3) return false;
  const mins = i.now.getHours() * 60 + i.now.getMinutes();
  if (mins < parseHM(i.time)) return false;
  if (mins >= QUIET_FROM || mins < QUIET_TO) return false;
  return true;
}
