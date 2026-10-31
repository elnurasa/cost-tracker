import type {
  Dataset, DateStr, Envelope, EnvelopeKind, Income, IncomeEvent, Minor, Period, PlanLine, Transaction,
} from './types';

const NOW = '2026-04-01T00:00:00.000Z';
const base = (id: string) => ({ id, createdAt: NOW, updatedAt: NOW, deletedAt: null, rev: '0' });

export const env = (id: string, kind: EnvelopeKind, order: number, extra: Partial<Envelope> = {}): Envelope => ({
  ...base(id), workspaceId: 'w', name: id, icon: 'wallet', kind, order, archived: false,
  rolloverRule: kind === 'fixed' || kind === 'flexible' ? 'to_buffer' : 'carry', ...extra,
});
export const income = (id: string, extra: Partial<Income> = {}): Income => ({
  ...base(id), workspaceId: 'w', name: id, kind: 'salary', reliability: 'steady', isAnchor: true,
  schedule: { type: 'monthly', day: 5 }, expectedAmount: 100000, currency: 'AZN', active: true, ...extra,
});
export const event = (id: string, incomeId: string, expectedDate: DateStr, amount: Minor, received: DateStr | null = null): IncomeEvent => ({
  ...base(id), incomeId, expectedDate, expectedAmount: amount, expectedBase: amount, currency: 'AZN',
  status: received ? 'received' : 'expected', receivedDate: received, receivedAmount: received ? amount : null,
  rate: '1', receivedBase: received ? amount : null, transactionId: null,
});
export const period = (id: string, startDate: DateStr, endDate: DateStr, state: Period['state'] = 'open'): Period => ({
  ...base(id), workspaceId: 'w', startDate, endDate, state, closedAt: null, scaledFirstPeriod: false,
});
export const tx = (id: string, envelopeId: string | null, date: DateStr, amount: Minor, extra: Partial<Transaction> = {}): Transaction => ({
  ...base(id), workspaceId: 'w', type: 'expense', date, time: null, amount, currency: 'AZN', rate: '1', amountBase: amount,
  envelopeId, incomeEventId: null, merchant: null, note: null, source: 'manual', sourceRef: null, recurringRuleId: null,
  installmentId: null, installmentNo: null, occurrenceDate: null, status: 'posted', deviceId: 'd', ...extra,
});
export const planLines = (periodId: string, plan: Record<string, Minor>): PlanLine[] =>
  Object.entries(plan).map(([envelopeId, amount]) => ({ ...base(`${periodId}:${envelopeId}`), periodId, envelopeId, amount }));

export function dataset(p: Partial<Dataset> & { cycle?: number | 'L'; base?: string; bridge?: boolean; cover?: DateStr | null; assumed?: DateStr | null }): Dataset {
  return {
    workspace: {
      baseCurrency: p.base ?? 'AZN', bridgeBuffer: p.bridge ?? true, coverUntil: p.cover ?? null,
      lateAssumedArrival: p.assumed ?? null, cycleStartDay: p.cycle ?? 5,
    },
    envelopes: p.envelopes ?? [], incomes: p.incomes ?? [], events: p.events ?? [], periods: p.periods ?? [],
    planLines: p.planLines ?? [], transactions: p.transactions ?? [], transfers: p.transfers ?? [], decisions: p.decisions ?? [],
  };
}

/** Example 1 (Azerbaijan, avans + salary), AZN minor units. Today = day 8. */
export function example1(today = '2026-04-08') {
  const envelopes = [
    env('home', 'fixed', 0), env('bills', 'fixed', 1), env('inst', 'fixed', 2),
    env('food', 'flexible', 3), env('transport', 'flexible', 4), env('fun', 'flexible', 5),
    env('pocket', 'pocket', 6), env('savings', 'savings', 7), env('buffer', 'buffer', 8),
  ];
  const plan = { home: 40000, bills: 10000, inst: 8000, food: 35000, transport: 10000, fun: 6000, pocket: 12000, savings: 10000 };
  const incomes = [income('salary', { schedule: { type: 'monthly', day: 5 }, expectedAmount: 100000 }), income('avans', { isAnchor: false, kind: 'advance', schedule: { type: 'monthly', day: 20 }, expectedAmount: 50000 })];
  const events = [
    event('e-sal', 'salary', '2026-04-05', 100000, '2026-04-05'),
    event('e-av', 'avans', '2026-04-20', 50000),
    event('e-sal2', 'salary', '2026-05-05', 100000),
  ];
  const per = period('p1', '2026-04-05', '2026-05-04');
  const transactions = [
    tx('t-rent', 'home', '2026-04-06', 40000), tx('t-phone', 'inst', '2026-04-07', 8000),
    tx('t-f', 'food', '2026-04-06', 4200), tx('t-t', 'transport', '2026-04-07', 1200),
  ];
  const ds = dataset({ envelopes, incomes, events, periods: [per], planLines: planLines('p1', plan), transactions, cycle: 5 });
  return { ds, today, plan, per };
}
