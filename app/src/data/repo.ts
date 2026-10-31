import { db, DATA_TABLES } from './db';
import { nextRev, nowIso, uuidv7 } from './ids';
import {
  Engine, addDays, autoConfirmIds, buildPeriodPlan, convertCurrency, currencyExponent, defaultRolloverFor, eventsToCreate,
  firstPeriod, incomeSpecs, isValidRate, loanStatus, reservationsFor, ruleOccurrences, splitLoanPayment, lateEditDelta, monthlyFigure, cycleDayFor, planPeriods, postingsDue,
  onlyUncertain, scaleAmounts, staleEventIds, suggestMoneyNow, templateAmounts, templateFor, todayLocal,
} from '../domain';
import type {
  Base, CommitmentRule, Currency, CycleDay, Dataset, DateStr, Envelope, EnvelopeKind, EnvelopeTransfer, Income, IncomeEvent,
  InstallmentPlan, Locale, Minor, Period, PlanLine, Region, RolloverDecision, Transaction, TxSource, TxType, Workspace,
} from '../domain';
import type { OnboardInput } from '../domain';
import { getDeviceId } from './device';
import { TEMPLATE_CATEGORY, inferCategoryKey, isCategoryKey, type CategoryKey } from '../domain/categories';
import { translate } from '../i18n';

/** Backup / data-model version. 2 = Payments panel (payee, loan kind, auto/confirm). 3 = envelope categoryKey (payment categories). */
export const SCHEMA_VERSION = 3;

export function stamp<T extends object>(o: T): T & Base {
  const t = nowIso();
  return { id: uuidv7(), createdAt: t, updatedAt: t, deletedAt: null, rev: nextRev(getDeviceId()), ...o } as T & Base;
}
const touch = <T extends Base>(o: T): T => ({ ...o, updatedAt: nowIso(), rev: nextRev(getDeviceId()) });

// ---------------------------------------------------------------- load

export interface AppData {
  ws: Workspace;
  ds: Dataset;
  rules: CommitmentRule[];
  installments: InstallmentPlan[];
  allTx: Transaction[]; // including tombstones
}

export async function loadAll(): Promise<AppData | null> {
  const [ws] = await db.workspaces.toArray();
  if (!ws) return null;
  const [envelopes, incomes, events, periods, planLines, allTx, rules, installments, transfers, decisions] = await Promise.all([
    db.envelopes.toArray(), db.incomes.toArray(), db.incomeEvents.toArray(), db.periods.toArray(), db.planLines.toArray(),
    db.transactions.toArray(), db.rules.toArray(), db.installments.toArray(), db.transfers.toArray(), db.decisions.toArray(),
  ]);
  const live = <T extends { deletedAt: string | null }>(xs: T[]) => xs.filter((x) => !x.deletedAt);
  const ds: Dataset = {
    workspace: { baseCurrency: ws.baseCurrency, bridgeBuffer: ws.bridgeBuffer, coverUntil: ws.coverUntil, lateAssumedArrival: ws.lateAssumedArrival, cycleStartDay: ws.cycleStartDay },
    envelopes: live(envelopes).sort((a, b) => a.order - b.order),
    incomes: live(incomes), events: live(events), periods: live(periods).sort((a, b) => (a.startDate < b.startDate ? -1 : 1)),
    planLines: live(planLines), transactions: live(allTx), transfers: live(transfers), decisions: live(decisions),
  };
  return { ws, ds, rules: live(rules), installments: live(installments), allTx };
}

const ALL = () => [db.workspaces, db.envelopes, db.incomes, db.incomeEvents, db.periods, db.planLines, db.transactions, db.rules, db.installments, db.transfers, db.decisions];

// ---------------------------------------------------------------- helpers

function periodOf(periods: Period[], date: DateStr): Period | undefined {
  return periods.find((p) => date >= p.startDate && date <= p.endDate);
}
async function currentWs(): Promise<Workspace> {
  const [ws] = await db.workspaces.toArray();
  if (!ws) throw new Error('no workspace');
  return ws;
}
export async function updateWorkspace(patch: Partial<Workspace>) {
  const ws = await currentWs();
  await db.workspaces.put(touch({ ...ws, ...patch }));
}
async function saveRate(currency: Currency, rate: string) {
  const ws = await currentWs();
  if (ws.baseCurrency === currency) return;
  await db.workspaces.put(touch({ ...ws, rates: { ...ws.rates, [currency]: { rate, updatedAt: nowIso() } } }));
}

// ---------------------------------------------------------------- onboarding

export interface OnboardingPayload {
  input: OnboardInput;
  locale: Locale;
  region: Region;
  currency: Currency;
  moneyNow: Minor;
  names: { envelope: Record<string, string>; income: Record<string, string>; starting: string; workspace: string };
  amounts?: Record<string, Minor>; // user-edited template rows (by template key); full-income amounts
  empty?: boolean;
}

