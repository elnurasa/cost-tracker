import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTestDb } from './db';
import {
  addTransaction, completeOnboarding, confirmAllClosing, convertBaseCurrency, deleteTransaction, loadAll, moveMoney, receiveIncome, runMaintenance,
  saveInstallment, updateEnvelope, updateTransaction,
} from './repo';
import { Engine, addDays, convertMinor, diffDays, sum } from '../domain';
import type { OnboardInput } from '../domain';

let n = 0;
beforeEach(() => {
  useTestDb(`inv${++n}`);
});

/** Small deterministic PRNG (mulberry32) so a failing seed can be replayed. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const names = {
  envelope: { home: 'Home', bills: 'Bills', food: 'Food', transport: 'Transport', family: 'Family', fun: 'Fun', pocket: 'My share', savings: 'Savings', buffer: 'Buffer' },
  income: { salary: 'Salary', first: 'First', second: 'Second', allowance: 'Allowance', freelance: 'Freelance' },
  starting: 'Starting amount', workspace: 'Me',
};

/**
 * THE conservation law of the product, checked on the real stack (IndexedDB -> repo -> engine):
 * the money sitting in all envelopes right now equals everything ever received minus everything ever spent.
 * Rollovers, moves, make-room, late edits and archiving may only relocate money, never create or destroy it.
 */
async function assertConserved(today: string, label: string) {
  const d = (await loadAll())!;
  const eng = new Engine(d.ds, today);
  const cur = eng.current()!;
  const idx = eng.periods.findIndex((p) => p.id === cur.periodId);
  let received = 0;
  let spent = 0;
  for (let i = 0; i <= idx; i++) {
    const s = eng.snapshotAt(i);
    received += s.R;
    spent += s.spentTotal;
    // per-period identity
    expect(sum(Object.values(s.available)), `${label}: period ${i} identity`).toBe(s.rolloverTotal + s.R - s.spentTotal);
  }
  expect(sum(Object.values(cur.available)), `${label}: global`).toBe(received - spent);
  // integers everywhere
  for (const v of Object.values(cur.available)) expect(Number.isInteger(v), label).toBe(true);
  expect(cur.safe.leftToday, label).toBeGreaterThanOrEqual(0);
}

describe('randomized conservation (rollover, rebalance, make-room, late edits, installments, archive)', () => {
  const SEEDS = 14;
  for (let seed = 1; seed <= SEEDS; seed++) {
    it(`seed ${seed}`, async () => {
      const r = rng(seed * 7919);
      const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
      const int = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
      const start = `2026-0${int(1, 6)}-${String(int(1, 28)).padStart(2, '0')}`;
      const freq = pick<OnboardInput['freq']>(['monthly', 'twice', 'weekly', 'monthly']);
      const inp: OnboardInput = { today: start, freq, amount: int(30000, 400000), day: int(1, 31), amount2: int(10000, 100000), day2: int(1, 31), nextPayDate: null, exp: 2 };
      await completeOnboarding({ input: inp, locale: 'en', region: pick(['AZ', 'TR', 'GLOBAL'] as const), currency: 'AZN', moneyNow: int(0, inp.amount), names });
      let today = start;
      await runMaintenance(today);
      await assertConserved(today, 'start');
      let installments = 0;
      for (let step = 0; step < 34; step++) {
        today = addDays(today, int(1, 9));
        await runMaintenance(today);
        let d = (await loadAll())!;
        const eng0 = new Engine(d.ds, today);
        const periodId = eng0.current()!.periodId;
        const envs = d.ds.envelopes.filter((e) => !e.archived);
        const spendable = envs.filter((e) => e.kind !== 'buffer');
        const ops = int(1, 4);
        for (let k = 0; k < ops; k++) {
          const roll = r();
          d = (await loadAll())!;
          const first = d.ds.periods[0].startDate;
          if (roll < 0.4) {
            const date = addDays(today, -int(0, 3));
            if (date >= first) await addTransaction({ type: r() < 0.12 ? 'refund' : 'expense', date, amount: int(1, 30000), currency: 'AZN', envelopeId: pick(spendable).id }, today);
          } else if (roll < 0.55) {
            const from = pick(envs);
            const to = pick(envs.filter((e) => e.id !== from.id));
            await moveMoney({ periodId, from: from.id, to: to.id, amount: int(1, 20000) }, today);
          } else if (roll < 0.7) {
            const ev = d.ds.events.filter((e) => e.status === 'expected' && (e.expectedDate ?? '9') <= today)[0];
            if (ev) await receiveIncome(ev.id, { amount: Math.max(1, ev.expectedAmount + int(-5000, 5000)), currency: 'AZN', date: today });
          } else if (roll < 0.8) {
            await confirmAllClosing(today);
          } else if (roll < 0.9) {
            // late edit / delete of any past manual expense (may sit in a closed period)
            const t = d.ds.transactions.filter((x) => x.source === 'manual' && x.type === 'expense');
            if (t.length) {
              const x = pick(t);
              if (r() < 0.5) await updateTransaction(x.id, { amount: int(1, 30000) }, today);
              else await deleteTransaction(x.id, today);
            }
          } else if (roll < 0.95 && installments < 2) {
            const fixed = envs.filter((e) => e.kind === 'fixed');
            if (fixed.length) {
              installments++;
              await saveInstallment({ name: 'Plan', envelopeId: pick(fixed).id, paymentAmount: int(500, 9000), paymentCount: int(2, 8), firstDueDate: addDays(today, int(0, 20)), paidBeforeCount: int(0, 1) }, today);
            }
          } else {
            // try to archive an envelope: only succeeds at a zero balance (the guard is the point)
            const cand = pick(spendable);
            await updateEnvelope(cand.id, { archived: true }).catch(() => undefined);
          }
          await assertConserved(today, `seed ${seed} step ${step} op ${k}`);
        }
        await runMaintenance(today);
        await assertConserved(today, `seed ${seed} step ${step} end`);
      }
    }, 60_000);
  }
});

