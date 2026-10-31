import { describe, expect, it } from 'vitest';
import {
  Engine, addDays, autoConfirmIds, buildPeriodPlan, cycleDayFor, commitmentsDue, convertMinor, computeSnapshot, eventsToCreate, fitPlanToIncome,
  firstPeriod, incomeSpecs, installmentDueDate, installmentIsDone, installmentOccurrences, lateEditDelta, monthlyFigure, periodBoundsFor,
  planPeriods, postingsDue, ruleOccurrences, scheduleDates, scaleAmounts, staleEventIds, suggestMoneyNow, suggestMove, templateAmounts,
  templateFor, nextBoundaryAfter, regionFor, currencyForRegion, diffDays, sum, parseAmountInput, planMove, isEarlyIncome, specsFromList, onlyUncertain, nextPay,
} from './index';
import type { CommitmentRule, Dataset, InstallmentPlan, RolloverDecision } from './index';
import { dataset, env, event, example1, income, period, planLines, tx } from './testkit';

const NOW = '2026-04-01T00:00:00.000Z';
const b = (id: string) => ({ id, createdAt: NOW, updatedAt: NOW, deletedAt: null, rev: '0' });

describe('dates and periods', () => {
  it('period bounds for cycle day 5, 1 and last day', () => {
    expect(periodBoundsFor('2026-04-08', 5)).toEqual({ startDate: '2026-04-05', endDate: '2026-05-04' });
    expect(periodBoundsFor('2026-04-03', 5)).toEqual({ startDate: '2026-03-05', endDate: '2026-04-04' });
    expect(periodBoundsFor('2026-02-10', 1)).toEqual({ startDate: '2026-02-01', endDate: '2026-02-28' });
    expect(periodBoundsFor('2026-02-28', 'L')).toEqual({ startDate: '2026-02-28', endDate: '2026-03-30' });
  });
  it('AC-PER-01/02: periods are created for every missing month; old ones become closing', () => {
    const p1 = period('p1', '2026-01-05', '2026-02-04');
    const plan = planPeriods([p1], 5, '2026-04-20');
    expect(plan.create.map((c) => c.startDate)).toEqual(['2026-02-05', '2026-03-05', '2026-04-05']);
    expect(plan.closing).toEqual(['p1']);
  });
  it('AC-PER-09: changing cycle day only affects the next boundary', () => {
    const p = period('p', '2026-04-05', '2026-05-04');
    const plan = planPeriods([p], 15, '2026-05-10');
    expect(plan.create).toEqual([{ startDate: '2026-05-05', endDate: '2026-05-14' }]);
    expect(nextBoundaryAfter('2026-05-05', 15)).toBe('2026-05-15');
  });
  it('AC-PER-07: closing period auto-confirms 7 days after successor starts', () => {
    const ps = [period('a', '2026-03-05', '2026-04-04', 'closing'), period('b', '2026-04-05', '2026-05-04')];
    expect(autoConfirmIds(ps, '2026-04-11')).toEqual([]);
    expect(autoConfirmIds(ps, '2026-04-12')).toEqual(['a']);
  });
  it('DST-safe day difference', () => {
    expect(diffDays('2026-03-30', '2026-03-28')).toBe(2);
    expect(diffDays('2026-11-02', '2026-10-25')).toBe(8);
  });
});

describe('money conversion', () => {
  it('AC-EXP-11: round half up', () => {
    expect(convertMinor(1000, '1.10', 2, 2)).toBe(1100);
    expect(convertMinor(1005, '1.5', 2, 2)).toBe(1508); // 1507.5 -> 1508
    expect(convertMinor(1, '0.5', 2, 2)).toBe(1); // .5 -> up
    expect(convertMinor(100, '0.0065', 0, 2)).toBe(65); // JPY -> USD-like
    expect(() => convertMinor(100, 'abc', 2, 2)).toThrow();
  });
  it('AC-CUR-03: base currency conversion 0.59 half-up', () => {
    expect(convertMinor(10000, '0.59', 2, 2)).toBe(5900);
    expect(convertMinor(333, '0.59', 2, 2)).toBe(196); // 196.47
  });
});