/** Creates the whole workspace atomically. */
export async function completeOnboarding(p: OnboardingPayload): Promise<void> {
  const { input } = p;
  const exp = currencyExponent(p.currency);
  const cycle: CycleDay = cycleDayFor(input);
  const monthly = monthlyFigure(input);
  const mn = suggestMoneyNow(input);
  const justPaidAccepted = mn.justPaid && p.moneyNow === mn.prefill;
  const fp = firstPeriod(input, justPaidAccepted);
  await db.transaction('rw', ALL(), async () => {
    const wsId = uuidv7();
    const tpl = templateFor(p.region);
    // envelopes
    const envs: Envelope[] = [];
    const keyToId: Record<string, string> = {};
    let order = 0;
    const mkEnv = (key: string, kind: EnvelopeKind, icon: string) => {
      const e = stamp<Omit<Envelope, keyof Base>>({
        workspaceId: wsId, name: p.names.envelope[key] ?? key, icon, kind, order: order++, archived: false, rolloverRule: defaultRolloverFor(kind),
        categoryKey: TEMPLATE_CATEGORY[key] ?? null,
      }) as Envelope;
      envs.push(e);
      keyToId[key] = e.id;
    };
    if (p.empty) {
      mkEnv('food', 'flexible', 'shopping-basket');
      mkEnv('pocket', 'pocket', 'hand-coins');
    } else for (const it of tpl) mkEnv(it.key, it.kind, it.icon);
    mkEnv('buffer', 'buffer', 'shield');
    const fullAmounts = p.empty ? {} : { ...templateAmounts(tpl, monthly, exp), ...(p.amounts ?? {}) };
    const master: Record<string, Minor> = {};
    for (const [k, v] of Object.entries(fullAmounts)) if (keyToId[k]) master[keyToId[k]] = v;
    const ws = stamp<Omit<Workspace, keyof Base>>({
      name: p.names.workspace, baseCurrency: p.currency, locale: p.locale, cycleStartDay: cycle, bridgeBuffer: true, rates: {},
      coverUntil: onlyUncertain(input) ? addDays(input.today, 30) : null, masterPlan: master, lateAssumedArrival: null,
      schemaVersion: SCHEMA_VERSION, region: p.region,
    }) as Workspace;
    await db.workspaces.add(ws);
    await db.envelopes.bulkAdd(envs);
    // periods
    const period = stamp<Omit<Period, keyof Base>>({
      workspaceId: wsId, startDate: fp.startDate, endDate: fp.endDate, state: 'open', closedAt: null, scaledFirstPeriod: fp.scaled,
    }) as Period;
    await db.periods.add(period);
    // incomes + events
    const specs = incomeSpecs(input);
    const incomes: Income[] = specs.map((s) =>
      stamp<Omit<Income, keyof Base>>({
        workspaceId: wsId, name: s.name ?? p.names.income[s.nameKey] ?? s.nameKey, kind: s.kind, reliability: s.reliability, isAnchor: s.isAnchor,
        schedule: s.schedule, expectedAmount: s.amount, currency: p.currency, active: true,
      }) as Income,
    );
    await db.incomes.bulkAdd(incomes);
    const today = input.today;
    const evs = eventsToCreate(incomes, [], today, p.currency, {});
    const txs: Transaction[] = [];
    const mkTx = (amount: Minor, date: DateStr, evId: string | null): Transaction =>
      stamp<Omit<Transaction, keyof Base>>({
        workspaceId: wsId, type: 'income', date, time: null, amount, currency: p.currency, rate: '1', amountBase: amount, envelopeId: null,
        incomeEventId: evId, merchant: null, note: null, source: 'manual', sourceRef: null, recurringRuleId: null, installmentId: null,
        installmentNo: null, occurrenceDate: null, status: 'posted', deviceId: getDeviceId(),
      }) as Transaction;
    const events: IncomeEvent[] = evs.map((e) => {
      const isPast = e.expectedDate <= today;
      const paidNow = justPaidAccepted && mn.lastPayDate === e.expectedDate && isPast;
      const ev = stamp<Omit<IncomeEvent, keyof Base>>({
        incomeId: e.incomeId, expectedDate: e.expectedDate, expectedAmount: e.expectedAmount, expectedBase: e.expectedBase, currency: e.currency,
        status: paidNow ? 'received' : isPast ? 'skipped' : 'expected', receivedDate: paidNow ? e.expectedDate : null,
        receivedAmount: paidNow ? e.expectedAmount : null, rate: '1', receivedBase: paidNow ? e.expectedBase : null, transactionId: null,
      }) as IncomeEvent;
      if (paidNow) {
        const t = mkTx(e.expectedAmount, e.expectedDate, ev.id);
        ev.transactionId = t.id;
        txs.push(t);
      }
      return ev;
    });
    // "Starting amount" for a partial first period
    if (fp.startingAmount && p.moneyNow > 0) {
      const inc = stamp<Omit<Income, keyof Base>>({
        workspaceId: wsId, name: p.names.starting, kind: 'other', reliability: 'uncertain', isAnchor: false, schedule: { type: 'none' },
        expectedAmount: p.moneyNow, currency: p.currency, active: false,
      }) as Income;
      await db.incomes.add(inc);
      const ev = stamp<Omit<IncomeEvent, keyof Base>>({
        incomeId: inc.id, expectedDate: null, expectedAmount: p.moneyNow, expectedBase: p.moneyNow, currency: p.currency, status: 'received',
        receivedDate: today, receivedAmount: p.moneyNow, rate: '1', receivedBase: p.moneyNow, transactionId: null,
      }) as IncomeEvent;
      const t = mkTx(p.moneyNow, today, ev.id);
      ev.transactionId = t.id;
      events.push(ev);
      txs.push(t);
    }
    await db.incomeEvents.bulkAdd(events);
    if (txs.length) await db.transactions.bulkAdd(txs);
    // plan lines (first period possibly scaled)
    let lines: Record<string, Minor> = { ...master };
    if (fp.scaled) {
      const scaled = scaleAmounts(fullAmounts, p.moneyNow, monthly);
      lines = {};
      for (const [k, v] of Object.entries(scaled)) if (keyToId[k]) lines[keyToId[k]] = v;
    }
    const pls: PlanLine[] = Object.entries(lines).map(([envelopeId, amount]) =>
      stamp<Omit<PlanLine, keyof Base>>({ periodId: period.id, envelopeId, amount }) as PlanLine,
    );
    if (pls.length) await db.planLines.bulkAdd(pls);
  });
}

// ---------------------------------------------------------------- maintenance (run on open/resume/midnight)

