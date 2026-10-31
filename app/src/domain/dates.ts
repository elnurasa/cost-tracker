import type { CycleDay, DateStr } from './types';

export const pad2 = (n: number) => String(n).padStart(2, '0');
export const fmtDate = (y: number, m: number, d: number): DateStr => `${String(y).padStart(4, '0')}-${pad2(m)}-${pad2(d)}`;
export function parseDate(s: DateStr): { y: number; m: number; d: number } {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}
export const toDay = (s: DateStr): number => {
  const { y, m, d } = parseDate(s);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};
export const fromDay = (n: number): DateStr => {
  const dt = new Date(n * 86400000);
  return fmtDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
};
export const addDays = (s: DateStr, n: number): DateStr => fromDay(toDay(s) + n);
export const diffDays = (a: DateStr, b: DateStr): number => toDay(a) - toDay(b); // a - b
export const daysInMonth = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();
export const dayOfWeek = (s: DateStr): number => new Date(toDay(s) * 86400000).getUTCDay();
export const lastDayOfMonth = (s: DateStr): DateStr => {
  const { y, m } = parseDate(s);
  return fmtDate(y, m, daysInMonth(y, m));
};
export function addMonths(y: number, m: number, n: number): { y: number; m: number } {
  const idx = y * 12 + (m - 1) + n;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}
/** Adds n months to a date keeping `day` (default: date's own day), clamped to month length. */
export function addMonthsClamped(s: DateStr, n: number, day?: number): DateStr {
  const p = parseDate(s);
  const t = addMonths(p.y, p.m, n);
  return fmtDate(t.y, t.m, Math.min(day ?? p.d, daysInMonth(t.y, t.m)));
}
export const todayLocal = (now: Date = new Date()): DateStr => fmtDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
export const inRange = (d: DateStr, a: DateStr, b: DateStr) => d >= a && d <= b;

/** Cycle start date in a given month. 'L' or day>days-in-month => last day. */
export function cycleStartIn(y: number, m: number, c: CycleDay): DateStr {
  const dim = daysInMonth(y, m);
  const d = c === 'L' ? dim : Math.min(c, dim);
  return fmtDate(y, m, d);
}
/** Smallest cycle start date strictly after `s`. */
export function nextBoundaryAfter(s: DateStr, c: CycleDay): DateStr {
  const { y, m } = parseDate(s);
  const here = cycleStartIn(y, m, c);
  if (here > s) return here;
  const n = addMonths(y, m, 1);
  return cycleStartIn(n.y, n.m, c);
}
/** Cycle start date <= s (the start of the period that contains s). */
export function cycleStartOnOrBefore(s: DateStr, c: CycleDay): DateStr {
  const { y, m } = parseDate(s);
  const here = cycleStartIn(y, m, c);
  if (here <= s) return here;
  const p = addMonths(y, m, -1);
  return cycleStartIn(p.y, p.m, c);
}
export function periodBoundsFor(date: DateStr, c: CycleDay): { startDate: DateStr; endDate: DateStr } {
  const startDate = cycleStartOnOrBefore(date, c);
  return { startDate, endDate: addDays(nextBoundaryAfter(startDate, c), -1) };
}
export const normalizePayDay = (d: number): number | 'L' => (d >= 29 ? 'L' : d);
