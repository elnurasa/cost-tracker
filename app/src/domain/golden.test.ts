import { describe, expect, it } from 'vitest';
import {
  Engine, computeFunding, floorMajor, makeRoom, previewHero, suggestMove, sourceCap, withBuffer, distribute, computeSnapshot,
} from './index';
import type { Dataset } from './index';
import { dataset, env, event, example1, income, period, planLines, tx } from './testkit';

const hero = (leftToday: number) => floorMajor(leftToday, 2);

describe('Golden example 1 - Azerbaijan avans + salary', () => {
  it('AC-PLAN-03: day 5 funding uses largest remainder', () => {
    const { ds, per } = example1('2026-04-05');
    const eng = new Engine({ ...ds, transactions: [] }, '2026-04-05');
    const s = eng.snapshotFor(per.id)!;
    expect(s.pInc).toBe(150000);
    expect(s.R).toBe(100000);
    expect(s.alloc.buffer).toBe(19000);
    expect(s.funded.home).toBe(40000);
    expect(s.funded.bills).toBe(10000);
    expect(s.funded.inst).toBe(8000);
    expect(s.funded.food).toBe(15979);
    expect(s.funded.transport).toBe(4565);
    expect(s.funded.fun).toBe(2739);
    expect(s.funded.pocket).toBe(5478);
    expect(s.funded.savings).toBe(4565);
    expect(s.funded.buffer).toBe(8674);
    expect(s.funded.food + s.funded.transport + s.funded.fun).toBe(23283); // 232.83
  });
  it('AC-HERO-01: day 8 hero 14, allowance 1,490 minor', () => {
    const { ds, today, per } = example1();
    const s = new Engine(ds, today).snapshotFor(per.id)!;
    expect(s.safe.flexPool).toBe(17883);
    expect(s.safe.H).toBe(12);
    expect(s.safe.allowance).toBe(1490);
    expect(s.safe.leftToday).toBe(1490);
    expect(hero(s.safe.leftToday)).toBe(14);
    expect(s.safe.mode).toBe('scheduled');
  });
  it('AC-HERO-02: 10.00 on Food today -> 4.90 -> hero 4', () => {
    const { ds, today, per } = example1();
    const withSpend: Dataset = { ...ds, transactions: [...ds.transactions, tx('t-today', 'food', today, 1000)] };
    const s = new Engine(withSpend, today).snapshotFor(per.id)!;
    expect(s.safe.poolStart).toBe(17883);
    expect(s.safe.allowance).toBe(1490);
    expect(s.safe.leftToday).toBe(490);
    expect(hero(s.safe.leftToday)).toBe(4);
  });
  it('day 20 after avans: 240.00 / 15 = 16', () => {
    const { ds, per } = example1('2026-04-20');
    const events = ds.events.map((e) => (e.id === 'e-av' ? { ...e, status: 'received' as const, receivedDate: '2026-04-20', receivedAmount: 50000, receivedBase: 50000 } : e));
    // flexible spent to date 270.00
    const txs = [...ds.transactions.filter((t) => t.envelopeId !== 'food' && t.envelopeId !== 'transport'), tx('fs', 'food', '2026-04-15', 20000), tx('ts', 'transport', '2026-04-16', 7000)];
    const s = new Engine({ ...ds, events, transactions: txs }, '2026-04-20').snapshotFor(per.id)!;
    expect(s.safe.flexPool).toBe(24000);
    expect(s.safe.H).toBe(15);
    expect(s.safe.allowance).toBe(1600);
    expect(hero(s.safe.leftToday)).toBe(16);
  });
});