export async function runMaintenance(today: DateStr = todayLocal()): Promise<void> {
  const first = await loadAll();
  if (!first) return;
  await db.transaction('rw', [...ALL()], async () => {
    const d = (await loadAll())!;
    const { ws } = d;
    // 1. periods
    const plan = planPeriods(d.ds.periods, ws.cycleStartDay, today);
    const periods = [...d.ds.periods];
    const money = { base: ws.baseCurrency, rates: ws.rates };
    const knownStart = periods.reduce((m, p) => (p.startDate < m ? p.startDate : m), '9999-12-31');
    for (const id of plan.closing) {
      const p = periods.find((x) => x.id === id)!;
      await db.periods.put(touch({ ...p, state: 'closing' }));
    }
    for (const c of plan.create) {
      const closing = c.endDate < today;
      const np = stamp<Omit<Period, keyof Base>>({
        workspaceId: ws.id, startDate: c.startDate, endDate: c.endDate, state: closing ? 'closing' : 'open', closedAt: null, scaledFirstPeriod: false,
      }) as Period;
      await db.periods.add(np);
      periods.push(np);
      // bills and loan payments due in the period, plus confirm-mode payments still waiting from before it (payments.ts)
      const due = reservationsFor(d.rules, d.installments, d.ds.transactions, c.startDate, c.endDate, knownStart, today, money);
      const byEnv: Record<string, Minor> = {};
      for (const it of due) byEnv[it.envelopeId] = (byEnv[it.envelopeId] ?? 0) + convertCurrency(it.amount, it.currency, ws.baseCurrency, ws.rates[it.currency]?.rate ?? '1');
      const alloc = buildPeriodPlan(ws.masterPlan, d.ds.envelopes, byEnv);
      const lines = Object.entries(alloc).map(([envelopeId, amount]) => stamp<Omit<PlanLine, keyof Base>>({ periodId: np.id, envelopeId, amount }) as PlanLine);
      if (lines.length) await db.planLines.bulkAdd(lines);
    }
    // 2. income events
    const allEvents = await db.incomeEvents.toArray();
    const newEv = eventsToCreate(d.ds.incomes, allEvents, today, ws.baseCurrency, ws.rates);
    if (newEv.length) {
      await db.incomeEvents.bulkAdd(
        newEv.map((e) =>
          stamp<Omit<IncomeEvent, keyof Base>>({
            incomeId: e.incomeId, expectedDate: e.expectedDate, expectedAmount: e.expectedAmount, expectedBase: e.expectedBase, currency: e.currency,
            status: 'expected', receivedDate: null, receivedAmount: null, rate: e.rate, receivedBase: null, transactionId: null,
          }) as IncomeEvent,
        ),
      );
    }
    for (const id of staleEventIds(d.ds.events, today)) {
      const ev = await db.incomeEvents.get(id);
      if (ev) await db.incomeEvents.put(touch({ ...ev, status: 'skipped' }));
    }
    // 3. recurring + installments
    const firstStart = periods.reduce((m, p) => (p.startDate < m ? p.startDate : m), '9999-12-31');
    const keys = new Set<string>();
    for (const t of d.allTx) if (t.occKey) keys.add(t.occKey);
    const due = postingsDue(d.rules, d.installments, keys, today, d.ds.transactions).filter((x) => x.occurrenceDate >= firstStart);
    const posted: Transaction[] = [];
    for (const x of due) {
      const rate = x.currency === ws.baseCurrency ? '1' : ws.rates[x.currency]?.rate ?? '1';
      posted.push(
        stamp<Omit<Transaction, keyof Base>>({
          workspaceId: ws.id, type: 'expense', date: x.occurrenceDate, time: null, amount: x.amount, currency: x.currency, rate,
          amountBase: convertCurrency(x.amount, x.currency, ws.baseCurrency, rate), envelopeId: x.envelopeId, incomeEventId: null,
          merchant: null, note: x.name, source: x.kind === 'recurring' ? 'recurring' : 'installment', sourceRef: null,
          recurringRuleId: x.kind === 'recurring' ? x.refId : null, installmentId: x.kind === 'installment' ? x.refId : null,
          installmentNo: x.installmentNo, occurrenceDate: x.occurrenceDate, occKey: `${x.refId}:${x.occurrenceDate}`,
          status: x.estimate ? 'pending' : 'posted', deviceId: getDeviceId(),
        }) as Transaction,
      );
    }
    if (posted.length) await db.transactions.bulkAdd(posted);
    for (const p of d.installments) {
      if (p.status === 'active' && loanStatus(p, [...d.ds.transactions, ...posted], today, money).done) await db.installments.put(touch({ ...p, status: 'done' }));
    }
    // 4. purge old tombstones (never occurrence tombstones: they keep posting idempotent)
    const cutoff = addDays(today, -30);
    for (const t of d.allTx) if (t.deletedAt && !t.occKey && t.deletedAt.slice(0, 10) < cutoff) await db.transactions.delete(t.id);
  });
  // auto-confirm period reviews after 7 days
  const d2 = await loadAll();
  if (!d2) return;
  for (const id of autoConfirmIds(d2.ds.periods, today)) await confirmPeriod(id, today);
}

// ---------------------------------------------------------------- transactions

export interface TxInput {
  type: TxType;
  date: DateStr;
  amount: Minor;
  currency: Currency;
  rate?: string;
  envelopeId: string | null;
  note?: string | null;
  merchant?: string | null;
  incomeEventId?: string | null;
  source?: TxSource;
  sourceRef?: string | null;
  payment?: 'cash' | 'card' | 'other' | null;
  status?: Transaction['status'];
}

/** What a single write needs: the workspace, envelopes and periods. Skips the (potentially 5,000+) transactions. */
interface Core {
  ws: Workspace;
  ds: { envelopes: Envelope[]; periods: Period[] };
}
async function loadCore(): Promise<Core> {
  const [ws] = await db.workspaces.toArray();
  if (!ws) throw new Error('no workspace');
  const [envelopes, periods] = await Promise.all([db.envelopes.toArray(), db.periods.toArray()]);
  const live = <T extends { deletedAt: string | null }>(xs: T[]) => xs.filter((x) => !x.deletedAt);
  return { ws, ds: { envelopes: live(envelopes), periods: live(periods).sort((a, b) => (a.startDate < b.startDate ? -1 : 1)) } };
}

async function lateAdjust(d: Core, oldTx: Transaction | null, newTx: Transaction | null, today: DateStr) {
  const cur = periodOf(d.ds.periods, today) ?? d.ds.periods[d.ds.periods.length - 1];
  const buffer = d.ds.envelopes.find((e) => e.kind === 'buffer');
  if (!cur || !buffer) return;
  const op = oldTx ? periodOf(d.ds.periods, oldTx.date) : undefined;
  const np = newTx ? periodOf(d.ds.periods, newTx.date) : undefined;
  const parts: { o: Transaction | null; n: Transaction | null; p: Period }[] = [];
  if (op && np && op.id === np.id) parts.push({ o: oldTx, n: newTx, p: op });
  else {
    if (oldTx && op) parts.push({ o: oldTx, n: null, p: op });
    if (newTx && np) parts.push({ o: null, n: newTx, p: np });
  }
  for (const { o, n, p } of parts) {
    if (p.state !== 'closed') continue;
    const delta = lateEditDelta(o, n);
    if (delta === 0) continue;
    await db.decisions.add(
      stamp<Omit<RolloverDecision, keyof Base>>({
        periodId: p.id, envelopeId: buffer.id, leftover: delta, action: 'carry', confirmedAt: nowIso(), adjustment: true,
        appliedPeriodId: cur.id, note: 'late edit',
      }) as RolloverDecision,
    );
  }
}