describe('income schedules', () => {
  it('AC-INC-08: day 31 -> last day of month', () => {
    expect(scheduleDates({ type: 'monthly', day: 31 }, '2026-04-01', '2026-04-30')).toEqual(['2026-04-30']);
    expect(scheduleDates({ type: 'monthly', day: 'L' }, '2026-02-01', '2026-02-28')).toEqual(['2026-02-28']);
  });
  it('AC-INC-09: biweekly every 14 days, idempotent', () => {
    const inc = income('bw', { schedule: { type: 'biweekly', refDate: '2026-04-03' } });
    const ev = eventsToCreate([inc], [], '2026-04-10', 'AZN', {});
    const dates = ev.map((e) => e.expectedDate);
    expect(dates.slice(0, 3)).toEqual(['2026-04-03', '2026-04-17', '2026-05-01']);
    expect(dates.every((d, i) => i === 0 || diffDays(d, dates[i - 1]) === 14)).toBe(true);
    expect(dates[dates.length - 1] <= addDays('2026-04-10', 62)).toBe(true);
    expect(eventsToCreate([inc], ev.map((e) => ({ incomeId: e.incomeId, expectedDate: e.expectedDate })), '2026-04-10', 'AZN', {})).toEqual([]);
  });
  it('weekly lands on the weekday', () => {
    const d = scheduleDates({ type: 'weekly', weekday: 5 }, '2026-04-01', '2026-04-30');
    expect(d).toEqual(['2026-04-03', '2026-04-10', '2026-04-17', '2026-04-24']);
  });
  it('AC-HERO-20: events more than 14 days overdue are skipped', () => {
    const evs = [event('a', 'i', '2026-03-01', 100), event('b', 'i', '2026-03-20', 100)];
    expect(staleEventIds(evs, '2026-04-01')).toEqual(['a']);
  });
});

