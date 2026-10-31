// Payments panel: pure accounting for bills, one-time payments and loans/installments ("pay as I go").
// No React, no DB, no clock: `today` is always passed in.
//
// Rules decided here (documented in README "Payments panel"):
// * A commitment is in AUTO mode (`autoPost !== false`, the default for data from before v3) or CONFIRM mode.
//   Confirm mode never writes anything by itself: on/after the due date the occurrence is "waiting" until the user
//   says "I paid" (creates a linked expense) or skips it. The money stays reserved in the fixed envelope meanwhile.
// * Loans (kredit) and installments (taksit) are counted from REAL linked payments:
//     total to repay  T = paymentAmount x (paymentCount - waived)
//     paid so far     P = paidBeforeCount x paymentAmount + sum(linked payments, in the loan currency)
//     left to repay   L = max(0, T - P)
//   The remaining schedule is rebuilt from L: every unpaid, unskipped occurrence takes min(paymentAmount, what is still
//   unassigned) in order. So an extra payment shortens the term (same monthly amount, fewer payments, earlier payoff),
//   a partial payment leaves the difference owed (a smaller payment appears at the end), and a skip keeps the amount
//   owed (one more payment at the end).
// * A payment larger than what is left to repay is capped: the part above L is a normal expense (see splitLoanPayment).
// * Interest is informational only and needs the optional principal: with an annual rate, simple monthly amortization
//   over the actual payments (interest_k = round(balance x rate / 1200), the rest repays the balance; extra payments
//   repay the balance only); without a rate, every payment carries the contract share (T - principal) / T as interest.
import type { CommitmentRule, Currency, DateStr, InstallmentPlan, Minor, Transaction } from './types';
import { addDays, addMonthsClamped, parseDate } from './dates';
import { convertCurrency, currencyExponent, pow10 } from './money';
import { ruleOccurrences } from './schedule';

export const PAY_CATCHUP_DAYS = 366;
/** Safety cap for schedules that grow through skips and partial payments. */
const MAX_EXTRA_OCCURRENCES = 240;

export type OccState = 'paid' | 'waiting' | 'scheduled' | 'skipped';
export type PaymentType = 'once' | 'repeating' | 'loan' | 'installment';
export type PaymentRef = 'rule' | 'loan';

export interface PayOcc {
  ref: PaymentRef;
  refId: string;
  /** installment number (loans) or null (rules) */
  n: number | null;
  dueDate: DateStr;
  state: OccState;
  /** paid: the actual amount; otherwise the amount still planned. Plan/rule currency. */
  amount: Minor;
  paidDate: DateStr | null;
  txIds: string[];
  /** paid before the user started using the app (no transaction) */
  before?: boolean;
}

export type TxLike = Pick<Transaction, 'id' | 'type' | 'date' | 'amount' | 'currency' | 'amountBase' | 'deletedAt' | 'status' | 'installmentId' | 'installmentNo' | 'recurringRuleId' | 'occurrenceDate'> &
  Partial<Pick<Transaction, 'note' | 'createdAt'>>;

export interface Money {
  base: Currency;
  rates: Record<string, { rate: string }>;
}
const rateOf = (m: Money | undefined, c: Currency) => (!m || c === m.base ? '1' : m.rates[c]?.rate ?? '1');
export const toBase = (amount: Minor, currency: Currency, m: Money | undefined): Minor =>
  !m || currency === m.base ? amount : convertCurrency(amount, currency, m.base, rateOf(m, currency));

/** A linked transaction expressed in the commitment's own currency (refunds count negative). */
export function amountIn(t: TxLike, currency: Currency, m?: Money): Minor {
  const sign = t.type === 'refund' ? -1 : t.type === 'expense' ? 1 : 0;
  if (t.currency === currency) return sign * t.amount;
  const baseAmt = t.amountBase;
  if (!m || currency === m.base) return sign * baseAmt;
  // base -> commitment currency with the stored rate (base units per 1 foreign unit)
  const r = Number(rateOf(m, currency).replace(',', '.'));
  if (!(r > 0)) return sign * baseAmt;
  return sign * Math.round((baseAmt / r) * pow10(currencyExponent(currency) - currencyExponent(m.base)));
}

const live = (t: TxLike) => !t.deletedAt && t.status !== 'void';

// ------------------------------------------------------------------ loans and installments

