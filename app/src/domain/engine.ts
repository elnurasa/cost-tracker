import type {
  CycleDay, Dataset, DateStr, Envelope, EnvelopeTransfer, Income, IncomeEvent, Minor, Period, RolloverAction, Transaction,
} from './types';
import { addDays, diffDays, inRange, nextBoundaryAfter } from './dates';
import { computeFunding, withBuffer } from './funding';
import { horizon, safeToSpend, type Horizon, type SafeResult } from './safe';
import { sum } from './money';

export interface EnvRow {
  id: string;
  planned: Minor; // alloc (buffer: derived)
  funded: Minor;
  spent: Minor;
  tIn: Minor;
  tOut: Minor;
  rolloverIn: Minor;
  available: Minor;
}
export interface Snapshot {
  periodId: string;
  period: Period;
  pInc: Minor;
  R: Minor;
  alloc: Record<string, Minor>;
  overPlanned: Minor;
  rows: Record<string, EnvRow>;
  funded: Record<string, Minor>;
  available: Record<string, Minor>;
  horizon: Horizon;
  safe: SafeResult;
  reserved: Minor; // funded fixed (bills and installments set aside)
  spentTotal: Minor;
  rolloverTotal: Minor;
  waitingForPayday: boolean;
}

export interface PeriodInput {
  today: DateStr;
  ws: Dataset['workspace'];
  period: Period;
  envelopes: Envelope[];
  incomes: Income[];
  events: IncomeEvent[];
  planned: Record<string, Minor>; // non-buffer plan lines of this period
  transactions: Transaction[];
  transfers: EnvelopeTransfer[];
  rolloverIn: Record<string, Minor>;
}

const countsAsSpend = (t: Transaction) => !t.deletedAt && t.status !== 'void';

/** How many days before its date a pay may arrive and still belong to its own period (E-08). */
export const EARLY_INCOME_DAYS = 10;
/** A pay received a few days before its expected date (salary paid early). */
export const isEarlyIncome = (e: IncomeEvent): boolean =>
  e.status === 'received' && !!e.receivedDate && !!e.expectedDate && e.receivedDate < e.expectedDate && diffDays(e.expectedDate, e.receivedDate) <= EARLY_INCOME_DAYS;
/**
 * The period an income event belongs to: the received date, else the expected date (spec 3, IncomeEvent). Exception
 * (E-08): a scheduled pay that arrives EARLY still belongs to the period of its expected date. Otherwise marking the
 * 5 Nov salary as received on 30 Oct would pour it into the old period, push the next income a month away and drop
 * today's number to 0. The money waits for its own period; today's number does not change.
 */
export function eventPeriodDate(e: IncomeEvent): DateStr | null {
  if (isEarlyIncome(e)) return e.expectedDate;
  return e.status === 'received' ? e.receivedDate : e.expectedDate;
}