describe('hero edge cases', () => {
  const mk = (extra: Partial<Dataset> = {}, today = '2026-04-08') => {
    const e = example1(today);
    return { ...e, eng: new Engine({ ...e.ds, ...extra }, today) };
  };
  it('AC-HERO-19: income expected today -> H = 1; next day -> late with H = 3', () => {
    const { ds, per } = example1('2026-04-20');
    const events = ds.events.map((e) => (e.id === 'e-sal2' ? { ...e, expectedDate: '2026-04-20' } : e));
    const s = new Engine({ ...ds, events }, '2026-04-20').snapshotFor(per.id)!;
    expect(s.safe.H).toBe(1);
    const s2 = new Engine({ ...ds, events }, '2026-04-21').snapshotFor(per.id)!;
    expect(s2.safe.mode).toBe('late');
    expect(s2.safe.H).toBe(3);
  });
  it('AC-HERO-07: last day -> whole pool', () => {
    const { ds, per } = example1('2026-04-20');
    const events = ds.events.map((e) => (e.id === 'e-av' ? { ...e, status: 'received' as const, receivedDate: '2026-04-19', receivedAmount: 50000, receivedBase: 50000 } : e)).map((e) => (e.id === 'e-sal2' ? { ...e, expectedDate: '2026-04-21' } : e));
    const s = new Engine({ ...ds, events }, '2026-04-20').snapshotFor(per.id)!;
    expect(s.safe.H).toBe(1);
    expect(s.safe.state).toBe('last_day');
    expect(s.safe.leftToday).toBe(s.safe.pool);
  });
  it('AC-HERO-06: spent beyond today allowance, pool > 0 -> hero 0, tomorrow shown', () => {
    const { eng, per, today, ds } = mk();
    const s0 = eng.snapshotFor(per.id)!;
    const spend = 2000;
    const s = new Engine({ ...ds, transactions: [...ds.transactions, tx('x', 'food', today, spend)] }, today).snapshotFor(per.id)!;
    expect(s0.safe.allowance).toBe(1490);
    expect(s.safe.leftToday).toBe(0);
    expect(s.safe.state).toBe('past_today');
    expect(s.safe.tomorrow).toBe(Math.floor(s.safe.pool / (s.safe.H - 1)));
  });
  it('AC-HERO-09: nothing received -> bridge counts Buffer', () => {
    const e = example1('2026-04-05');
    const events = e.ds.events.map((x) => (x.id === 'e-sal' ? { ...x, status: 'expected' as const, receivedDate: null, receivedBase: null, receivedAmount: null } : x));
    const s = new Engine({ ...e.ds, events, transactions: [] }, '2026-04-05').snapshotFor(e.per.id)!;
    expect(s.waitingForPayday).toBe(true);
    expect(s.safe.bridged).toBe(true);
  });
  it('AC-HERO-11/12: pocket overspent is covered by Buffer, then reduces the pool', () => {
    const e = example1();
    const run = (pocketSpend: number, bufferRoll: number) =>
      computeSnapshot({
        today: e.today, ws: e.ds.workspace, period: e.per, envelopes: e.ds.envelopes, incomes: e.ds.incomes, events: e.ds.events,
        planned: e.plan, transactions: [...e.ds.transactions, tx('p', 'pocket', e.today, pocketSpend)], transfers: [], rolloverIn: { buffer: bufferRoll },
      });
    const base = run(0, 0);
    // pocket funded 5478; spend 5478+3000 => 3000 overspent; buffer funded 8674 covers it
    const covered = run(5478 + 3000, 0);
    expect(covered.safe.D).toBe(3000);
    expect(covered.safe.cover).toBe(3000);
    expect(covered.safe.netDeficit).toBe(0);
    expect(covered.safe.pool).toBe(base.safe.pool);
    // Buffer nearly empty: only 1000 of 3000 absorbed -> pool reduced by 2000
    const e2 = { ...e.ds.envelopes };
    void e2;
    const tight = computeSnapshot({
      today: e.today, ws: e.ds.workspace, period: e.per, envelopes: e.ds.envelopes, incomes: e.ds.incomes, events: e.ds.events,
      planned: e.plan, transactions: [...e.ds.transactions, tx('p', 'pocket', e.today, 5478 + 3000)],
      transfers: [{ ...b('tr'), periodId: e.per.id, fromEnvelopeId: 'buffer', toEnvelopeId: 'savings', amount: 8674 - 1000, date: e.today, note: null }], rolloverIn: {},
    });
    expect(tight.safe.cover).toBe(1000);
    expect(tight.safe.netDeficit).toBe(2000);
    expect(tight.safe.pool).toBe(base.safe.pool - 2000);
  });
  it('AC-HERO-13: flexible envelopes net each other', () => {
    const e = example1();
    const s = computeSnapshot({
      today: e.today, ws: e.ds.workspace, period: e.per, envelopes: e.ds.envelopes, incomes: e.ds.incomes, events: e.ds.events,
      planned: e.plan, transactions: [tx('big', 'fun', e.today, 2739 + 2000)], transfers: [], rolloverIn: {},
    });
    expect(s.available.fun).toBe(-2000);
    expect(s.safe.flexPool).toBe(s.available.food + s.available.transport + s.available.fun);
    expect(s.safe.flexPool).toBeGreaterThan(0);
  });
  it('AC-HERO-15/16: no flexible envelopes; no steady income and no cover date', () => {
    const ds = dataset({ envelopes: [env('home', 'fixed', 0), env('buffer', 'buffer', 1)], periods: [period('p', '2026-04-01', '2026-04-30')], cycle: 1 });
    const s = new Engine(ds, '2026-04-10').snapshotFor('p')!;
    expect(s.safe.state).toBe('no_flexible');
    expect(s.safe.mode).toBe('period_end');
    expect(s.safe.H).toBe(21);
  });
  it('AC-HERO-14: foreign expense reduces the hero by amountBase only', () => {
    const e = example1();
    const before = new Engine(e.ds, e.today).snapshotFor(e.per.id)!;
    const t = tx('fx', 'food', e.today, 1000, { currency: 'EUR', rate: '1.7', amountBase: 1700 });
    const after = new Engine({ ...e.ds, transactions: [...e.ds.transactions, t] }, e.today).snapshotFor(e.per.id)!;
    expect(before.safe.flexPool - after.safe.flexPool).toBe(1700);
  });
  it('AC-INC-03: received differs from expected: Buffer absorbs the difference', () => {
    const e = example1();
    const events = e.ds.events.map((x) => (x.id === 'e-sal' ? { ...x, receivedBase: 90000, receivedAmount: 90000 } : x));
    const s = new Engine({ ...e.ds, events }, e.today).snapshotFor(e.per.id)!;
    expect(s.pInc).toBe(140000);
    expect(s.alloc.buffer).toBe(9000);
  });
  it('AC-INC-05: ad hoc income funds the period and grows the Buffer line', () => {
    const e = example1();
    const before = new Engine(e.ds, e.today).snapshotFor(e.per.id)!;
    const t = tx('adhoc', null, e.today, 10000, { type: 'income' });
    const after = new Engine({ ...e.ds, transactions: [...e.ds.transactions, t] }, e.today).snapshotFor(e.per.id)!;
    expect(after.R - before.R).toBe(10000);
    expect(after.alloc.buffer - before.alloc.buffer).toBe(10000);
  });
  it('refund reduces spent (AC-EXP-10)', () => {
    const e = example1();
    const before = new Engine(e.ds, e.today).snapshotFor(e.per.id)!;
    const r = tx('rf', 'food', e.today, 500, { type: 'refund' });
    const after = new Engine({ ...e.ds, transactions: [...e.ds.transactions, r] }, e.today).snapshotFor(e.per.id)!;
    expect(after.rows.food.spent).toBe(before.rows.food.spent - 500);
  });
  it('void and deleted transactions are excluded', () => {
    const e = example1();
    const before = new Engine(e.ds, e.today).snapshotFor(e.per.id)!;
    const txs = [...e.ds.transactions, tx('v', 'food', e.today, 999, { status: 'void' }), tx('d', 'food', e.today, 999, { deletedAt: NOW })];
    const after = new Engine({ ...e.ds, transactions: txs }, e.today).snapshotFor(e.per.id)!;
    expect(after.safe.pool).toBe(before.safe.pool);
  });
  it('pending (estimate) counts as spent', () => {
    const e = example1();
    const before = new Engine(e.ds, e.today).snapshotFor(e.per.id)!;
    const after = new Engine({ ...e.ds, transactions: [...e.ds.transactions, tx('pe', 'food', e.today, 500, { status: 'pending' })] }, e.today).snapshotFor(e.per.id)!;
    expect(before.safe.pool - after.safe.pool).toBe(500);
    expect(after.rows.food.spent - before.rows.food.spent).toBe(500);
  });
});