export interface LoanInterest {
  method: 'rate' | 'share';
  principal: Minor;
  /** contract interest: T - principal (never negative) */
  interestTotal: Minor;
  principalPaid: Minor;
  interestPaid: Minor;
  principalLeft: Minor;
}
export interface LoanStatus {
  total: Minor;
  paid: Minor;
  paidBeforeAmount: Minor;
  extraPaid: Minor;
  remaining: Minor;
  paymentsLeft: number;
  payoffDate: DateStr | null;
  next: PayOcc | null;
  waiting: PayOcc[];
  done: boolean;
  /** 0..1, share of the total already repaid */
  progress: number;
  occurrences: PayOcc[];
  /** linked payments with no occurrence (extra / early repayment), oldest first */
  extras: { txId: string; date: DateStr; amount: Minor }[];
  interest: LoanInterest | null;
}

export const loanDueDate = (p: Pick<InstallmentPlan, 'firstDueDate'>, n: number): DateStr => addMonthsClamped(p.firstDueDate, n - 1, parseDate(p.firstDueDate).d);
export const loanTotal = (p: Pick<InstallmentPlan, 'paymentAmount' | 'paymentCount' | 'waived'>): Minor =>
  p.paymentAmount * Math.max(0, p.paymentCount - (p.waived?.length ?? 0));

export function loanStatus(p: InstallmentPlan, txns: TxLike[], today: DateStr, m?: Money): LoanStatus {
  const waived = new Set(p.waived ?? []);
  const byNo = new Map<number, { amount: Minor; date: DateStr; ids: string[] }>();
  const extras: LoanStatus['extras'] = [];
  for (const t of txns) {
    if (t.installmentId !== p.id || !live(t)) continue;
    const a = amountIn(t, p.currency, m);
    if (t.installmentNo) {
      const cur = byNo.get(t.installmentNo) ?? { amount: 0, date: t.date, ids: [] };
      cur.amount += a;
      if (t.date > cur.date) cur.date = t.date;
      cur.ids.push(t.id);
      byNo.set(t.installmentNo, cur);
    } else extras.push({ txId: t.id, date: t.date, amount: a });
  }
  extras.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const total = loanTotal(p);
  const before = Math.min(p.paidBeforeCount, p.paymentCount);
  const paidBeforeAmount = before * p.paymentAmount;
  const linkedPaid = [...byNo.values()].reduce((s, x) => s + x.amount, 0);
  const extraPaid = extras.reduce((s, x) => s + x.amount, 0);
  const paid = paidBeforeAmount + linkedPaid + extraPaid;
  const remaining = Math.max(0, total - paid);

  const occurrences: PayOcc[] = [];
  let rest = remaining;
  const lastRecorded = Math.max(0, ...byNo.keys(), ...p.skipped, ...waived);
  const cancelled = p.status === 'cancelled';
  for (let n = 1; n <= p.paymentCount + MAX_EXTRA_OCCURRENCES; n++) {
    if (n > p.paymentCount && n > lastRecorded && rest <= 0) break;
    const dueDate = loanDueDate(p, n);
    const base = { ref: 'loan' as const, refId: p.id, n, dueDate };
    if (n <= before) occurrences.push({ ...base, state: 'paid', amount: p.paymentAmount, paidDate: null, txIds: [], before: true });
    else if (byNo.has(n)) {
      const x = byNo.get(n)!;
      occurrences.push({ ...base, state: 'paid', amount: x.amount, paidDate: x.date, txIds: x.ids });
    } else if (waived.has(n) || p.skipped.includes(n)) {
      occurrences.push({ ...base, state: 'skipped', amount: waived.has(n) ? 0 : Math.min(p.paymentAmount, Math.max(rest, 0)), paidDate: null, txIds: [] });
    } else if (rest > 0 && !cancelled) {
      const amount = Math.min(p.paymentAmount, rest);
      rest -= amount;
      occurrences.push({ ...base, state: dueDate <= today ? 'waiting' : 'scheduled', amount, paidDate: null, txIds: [] });
    }
  }
  const unpaid = occurrences.filter((o) => o.state === 'waiting' || o.state === 'scheduled');
  const lastPaid = [...occurrences].reverse().find((o) => o.state === 'paid' && o.paidDate)?.paidDate ?? extras[extras.length - 1]?.date ?? null;
  return {
    total, paid, paidBeforeAmount, extraPaid, remaining, paymentsLeft: unpaid.length,
    payoffDate: unpaid.length ? unpaid[unpaid.length - 1].dueDate : remaining === 0 ? lastPaid : null,
    next: unpaid[0] ?? null, waiting: unpaid.filter((o) => o.state === 'waiting'), done: remaining === 0,
    progress: total > 0 ? Math.min(1, paid / total) : 1, occurrences, extras,
    interest: loanInterest(p, total, occurrences, extras),
  };
}

