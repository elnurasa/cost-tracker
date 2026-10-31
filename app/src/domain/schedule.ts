import type { CommitmentRule, Currency, DateStr, Income, IncomeEvent, InstallmentPlan, Schedule, Transaction } from './types';
import { addDays, addMonthsClamped, dayOfWeek, daysInMonth, diffDays, fmtDate, parseDate } from './dates';
import { convertCurrency } from './money';
import { STALE_DAYS } from './safe';
import { isAuto, loanStatus, type TxLike } from './payments';

export const EVENT_PAST_DAYS = 14;
export const EVENT_FUTURE_DAYS = 62;
export const CATCHUP_DAYS = 366;

/** Dates a monthly day-of-month schedule falls on within [from, to] (clamped to month length). */
function monthlyDates(day: number | 'L', from: DateStr, to: DateStr): DateStr[] {
  const out: DateStr[] = [];
  const a = parseDate(from);
  const b = parseDate(to);
  for (let idx = a.y * 12 + a.m - 1; idx <= b.y * 12 + b.m - 1; idx++) {
    const y = Math.floor(idx / 12);
    const m = (idx % 12) + 1;
    const dim = daysInMonth(y, m);
    const d = day === 'L' ? dim : Math.min(day, dim);
    const s = fmtDate(y, m, d);
    if (s >= from && s <= to) out.push(s);
  }
  return out;
}
function stepDates(anchor: DateStr, step: number, from: DateStr, to: DateStr): DateStr[] {
  const out: DateStr[] = [];
  let d = anchor;
  if (d < from) d = addDays(anchor, Math.ceil(diffDays(from, anchor) / step) * step);
  for (; d <= to; d = addDays(d, step)) out.push(d);
  return out;
}

export function scheduleDates(s: Schedule, from: DateStr, to: DateStr): DateStr[] {
  switch (s.type) {
    case 'monthly':
      return monthlyDates(s.day, from, to);
    case 'weekly': {
      const first = addDays(from, (s.weekday - dayOfWeek(from) + 7) % 7);
      return stepDates(first, 7, from, to);
    }
    case 'biweekly':
      return stepDates(s.refDate, 14, from, to);
    case 'once':
      return s.date >= from && s.date <= to ? [s.date] : [];
    default:
      return [];
  }
}

export interface NewEvent {
  incomeId: string;
  expectedDate: DateStr;
  expectedAmount: number;
  expectedBase: number;
  currency: Currency;
  rate: string;
}
/** Lazily generate events from today-14 to today+62, idempotent on (incomeId, expectedDate). */
export function eventsToCreate(
  incomes: Income[],
  existing: Pick<IncomeEvent, 'incomeId' | 'expectedDate'>[],
  today: DateStr,
  base: Currency,
  rates: Record<string, { rate: string }>,
): NewEvent[] {
  const have = new Set(existing.map((e) => `${e.incomeId}|${e.expectedDate}`));
  const out: NewEvent[] = [];
  const from = addDays(today, -EVENT_PAST_DAYS);
  const to = addDays(today, EVENT_FUTURE_DAYS);
  for (const inc of incomes) {
    if (!inc.active || inc.deletedAt) continue;
    const rate = inc.currency === base ? '1' : rates[inc.currency]?.rate ?? '1';
    for (const d of scheduleDates(inc.schedule, from, to)) {
      if (have.has(`${inc.id}|${d}`)) continue;
      out.push({
        incomeId: inc.id, expectedDate: d, expectedAmount: inc.expectedAmount,
        expectedBase: convertCurrency(inc.expectedAmount, inc.currency, base, rate), currency: inc.currency, rate,
      });
    }
  }
  return out;
}
/** Expected events more than 14 days overdue get auto-skipped (4.6). */
export function staleEventIds(events: IncomeEvent[], today: DateStr): string[] {
  return events
    .filter((e) => !e.deletedAt && e.status === 'expected' && e.expectedDate && diffDays(today, e.expectedDate) > STALE_DAYS)
    .map((e) => e.id);
}

// ---------------- recurring commitments ----------------

export function ruleOccurrences(r: Pick<CommitmentRule, 'frequency' | 'anchorDate' | 'dayOfMonth' | 'endDate'>, from: DateStr, to: DateStr): DateStr[] {
  const end = r.endDate && r.endDate < to ? r.endDate : to;
  const start = from > r.anchorDate ? from : r.anchorDate;
  if (start > end) return [];
  switch (r.frequency) {
    case 'once':
      return r.anchorDate >= from && r.anchorDate <= end ? [r.anchorDate] : [];
    case 'weekly':
      return stepDates(r.anchorDate, 7, start, end);
    case 'biweekly':
      return stepDates(r.anchorDate, 14, start, end);
    case 'monthly':
      return monthlyDates(r.dayOfMonth ?? parseDate(r.anchorDate).d, start, end);
    case 'yearly': {
      const a = parseDate(r.anchorDate);
      const out: DateStr[] = [];
      for (let y = parseDate(start).y; y <= parseDate(end).y; y++) {
        const s = fmtDate(y, a.m, Math.min(a.d, daysInMonth(y, a.m)));
        if (s >= start && s <= end && s >= r.anchorDate) out.push(s);
      }
      return out;
    }
  }
}

