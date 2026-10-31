import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { SakinDB, useTestDb } from './db';
import {
  completeOnboarding, loadAll, recordPayment, runMaintenance, saveInstallment, saveRule, setAutoPost, undoPayment, pauseRule, resumeRule, SCHEMA_VERSION,
} from './repo';
import { buildBackup, parseBackup, sha256Hex } from './backup';
import { buildCsv } from './csv';
import { Engine, loanStatus, paymentsOverview } from '../domain';

let n = 0;
beforeEach(() => {
  useTestDb(`pay${++n}`);
});
const names = {
  envelope: { home: 'Home', bills: 'Bills', food: 'Food', transport: 'Transport', family: 'Family', fun: 'Fun', pocket: 'My share', savings: 'Savings', buffer: 'Buffer', installments: 'Installments' },
  income: { salary: 'Salary', first: 'First', second: 'Second', allowance: 'Allowance', freelance: 'Freelance' },
  starting: 'Starting amount', workspace: 'Me',
};
const onboard = (today: string) =>
  completeOnboarding({ input: { today, freq: 'monthly', amount: 150000, day: 5, amount2: 0, day2: 20, nextPayDate: null, exp: 2 }, locale: 'en', region: 'AZ', currency: 'AZN', moneyNow: 150000, names });
const envId = async (name: string) => (await loadAll())!.ds.envelopes.find((e) => e.name === name)!.id;
const hero = async (today: string) => new Engine((await loadAll())!.ds, today).current()!.safe;
const totalAvailable = async (today: string) => {
  const d = (await loadAll())!;
  return Object.values(new Engine(d.ds, today).current()!.available).reduce((a, b) => a + b, 0);
};

describe('confirm mode ("I paid")', () => {
  it('a confirm-mode bill waits instead of posting; "I paid" records the actual amount; the hero does not move', async () => {
    await onboard('2026-04-05');
    const bills = await envId('Bills');
    await saveRule({ name: 'Gas', payee: 'Gas company', envelopeId: bills, amount: 3000, frequency: 'monthly', anchorDate: '2026-04-10', dayOfMonth: 10, autoPost: false }, '2026-04-12');
    await runMaintenance('2026-04-12');
    let d = (await loadAll())!;
    expect(d.allTx.filter((t) => t.source === 'recurring')).toHaveLength(0);
    const o = () => paymentsOverview({ rules: d.rules, plans: d.installments, txns: d.ds.transactions, today: '2026-04-12', firstStart: '2026-04-05', to: '2026-05-04', periodStart: '2026-04-05', periodEnd: '2026-05-04' });
    expect(o().waitingCount).toBe(1);
    const before = await hero('2026-04-12');
    const res = await recordPayment({ ref: 'rule', id: d.rules[0].id, dueDate: '2026-04-10', amount: 2870, date: '2026-04-12', envelopeId: bills }, '2026-04-12');
    expect(res.txIds).toHaveLength(1);
    d = (await loadAll())!;
    const t = d.allTx.find((x) => x.id === res.txIds[0])!;
    expect(t).toMatchObject({ source: 'recurring', recurringRuleId: d.rules[0].id, occurrenceDate: '2026-04-10', amount: 2870, merchant: 'Gas company' });
    expect(o().waitingCount).toBe(0);
    const after = await hero('2026-04-12');
    expect(after.leftToday).toBe(before.leftToday);
    expect(after.pool).toBe(before.pool);
    // double tap / second tab: nothing new
    const again = await recordPayment({ ref: 'rule', id: d.rules[0].id, dueDate: '2026-04-10', amount: 2870, date: '2026-04-12', envelopeId: bills }, '2026-04-12');
    expect(again.already).toBe(true);
    expect((await loadAll())!.allTx.filter((x) => x.source === 'recurring' && !x.deletedAt)).toHaveLength(1);
    // undo: it waits again, and auto-posting never takes over
    await undoPayment(res.txIds, '2026-04-12');
    await runMaintenance('2026-04-12');
    d = (await loadAll())!;
    expect(o().waitingCount).toBe(1);
    expect(d.ds.transactions.filter((x) => x.source === 'recurring')).toHaveLength(0);
  });
  it('a bill still waiting at the end of a period stays reserved in the next period plan', async () => {
    await onboard('2026-04-05');
    const bills = await envId('Bills');
    await saveRule({ name: 'Gas', envelopeId: bills, amount: 3000, frequency: 'monthly', anchorDate: '2026-05-01', dayOfMonth: 1, autoPost: false }, '2026-04-20');
    await runMaintenance('2026-05-06'); // new period 05-05..06-04 created; the 05-01 gas bill is still waiting
    const d = (await loadAll())!;
    const p2 = d.ds.periods.find((p) => p.startDate === '2026-05-05')!;
    const line = d.ds.planLines.find((l) => l.periodId === p2.id && l.envelopeId === bills)!;
    const master = d.ws.masterPlan[bills] ?? 0;
    // 06-01 is due in the period and 05-01 is carried over: both must fit
    expect(line.amount).toBeGreaterThanOrEqual(Math.max(master, 6000));
  });
  it('auto mode: switching on records due dates from today on only; pause and resume skip the paused dates', async () => {
    await onboard('2026-04-05');
    const bills = await envId('Bills');
    await saveRule({ name: 'Water', envelopeId: bills, amount: 1000, frequency: 'monthly', anchorDate: '2026-04-08', dayOfMonth: 8, autoPost: false }, '2026-04-10');
    const id = (await loadAll())!.rules[0].id;
    await setAutoPost('rule', id, true, '2026-04-10');
    await runMaintenance('2026-05-09');
    let txs = (await loadAll())!.ds.transactions.filter((t) => t.recurringRuleId === id);
    expect(txs.map((t) => t.occurrenceDate)).toEqual(['2026-05-08']); // 04-08 keeps waiting for "I paid"
    await pauseRule(id, '2026-05-10');
    await resumeRule(id, '2026-07-20');
    const r = (await loadAll())!.rules[0];
    expect(r.skippedDates).toEqual(expect.arrayContaining(['2026-06-08', '2026-07-08']));
    await runMaintenance('2026-07-20');
    txs = (await loadAll())!.ds.transactions.filter((t) => t.recurringRuleId === id);
    expect(txs.map((t) => t.occurrenceDate).sort()).toEqual(['2026-05-08']);
  });
});