/** Interest share, informational. Needs the principal; never blocks anything. */
export function loanInterest(
  p: Pick<InstallmentPlan, 'principal' | 'interestRate'>,
  total: Minor,
  occurrences: PayOcc[],
  extras: { date: DateStr; amount: Minor }[],
): LoanInterest | null {
  const P = p.principal ?? 0;
  if (!(P > 0)) return null;
  const interestTotal = Math.max(0, total - P);
  const payments = [
    ...occurrences.filter((o) => o.state === 'paid').map((o) => ({ date: o.paidDate ?? o.dueDate, amount: o.amount, extra: false, n: o.n ?? 0 })),
    ...extras.map((x) => ({ date: x.date, amount: x.amount, extra: true, n: Infinity })),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.n - b.n));
  const paidSum = payments.reduce((s, x) => s + x.amount, 0);
  const rate = p.interestRate ?? 0;
  if (rate > 0) {
    let balance = P;
    let interestPaid = 0;
    for (const x of payments) {
      const due = x.extra ? 0 : Math.round((balance * rate) / 1200);
      const i = Math.max(0, Math.min(x.amount, due));
      interestPaid += i;
      balance = Math.max(0, balance - (x.amount - i));
    }
    return { method: 'rate', principal: P, interestTotal, interestPaid, principalPaid: paidSum - interestPaid, principalLeft: balance };
  }
  const interestPaid = total > 0 ? Math.round((paidSum * interestTotal) / total) : 0;
  const principalPaid = paidSum - interestPaid;
  return { method: 'share', principal: P, interestTotal, interestPaid, principalPaid, principalLeft: Math.max(0, P - principalPaid) };
}

/** A payment toward a loan never goes beyond what is left to repay; the part above it is a normal expense. */
export function splitLoanPayment(remaining: Minor, amount: Minor): { toLoan: Minor; rest: Minor } {
  const toLoan = Math.max(0, Math.min(amount, remaining));
  return { toLoan, rest: Math.max(0, amount - toLoan) };
}

// ------------------------------------------------------------------ repeating and one-time

export interface RuleStatus {
  occurrences: PayOcc[]; // in window: every past occurrence since `from`, then upcoming up to `to`, oldest first
  waiting: PayOcc[];
  next: PayOcc | null;
  /** live linked payments, newest first */
  history: { txId: string; date: DateStr; dueDate: DateStr | null; amount: Minor; currency: Currency }[];
  paidThisYear: Minor;
  done: boolean; // one-time payment that is paid (or skipped)
}

export interface RuleWindow {
  today: DateStr;
  /** first date the app knows about (first period start): older occurrences are not shown as waiting */
  firstStart: DateStr;
  /** show upcoming occurrences up to here */
  to: DateStr;
}