describe('Golden example 2 - Turkey installments, make room', () => {
  const envelopes = [
    env('home', 'fixed', 0), env('bills', 'fixed', 1), env('inst', 'fixed', 2),
    env('groc', 'flexible', 3), env('trans', 'flexible', 4), env('fun', 'flexible', 5),
    env('pocket', 'pocket', 6), env('savings', 'savings', 7), env('buffer', 'buffer', 8),
  ];
  const plan0 = { home: 1400000, bills: 300000, inst: 650000, groc: 700000, trans: 200000, fun: 150000, pocket: 200000, savings: 200000 };
  const mk = (plan: Record<string, number>) =>
    dataset({
      envelopes, cycle: 1, base: 'TRY',
      incomes: [income('sal', { schedule: { type: 'monthly', day: 1 }, expectedAmount: 4000000, currency: 'TRY' })],
      events: [event('s1', 'sal', '2026-04-01', 4000000, '2026-04-01'), event('s2', 'sal', '2026-05-01', 4000000)],
      periods: [period('p', '2026-04-01', '2026-04-30')], planLines: planLines('p', plan),
      transactions: [tx('a', 'groc', '2026-04-05', 280000), tx('b', 'trans', '2026-04-06', 50000), tx('c', 'fun', '2026-04-07', 30000)],
    });
  it('day 10: hero 328', () => {
    const s = new Engine(mk(plan0), '2026-04-10').snapshotFor('p')!;
    expect(s.alloc.buffer).toBe(200000);
    expect(s.safe.H).toBe(21);
    expect(s.safe.allowance).toBe(32857);
    expect(hero(s.safe.leftToday)).toBe(328);
  });
  it('first installment: Buffer covers, hero stays 328', () => {
    const r = makeRoom({ amount: 125000, targetId: 'inst', planned: plan0, bufferAlloc: 200000, envelopes, spent: { groc: 280000, trans: 50000, fun: 30000 } });
    expect(r.fromBuffer).toBe(125000);
    expect(r.short).toBe(0);
    const s = new Engine(mk(r.newAlloc), '2026-04-10').snapshotFor('p')!;
    expect(s.alloc.buffer).toBe(75000);
    expect(hero(s.safe.leftToday)).toBe(328);
  });
  it('AC-HERO-03 / AC-PLAN-07: second installment -> 269', () => {
    const plan1 = { ...plan0, inst: 775000 };
    const r = makeRoom({ amount: 200000, targetId: 'inst', planned: plan1, bufferAlloc: 75000, envelopes, spent: { groc: 280000, trans: 50000, fun: 30000 } });
    expect(r.fromBuffer).toBe(75000);
    expect(r.newAlloc.pocket).toBe(200000);
    expect(r.newAlloc.savings).toBe(200000);
    expect(r.newAlloc.groc + r.newAlloc.trans + r.newAlloc.fun).toBe(925000);
    const s = new Engine(mk(r.newAlloc), '2026-04-10').snapshotFor('p')!;
    expect(s.alloc.buffer).toBe(0);
    expect(s.safe.flexPool).toBe(565000);
    expect(s.safe.allowance).toBe(26904);
    expect(hero(s.safe.leftToday)).toBe(269);
  });
  it('AC-PLAN-07 in whole units: 6,167 / 1,762 / 1,321', () => {
    const planU = { groc: 7000, trans: 2000, fun: 1500 };
    const r = makeRoom({ amount: 1250, targetId: 'inst', planned: { ...planU, inst: 0 }, bufferAlloc: 0, envelopes, spent: {} });
    expect([r.newAlloc.groc, r.newAlloc.trans, r.newAlloc.fun]).toEqual([6167, 1762, 1321]);
  });
  it('AC-PLAN-08: flexible allocation is floored at spent', () => {
    const r = makeRoom({ amount: 1250, targetId: 'inst', planned: { groc: 7000, trans: 2000, fun: 1500 }, bufferAlloc: 0, envelopes, spent: { groc: 6900 } });
    expect(r.newAlloc.groc).toBe(6900);
    expect(r.newAlloc.trans + r.newAlloc.fun).toBe(3500 - (1250 - 100));
    expect(r.short).toBe(0);
  });
});