describe('loans: pay as you go', () => {
  it('partial, extra and overpay; remaining debt, fewer payments, done and undo', async () => {
    await onboard('2026-04-05');
    const inst = await envId('Installments');
    const plan = await saveInstallment({ name: 'Car loan', payee: 'Bank', kind: 'loan', envelopeId: inst, paymentAmount: 10000, paymentCount: 6, firstDueDate: '2026-04-10', principal: 50000, interestRate: 20, autoPost: false }, '2026-04-06');
    const status = async (today = '2026-04-12') => {
      const d = (await loadAll())!;
      return loanStatus(d.installments[0], d.ds.transactions, today);
    };
    expect((await status()).remaining).toBe(60000);
    const s0 = (await loadAll())!.ds.transactions.length;
    // partial: 8,000 instead of 10,000
    await recordPayment({ ref: 'loan', id: plan.id, dueDate: '2026-04-10', n: 1, amount: 8000, date: '2026-04-12', envelopeId: inst }, '2026-04-12');
    let s = await status();
    expect(s.paid).toBe(8000);
    expect(s.remaining).toBe(52000);
    expect(s.paymentsLeft).toBe(6); // 5 x 10,000 + 2,000
    // extra 25,000: shorter term, same monthly amount
    const extra = await recordPayment({ ref: 'loan', id: plan.id, amount: 25000, date: '2026-04-12', envelopeId: inst }, '2026-04-12');
    s = await status();
    expect(s.remaining).toBe(27000);
    expect(s.paymentsLeft).toBe(3);
    expect(s.payoffDate).toBe('2026-07-10');
    // overpay: only 27,000 can go to the loan; 3,000 becomes a normal expense
    const over = await recordPayment({ ref: 'loan', id: plan.id, amount: 30000, date: '2026-04-12', envelopeId: inst }, '2026-04-12');
    expect(over.rest).toBe(3000);
    expect(over.txIds).toHaveLength(2);
    let d = (await loadAll())!;
    expect(d.installments[0].status).toBe('done');
    expect(d.ds.transactions.find((t) => t.id === over.txIds[1])).toMatchObject({ source: 'manual', amount: 3000, installmentId: null });
    s = await status();
    expect(s.remaining).toBe(0);
    expect(s.paid).toBe(60000);
    // nothing else posts once done, and money stays conserved: every saved row is an expense
    await runMaintenance('2026-09-30');
    d = (await loadAll())!;
    expect(d.ds.transactions.length).toBe(s0 + 4);
    // undo the overpay -> active again
    await undoPayment(over.txIds, '2026-04-12');
    expect((await loadAll())!.installments[0].status).toBe('active');
    expect((await status()).remaining).toBe(27000);
    await undoPayment(extra.txIds, '2026-04-12');
    expect((await status()).paymentsLeft).toBe(6);
  });
  it('money is conserved: available everywhere = received - spent, before and after loan payments', async () => {
    await onboard('2026-04-05');
    const inst = await envId('Installments');
    const plan = await saveInstallment({ name: 'Phone', kind: 'installment', envelopeId: inst, paymentAmount: 8500, paymentCount: 6, firstDueDate: '2026-04-15', autoPost: false }, '2026-04-06');
    const t0 = await totalAvailable('2026-04-16');
    await recordPayment({ ref: 'loan', id: plan.id, dueDate: '2026-04-15', n: 1, amount: 8500, date: '2026-04-16', envelopeId: inst }, '2026-04-16');
    await recordPayment({ ref: 'loan', id: plan.id, amount: 1500, date: '2026-04-16', envelopeId: inst }, '2026-04-16');
    expect(await totalAvailable('2026-04-16')).toBe(t0 - 10000);
  });
  it('a future date is refused; an invalid amount is refused (never NaN in the database)', async () => {
    await onboard('2026-04-05');
    const inst = await envId('Installments');
    const plan = await saveInstallment({ name: 'Phone', envelopeId: inst, paymentAmount: 8500, paymentCount: 6, firstDueDate: '2026-04-15', autoPost: false }, '2026-04-06');
    await expect(recordPayment({ ref: 'loan', id: plan.id, amount: 100, date: '2026-04-20', envelopeId: inst }, '2026-04-16')).rejects.toThrow('future');
    await expect(recordPayment({ ref: 'loan', id: plan.id, amount: Number.NaN, date: '2026-04-16', envelopeId: inst }, '2026-04-16')).rejects.toThrow('amount');
  });
  it('CSV export carries payee and payment type', async () => {
    await onboard('2026-04-05');
    const inst = await envId('Installments');
    const plan = await saveInstallment({ name: 'Car loan', payee: 'Bank', kind: 'loan', envelopeId: inst, paymentAmount: 10000, paymentCount: 6, firstDueDate: '2026-04-10', autoPost: false }, '2026-04-06');
    await recordPayment({ ref: 'loan', id: plan.id, dueDate: '2026-04-10', n: 1, amount: 10000, date: '2026-04-10', envelopeId: inst }, '2026-04-10');
    const d = (await loadAll())!;
    const csv = buildCsv(d.allTx, { semicolon: false, baseCurrency: 'AZN', envelopes: d.ds.envelopes, rules: d.rules, plans: d.installments });
    // payment categories added a final `category` column (the envelope's stable key)
    expect(csv.split('\r\n')[0].endsWith(',payee,payment_type,category')).toBe(true);
    expect(csv).toMatch(/,Bank,loan,installments\r\n/);
  });
});