describe('property: funding invariant and non-negative hero', () => {
  it('AC-HERO-21: sum(available) = sum(rolloverIn) + R - sum(spent) for random states', () => {
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    const e = example1();
    for (let k = 0; k < 400; k++) {
      const txs = Array.from({ length: Math.floor(rnd() * 8) }, (_, i) => {
        const envs = e.ds.envelopes;
        const en = envs[Math.floor(rnd() * envs.length)];
        return tx(`r${i}`, en.id, `2026-04-0${1 + Math.floor(rnd() * 8)}`, Math.floor(rnd() * 20000) + 1);
      });
      const recv = Math.floor(rnd() * 200000);
      const events = [{ ...event('e1', 'salary', '2026-04-05', 100000, '2026-04-05'), receivedBase: recv }, ...e.ds.events.filter((x) => x.id !== 'e-sal')];
      const roll = { buffer: Math.floor(rnd() * 5000) - 1000, food: Math.floor(rnd() * 3000) };
      const planned = Object.fromEntries(Object.entries(e.plan).map(([id, v]) => [id, Math.floor(v * rnd() * 2)]));
      const trs = rnd() > 0.5 ? [{ ...b('t'), periodId: 'p1', fromEnvelopeId: 'fun', toEnvelopeId: 'food', amount: Math.floor(rnd() * 3000), date: '2026-04-08', note: null }] : [];
      const s = computeSnapshot({
        today: '2026-04-08', ws: e.ds.workspace, period: e.per, envelopes: e.ds.envelopes, incomes: e.ds.incomes, events,
        planned, transactions: txs, transfers: trs, rolloverIn: roll,
      });
      const rollSum = sum(Object.values(roll));
      expect(sum(Object.values(s.available))).toBe(rollSum + s.R - s.spentTotal);
      expect(s.safe.leftToday).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(s.safe.leftToday)).toBe(true);
    }
  });
});

describe('rollover and closing', () => {
  const envelopes = [env('food', 'flexible', 0), env('pocket', 'pocket', 1), env('buffer', 'buffer', 2)];
  const mk = (decisions: RolloverDecision[] = [], state: 'closing' | 'closed' = 'closing') =>
    dataset({
      envelopes, cycle: 1,
      incomes: [income('s', { schedule: { type: 'monthly', day: 1 }, expectedAmount: 100000 })],
      events: [event('a', 's', '2026-03-01', 100000, '2026-03-01'), event('b', 's', '2026-04-01', 100000, '2026-04-01')],
      periods: [period('p1', '2026-03-01', '2026-03-31', state), period('p2', '2026-04-01', '2026-04-30')],
      planLines: [...planLines('p1', { food: 50000, pocket: 10000 }), ...planLines('p2', { food: 50000, pocket: 10000 })],
      transactions: [tx('x', 'food', '2026-03-10', 20000)],
      decisions,
    });
  const dec = (envelopeId: string, leftover: number, action: 'carry' | 'to_buffer', confirmed = true): RolloverDecision => ({
    ...b(`d-${envelopeId}`), periodId: 'p1', envelopeId, leftover, action, confirmedAt: confirmed ? NOW : null,
  });
  it('AC-PER-04/08: defaults: Food leftover goes to Buffer, Pocket carries; provisional = confirmed', () => {
    const prov = new Engine(mk(), '2026-04-05');
    const s1 = prov.snapshotFor('p1')!;
    expect(s1.available.food).toBe(30000);
    const cur = prov.snapshotFor('p2')!;
    expect(cur.rows.food.rolloverIn).toBe(0);
    expect(cur.rows.buffer.rolloverIn).toBe(30000 + s1.available.buffer);
    expect(cur.rows.pocket.rolloverIn).toBe(10000);
    const confirmed = new Engine(mk([dec('food', 30000, 'to_buffer'), dec('pocket', 10000, 'carry'), dec('buffer', s1.available.buffer, 'carry')], 'closed'), '2026-04-05');
    expect(confirmed.snapshotFor('p2')!.safe.pool).toBe(cur.safe.pool);
  });
  it('AC-PER-05: toggling Food to Keep carries 30', () => {
    const e = new Engine(mk([dec('food', 30000, 'carry', false)]), '2026-04-05');
    expect(e.snapshotFor('p2')!.rows.food.rolloverIn).toBe(30000);
  });
  it('AC-PER-06: negative leftover with To Buffer reduces Buffer', () => {
    const d = mk();
    d.transactions = [tx('x', 'food', '2026-03-10', 70000)];
    const e = new Engine(d, '2026-04-05');
    const s1 = e.snapshotFor('p1')!;
    expect(s1.available.food).toBe(-20000);
    expect(e.snapshotFor('p2')!.rows.buffer.rolloverIn).toBe(s1.available.buffer - 20000);
  });
  it('conservation: total rolled in equals total leftover', () => {
    const e = new Engine(mk(), '2026-04-05');
    const s1 = e.snapshotFor('p1')!;
    expect(sum(Object.values(e.snapshotFor('p2')!.rows).map((r) => r.rolloverIn))).toBe(sum(Object.values(s1.available)));
  });
  it('AC-EXP-05: late edit delta is applied to the current Buffer', () => {
    const old = tx('x', 'food', '2026-03-10', 20000);
    const edited = { ...old, amount: 25000, amountBase: 25000 };
    expect(lateEditDelta(old, edited)).toBe(-5000);
    expect(lateEditDelta(old, null)).toBe(20000);
    const adj: RolloverDecision = { ...b('adj'), periodId: 'p1', envelopeId: 'buffer', leftover: -5000, action: 'carry', confirmedAt: NOW, adjustment: true, appliedPeriodId: 'p2' };
    const base = new Engine(mk([], 'closing'), '2026-04-05').snapshotFor('p2')!.rows.buffer.rolloverIn;
    const withAdj = new Engine(mk([adj], 'closing'), '2026-04-05').snapshotFor('p2')!.rows.buffer.rolloverIn;
    expect(withAdj - base).toBe(-5000);
  });
});