function buildTx(ws: Workspace, i: TxInput): Transaction {
  const foreign = i.currency !== ws.baseCurrency;
  const rate = foreign ? (i.rate ?? ws.rates[i.currency]?.rate ?? '') : '1';
  if (foreign && !isValidRate(rate)) throw new Error('rate-required');
  const sourceRef = i.sourceRef ?? null;
  const source = i.source ?? 'manual';
  return stamp<Omit<Transaction, keyof Base>>({
    workspaceId: ws.id, type: i.type, date: i.date, time: null, amount: i.amount, currency: i.currency, rate,
    amountBase: foreign ? convertCurrency(i.amount, i.currency, ws.baseCurrency, rate) : i.amount, envelopeId: i.type === 'income' ? null : i.envelopeId,
    incomeEventId: i.incomeEventId ?? null, merchant: i.merchant ?? null, note: i.note ?? null, source, sourceRef,
    dedupeKey: sourceRef ? `${source}:${sourceRef}` : null, recurringRuleId: null, installmentId: null, installmentNo: null, occurrenceDate: null,
    status: i.status ?? 'posted', deviceId: getDeviceId(), payment: i.payment ?? null,
  }) as Transaction;
}

/** `onBuilt` runs with the finished row just before it is written, so the UI can show it at once (optimistic); a failed write rejects and the caller rolls the optimistic copy back. */
export async function addTransaction(i: TxInput, today: DateStr = todayLocal(), onBuilt?: (t: Transaction) => void): Promise<Transaction> {
  if (i.amount <= 0) throw new Error('amount');
  if (i.date > today) throw new Error('future');
  let out!: Transaction;
  await db.transaction('rw', ALL(), async () => {
    const d = await loadCore(); // not loadAll(): adding one entry must not re-read every transaction (AC-PWA-05, save-to-UI <= 100 ms)
    const t = buildTx(d.ws, i);
    if (t.dedupeKey && (await db.transactions.where('dedupeKey').equals(t.dedupeKey).count()) > 0) throw new Error('duplicate');
    onBuilt?.(t);
    await db.transactions.add(t);
    if (t.currency !== d.ws.baseCurrency) await saveRate(t.currency, t.rate);
    await lateAdjust(d, null, t, today);
    out = t;
  });
  return out;
}

export async function updateTransaction(id: string, patch: Partial<TxInput> & { deletedAt?: string | null }, today: DateStr = todayLocal()): Promise<void> {
  await db.transaction('rw', ALL(), async () => {
    const d = await loadCore();
    const old = await db.transactions.get(id);
    if (!old) return;
    let next: Transaction = { ...old };
    const { deletedAt, ...rest } = patch;
    if (Object.keys(rest).length) {
      const merged: TxInput = {
        type: old.type, date: old.date, amount: old.amount, currency: old.currency, rate: old.rate, envelopeId: old.envelopeId, note: old.note,
        merchant: old.merchant, payment: old.payment ?? null, ...rest,
      };
      if (merged.date > today) throw new Error('future');
      const b = buildTx(d.ws, merged);
      next = { ...old, type: b.type, date: b.date, amount: b.amount, currency: b.currency, rate: b.rate, amountBase: b.amountBase, envelopeId: b.envelopeId, note: b.note, merchant: b.merchant, payment: b.payment };
      if (b.currency !== d.ws.baseCurrency) await saveRate(b.currency, b.rate);
    }
    if (deletedAt !== undefined) next.deletedAt = deletedAt;
    next = touch(next);
    await db.transactions.put(next);
    await lateAdjust(d, old, next, today);
    if (old.incomeEventId) {
      const ev = await db.incomeEvents.get(old.incomeEventId);
      if (ev) {
        if (next.deletedAt) await db.incomeEvents.put(touch({ ...ev, status: 'expected', receivedDate: null, receivedAmount: null, receivedBase: null, transactionId: null }));
        else await db.incomeEvents.put(touch({ ...ev, status: 'received', receivedDate: next.date, receivedAmount: next.amount, currency: next.currency, rate: next.rate, receivedBase: next.amountBase, transactionId: next.id }));
      }
    }
  });
}
export const deleteTransaction = (id: string, today?: DateStr) => updateTransaction(id, { deletedAt: nowIso() }, today);
export const restoreTransaction = (id: string, today?: DateStr) => updateTransaction(id, { deletedAt: null }, today);
export async function confirmPending(id: string) {
  const t = await db.transactions.get(id);
  if (t) await db.transactions.put(touch({ ...t, status: 'posted' }));
}

// ---------------------------------------------------------------- income

export async function receiveIncome(eventId: string, o: { amount: Minor; currency: Currency; rate?: string; date: DateStr }): Promise<{ uncertain: boolean }> {
  let uncertain = false;
  await db.transaction('rw', ALL(), async () => {
    const d = (await loadAll())!;
    const ev = await db.incomeEvents.get(eventId);
    if (!ev) return;
    // idempotent: a double tap, or the same card open in two tabs, must not count the pay twice
    if (ev.status === 'received' && ev.transactionId && (await db.transactions.get(ev.transactionId))?.deletedAt === null) return;
    const inc = d.ds.incomes.find((x) => x.id === ev.incomeId);
    uncertain = inc?.reliability === 'uncertain';
    const t = buildTx(d.ws, { type: 'income', date: o.date, amount: o.amount, currency: o.currency, rate: o.rate, envelopeId: null, incomeEventId: eventId });
    await db.transactions.add(t);
    if (t.currency !== d.ws.baseCurrency) await saveRate(t.currency, t.rate);
    await db.incomeEvents.put(touch({ ...ev, status: 'received', receivedDate: o.date, receivedAmount: o.amount, currency: o.currency, rate: t.rate, receivedBase: t.amountBase, transactionId: t.id }));
    if (d.ws.lateAssumedArrival) await updateWorkspace({ lateAssumedArrival: null });
  });
  return { uncertain };
}
export async function undoReceive(eventId: string) {
  await db.transaction('rw', ALL(), async () => {
    const ev = await db.incomeEvents.get(eventId);
    if (!ev) return;
    if (ev.transactionId) {
      const t = await db.transactions.get(ev.transactionId);
      if (t) await db.transactions.put(touch({ ...t, deletedAt: nowIso() }));
    }
    await db.incomeEvents.put(touch({ ...ev, status: 'expected', receivedDate: null, receivedAmount: null, receivedBase: null, transactionId: null }));
  });
}
export async function skipIncomeEvent(eventId: string) {
  const ev = await db.incomeEvents.get(eventId);
  if (ev) await db.incomeEvents.put(touch({ ...ev, status: 'skipped' }));
}
export async function setCoverUntil(date: DateStr | null) {
  await updateWorkspace({ coverUntil: date });
}
export async function setLateAssumed(date: DateStr | null) {
  await updateWorkspace({ lateAssumedArrival: date });
}
/** Rename only (language switch translates app-made names, E-20). */
export async function renameIncome(id: string, name: string) {
  const i = await db.incomes.get(id);
  if (i && i.name !== name) await db.incomes.put(touch({ ...i, name }));
}
export async function saveIncome(i: Partial<Income> & { id?: string }, today: DateStr = todayLocal()) {
  await db.transaction('rw', ALL(), async () => {
    const ws = await currentWs();
    if (i.id) {
      const old = await db.incomes.get(i.id);
      if (!old) return;
      const next = touch({ ...old, ...i } as Income);
      await db.incomes.put(next);
      // regenerate future expected events when the schedule changed
      const evs = await db.incomeEvents.where('incomeId').equals(old.id).toArray();
      for (const e of evs) if (e.status === 'expected' && e.expectedDate && e.expectedDate >= today) await db.incomeEvents.delete(e.id);
    } else {
      await db.incomes.add(stamp<Omit<Income, keyof Base>>({
        workspaceId: ws.id, name: translate(ws.locale, 'income.other'), kind: 'other', reliability: 'steady', isAnchor: false, schedule: { type: 'none' }, expectedAmount: 0,
        currency: ws.baseCurrency, active: true, ...i,
      }) as Income);
    }
  });
  await runMaintenance(today);
}