describe('Golden example 3 - late income, Buffer bridge', () => {
  const { ds, per } = example1('2026-04-07');
  const base = (assumed: string | null): Dataset => ({
    ...ds,
    workspace: { ...ds.workspace, lateAssumedArrival: assumed },
    events: [event('e-sal', 'salary', '2026-04-05', 100000), event('e-av', 'avans', '2026-04-20', 50000)],
    transactions: [tx('f', 'food', '2026-04-06', 1800)],
  });
  const run = (assumed: string | null, bridge = true) => {
    const d = base(assumed);
    d.workspace = { ...d.workspace, bridgeBuffer: bridge };
    // manual rolloverIn: Buffer 120, My share 20, Savings 200
    return computeSnapshot({
      today: '2026-04-07', ws: d.workspace, period: per, envelopes: d.envelopes, incomes: d.incomes, events: d.events,
      planned: Object.fromEntries(d.planLines.map((l) => [l.envelopeId, l.amount])), transactions: d.transactions,
      transfers: [], rolloverIn: { buffer: 12000, pocket: 2000, savings: 20000 },
    });
  };
  it('AC-HERO-04: hero 34, then 51 with "I expect it on day 9"', () => {
    const s = run(null);
    expect(s.horizon.mode).toBe('late');
    expect(s.safe.bridged).toBe(true);
    expect(s.safe.pool).toBe(10200);
    expect(s.safe.H).toBe(3);
    expect(hero(s.safe.leftToday)).toBe(34);
    const s2 = run('2026-04-09');
    expect(s2.safe.H).toBe(2);
    expect(hero(s2.safe.leftToday)).toBe(51);
  });
  it('AC-HERO-10: bridge off excludes Buffer', () => {
    const s = run(null, false);
    expect(s.safe.pool).toBe(-1800);
    expect(hero(s.safe.leftToday)).toBe(0);
    expect(s.safe.state).toBe('used_up');
  });
});

describe('Golden example 4 - overspend and rebalance', () => {
  const { ds, per } = example1('2026-04-14');
  const d: Dataset = {
    ...ds,
    transactions: [tx('f', 'food', '2026-04-10', 22000), tx('t', 'transport', '2026-04-11', 4800)], // 268.00
  };
  it('AC-HERO-05: pool -35.17 -> hero 0, H = 6', () => {
    const s = new Engine(d, '2026-04-14').snapshotFor(per.id)!;
    expect(s.safe.pool).toBe(-3517);
    expect(s.safe.H).toBe(6);
    expect(s.safe.leftToday).toBe(0);
    expect(s.safe.state).toBe('used_up');
    expect(s.safe.nextDate).toBe('2026-04-20');
  });
  it('AC-REB-01/05: suggests 40 from Buffer; previews 0 then 8', () => {
    const eng = new Engine(d, '2026-04-14');
    const s = eng.snapshotFor(per.id)!;
    const sug = suggestMove(s, d.envelopes, 2);
    expect(sug.fromId).toBe('buffer');
    expect(sug.amount).toBe(4000);
    expect(sug.toId).toBe('food');
    expect(previewHero(d, '2026-04-14', per.id, 'buffer', 'food', 4000, 2)).toBe(0);
    const cap = sourceCap(s, d.envelopes, 'buffer')!;
    expect(cap).toBe(8674);
    expect(previewHero(d, '2026-04-14', per.id, 'buffer', 'food', cap, 2)).toBe(8);
  });
  it('AC-HERO-21: moving money between flexible envelopes never changes the allowance', () => {
    const a = new Engine(d, '2026-04-14').snapshotFor(per.id)!;
    const b = new Engine(d, '2026-04-14', [
      { id: 'x', periodId: per.id, fromEnvelopeId: 'fun', toEnvelopeId: 'food', amount: 1000, date: '2026-04-14', note: null, createdAt: '', updatedAt: '', deletedAt: null, rev: '' },
    ]).snapshotFor(per.id)!;
    expect(b.safe.allowance).toBe(a.safe.allowance);
    expect(b.safe.pool).toBe(a.safe.pool);
  });
});