// ---------------- installments ----------------

export interface Occurrence {
  n: number;
  dueDate: DateStr;
  state: 'paid' | 'scheduled' | 'skipped';
  txId: string | null;
}
export function installmentDueDate(p: Pick<InstallmentPlan, 'firstDueDate'>, n: number): DateStr {
  return addMonthsClamped(p.firstDueDate, n - 1, parseDate(p.firstDueDate).d);
}
export function installmentOccurrences(p: InstallmentPlan, txns: Pick<Transaction, 'installmentId' | 'installmentNo' | 'deletedAt' | 'id'>[]): Occurrence[] {
  const posted = new Map<number, string>();
  for (const t of txns) if (t.installmentId === p.id && t.installmentNo && !t.deletedAt) posted.set(t.installmentNo, t.id);
  const out: Occurrence[] = [];
  for (let n = 1; n <= p.paymentCount; n++) {
    const dueDate = installmentDueDate(p, n);
    let state: Occurrence['state'] = 'scheduled';
    if (n <= p.paidBeforeCount || posted.has(n)) state = 'paid';
    else if (p.skipped.includes(n)) state = 'skipped';
    out.push({ n, dueDate, state, txId: posted.get(n) ?? null });
  }
  return out;
}

export interface PostSpec {
  kind: 'recurring' | 'installment';
  refId: string;
  occurrenceDate: DateStr;
  installmentNo: number | null;
  name: string;
  envelopeId: string;
  amount: number;
  currency: Currency;
  estimate: boolean;
}
/**
 * Auto-posting on open (4.11). Idempotent: `existingKeys` holds `${refId}:${occurrenceDate}` for ALL rows ever
 * posted (including tombstones). Catch-up window 366 days.
 */
export function postingsDue(
  rules: CommitmentRule[],
  plans: InstallmentPlan[],
  existingKeys: Set<string>,
  today: DateStr,
  txns: TxLike[] = [],
): PostSpec[] {
  const out: PostSpec[] = [];
  const from = addDays(today, -CATCHUP_DAYS);
  for (const r of rules) {
    // confirm-mode commitments never post by themselves: they wait for "I paid" (payments.ts)
    if (!r.active || r.deletedAt || !isAuto(r)) continue;
    for (const d of ruleOccurrences(r, from, today)) {
      if (r.skippedDates.includes(d) || existingKeys.has(`${r.id}:${d}`) || (r.autoFrom && d < r.autoFrom) || (r.pausedAt && d >= r.pausedAt)) continue;
      out.push({ kind: 'recurring', refId: r.id, occurrenceDate: d, installmentNo: null, name: r.name, envelopeId: r.envelopeId, amount: r.amount, currency: r.currency, estimate: r.estimate });
    }
  }
  for (const p of plans) {
    if (p.status !== 'active' || p.deletedAt || !isAuto(p)) continue;
    // the schedule comes from what is really left to repay (extra and partial payments move it), see payments.ts
    for (const o of loanStatus(p, txns, today).occurrences) {
      if (o.state !== 'waiting') continue;
      const due = o.dueDate;
      if (due < from || existingKeys.has(`${p.id}:${due}`) || (p.autoFrom && due < p.autoFrom)) continue;
      out.push({ kind: 'installment', refId: p.id, occurrenceDate: due, installmentNo: o.n, name: p.name, envelopeId: p.envelopeId, amount: o.amount, currency: p.currency, estimate: false });
    }
  }
  return out.sort((a, b) => (a.occurrenceDate < b.occurrenceDate ? -1 : 1));
}
/** Plan is done once every occurrence is paid or skipped. */
export function installmentIsDone(p: InstallmentPlan, txns: Pick<Transaction, 'installmentId' | 'installmentNo' | 'deletedAt' | 'id'>[]): boolean {
  return installmentOccurrences(p, txns).every((o) => o.state !== 'scheduled');
}

export interface DueItem { id: string; kind: 'rule' | 'installment'; name: string; envelopeId: string; date: DateStr; amount: number; currency: Currency; no?: number }
/** Commitments due (not yet posted, not skipped) inside [from, to]. */
export function commitmentsDue(rules: CommitmentRule[], plans: InstallmentPlan[], txns: Transaction[], from: DateStr, to: DateStr): DueItem[] {
  const posted = new Set<string>();
  for (const t of txns) if (t.occKey) posted.add(t.occKey);
  const out: DueItem[] = [];
  for (const r of rules) {
    if (!r.active || r.deletedAt) continue;
    for (const d of ruleOccurrences(r, from, to)) {
      if (r.skippedDates.includes(d) || posted.has(`${r.id}:${d}`)) continue;
      out.push({ id: r.id, kind: 'rule', name: r.name, envelopeId: r.envelopeId, date: d, amount: r.amount, currency: r.currency });
    }
  }
  for (const p of plans) {
    if (p.status !== 'active' || p.deletedAt) continue;
    for (const o of loanStatus(p, txns, to).occurrences) {
      if ((o.state !== 'scheduled' && o.state !== 'waiting') || o.dueDate < from || o.dueDate > to) continue;
      out.push({ id: p.id, kind: 'installment', name: p.name, envelopeId: p.envelopeId, date: o.dueDate, amount: o.amount, currency: p.currency, no: o.n ?? undefined });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