export function computeSnapshot(i: PeriodInput): Snapshot {
  const { period, envelopes } = i;
  const inP = (d: DateStr | null) => d !== null && inRange(d, period.startDate, period.endDate);
  const evs = i.events.filter((e) => !e.deletedAt && e.status !== 'skipped' && inP(eventPeriodDate(e)));
  const adHoc = i.transactions.filter((t) => countsAsSpend(t) && t.type === 'income' && !t.incomeEventId && inP(t.date));
  const received = sum(evs.filter((e) => e.status === 'received').map((e) => e.receivedBase ?? 0));
  const expected = sum(evs.filter((e) => e.status === 'expected').map((e) => e.expectedBase));
  const adHocSum = sum(adHoc.map((t) => t.amountBase));
  const R = received + adHocSum;
  const pInc = R + expected;

  const { alloc, overPlanned } = withBuffer(i.planned, envelopes, pInc);
  const funded = computeFunding(R, alloc, envelopes);

  const spent: Record<string, Minor> = {};
  const spentToday: Record<string, Minor> = {};
  for (const e of envelopes) {
    spent[e.id] = 0;
    spentToday[e.id] = 0;
  }
  for (const t of i.transactions) {
    if (!countsAsSpend(t) || !t.envelopeId || !inP(t.date)) continue;
    if (!(t.envelopeId in spent)) continue;
    const s = t.type === 'expense' ? t.amountBase : t.type === 'refund' ? -t.amountBase : 0;
    spent[t.envelopeId] += s;
    if (t.date === i.today) spentToday[t.envelopeId] += s;
  }
  const tIn: Record<string, Minor> = {};
  const tOut: Record<string, Minor> = {};
  for (const e of envelopes) {
    tIn[e.id] = 0;
    tOut[e.id] = 0;
  }
  for (const tr of i.transfers) {
    if (tr.deletedAt || tr.periodId !== period.id) continue;
    if (tr.toEnvelopeId in tIn) tIn[tr.toEnvelopeId] += tr.amount;
    if (tr.fromEnvelopeId in tOut) tOut[tr.fromEnvelopeId] += tr.amount;
  }
  const rows: Record<string, EnvRow> = {};
  const available: Record<string, Minor> = {};
  for (const e of envelopes) {
    const r = i.rolloverIn[e.id] ?? 0;
    const a = r + funded[e.id] + tIn[e.id] - tOut[e.id] - spent[e.id];
    available[e.id] = a;
    rows[e.id] = { id: e.id, planned: alloc[e.id] ?? 0, funded: funded[e.id], spent: spent[e.id], tIn: tIn[e.id], tOut: tOut[e.id], rolloverIn: r, available: a };
  }

  const steadyIds = new Set(i.incomes.filter((x) => x.reliability === 'steady' && x.active && !x.deletedAt).map((x) => x.id));
  // an early-received pay for a later period still marks the end of this one (the horizon stays at its date)
  const steadyExpectedDates = i.events
    .filter((e) => !e.deletedAt && e.expectedDate && steadyIds.has(e.incomeId) && (e.status === 'expected' || (isEarlyIncome(e) && (e.expectedDate as DateStr) > period.endDate)))
    .map((e) => e.expectedDate as DateStr);
  const h = horizon({
    today: i.today, periodEnd: period.endDate, steadyExpectedDates,
    coverUntil: i.ws.coverUntil, lateAssumedArrival: i.ws.lateAssumedArrival,
  });
  const flexIds = new Set(envelopes.filter((e) => e.kind === 'flexible').map((e) => e.id));
  const spentTodayFlex = sum([...flexIds].map((id) => spentToday[id]));
  const safe = safeToSpend({ envelopes, available, R, horizon: h, bridgeBuffer: i.ws.bridgeBuffer, spentTodayFlex });
  const fixed = envelopes.filter((e) => e.kind === 'fixed');
  return {
    periodId: period.id, period, pInc, R, alloc, overPlanned, rows, funded, available, horizon: h, safe,
    reserved: sum(fixed.map((e) => funded[e.id])),
    spentTotal: sum(Object.values(spent)),
    rolloverTotal: sum(Object.values(i.rolloverIn)),
    waitingForPayday: R === 0,
  };
}

export const defaultRolloverFor = (kind: Envelope['kind']): RolloverAction =>
  kind === 'fixed' || kind === 'flexible' ? 'to_buffer' : 'carry';

/** Build hypothetical transfer for previews (does not persist). */
export function hypotheticalTransfer(periodId: string, from: string, to: string, amount: Minor, today: DateStr): EnvelopeTransfer {
  return {
    id: '__preview__', periodId, fromEnvelopeId: from, toEnvelopeId: to, amount, date: today, note: null,
    createdAt: '', updatedAt: '', deletedAt: null, rev: '',
  };
}