describe('recurring and installments', () => {
  const rule = (extra: Partial<CommitmentRule> = {}): CommitmentRule => ({
    ...b('r1'), workspaceId: 'w', name: 'Rent', envelopeId: 'home', amount: 50000, currency: 'AZN', frequency: 'monthly',
    anchorDate: '2026-01-12', dayOfMonth: 12, endDate: null, estimate: false, active: true, skippedDates: [], ...extra,
  });
  it('AC-REC-01/02/03: monthly rule posts once per due date, catches up, is idempotent', () => {
    const due = postingsDue([rule()], [], new Set(), '2026-04-15');
    expect(due.map((d) => d.occurrenceDate)).toEqual(['2026-01-12', '2026-02-12', '2026-03-12', '2026-04-12']);
    const keys = new Set(due.map((d) => `${d.refId}:${d.occurrenceDate}`));
    expect(postingsDue([rule()], [], keys, '2026-04-15')).toEqual([]);
    const before = postingsDue([rule()], [], new Set(), '2026-04-11');
    expect(before.map((d) => d.occurrenceDate)).toEqual(['2026-01-12', '2026-02-12', '2026-03-12']);
  });
  it('AC-REC-05: skipped dates are not posted; catch-up window is 366 days', () => {
    expect(postingsDue([rule({ skippedDates: ['2026-04-12'] })], [], new Set(), '2026-04-15').map((d) => d.occurrenceDate)).not.toContain('2026-04-12');
    const old = rule({ anchorDate: '2020-01-12', dayOfMonth: 12 });
    const due = postingsDue([old], [], new Set(), '2026-04-15');
    expect(due.length).toBeLessThanOrEqual(13);
    expect(due[0].occurrenceDate >= '2025-04-14').toBe(true);
  });
  it('monthly day 31 clamps; yearly and once', () => {
    expect(ruleOccurrences({ frequency: 'monthly', anchorDate: '2026-01-31', dayOfMonth: 31, endDate: null }, '2026-02-01', '2026-04-30')).toEqual(['2026-02-28', '2026-03-31', '2026-04-30']);
    expect(ruleOccurrences({ frequency: 'yearly', anchorDate: '2024-02-29', dayOfMonth: null, endDate: null }, '2026-01-01', '2026-12-31')).toEqual(['2026-02-28']);
    expect(ruleOccurrences({ frequency: 'once', anchorDate: '2026-04-20', dayOfMonth: null, endDate: null }, '2026-04-01', '2026-04-30')).toEqual(['2026-04-20']);
  });
  const plan = (extra: Partial<InstallmentPlan> = {}): InstallmentPlan => ({
    ...b('i1'), workspaceId: 'w', name: 'Phone', envelopeId: 'inst', currency: 'AZN', paymentAmount: 125000, paymentCount: 4,
    firstDueDate: '2026-01-31', paidBeforeCount: 0, skipped: [], status: 'active', ...extra,
  });
  it('AC-INS-01/08: consecutive months, day clamped, total', () => {
    const p = plan();
    expect([1, 2, 3, 4].map((n) => installmentDueDate(p, n))).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
    expect(p.paymentAmount * p.paymentCount).toBe(500000);
  });
  it('AC-INS-02: already paid occurrences are paid without transactions and never posted', () => {
    const p = plan({ paymentCount: 6, paidBeforeCount: 2, firstDueDate: '2026-01-15' });
    const occ = installmentOccurrences(p, []);
    expect(occ.map((o) => o.state)).toEqual(['paid', 'paid', 'scheduled', 'scheduled', 'scheduled', 'scheduled']);
    const due = postingsDue([], [p], new Set(), '2026-04-20');
    expect(due.map((d) => d.installmentNo)).toEqual([3, 4]);
  });
  it('AC-INS-04: plan is done after the final payment; AC-INS-05 cancelled plans stop posting', () => {
    const p = plan();
    const txs = [1, 2, 3, 4].map((n) => tx(`t${n}`, 'inst', '2026-01-31', 1, { installmentId: 'i1', installmentNo: n }));
    expect(installmentIsDone(p, txs.slice(0, 3))).toBe(false);
    expect(installmentIsDone(p, txs)).toBe(true);
    expect(postingsDue([], [plan({ status: 'cancelled' })], new Set(), '2026-04-20')).toEqual([]);
  });
  it('AC-INS-06 / AC-PLAN-14: new period raises fixed allocation to cover commitments due', () => {
    const p = plan({ firstDueDate: '2026-04-15' });
    const due = commitmentsDue([], [p], [], '2026-04-05', '2026-05-04');
    const byEnv: Record<string, number> = {};
    due.forEach((d) => (byEnv[d.envelopeId] = (byEnv[d.envelopeId] ?? 0) + d.amount));
    const envs = [env('inst', 'fixed', 0), env('food', 'flexible', 1), env('buffer', 'buffer', 2)];
    expect(buildPeriodPlan({ inst: 50000, food: 30000 }, envs, byEnv)).toEqual({ inst: 125000, food: 30000 });
  });
});