// ---------------------------------------------------------------- envelopes and plan

export interface EnsuredEnvelope {
  envelope: Envelope;
  /** a new row was written */
  created: boolean;
  /** an archived envelope with the same category came back instead of a duplicate */
  unarchived: boolean;
}
/**
 * Creates an envelope, never a duplicate category: with a `categoryKey` that a live envelope already has, that envelope is
 * returned (an archived one is brought back). A fixed envelope without a key gets the inferred one when it is still free
 * ("Kommunal" -> utilities). `categoryKey: null` means "no category".
 */
export async function ensureEnvelope(o: { name: string; icon: string; kind: EnvelopeKind; categoryKey?: CategoryKey | null }): Promise<EnsuredEnvelope> {
  let out!: EnsuredEnvelope;
  await db.transaction('rw', [db.workspaces, db.envelopes], async () => {
    const ws = await currentWs();
    const all = (await db.envelopes.toArray()).filter((x) => !x.deletedAt);
    let key: CategoryKey | null = o.categoryKey === undefined ? inferCategoryKey(o) : o.categoryKey;
    if (key) {
      const same = all.find((x) => x.categoryKey === key);
      if (same && o.categoryKey !== undefined) {
        // asked for this category explicitly: reuse it
        if (same.archived) {
          const back = touch({ ...same, archived: false });
          await db.envelopes.put(back);
          out = { envelope: back, created: false, unarchived: true };
        } else out = { envelope: same, created: false, unarchived: false };
        return;
      }
      if (same) key = null; // only inferred from the name: a second envelope is fine, it just does not get the key
    }
    const e = stamp<Omit<Envelope, keyof Base>>({
      workspaceId: ws.id, name: o.name, icon: o.icon, kind: o.kind, order: Math.max(0, ...all.map((x) => x.order)) + 1, archived: false,
      rolloverRule: defaultRolloverFor(o.kind), categoryKey: isCategoryKey(key) ? key : null,
    }) as Envelope;
    await db.envelopes.add(e);
    out = { envelope: e, created: true, unarchived: false };
  });
  return out;
}
export async function createEnvelope(o: { name: string; icon: string; kind: EnvelopeKind; categoryKey?: CategoryKey | null }): Promise<Envelope> {
  return (await ensureEnvelope(o)).envelope;
}

/** The current plan lines of a period and the master plan, so a save can be undone exactly (inline envelope creation). */
export interface PlanSnapshot { periodId: string; lines: Record<string, Minor>; master: Record<string, Minor> }
export async function capturePlan(periodId: string): Promise<PlanSnapshot> {
  const ws = await currentWs();
  const lines: Record<string, Minor> = {};
  for (const l of await db.planLines.where('periodId').equals(periodId).toArray()) if (!l.deletedAt) lines[l.envelopeId] = l.amount;
  return { periodId, lines, master: { ...ws.masterPlan } };
}
async function restorePlan(s: PlanSnapshot) {
  for (const l of await db.planLines.where('periodId').equals(s.periodId).toArray()) {
    if (l.deletedAt) continue;
    const want = s.lines[l.envelopeId] ?? 0;
    if (l.amount !== want) await db.planLines.put(touch({ ...l, amount: want }));
  }
  const ws = await currentWs();
  await db.workspaces.put(touch({ ...ws, masterPlan: { ...s.master } }));
}

/**
 * Undo for an envelope made inline (payment form or add-expense) that nothing else uses yet: soft-deleted, so it leaves the
 * plan and the lists. Does nothing when other live entries or payments point at it.
 */
async function discardEnvelope(id: string, ignore: { txIds?: string[]; ruleId?: string; planId?: string } = {}) {
  const e = await db.envelopes.get(id);
  if (!e || e.deletedAt) return;
  const used = (await db.transactions.where('envelopeId').equals(id).toArray()).some((t) => !t.deletedAt && !(ignore.txIds ?? []).includes(t.id))
    || (await db.rules.toArray()).some((r) => r.envelopeId === id && !r.deletedAt && r.id !== ignore.ruleId)
    || (await db.installments.toArray()).some((p) => p.envelopeId === id && !p.deletedAt && p.id !== ignore.planId);
  if (used) return;
  await db.envelopes.put(touch({ ...e, archived: true, deletedAt: nowIso() }));
  const ws = await currentWs();
  if (ws.masterPlan[id] !== undefined) {
    const { [id]: _gone, ...rest } = ws.masterPlan;
    void _gone;
    await db.workspaces.put(touch({ ...ws, masterPlan: rest }));
  }
}