export class Engine {
  private memo = new Map<string, Snapshot>();
  readonly periods: Period[];
  constructor(readonly ds: Dataset, readonly today: DateStr, private extraTransfers: EnvelopeTransfer[] = []) {
    this.periods = [...ds.periods].filter((p) => !p.deletedAt).sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
  }
  get buffer(): Envelope | undefined {
    return this.ds.envelopes.find((e) => e.kind === 'buffer');
  }
  currentPeriod(): Period | undefined {
    return this.periods.find((p) => inRange(this.today, p.startDate, p.endDate)) ?? this.periods[this.periods.length - 1];
  }
  rolloverInFor(idx: number): Record<string, Minor> {
    const out: Record<string, Minor> = {};
    const period = this.periods[idx];
    const bufId = this.buffer?.id;
    const add = (id: string | undefined, v: Minor) => {
      if (id) out[id] = (out[id] ?? 0) + v;
    };
    if (idx > 0) {
      const prev = this.periods[idx - 1];
      const decs = this.ds.decisions.filter((d) => d.periodId === prev.id && !d.adjustment && !d.deletedAt);
      if (prev.state === 'closed') {
        for (const d of decs) add(d.action === 'carry' || d.envelopeId === bufId ? d.envelopeId : bufId, d.leftover);
      } else {
        const ps = this.snapshotAt(idx - 1);
        for (const e of this.ds.envelopes) {
          const left = ps.available[e.id] ?? 0;
          if (left === 0) continue;
          const action = e.kind === 'buffer' ? 'carry' : decs.find((d) => d.envelopeId === e.id)?.action ?? e.rolloverRule;
          add(action === 'carry' ? e.id : bufId, left);
        }
      }
    }
    for (const d of this.ds.decisions) {
      if (d.adjustment && !d.deletedAt && d.appliedPeriodId === period.id) add(bufId, d.leftover);
    }
    return out;
  }
  snapshotAt(idx: number): Snapshot {
    const period = this.periods[idx];
    const key = period.id;
    const hit = this.memo.get(key);
    if (hit) return hit;
    const planned: Record<string, Minor> = {};
    for (const l of this.ds.planLines) if (l.periodId === period.id && !l.deletedAt) planned[l.envelopeId] = l.amount;
    const snap = computeSnapshot({
      today: this.today, ws: this.ds.workspace, period, envelopes: this.ds.envelopes, incomes: this.ds.incomes,
      events: this.ds.events, planned, transactions: this.ds.transactions,
      transfers: [...this.ds.transfers, ...this.extraTransfers], rolloverIn: this.rolloverInFor(idx),
    });
    this.memo.set(key, snap);
    return snap;
  }
  snapshotFor(periodId: string): Snapshot | undefined {
    const idx = this.periods.findIndex((p) => p.id === periodId);
    return idx < 0 ? undefined : this.snapshotAt(idx);
  }
  current(): Snapshot | undefined {
    const p = this.currentPeriod();
    return p ? this.snapshotFor(p.id) : undefined;
  }
  /** Provisional leftover per envelope for a non-closed period. */
  leftovers(periodId: string): { envelopeId: string; leftover: Minor; action: RolloverAction }[] {
    const idx = this.periods.findIndex((p) => p.id === periodId);
    const s = this.snapshotAt(idx);
    const decs = this.ds.decisions.filter((d) => d.periodId === periodId && !d.adjustment && !d.deletedAt);
    return this.ds.envelopes
      .filter((e) => !e.archived || (s.available[e.id] ?? 0) !== 0)
      .map((e) => ({
        envelopeId: e.id,
        leftover: s.available[e.id] ?? 0,
        action: e.kind === 'buffer' ? ('carry' as const) : decs.find((d) => d.envelopeId === e.id)?.action ?? e.rolloverRule,
      }));
  }
}

// ----- period lifecycle (4.9) -----

export interface PeriodPlan {
  create: { startDate: DateStr; endDate: DateStr }[];
  closing: string[]; // ids of open periods that ended before today
}
export function planPeriods(periods: Period[], cycleStartDay: CycleDay, today: DateStr): PeriodPlan {
  const sorted = [...periods].filter((p) => !p.deletedAt).sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
  const create: PeriodPlan['create'] = [];
  const closing: string[] = [];
  if (sorted.length === 0) return { create, closing };
  let lastEnd = sorted[sorted.length - 1].endDate;
  while (lastEnd < today) {
    const startDate = addDays(lastEnd, 1);
    const endDate = addDays(nextBoundaryAfter(startDate, cycleStartDay), -1);
    create.push({ startDate, endDate });
    lastEnd = endDate;
  }
  for (const p of sorted) if (p.state === 'open' && p.endDate < today) closing.push(p.id);
  return { create, closing };
}
/** Closing periods whose successor started >= 7 days ago auto-confirm with defaults. */
export function autoConfirmIds(periods: Period[], today: DateStr): string[] {
  const sorted = [...periods].filter((p) => !p.deletedAt).sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
  const out: string[] = [];
  sorted.forEach((p, i) => {
    const next = sorted[i + 1];
    if (p.state === 'closing' && next && today >= addDays(next.startDate, 7)) out.push(p.id);
  });
  return out;
}
/** Delta applied to the current period's Buffer when a transaction inside a closed period changes (4.10). */
export function lateEditDelta(oldTx: Transaction | null, newTx: Transaction | null): Minor {
  const eff = (t: Transaction | null) => (!t || t.deletedAt || t.status === 'void' ? 0 : t.type === 'expense' ? -t.amountBase : t.type === 'refund' ? t.amountBase : t.amountBase);
  return eff(newTx) - eff(oldTx);
}