describe('plan ops', () => {
  const envs = [env('f', 'fixed', 0), env('x', 'flexible', 1), env('y', 'flexible', 2), env('p', 'pocket', 3), env('s', 'savings', 4), env('buffer', 'buffer', 5)];
  it('AC-PLAN-09: fit plan reduces Savings first, then flexible, never fixed/pocket', () => {
    const r = fitPlanToIncome({ over: 8000, planned: { f: 30000, x: 20000, y: 10000, p: 5000, s: 5000 }, envelopes: envs, spent: {}, includePocket: false });
    expect(r.newAlloc.s).toBe(0);
    expect(r.newAlloc.f).toBe(30000);
    expect(r.newAlloc.p).toBe(5000);
    expect(r.newAlloc.x + r.newAlloc.y).toBe(30000 - 3000);
    const hard = fitPlanToIncome({ over: 100000, planned: { f: 30000, x: 20000, y: 10000, p: 5000, s: 5000 }, envelopes: envs, spent: {}, includePocket: false });
    expect(hard.short).toBe(100000 - 35000);
    expect(hard.newAlloc.p).toBe(5000);
    const incl = fitPlanToIncome({ over: 37000, planned: { f: 30000, x: 20000, y: 10000, p: 5000, s: 5000 }, envelopes: envs, spent: {}, includePocket: true });
    expect(incl.newAlloc.p).toBe(3000);
  });
  it('suggestMove picks the flexible donor when the pool is positive (AC-REB-02)', () => {
    const e = example1();
    const planned = e.plan;
    const snap = computeSnapshot({
      today: e.today, ws: e.ds.workspace, period: e.per, envelopes: e.ds.envelopes, incomes: e.ds.incomes, events: e.ds.events,
      planned, transactions: [tx('o', 'fun', e.today, 2739 + 2000)], transfers: [], rolloverIn: {},
    });
    const sug = suggestMove(snap, e.ds.envelopes, 2, 'fun');
    expect(sug.fromId).toBe('food');
    expect(sug.amount).toBe(2000);
  });
});