export interface PaymentSaveUndo {
  ref: 'rule' | 'loan';
  id: string;
  /** the payment as it was before an edit; null = it was new */
  before: CommitmentRule | InstallmentPlan | null;
  plan: PlanSnapshot | null;
  createdEnvelopeId: string | null;
  unarchivedEnvelopeId: string | null;
}
/** Undo "Save payment": the payment, any plan change ("make room") and an envelope created or brought back for it. */
export async function undoPaymentSave(u: PaymentSaveUndo): Promise<void> {
  await db.transaction('rw', ALL(), async () => {
    const linked = (await db.transactions.toArray()).filter((t) => !t.deletedAt && (u.ref === 'rule' ? t.recurringRuleId === u.id : t.installmentId === u.id));
    if (u.ref === 'rule') {
      const r = await db.rules.get(u.id);
      if (r) await db.rules.put(touch(u.before ? { ...(u.before as CommitmentRule) } : { ...r, active: false, deletedAt: nowIso() }));
    } else {
      const p = await db.installments.get(u.id);
      if (p) await db.installments.put(touch(u.before ? { ...(u.before as InstallmentPlan) } : { ...p, deletedAt: nowIso() }));
    }
    // automatic postings the save just made (new payments only; an edit keeps its history)
    if (!u.before) for (const t of linked) await db.transactions.put(touch({ ...t, deletedAt: nowIso() }));
    if (u.plan) await restorePlan(u.plan);
    if (u.createdEnvelopeId) {
      await discardEnvelope(u.createdEnvelopeId, { txIds: u.before ? [] : linked.map((t) => t.id), ruleId: u.ref === 'rule' ? u.id : undefined, planId: u.ref === 'loan' ? u.id : undefined });
    }
    if (u.unarchivedEnvelopeId) {
      const e = await db.envelopes.get(u.unarchivedEnvelopeId);
      if (e && !e.archived) await db.envelopes.put(touch({ ...e, archived: true }));
    }
  });
}
/** Undo for "Save" in the add sheet when the envelope was created in the same step. */
export async function undoExpenseWithEnvelope(txId: string, envelopeId: string | null, today: DateStr = todayLocal()): Promise<void> {
  await deleteTransaction(txId, today);
  if (envelopeId) await db.transaction('rw', ALL(), () => discardEnvelope(envelopeId));
}

export async function updateEnvelope(id: string, patch: Partial<Pick<Envelope, 'name' | 'icon' | 'kind' | 'archived' | 'rolloverRule'>>) {
  const e = await db.envelopes.get(id);
  if (!e) return;
  if (patch.kind && patch.kind !== e.kind) {
    if (e.kind === 'buffer' || e.kind === 'pocket') throw new Error('blocked');
    if (e.kind === 'fixed') {
      const rules = await db.rules.toArray();
      const plans = await db.installments.toArray();
      if (rules.some((r) => r.envelopeId === id && r.active && !r.deletedAt) || plans.some((p) => p.envelopeId === id && p.status === 'active' && !p.deletedAt)) throw new Error('bills');
    }
  }
  if (patch.archived && (e.kind === 'buffer' || e.kind === 'pocket')) throw new Error('blocked');
  if (patch.archived && !e.archived) {
    // Remove = archive (history stays, nothing is hard-deleted). Allowed only at a zero balance so no money is stranded (AC-PLAN-11).
    const d = await loadAll();
    const bal = d ? new Engine(d.ds, todayLocal()).current()?.rows[id]?.available ?? 0 : 0;
    if (bal !== 0) throw new Error('balance');
    await db.transaction('rw', [db.envelopes, db.workspaces], async () => {
      await db.envelopes.put(touch({ ...e, ...patch }));
      // future periods stop funding it; the freed plan flows back into the derived Buffer
      const ws = await currentWs();
      if (ws.masterPlan[id]) {
        const { [id]: _gone, ...rest } = ws.masterPlan;
        void _gone;
        await db.workspaces.put(touch({ ...ws, masterPlan: rest }));
      }
    });
    return;
  }
  await db.envelopes.put(touch({ ...e, ...patch }));
}
export async function savePlan(periodId: string, planned: Record<string, Minor>, alsoMaster: boolean) {
  await db.transaction('rw', ALL(), async () => {
    const existing = await db.planLines.where('periodId').equals(periodId).toArray();
    for (const [envelopeId, amount] of Object.entries(planned)) {
      const line = existing.find((l) => l.envelopeId === envelopeId);
      if (line) {
        if (line.amount !== amount) await db.planLines.put(touch({ ...line, amount }));
      } else if (amount !== 0) await db.planLines.add(stamp<Omit<PlanLine, keyof Base>>({ periodId, envelopeId, amount }) as PlanLine);
    }
    if (alsoMaster) {
      const ws = await currentWs();
      await db.workspaces.put(touch({ ...ws, masterPlan: { ...ws.masterPlan, ...planned } }));
    }
  });
}

// ---------------------------------------------------------------- transfers

export async function moveMoney(o: { periodId: string; from: string; to: string; amount: Minor; note?: string | null }, today: DateStr = todayLocal()): Promise<EnvelopeTransfer> {
  if (o.amount <= 0 || o.from === o.to) throw new Error('invalid');
  const t = stamp<Omit<EnvelopeTransfer, keyof Base>>({ periodId: o.periodId, fromEnvelopeId: o.from, toEnvelopeId: o.to, amount: o.amount, date: today, note: o.note ?? null }) as EnvelopeTransfer;
  await db.transfers.add(t);
  return t;
}
export async function setTransferDeleted(id: string, deleted: boolean) {
  const t = await db.transfers.get(id);
  if (t) await db.transfers.put(touch({ ...t, deletedAt: deleted ? nowIso() : null }));
}

// ---------------------------------------------------------------- commitments