describe('Golden example 5 - freelancer, USD base, EUR income, cover-until', () => {
  it('AC-CUR-04: 1,200 EUR @1.10 = 1,320.00 USD, hero 12', () => {
    const envelopes = [env('home', 'fixed', 0), env('food', 'flexible', 1), env('trans', 'flexible', 2), env('pocket', 'pocket', 3), env('buffer', 'buffer', 4)];
    const inc = income('fl', { reliability: 'uncertain', schedule: { type: 'none' }, expectedAmount: 120000, currency: 'EUR' });
    const ev = { ...event('e1', 'fl', '2026-04-01', 120000, '2026-04-01'), currency: 'EUR', rate: '1.10', receivedBase: 132000, expectedBase: 132000, expectedDate: null as string | null };
    const ds = dataset({
      envelopes, base: 'USD', cycle: 1, cover: '2026-05-01', incomes: [inc], events: [ev],
      periods: [period('p', '2026-04-01', '2026-04-30')], planLines: planLines('p', { home: 50000, food: 30000, trans: 8000, pocket: 10000 }),
    });
    const s = new Engine(ds, '2026-04-01').snapshotFor('p')!;
    expect(s.R).toBe(132000);
    expect(s.alloc.buffer).toBe(34000);
    expect(s.horizon.mode).toBe('cover');
    expect(s.safe.H).toBe(30);
    expect(s.safe.pool).toBe(38000);
    expect(hero(s.safe.leftToday)).toBe(12);
  });
  it('cover date passed -> late mode, H = 3', () => {
    const ds = dataset({
      envelopes: [env('food', 'flexible', 0), env('buffer', 'buffer', 1)], cycle: 1, cover: '2026-05-01',
      periods: [period('p', '2026-05-01', '2026-05-31')], planLines: planLines('p', { food: 10000 }),
    });
    const s = new Engine(ds, '2026-05-02').snapshotFor('p')!;
    expect(s.horizon.mode).toBe('late');
    expect(s.safe.H).toBe(3);
  });
});

describe('funding primitives', () => {
  it('distribute: ties go to the lowest index and sum is exact', () => {
    expect(distribute(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(distribute(0, [1, 2])).toEqual([0, 0]);
    expect(distribute(5, [0, 0])).toEqual([0, 0]);
  });
  it('AC-PLAN-04: R < fixed funds only fixed, pro-rata', () => {
    const { ds } = example1();
    const alloc = { home: 40000, bills: 10000, inst: 8000, food: 35000, transport: 10000, fun: 6000, pocket: 12000, savings: 10000, buffer: 19000 };
    const f = computeFunding(29000, alloc, ds.envelopes);
    expect(f.home + f.bills + f.inst).toBe(29000);
    expect(f.food + f.transport + f.fun + f.pocket + f.savings + f.buffer).toBe(0);
  });
  it('AC-PLAN-05: R above total planned adds the surplus to Buffer', () => {
    const { ds } = example1();
    const alloc = { home: 40000, bills: 10000, inst: 8000, food: 35000, transport: 10000, fun: 6000, pocket: 12000, savings: 10000, buffer: 19000 };
    const f = computeFunding(160000, alloc, ds.envelopes);
    expect(f.buffer).toBe(29000);
    expect(f.food).toBe(35000);
  });
  it('AC-PLAN-01/02: derived Buffer line and over-planned', () => {
    const { ds, plan } = example1();
    expect(withBuffer(plan, ds.envelopes, 150000).alloc.buffer).toBe(19000);
    const over = withBuffer(plan, ds.envelopes, 120000);
    expect(over.alloc.buffer).toBe(0);
    expect(over.overPlanned).toBe(11000);
  });
});