describe('onboarding', () => {
  const base = { today: '2026-04-10', freq: 'monthly' as const, amount: 150000, day: 5, amount2: 0, day2: 20, nextPayDate: null, exp: 2 };
  it('AC-ONB-04: twice a month -> two steady incomes, bigger one is the anchor, cycle day 5, P_inc 1,500', () => {
    const i = { ...base, freq: 'twice' as const, amount: 100000, day: 5, amount2: 50000, day2: 20 };
    const specs = incomeSpecs(i);
    expect(specs.map((s) => s.isAnchor)).toEqual([true, false]);
    expect(specs.every((s) => s.reliability === 'steady')).toBe(true);
    expect(cycleDayFor(i)).toBe(5);
    expect(monthlyFigure(i)).toBe(150000);
  });
  it('AC-ONB-05: weekly 300 -> 1,300/month, cycle day 1', () => {
    const i = { ...base, freq: 'weekly' as const, amount: 30000, nextPayDate: '2026-04-12' };
    expect(monthlyFigure(i)).toBe(130000);
    expect(cycleDayFor(i)).toBe(1);
  });
  it('AC-ONB-06: "It varies" -> uncertain income', () => {
    const i = { ...base, freq: 'varies' as const };
    expect(incomeSpecs(i)[0].reliability).toBe('uncertain');
  });
  it('AC-ONB-07: pay day 10 days ago -> partial first period starting today with a starting amount', () => {
    const i = { ...base, today: '2026-04-15', day: 5 };
    const m = suggestMoneyNow(i);
    expect(m.justPaid).toBe(false);
    const fp = firstPeriod(i, false);
    expect(fp).toEqual({ startDate: '2026-04-15', endDate: '2026-05-04', scaled: true, startingAmount: true });
    const tpl = templateAmounts(templateFor('AZ'), 150000, 2);
    const scaled = scaleAmounts(tpl, 40000, 150000);
    expect(sum(Object.values(scaled))).toBeLessThanOrEqual(40000);
  });
  it('AC-ONB-08: pay day today -> prefilled with the full income, period starts on the cycle start', () => {
    const i = { ...base, today: '2026-04-05' };
    const m = suggestMoneyNow(i);
    expect(m.justPaid).toBe(true);
    expect(m.prefill).toBe(150000);
    expect(firstPeriod(i, true)).toEqual({ startDate: '2026-04-05', endDate: '2026-05-04', scaled: false, startingAmount: false });
  });
  it('AC-ONB-09: template sums stay within income for every region and size', () => {
    for (const region of ['AZ', 'TR', 'GLOBAL'] as const) {
      for (const income of [3000, 15000, 50000, 150000, 4000000, 99999999]) {
        const t = templateAmounts(templateFor(region), income, 2);
        expect(sum(Object.values(t))).toBeLessThanOrEqual(income);
      }
    }
    expect(templateFor('AZ').reduce((s, i) => s + i.pct, 0)).toBe(93);
    expect(templateFor('TR').reduce((s, i) => s + i.pct, 0)).toBe(85);
    expect(templateFor('GLOBAL').reduce((s, i) => s + i.pct, 0)).toBe(90);
  });
  it('AC-ONB-03: region and currency detection', () => {
    expect(regionFor('AZ', null)).toBe('AZ');
    expect(regionFor(null, 'Europe/Istanbul')).toBe('TR');
    expect(regionFor('FR', null)).toBe('GLOBAL');
    expect(currencyForRegion('AZ', 'AZ')).toBe('AZN');
    expect(currencyForRegion('TR', 'TR')).toBe('TRY');
    expect(currencyForRegion('DE', 'GLOBAL')).toBe('EUR');
    expect(currencyForRegion(null, 'GLOBAL')).toBe('USD');
  });
});

// E-03: typed amounts accept "," and "." as decimal, and grouped numbers
describe('parseAmountInput / normalizeAmountText (E-03)', () => {
  it.each([
    ['4,50', 450], ['4.50', 450], ['1.500,50', 150050], ['1,500.50', 150050], ['1 500,5', 150050], ['1 500', 150000],
    ['1.500.000', 150000000], ['12', 1200], [',5', 50], ['5,', 500],
  ])('%s -> %i', (text, want) => expect(parseAmountInput(text, 2)).toBe(want));
  it.each(['', '.', ',', 'abc', '1,2,3.4.5', '4,567', '-5', '1e3'])('"%s" is not an amount (never NaN, never throws)', (text) => {
    expect(() => parseAmountInput(text, 2)).not.toThrow();
    expect(parseAmountInput(text, 2)).toBeNull();
  });
  it('zero-decimal currencies reject decimals', () => expect(parseAmountInput('5,5', 0)).toBeNull());
});