export async function saveRule(r: Partial<CommitmentRule> & Pick<CommitmentRule, 'name' | 'envelopeId' | 'amount' | 'frequency' | 'anchorDate'>, today?: DateStr): Promise<CommitmentRule | null> {
  const ws = await currentWs();
  let out: CommitmentRule | null = null;
  if (r.id) {
    const old = await db.rules.get(r.id);
    if (old) await db.rules.put((out = touch({ ...old, ...r } as CommitmentRule)));
  } else {
    out = stamp<Omit<CommitmentRule, keyof Base>>({
      workspaceId: ws.id, currency: ws.baseCurrency, dayOfMonth: null, endDate: null, estimate: false, active: true, skippedDates: [],
      payee: null, autoPost: true, autoFrom: null, pausedAt: null, ...r,
    }) as CommitmentRule;
    await db.rules.add(out);
  }
  await runMaintenance(today);
  return out;
}
export async function saveInstallment(p: Partial<InstallmentPlan> & Pick<InstallmentPlan, 'name' | 'envelopeId' | 'paymentAmount' | 'paymentCount' | 'firstDueDate'>, today?: DateStr): Promise<InstallmentPlan> {
  const ws = await currentWs();
  let out: InstallmentPlan;
  if (p.id) {
    const old = (await db.installments.get(p.id))!;
    out = touch({ ...old, ...p } as InstallmentPlan);
    await db.installments.put(out);
  } else {
    out = stamp<Omit<InstallmentPlan, keyof Base>>({
      workspaceId: ws.id, currency: ws.baseCurrency, paidBeforeCount: 0, skipped: [], status: 'active', kind: 'installment', payee: null, principal: null,
      interestRate: null, autoPost: true, autoFrom: null, waived: [], ...p,
    }) as InstallmentPlan;
    await db.installments.add(out);
  }
  await runMaintenance(today);
  return out;
}
export async function endInstallment(id: string) {
  const p = await db.installments.get(id);
  if (p) await db.installments.put(touch({ ...p, status: 'cancelled' }));
}
export async function skipInstallmentPayment(id: string, n: number) {
  const p = await db.installments.get(id);
  if (!p) return;
  const txs = await db.transactions.where('occKey').startsWith(`${id}:`).toArray();
  for (const t of txs) if (t.installmentNo === n && !t.deletedAt) await db.transactions.put(touch({ ...t, deletedAt: nowIso() }));
  await db.installments.put(touch({ ...p, skipped: [...new Set([...p.skipped, n])] }));
}
export async function skipRuleOccurrence(id: string, date: DateStr) {
  const r = await db.rules.get(id);
  if (!r) return;
  const txs = await db.transactions.where('occKey').equals(`${id}:${date}`).toArray();
  for (const t of txs) if (!t.deletedAt) await db.transactions.put(touch({ ...t, deletedAt: nowIso() }));
  await db.rules.put(touch({ ...r, skippedDates: [...new Set([...r.skippedDates, date])] }));
}
export async function deleteRule(id: string) {
  const r = await db.rules.get(id);
  if (r) await db.rules.put(touch({ ...r, active: false, deletedAt: nowIso() }));
}

// ---------------------------------------------------------------- payments panel ("I paid", pay extra, auto/confirm)

export interface PaidInput {
  ref: 'rule' | 'loan';
  id: string;
  /** the occurrence being settled (its due date); omitted for an extra loan payment */
  dueDate?: DateStr;
  n?: number | null;
  amount: Minor; // in the commitment's currency
  date: DateStr;
  envelopeId: string;
  note?: string | null;
  rate?: string;
}
export interface PaidResult {
  txIds: string[];
  /** part of the amount above what was left to repay, saved as a normal expense */
  rest: Minor;
  /** true when the payment had already been recorded (double tap, second tab): nothing new was written */
  already: boolean;
}

/**
 * "I paid" (and "Pay extra" when `dueDate` is omitted for a loan). Writes the linked expense in one IndexedDB transaction.
 * Idempotent per occurrence. A loan payment above what is left to repay is capped; the rest is a normal expense in the same envelope.
 */
export async function recordPayment(i: PaidInput, today: DateStr = todayLocal()): Promise<PaidResult> {
  if (!(i.amount > 0) || !Number.isSafeInteger(i.amount)) throw new Error('amount');
  if (i.date > today) throw new Error('future');
  const out: PaidResult = { txIds: [], rest: 0, already: false };
  await db.transaction('rw', ALL(), async () => {
    const d = await loadCore();
    const money = { base: d.ws.baseCurrency, rates: d.ws.rates };
    const write = async (t: Transaction) => {
      await db.transactions.add(t);
      out.txIds.push(t.id);
      if (t.currency !== d.ws.baseCurrency) await saveRate(t.currency, t.rate);
      await lateAdjust(d, null, t, today);
    };
    if (i.ref === 'rule') {
      const r = await db.rules.get(i.id);
      if (!r || !i.dueDate) throw new Error('missing');
      const key = `${r.id}:${i.dueDate}`;
      const existing = (await db.transactions.where('occKey').equals(key).toArray()).filter((t) => !t.deletedAt);
      if (existing.length) {
        out.already = true;
        out.txIds = existing.map((t) => t.id);
        return;
      }
      const t = buildTx(d.ws, { type: 'expense', date: i.date, amount: i.amount, currency: r.currency, rate: i.rate, envelopeId: i.envelopeId, note: i.note || r.name, merchant: r.payee ?? null, source: 'recurring' });
      await write({ ...t, recurringRuleId: r.id, occurrenceDate: i.dueDate, occKey: key });
      return;
    }
    const p = await db.installments.get(i.id);
    if (!p) throw new Error('missing');
    const txs = await db.transactions.toArray();
    if (i.n) {
      const existing = txs.filter((t) => t.installmentId === p.id && t.installmentNo === i.n && !t.deletedAt);
      if (existing.length) {
        out.already = true;
        out.txIds = existing.map((t) => t.id);
        return;
      }
    }
    const { toLoan, rest } = splitLoanPayment(loanStatus(p, txs, today, money).remaining, i.amount);
    const common = { type: 'expense' as const, date: i.date, currency: p.currency, rate: i.rate, envelopeId: i.envelopeId, merchant: p.payee ?? null, note: i.note || p.name };
    if (toLoan > 0) {
      const t = buildTx(d.ws, { ...common, amount: toLoan, source: 'installment' });
      const due = i.n ? i.dueDate ?? null : null;
      await write({ ...t, installmentId: p.id, installmentNo: i.n ?? null, occurrenceDate: due, occKey: due ? `${p.id}:${due}` : null });
    }
    if (rest > 0) {
      await write(buildTx(d.ws, { ...common, amount: rest, source: 'manual' }));
      out.rest = rest;
    }
    if (p.status === 'active' && loanStatus(p, await db.transactions.toArray(), today, money).done) await db.installments.put(touch({ ...p, status: 'done' }));
  });
  return out;
}

/** Undo "I paid" / "Pay extra": soft-deletes the rows; a loan that those rows had finished becomes active again. */
export async function undoPayment(txIds: string[], today: DateStr = todayLocal()): Promise<void> {
  const plans = new Set<string>();
  for (const id of txIds) {
    const t = await db.transactions.get(id);
    if (!t || t.deletedAt) continue;
    if (t.installmentId) plans.add(t.installmentId);
    await deleteTransaction(id, today);
  }
  const ws = await currentWs();
  for (const pid of plans) {
    const p = await db.installments.get(pid);
    if (!p || p.status !== 'done') continue;
    if (!loanStatus(p, await db.transactions.toArray(), today, { base: ws.baseCurrency, rates: ws.rates }).done) await db.installments.put(touch({ ...p, status: 'active' }));
  }
}