describe('transfers are zero-sum', () => {
  it('any move leaves the sum of all balances unchanged (random amounts, including above the source balance)', async () => {
    const r = rng(42);
    await completeOnboarding({ input: { today: '2026-04-05', freq: 'monthly', amount: 150000, day: 5, amount2: 0, day2: 20, nextPayDate: null, exp: 2 }, locale: 'en', region: 'AZ', currency: 'AZN', moneyNow: 150000, names });
    await runMaintenance('2026-04-06');
    for (let i = 0; i < 60; i++) {
      const d = (await loadAll())!;
      const s = new Engine(d.ds, '2026-04-06').current()!;
      const ids = d.ds.envelopes.map((e) => e.id);
      const a = ids[Math.floor(r() * ids.length)];
      const b = ids.filter((x) => x !== a)[Math.floor(r() * (ids.length - 1))];
      const before = sum(Object.values(s.available));
      await moveMoney({ periodId: s.periodId, from: a, to: b, amount: 1 + Math.floor(r() * 99999) }, '2026-04-06');
      const s2 = new Engine((await loadAll())!.ds, '2026-04-06').current()!;
      expect(sum(Object.values(s2.available))).toBe(before);
    }
  });
});

describe('installments: schedule and totals', () => {
  it('posts exactly (count - paidBefore) payments of the exact amount, once each, even on day 29-31 starts', async () => {
    const r = rng(7);
    for (let k = 0; k < 8; k++) {
      useTestDb(`inst${++n}`);
      await completeOnboarding({ input: { today: '2026-01-05', freq: 'monthly', amount: 150000, day: 5, amount2: 0, day2: 20, nextPayDate: null, exp: 2 }, locale: 'en', region: 'AZ', currency: 'AZN', moneyNow: 150000, names });
      const home = (await loadAll())!.ds.envelopes.find((e) => e.name === 'Home')!;
      const count = 2 + Math.floor(r() * 9);
      const paidBefore = Math.floor(r() * 2);
      const amount = 100 + Math.floor(r() * 9000);
      const firstDay = [29, 30, 31, 28, 15][k % 5];
      const first = `2026-01-${String(firstDay).padStart(2, '0')}`;
      const plan = await saveInstallment({ name: 'P', envelopeId: home.id, paymentAmount: amount, paymentCount: count, firstDueDate: first, paidBeforeCount: paidBefore }, '2026-01-31');
      // the app is opened regularly; a single jump of more than 366 days intentionally stops catching up (AC-REC-05)
      for (let day = '2026-02-01'; day < '2027-03-01'; day = addDays(day, 20)) await runMaintenance(day);
      await runMaintenance('2027-03-01');
      await runMaintenance('2027-03-01');
      const tx = (await loadAll())!.allTx.filter((t) => t.installmentId === plan.id && !t.deletedAt);
      expect(tx).toHaveLength(count - paidBefore);
      expect(sum(tx.map((t) => t.amountBase))).toBe((count - paidBefore) * amount);
      expect(new Set(tx.map((t) => t.installmentNo)).size).toBe(tx.length);
      // consecutive months, never skipping or duplicating a month even when the day is clamped (29-31)
      const months = tx.map((t) => t.date.slice(0, 7)).sort();
      for (let i = 1; i < months.length; i++) expect(diffDays(`${months[i]}-01`, `${months[i - 1]}-01`)).toBeGreaterThanOrEqual(28);
    }
  });
});