// founder request: equal-rank income list in onboarding (1, 2, 3 incomes, last-day pay)
describe('onboarding income list', () => {
  const base = { today: '2026-04-10', freq: 'monthly' as const, amount: 0, day: 5, amount2: 0, day2: 20, nextPayDate: null, exp: 2 };
  const row = (name: string, amount: number, schedule: import('./types').Schedule, extra = {}) => ({ name, kind: 'other' as const, amount, schedule, ...extra });
  it('one monthly income gives the same numbers as the old "once a month" shape', () => {
    const list = { ...base, incomes: [row('Maaş', 150000, { type: 'monthly', day: 5 })] };
    const old = { ...base, amount: 150000 };
    expect(monthlyFigure(list)).toBe(monthlyFigure(old));
    expect(cycleDayFor(list)).toBe(cycleDayFor(old));
    expect(suggestMoneyNow(list)).toEqual(suggestMoneyNow(old));
    expect(incomeSpecs(list)[0]).toMatchObject({ name: 'Maaş', isAnchor: true, reliability: 'steady' });
  });
  it('two incomes match the old "twice a month" numbers; the bigger one is the anchor whatever the row order', () => {
    const list = { ...base, incomes: [row('Avans', 50000, { type: 'monthly', day: 20 }), row('Maaş', 100000, { type: 'monthly', day: 5 })] };
    const old = { ...base, freq: 'twice' as const, amount: 100000, day: 5, amount2: 50000, day2: 20 };
    expect(monthlyFigure(list)).toBe(150000);
    expect(cycleDayFor(list)).toBe(5);
    expect(incomeSpecs(list).map((s) => s.isAnchor)).toEqual([false, true]);
    expect(suggestMoneyNow(list)).toEqual(suggestMoneyNow(old));
  });
  it('three incomes: monthly + weekly side job + irregular; the person can mark the anchor', () => {
    const incomes = [row('Maaş', 100000, { type: 'monthly', day: 10 }), row('Kurs', 20000, { type: 'weekly', weekday: 6 }), row('Sifariş', 30000, { type: 'none' })];
    const i = { ...base, incomes };
    expect(monthlyFigure(i)).toBe(100000 + Math.round((20000 * 52) / 12) + 30000);
    expect(incomeSpecs(i).map((s) => s.reliability)).toEqual(['steady', 'steady', 'uncertain']);
    expect(cycleDayFor(i)).toBe(10);
    expect(onlyUncertain(i)).toBe(false);
    const marked = { ...base, incomes: [incomes[0], { ...incomes[1], anchor: true }, incomes[2]] };
    expect(cycleDayFor(marked)).toBe(1); // a weekly anchor starts periods on day 1, as before
  });
  it('a last-day income (or 29-31) uses the month-end rule for the cycle and the events', () => {
    for (const day of ['L', 29, 31] as const) {
      const i = { ...base, today: '2026-02-10', incomes: [row('Maaş', 120000, { type: 'monthly', day })] };
      expect(cycleDayFor(i)).toBe('L');
      expect(nextPay(i)).toBe('2026-02-28');
    }
  });
  it('rows without an amount are ignored; an irregular-only list is cover mode', () => {
    const i = { ...base, incomes: [row('Sifariş', 80000, { type: 'once', date: '2026-05-20' }), row('', 0, { type: 'monthly', day: 5 })] };
    expect(specsFromList(i.incomes)).toHaveLength(1);
    expect(onlyUncertain(i)).toBe(true);
    expect(suggestMoneyNow(i).prefill).toBe(80000);
    expect(nextPay(i)).toBe('2026-05-20');
  });
});

// E-08: a salary marked as received a few days early waits for its own period
describe('early income (E-08)', () => {
  const { ds } = example1('2026-04-30');
  const early = { ...ds, events: ds.events.map((e) => (e.id === 'e-sal2' ? { ...e, status: 'received' as const, receivedDate: '2026-04-30', receivedAmount: 100000, receivedBase: 100000 } : e)) };
  it('today\'s number, the income of this period and the horizon do not change', () => {
    const before = new Engine(ds, '2026-04-30').current()!;
    const after = new Engine(early, '2026-04-30').current()!;
    expect(isEarlyIncome(early.events.find((e) => e.id === 'e-sal2')!)).toBe(true);
    expect(after.R).toBe(before.R);
    expect(after.safe.leftToday).toBe(before.safe.leftToday);
    expect(after.horizon.nextDate).toBe(before.horizon.nextDate);
    expect(after.safe.H).toBe(before.safe.H);
  });
  it('the pay funds the next period when it starts', () => {
    const next = period('p2', '2026-05-05', '2026-06-04');
    const d2 = { ...early, periods: [...early.periods, next], planLines: [...early.planLines, ...planLines('p2', { food: 35000 })] };
    const s = new Engine(d2, '2026-05-05').snapshotFor('p2')!;
    expect(s.R).toBe(100000);
    expect(s.waitingForPayday).toBe(false);
  });
  it('a pay received more than 10 days early counts as income now', () => {
    const e = { ...early.events.find((x) => x.id === 'e-sal2')!, receivedDate: '2026-04-20' };
    expect(isEarlyIncome(e)).toBe(false);
  });
});

// E-06: a move never dead-ends when the first source is too small
describe('planMove (E-06)', () => {
  const { ds } = example1('2026-04-14');
  const over = { ...ds, transactions: [...ds.transactions, tx('big', 'food', '2026-04-14', 30000)] };
  const snap = new Engine(over, '2026-04-14').current()!;
  const need = -snap.available.food;
  it('takes Buffer first (capped) and the rest from the next sources in the 4.8 order, never from Pocket', () => {
    const buf = snap.available.buffer;
    const p = planMove(snap, over.envelopes, 'food', 'buffer', need + buf);
    expect(p.parts[0]).toEqual({ from: 'buffer', amount: buf });
    expect(p.parts.map((x) => x.from)).not.toContain('pocket');
    expect(p.parts.reduce((a, x) => a + x.amount, 0) + p.rest).toBe(need + buf);
    const order = p.parts.slice(1).map((x) => over.envelopes.find((e) => e.id === x.from)!.kind);
    expect(order.indexOf('savings') === -1 || order.lastIndexOf('flexible') < order.indexOf('savings')).toBe(true);
  });
  it('reports what nothing can cover', () => {
    const p = planMove(snap, over.envelopes, 'food', 'buffer', 99999999);
    expect(p.rest).toBeGreaterThan(0);
  });
});
