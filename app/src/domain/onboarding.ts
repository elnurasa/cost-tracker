import type { CycleDay, DateStr, Income, Minor, Region, Schedule } from './types';
import { addDays, cycleStartOnOrBefore, diffDays, nextBoundaryAfter, normalizePayDay, periodBoundsFor } from './dates';
import { pow10, roundNearestTo } from './money';
import { scheduleDates } from './schedule';

export type Frequency = 'monthly' | 'twice' | 'biweekly' | 'weekly' | 'varies';

/**
 * One row of the onboarding income list (equal rank: no row is nested under another). Presets ("Once a month",
 * "Advance + salary", ...) only pre-fill rows; the person can edit every field. `anchor` marks the income that starts
 * the period; when nobody marks one, the largest steady monthly income is the anchor (tie: the later pay day).
 */
export interface OnboardIncome {
  name: string;
  kind: Income['kind'];
  amount: Minor;
  schedule: Schedule;
  /** default: monthly / weekly / every 2 weeks are steady; once / irregular is not */
  steady?: boolean;
  anchor?: boolean;
}

export interface OnboardInput {
  today: DateStr;
  freq: Frequency;
  amount: Minor;
  day: number; // monthly / first payment day
  amount2: Minor; // twice a month: second payment
  day2: number;
  nextPayDate: DateStr | null; // weekly / biweekly / varies
  exp: number;
  /** the income list (onboarding step 1). When present it replaces freq/amount/day/amount2/day2/nextPayDate. */
  incomes?: OnboardIncome[];
}
export interface IncomeSpec {
  nameKey: 'salary' | 'advance' | 'allowance' | 'freelance' | 'first' | 'second';
  /** a name typed by the person (income list); wins over nameKey */
  name?: string;
  kind: Income['kind'];
  reliability: Income['reliability'];
  isAnchor: boolean;
  schedule: Schedule;
  amount: Minor;
}

/** Monthly planning figure of one income (template only; real planning uses the actual events). */
export function monthlyEquivalent(amount: Minor, schedule: Schedule): Minor {
  if (schedule.type === 'weekly') return Math.round((amount * 52) / 12);
  if (schedule.type === 'biweekly') return Math.round((amount * 26) / 12);
  return amount;
}
const keyForKind = (k: Income['kind']): IncomeSpec['nameKey'] =>
  k === 'salary' ? 'salary' : k === 'advance' ? 'advance' : k === 'allowance' ? 'allowance' : k === 'freelance' ? 'freelance' : 'first';
const dayRank = (s: Schedule) => (s.type === 'monthly' ? (s.day === 'L' ? 32 : s.day) : 0);

/** Income list -> specs: month-end days normalised (29-31 = last day, as everywhere else), anchor chosen. */
export function specsFromList(list: OnboardIncome[]): IncomeSpec[] {
  const rows = list.filter((r) => r.amount > 0);
  const specs: IncomeSpec[] = rows.map((r) => {
    const schedule: Schedule = r.schedule.type === 'monthly' ? { type: 'monthly', day: r.schedule.day === 'L' ? 'L' : normalizePayDay(r.schedule.day) } : r.schedule;
    const steady = r.steady ?? (schedule.type === 'monthly' || schedule.type === 'weekly' || schedule.type === 'biweekly');
    return { nameKey: keyForKind(r.kind), name: r.name.trim() || undefined, kind: r.kind, reliability: steady ? 'steady' : 'uncertain', isAnchor: false, schedule, amount: r.amount };
  });
  if (specs.length === 0) return specs;
  let anchor = rows.findIndex((r) => r.anchor);
  if (anchor < 0) {
    const steady = specs.map((s, i) => ({ s, i })).filter((x) => x.s.reliability === 'steady');
    const pool = steady.length ? steady : specs.map((s, i) => ({ s, i }));
    pool.sort((a, b) => monthlyEquivalent(b.s.amount, b.s.schedule) - monthlyEquivalent(a.s.amount, a.s.schedule) || dayRank(b.s.schedule) - dayRank(a.s.schedule) || a.i - b.i);
    anchor = pool[0].i;
  }
  specs[anchor].isAnchor = true;
  return specs;
}