describe('migration of existing data (no behaviour change)', () => {
  it('IndexedDB v2 -> v3: rules and installments keep AUTO mode; the old skip meaning is kept as "waived"', async () => {
    const name = `v2-${++n}`;
    const old = new Dexie(name);
    old.version(2).stores({
      workspaces: 'id', envelopes: 'id, workspaceId', incomes: 'id', incomeEvents: 'id, incomeId, expectedDate, status', periods: 'id, startDate',
      planLines: 'id, periodId', transactions: 'id, date, envelopeId, dedupeKey, occKey, deletedAt', rules: 'id', installments: 'id', transfers: 'id, periodId',
      decisions: 'id, periodId', snapshots: 'id', meta: 'key',
    });
    await old.open();
    await old.table('rules').add({ id: 'r1', name: 'Rent', amount: 100, envelopeId: 'e', frequency: 'monthly', anchorDate: '2026-01-05', dayOfMonth: 5, skippedDates: [], active: true });
    await old.table('installments').add({ id: 'i1', name: 'Phone', paymentAmount: 100, paymentCount: 4, firstDueDate: '2026-01-05', paidBeforeCount: 0, skipped: [2], status: 'active' });
    old.close();
    const db = new SakinDB(name);
    await db.open();
    expect(await db.rules.get('r1')).toMatchObject({ autoPost: true, payee: null, autoFrom: null, pausedAt: null });
    expect(await db.installments.get('i1')).toMatchObject({ autoPost: true, kind: 'installment', principal: null, interestRate: null, waived: [2], skipped: [2] });
    expect((await db.table('meta').get('migration'))!.value).toMatchObject({ from: 3, to: 4 }); // v3 ran, then v4 (categories) recorded last
    db.close();
  });
  it('backup v1 files import with auto mode and the waived meaning; new backups are current', async () => {
    await onboard('2026-04-05');
    const inst = await envId('Installments');
    await saveInstallment({ name: 'Phone', envelopeId: inst, paymentAmount: 100, paymentCount: 4, firstDueDate: '2026-04-10', skipped: [2] }, '2026-04-06');
    const cur = await buildBackup();
    expect(cur.schemaVersion).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe(3); // 3 = payment categories
    // forge what v1 wrote: no payee / kind / autoPost / waived
    const data = JSON.parse(JSON.stringify(cur.data));
    for (const p of data.installmentPlans) for (const k of ['payee', 'kind', 'principal', 'interestRate', 'autoPost', 'autoFrom', 'waived']) delete p[k];
    const plain = JSON.stringify(data);
    const v1 = { ...cur, schemaVersion: 1, data, checksum: await sha256Hex(plain) };
    const { data: back } = await parseBackup(JSON.stringify(v1));
    expect(back.installmentPlans[0]).toMatchObject({ autoPost: true, kind: 'installment', waived: [2] });
  });
  it('an existing auto-mode installment keeps posting exactly as before', async () => {
    await onboard('2026-04-05');
    const inst = await envId('Installments');
    await saveInstallment({ name: 'Phone', envelopeId: inst, paymentAmount: 12500, paymentCount: 4, firstDueDate: '2026-04-15' }, '2026-06-20');
    const txs = (await loadAll())!.allTx.filter((t) => t.source === 'installment');
    expect(txs.map((t) => t.installmentNo).sort()).toEqual([1, 2, 3]);
    expect(txs.every((t) => t.amount === 12500)).toBe(true);
  });
});