export function ruleStatus(r: CommitmentRule, txns: TxLike[], w: RuleWindow, m?: Money): RuleStatus {
  const linked = txns.filter((t) => t.recurringRuleId === r.id && live(t));
  const byDate = new Map<DateStr, { amount: Minor; date: DateStr; ids: string[] }>();
  for (const t of linked) {
    if (!t.occurrenceDate) continue;
    const cur = byDate.get(t.occurrenceDate) ?? { amount: 0, date: t.date, ids: [] };
    cur.amount += amountIn(t, r.currency, m);
    if (t.date > cur.date) cur.date = t.date;
    cur.ids.push(t.id);
    byDate.set(t.occurrenceDate, cur);
  }
  const catchFrom = addDays(w.today, -PAY_CATCHUP_DAYS);
  const from = [w.firstStart, catchFrom, r.anchorDate].sort()[2];
  const to = w.to > w.today ? w.to : w.today;
  // the next unpaid one may lie past the window (yearly bills): look further ahead for it
  const ahead = addMonthsClamped(to, 13);
  const dates = new Set<DateStr>(ruleOccurrences(r, r.frequency === 'once' ? r.anchorDate : from, ahead));
  for (const d of byDate.keys()) dates.add(d);
  const sorted = [...dates].sort();
  const paused = !r.active;
  const occAll: PayOcc[] = [];
  for (const d of sorted) {
    const base = { ref: 'rule' as const, refId: r.id, n: null, dueDate: d };
    const paid = byDate.get(d);
    if (paid) occAll.push({ ...base, state: 'paid', amount: paid.amount, paidDate: paid.date, txIds: paid.ids });
    else if (r.skippedDates.includes(d)) occAll.push({ ...base, state: 'skipped', amount: r.amount, paidDate: null, txIds: [] });
    else if (paused || r.deletedAt) continue;
    else if (r.pausedAt && d >= r.pausedAt && d < w.today) continue;
    else if (d < from && r.frequency !== 'once') continue;
    else occAll.push({ ...base, state: d <= w.today ? 'waiting' : 'scheduled', amount: r.amount, paidDate: null, txIds: [] });
  }
  const next = occAll.find((o) => o.state === 'waiting' || o.state === 'scheduled') ?? null;
  const occurrences = occAll.filter((o) => o.dueDate <= to || o === next);
  const history = linked
    .map((t) => ({ txId: t.id, date: t.date, dueDate: t.occurrenceDate, amount: amountIn(t, r.currency, m), currency: r.currency }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const year = w.today.slice(0, 4);
  const paidThisYear = history.filter((h) => h.date.slice(0, 4) === year).reduce((s, h) => s + h.amount, 0);
  const done = r.frequency === 'once' && occAll.length > 0 && occAll.every((o) => o.state === 'paid' || o.state === 'skipped');
  return { occurrences, waiting: occAll.filter((o) => o.state === 'waiting'), next, history, paidThisYear, done };
}

// ------------------------------------------------------------------ the panel

export type PayGroup = 'waiting' | 'period' | 'later' | 'done';
export type RowState = OccState | 'paused' | 'ended';
export interface PaymentSummary {
  ref: PaymentRef;
  id: string;
  name: string;
  payee: string | null;
  type: PaymentType;
  frequency: CommitmentRule['frequency'] | null;
  currency: Currency;
  envelopeId: string;
  autoPost: boolean;
  group: PayGroup;
  state: RowState;
  /** amount and date the row shows: first waiting, else next, else last paid */
  amount: Minor;
  date: DateStr | null;
  waiting: PayOcc[];
  next: PayOcc | null;
  loan: LoanStatus | null;
  rule: RuleStatus | null;
}

export interface OverviewInput extends RuleWindow, Partial<Money> {
  rules: CommitmentRule[];
  plans: InstallmentPlan[];
  txns: TxLike[];
  periodStart: DateStr;
  periodEnd: DateStr;
}
export interface Overview {
  items: PaymentSummary[];
  /** waiting (any date) + scheduled up to the period end, in base currency */
  stillToPay: Minor;
  waitingCount: number;
  next: PayOcc | null;
}

export const isAuto = (x: { autoPost?: boolean }) => x.autoPost !== false;
export const loanType = (p: Pick<InstallmentPlan, 'kind'>): PaymentType => (p.kind === 'loan' ? 'loan' : 'installment');
export const ruleType = (r: Pick<CommitmentRule, 'frequency'>): PaymentType => (r.frequency === 'once' ? 'once' : 'repeating');

const groupFor = (waiting: PayOcc[], next: PayOcc | null, periodEnd: DateStr, finished: boolean): PayGroup =>
  waiting.length ? 'waiting' : finished ? 'done' : next && next.dueDate <= periodEnd ? 'period' : 'later';

export function paymentsOverview(i: OverviewInput): Overview {
  const money: Money | undefined = i.base ? { base: i.base, rates: i.rates ?? {} } : undefined;
  const items: PaymentSummary[] = [];
  let still = 0;
  const unpaidInPeriod = (o: PayOcc) => o.state === 'waiting' || (o.state === 'scheduled' && o.dueDate <= i.periodEnd);
  for (const r of i.rules) {
    if (r.deletedAt) continue;
    const s = ruleStatus(r, i.txns, i, money);
    const last = s.history[0];
    const finished = s.done;
    const shown = s.waiting[0] ?? s.next;
    let state: RowState = shown?.state ?? (last ? 'paid' : 'scheduled');
    if (!r.active && !finished) state = 'paused';
    items.push({
      ref: 'rule', id: r.id, name: r.name, payee: r.payee ?? null, type: ruleType(r), frequency: r.frequency, currency: r.currency,
      envelopeId: r.envelopeId, autoPost: isAuto(r), group: !r.active && !s.waiting.length ? (finished ? 'done' : 'later') : groupFor(s.waiting, s.next, i.periodEnd, finished),
      state, amount: shown?.amount ?? last?.amount ?? r.amount, date: shown?.dueDate ?? last?.date ?? null, waiting: s.waiting, next: s.next, loan: null, rule: s,
    });
    for (const o of s.occurrences) if (unpaidInPeriod(o)) still += toBase(o.amount, r.currency, money);
  }
  for (const p of i.plans) {
    if (p.deletedAt) continue;
    const s = loanStatus(p, i.txns, i.today, money);
    const finished = s.done || p.status !== 'active';
    const shown = s.waiting[0] ?? s.next;
    const state: RowState = p.status === 'cancelled' ? 'ended' : shown?.state ?? 'paid';
    items.push({
      ref: 'loan', id: p.id, name: p.name, payee: p.payee ?? null, type: loanType(p), frequency: null, currency: p.currency, envelopeId: p.envelopeId,
      autoPost: isAuto(p), group: p.status === 'cancelled' ? 'done' : groupFor(s.waiting, s.next, i.periodEnd, finished), state,
      amount: shown?.amount ?? p.paymentAmount, date: shown?.dueDate ?? s.payoffDate, waiting: s.waiting, next: s.next, loan: s, rule: null,
    });
    if (p.status === 'active') for (const o of s.occurrences) if (unpaidInPeriod(o)) still += toBase(o.amount, p.currency, money);
  }
  const order: Record<PayGroup, number> = { waiting: 0, period: 1, later: 2, done: 3 };
  items.sort((a, b) => order[a.group] - order[b.group] || ((a.date ?? '9') < (b.date ?? '9') ? -1 : (a.date ?? '9') > (b.date ?? '9') ? 1 : a.name.localeCompare(b.name)));
  const nexts = items.filter((x) => x.next && x.next.state === 'scheduled' && x.group !== 'done').map((x) => x.next!).sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  return { items, stillToPay: still, waitingCount: items.reduce((s, x) => s + x.waiting.length, 0), next: nexts[0] ?? null };
}

/** Payee suggestions: previous payees, most used first. */
export function payeeSuggestions(rules: Pick<CommitmentRule, 'payee' | 'deletedAt'>[], plans: Pick<InstallmentPlan, 'payee' | 'deletedAt'>[], query = ''): string[] {
  const counts = new Map<string, { label: string; n: number }>();
  for (const x of [...rules, ...plans]) {
    const v = x.payee?.trim();
    if (!v) continue;
    const k = v.toLocaleLowerCase();
    const c = counts.get(k) ?? { label: v, n: 0 };
    c.n++;
    counts.set(k, c);
  }
  const q = query.trim().toLocaleLowerCase();
  return [...counts.entries()]
    .filter(([k]) => !q || (k.includes(q) && k !== q))
    .sort((a, b) => b[1].n - a[1].n || a[1].label.localeCompare(b[1].label))
    .map(([, v]) => v.label);
}

// ------------------------------------------------------------------ plan reservations

export interface Reservation { id: string; kind: 'rule' | 'installment'; name: string; envelopeId: string; date: DateStr; amount: Minor; currency: Currency; no?: number }

/**
 * What a period plan must set aside: every unpaid, unskipped occurrence due in [from, to], plus CONFIRM-mode occurrences
 * that are still waiting from before `from` (so a bill you have not confirmed yet stays reserved in the next period).
 */
export function reservationsFor(rules: CommitmentRule[], plans: InstallmentPlan[], txns: TxLike[], from: DateStr, to: DateStr, firstStart: DateStr, today: DateStr = to, m?: Money): Reservation[] {
  const out: Reservation[] = [];
  for (const r of rules) {
    if (!r.active || r.deletedAt) continue;
    const s = ruleStatus(r, txns, { today: to, firstStart, to }, m);
    for (const o of s.occurrences) {
      if (o.state !== 'waiting' && o.state !== 'scheduled') continue;
      const inRange = o.dueDate >= from && o.dueDate <= to;
      const carried = !isAuto(r) && o.dueDate < from && o.dueDate <= today;
      if (inRange || carried) out.push({ id: r.id, kind: 'rule', name: r.name, envelopeId: r.envelopeId, date: o.dueDate, amount: o.amount, currency: r.currency });
    }
  }
  for (const p of plans) {
    if (p.status !== 'active' || p.deletedAt) continue;
    for (const o of loanStatus(p, txns, to, m).occurrences) {
      if (o.state !== 'waiting' && o.state !== 'scheduled') continue;
      const inRange = o.dueDate >= from && o.dueDate <= to;
      const carried = !isAuto(p) && o.dueDate < from && o.dueDate >= firstStart && o.dueDate <= today;
      if (inRange || carried) out.push({ id: p.id, kind: 'installment', name: p.name, envelopeId: p.envelopeId, date: o.dueDate, amount: o.amount, currency: p.currency, no: o.n ?? undefined });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