export function incomeSpecs(i: OnboardInput): IncomeSpec[] {
  if (i.incomes) return specsFromList(i.incomes);
  switch (i.freq) {
    case 'monthly':
      return [{ nameKey: 'salary', kind: 'salary', reliability: 'steady', isAnchor: true, schedule: { type: 'monthly', day: normalizePayDay(i.day) }, amount: i.amount }];
    case 'twice': {
      const firstIsAnchor = i.amount > i.amount2 || (i.amount === i.amount2 && i.day > i.day2);
      return [
        { nameKey: 'first', kind: firstIsAnchor ? 'salary' : 'advance', reliability: 'steady', isAnchor: firstIsAnchor, schedule: { type: 'monthly', day: normalizePayDay(i.day) }, amount: i.amount },
        { nameKey: 'second', kind: firstIsAnchor ? 'advance' : 'salary', reliability: 'steady', isAnchor: !firstIsAnchor, schedule: { type: 'monthly', day: normalizePayDay(i.day2) }, amount: i.amount2 },
      ];
    }
    case 'biweekly':
      return [{ nameKey: 'allowance', kind: 'allowance', reliability: 'steady', isAnchor: true, schedule: { type: 'biweekly', refDate: i.nextPayDate ?? i.today }, amount: i.amount }];
    case 'weekly': {
      const d = i.nextPayDate ?? i.today;
      const wd = new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))).getUTCDay();
      return [{ nameKey: 'allowance', kind: 'allowance', reliability: 'steady', isAnchor: true, schedule: { type: 'weekly', weekday: wd }, amount: i.amount }];
    }
    case 'varies':
      return [{ nameKey: 'freelance', kind: 'freelance', reliability: 'uncertain', isAnchor: true, schedule: i.nextPayDate ? { type: 'once', date: i.nextPayDate } : { type: 'none' }, amount: i.amount }];
  }
}
/** Sum of the monthly figures of every income (same numbers as before for the single-income shapes). */
export function monthlyFigure(i: OnboardInput): Minor {
  return incomeSpecs(i).reduce((a, s) => a + monthlyEquivalent(s.amount, s.schedule), 0);
}
/** No steady income at all (freelancer): cover mode with a 30-day default (5.1 O2 "It varies"). */
export const onlyUncertain = (i: OnboardInput): boolean => {
  const s = incomeSpecs(i);
  return s.length > 0 && s.every((x) => x.reliability === 'uncertain');
};
export function cycleDayFor(i: OnboardInput): CycleDay {
  const a = incomeSpecs(i).find((s) => s.isAnchor);
  return a && a.schedule.type === 'monthly' ? a.schedule.day : 1;
}
/** Most recent scheduled pay date on or before today (within 62 days), with its amount. */
export function lastPay(i: OnboardInput): { date: DateStr; amount: Minor } | null {
  let best: { date: DateStr; amount: Minor } | null = null;
  for (const s of incomeSpecs(i)) {
    if (s.schedule.type === 'once' || s.schedule.type === 'none') continue;
    const ds = scheduleDates(s.schedule, addDays(i.today, -62), i.today);
    const d = ds[ds.length - 1];
    if (d && (!best || d > best.date)) best = { date: d, amount: s.amount };
  }
  return best;
}
export function nextPay(i: OnboardInput): DateStr | null {
  let best: DateStr | null = null;
  const specs = incomeSpecs(i);
  for (const s of specs) {
    const ds = scheduleDates(s.schedule, addDays(i.today, 1), addDays(i.today, 62));
    if (ds[0] && (!best || ds[0] < best)) best = ds[0];
  }
  // an irregular income with a far expected date still sets the horizon (beyond the 62-day window)
  if (onlyUncertain(i)) {
    const once = specs.map((s) => (s.schedule.type === 'once' ? s.schedule.date : null)).filter((d): d is DateStr => !!d && d > i.today).sort()[0];
    if (once) return once;
  }
  return best;
}
export interface MoneyNow {
  justPaid: boolean;
  prefill: Minor;
  lastPayDate: DateStr | null;
}
/** O3 prefill (5.1). */
export function suggestMoneyNow(i: OnboardInput): MoneyNow {
  const lp = lastPay(i);
  const cycle = cycleDayFor(i);
  const cycleStart = cycleStartOnOrBefore(i.today, cycle);
  const monthly = monthlyFigure(i);
  const anchor = incomeSpecs(i).find((s) => s.isAnchor);
  const justPaid = !!lp && diffDays(i.today, lp.date) <= 2 && anchor?.schedule.type === 'monthly' && lp.date === cycleStart;
  if (justPaid && lp) return { justPaid: true, prefill: lp.amount, lastPayDate: lp.date };
  const np = nextPay(i) ?? nextBoundaryAfter(i.today, cycle);
  const cycleLen = 30;
  const share = Math.min(1, Math.max(0, diffDays(np, i.today) / cycleLen));
  const step = 10 * pow10(i.exp);
  const prefill = onlyUncertain(i) ? monthly : roundNearestTo(Math.round(monthly * share), step);
  return { justPaid: false, prefill, lastPayDate: lp?.date ?? null };
}
export interface FirstPeriod {
  startDate: DateStr;
  endDate: DateStr;
  scaled: boolean;
  startingAmount: boolean; // create a received "Starting amount" event
}
export function firstPeriod(i: OnboardInput, justPaidAccepted: boolean): FirstPeriod {
  const cycle = cycleDayFor(i);
  if (justPaidAccepted) {
    const b = periodBoundsFor(i.today, cycle);
    return { startDate: b.startDate, endDate: b.endDate, scaled: false, startingAmount: false };
  }
  const endDate = addDays(nextBoundaryAfter(i.today, cycle), -1);
  return { startDate: i.today, endDate, scaled: true, startingAmount: true };
}
export function regionFor(country: string | null, timeZone: string | null): Region {
  const c = (country ?? '').toUpperCase();
  if (c === 'AZ' || timeZone === 'Asia/Baku') return 'AZ';
  if (c === 'TR' || timeZone === 'Europe/Istanbul') return 'TR';
  if (['RU', 'KZ', 'UZ', 'GE', 'AM', 'BY', 'KG', 'TJ', 'UA'].includes(c)) return 'CIS';
  return 'GLOBAL';
}
const CUR: Record<string, string> = { AZ: 'AZN', TR: 'TRY', KZ: 'KZT', GE: 'GEL', RU: 'RUB', US: 'USD', GB: 'GBP', UK: 'GBP', UZ: 'UZS', UA: 'UAH', BY: 'BYN', AM: 'AMD' };
const EURO = ['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'PT', 'IE', 'FI', 'GR', 'SK', 'SI', 'LT', 'LV', 'EE', 'LU', 'MT', 'CY', 'HR'];
export function currencyForRegion(country: string | null, region: Region): string {
  const c = (country ?? '').toUpperCase();
  if (CUR[c]) return CUR[c];
  if (EURO.includes(c)) return 'EUR';
  if (region === 'AZ') return 'AZN';
  if (region === 'TR') return 'TRY';
  return 'USD';
}