/** "Record automatically on the due date". Turning it on covers due dates from today on, so waiting items are not posted behind your back. */
export async function setAutoPost(ref: 'rule' | 'loan', id: string, on: boolean, today: DateStr = todayLocal()) {
  const patch = { autoPost: on, autoFrom: on ? today : null };
  if (ref === 'rule') {
    const r = await db.rules.get(id);
    if (r) await db.rules.put(touch({ ...r, ...patch }));
  } else {
    const p = await db.installments.get(id);
    if (p) await db.installments.put(touch({ ...p, ...patch }));
  }
  await runMaintenance(today);
}
export async function pauseRule(id: string, today: DateStr = todayLocal()) {
  const r = await db.rules.get(id);
  if (r) await db.rules.put(touch({ ...r, active: false, pausedAt: today }));
}
/** Resume: the due dates that fell inside the pause are skipped (nothing waits for them, nothing posts). */
export async function resumeRule(id: string, today: DateStr = todayLocal()) {
  const r = await db.rules.get(id);
  if (!r) return;
  const from = r.pausedAt ?? today;
  const missed = from < today ? ruleOccurrences(r, from, addDays(today, -1)) : [];
  await db.rules.put(touch({ ...r, active: true, pausedAt: null, skippedDates: [...new Set([...r.skippedDates, ...missed])] }));
  await runMaintenance(today);
}
export async function unskipRuleOccurrence(id: string, date: DateStr) {
  const r = await db.rules.get(id);
  if (r) await db.rules.put(touch({ ...r, skippedDates: r.skippedDates.filter((x) => x !== date) }));
}
export async function unskipInstallmentPayment(id: string, n: number) {
  const p = await db.installments.get(id);
  if (p) await db.installments.put(touch({ ...p, skipped: p.skipped.filter((x) => x !== n) }));
}
export async function reopenInstallment(id: string) {
  const p = await db.installments.get(id);
  if (p) await db.installments.put(touch({ ...p, status: 'active' }));
}

// ---------------------------------------------------------------- period review

export async function setRolloverAction(periodId: string, envelopeId: string, action: 'carry' | 'to_buffer') {
  await db.transaction('rw', ALL(), async () => {
    const d = (await loadAll())!;
    const eng = new Engine(d.ds, todayLocal());
    const left = eng.snapshotFor(periodId)?.available[envelopeId] ?? 0;
    const ex = (await db.decisions.where('periodId').equals(periodId).toArray()).find((x) => x.envelopeId === envelopeId && !x.adjustment);
    if (ex) await db.decisions.put(touch({ ...ex, action, leftover: left }));
    else await db.decisions.add(stamp<Omit<RolloverDecision, keyof Base>>({ periodId, envelopeId, leftover: left, action, confirmedAt: null }) as RolloverDecision);
  });
}
export async function confirmPeriod(periodId: string, today: DateStr = todayLocal()) {
  await db.transaction('rw', ALL(), async () => {
    const d = (await loadAll())!;
    const p = d.ds.periods.find((x) => x.id === periodId);
    if (!p || p.state === 'closed') return;
    const eng = new Engine(d.ds, today);
    const lefts = eng.leftovers(periodId);
    const existing = (await db.decisions.where('periodId').equals(periodId).toArray()).filter((x) => !x.adjustment);
    for (const l of lefts) {
      const ex = existing.find((x) => x.envelopeId === l.envelopeId);
      const row = { leftover: l.leftover, action: l.action, confirmedAt: nowIso() };
      if (ex) await db.decisions.put(touch({ ...ex, ...row }));
      else await db.decisions.add(stamp<Omit<RolloverDecision, keyof Base>>({ periodId, envelopeId: l.envelopeId, ...row }) as RolloverDecision);
    }
    await db.periods.put(touch({ ...p, state: 'closed', closedAt: nowIso() }));
  });
}
/** Confirm every closing period, oldest first. */
export async function confirmAllClosing(today: DateStr = todayLocal()) {
  for (;;) {
    const d = await loadAll();
    const next = d?.ds.periods.find((p) => p.state === 'closing');
    if (!next) break;
    await confirmPeriod(next.id, today);
  }
}

// ---------------------------------------------------------------- base currency

export async function convertBaseCurrency(newCurrency: Currency, rate: string) {
  if (!isValidRate(rate)) throw new Error('rate');
  await db.transaction('rw', ALL(), async () => {
    const ws = await currentWs();
    const conv = (x: Minor) => convertCurrency(x, ws.baseCurrency, newCurrency, rate);
    for (const t of await db.transactions.toArray()) {
      await db.transactions.put({ ...t, amountBase: t.currency === newCurrency ? t.amount : conv(t.amountBase) });
    }
    for (const l of await db.planLines.toArray()) await db.planLines.put({ ...l, amount: conv(l.amount) });
    for (const t of await db.transfers.toArray()) await db.transfers.put({ ...t, amount: conv(t.amount) });
    for (const d of await db.decisions.toArray()) await db.decisions.put({ ...d, leftover: conv(d.leftover) });
    for (const e of await db.incomeEvents.toArray()) {
      await db.incomeEvents.put({ ...e, expectedBase: conv(e.expectedBase), receivedBase: e.receivedBase === null ? null : conv(e.receivedBase) });
    }
    const master: Record<string, Minor> = {};
    for (const [k, v] of Object.entries(ws.masterPlan)) master[k] = conv(v);
    await db.workspaces.put(touch({ ...ws, baseCurrency: newCurrency, masterPlan: master, rates: {} }));
  });
}

export async function eraseAll() {
  await db.transaction('rw', [...ALL(), db.snapshots], async () => {
    for (const t of [...ALL(), db.snapshots]) await t.clear();
  });
}
export { DATA_TABLES };

/** Run several writes as one IndexedDB transaction: all or nothing (AC-PWA-08). */
export const atomic = <T>(fn: () => Promise<T>): Promise<T> => db.transaction('rw', ALL(), fn);
export async function setIncomeDeleted(id: string, today?: DateStr) {
  await saveIncome({ id, active: false, deletedAt: nowIso() }, today);
}