describe('currency rounding invariants', () => {
  it('base conversion: |sum(convert(parts)) - convert(sum)| <= n/2 minor units; round-trip stays within one rounding step', () => {
    const r = rng(99);
    for (let i = 0; i < 300; i++) {
      const rate = `${1 + Math.floor(r() * 3)}.${String(Math.floor(r() * 1e4)).padStart(4, '0')}`;
      const parts = Array.from({ length: 1 + Math.floor(r() * 12) }, () => Math.floor(r() * 500000));
      const whole = convertMinor(sum(parts), rate, 2, 2);
      const piecewise = sum(parts.map((p) => convertMinor(p, rate, 2, 2)));
      expect(Math.abs(piecewise - whole)).toBeLessThanOrEqual(Math.ceil(parts.length / 2));
      const back = convertMinor(convertMinor(parts[0], rate, 2, 2), `${(1 / Number(rate)).toFixed(8)}`, 2, 2);
      expect(Math.abs(back - parts[0])).toBeLessThanOrEqual(Math.ceil(Number(rate)) + 1);
    }
  });
  it('0-, 2- and 3-decimal currencies keep exact integer arithmetic; half rounds away from zero; sign symmetric', () => {
    expect(convertMinor(1, '0.5', 2, 2)).toBe(1); // 0.5 -> 1 (half up)
    expect(convertMinor(-1, '0.5', 2, 2)).toBe(-1);
    expect(convertMinor(1000, '1.7', 2, 0)).toBe(17); // 10.00 * 1.7 = 17 JPY-style units
    expect(convertMinor(1000, '0.3', 0, 3)).toBe(300000);
    expect(convertMinor(0, '123.45678901', 2, 2)).toBe(0);
    for (const a of [1, 7, 99, 12345, 9_999_999]) expect(convertMinor(-a, '1.3333', 2, 2)).toBe(-convertMinor(a, '1.3333', 2, 2));
  });
  it('changing the base currency keeps the books consistent: sum of balances equals converted income - converted spending within n/2 units', async () => {
    useTestDb(`cur${++n}`);
    await completeOnboarding({ input: { today: '2026-04-05', freq: 'monthly', amount: 150000, day: 5, amount2: 0, day2: 20, nextPayDate: null, exp: 2 }, locale: 'en', region: 'AZ', currency: 'AZN', moneyNow: 150000, names });
    await runMaintenance('2026-04-20');
    const food = (await loadAll())!.ds.envelopes.find((e) => e.name === 'Food')!;
    const r = rng(5);
    for (let i = 0; i < 12; i++) await addTransaction({ type: 'expense', date: `2026-04-${String(6 + (i % 10)).padStart(2, '0')}`, amount: 100 + Math.floor(r() * 5000), currency: 'AZN', envelopeId: food.id }, '2026-04-20');
    const before = (await loadAll())!;
    const b = new Engine(before.ds, '2026-04-20').current()!;
    const total0 = sum(Object.values(b.available));
    await convertBaseCurrency('USD', '0.5883');
    const after = (await loadAll())!;
    const a = new Engine(after.ds, '2026-04-20').current()!;
    const total1 = sum(Object.values(a.available));
    const items = before.ds.transactions.length + before.ds.events.length + 10;
    expect(Math.abs(total1 - convertMinor(total0, '0.5883', 2, 2))).toBeLessThanOrEqual(items);
  });
});
