import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTestDb, db } from './db';
import {
  addTransaction, completeOnboarding, deleteTransaction, loadAll, receiveIncome, restoreTransaction, runMaintenance, saveInstallment, saveRule,
  updateTransaction, moveMoney, confirmPeriod, updateWorkspace,
} from './repo';
import { BackupError, buildBackup, parseBackup, restoreData, undoRestore } from './backup';
import { buildCsv, decimalString } from './csv';
import { Engine, floorMajor } from '../domain';
import type { OnboardInput } from '../domain';

let n = 0;
beforeEach(() => {
  useTestDb(`t${++n}`);
});

const names = {
  envelope: { home: 'Home', bills: 'Bills', food: 'Food', transport: 'Transport', family: 'Family', fun: 'Fun', pocket: 'My share', savings: 'Savings', buffer: 'Buffer' },
  income: { salary: 'Salary', first: 'First', second: 'Second', allowance: 'Allowance', freelance: 'Freelance' },
  starting: 'Starting amount', workspace: 'Me',
};
const input = (today: string, over: Partial<OnboardInput> = {}): OnboardInput => ({
  today, freq: 'monthly', amount: 150000, day: 5, amount2: 0, day2: 20, nextPayDate: null, exp: 2, ...over,
});
const onboard = (today: string, over: Partial<OnboardInput> = {}, moneyNow = 150000) =>
  completeOnboarding({ input: input(today, over), locale: 'en', region: 'AZ', currency: 'AZN', moneyNow, names });

describe('onboarding and hero (integration)', () => {
  it('AC-ONB-08/09: pay day today -> period starts today, hero is a number, Buffer is the remainder', async () => {
    await onboard('2026-04-05');
    await runMaintenance('2026-04-05');
    const d = (await loadAll())!;
    expect(d.ds.periods).toHaveLength(1);
    expect(d.ds.periods[0].startDate).toBe('2026-04-05');
    const snap = new Engine(d.ds, '2026-04-05').current()!;
    expect(snap.R).toBe(150000);
    const sum = d.ds.envelopes.filter((e) => e.kind !== 'buffer').reduce((s, e) => s + (snap.alloc[e.id] ?? 0), 0);
    expect(sum).toBeLessThanOrEqual(150000);
    expect(snap.alloc[d.ds.envelopes.find((e) => e.kind === 'buffer')!.id]).toBe(150000 - sum);
    expect(floorMajor(snap.safe.leftToday, 2)).toBeGreaterThan(0);
  });
  it('AC-ONB-07: pay day 10 days ago -> partial period, starting amount, scaled plan', async () => {
    await onboard('2026-04-15', {}, 40000);
    await runMaintenance('2026-04-15');
    const d = (await loadAll())!;
    expect(d.ds.periods[0]).toMatchObject({ startDate: '2026-04-15', endDate: '2026-05-04', scaledFirstPeriod: true });
    const starting = d.ds.events.find((e) => e.status === 'received')!;
    expect(starting.receivedBase).toBe(40000);
    const snap = new Engine(d.ds, '2026-04-15').current()!;
    expect(snap.R).toBe(40000);
    expect(snap.horizon.mode).toBe('scheduled');
    expect(snap.safe.H).toBe(20);
    // events for the already-passed pay day are not left as "late"
    expect(d.ds.events.filter((e) => e.status === 'expected' && (e.expectedDate ?? '') < '2026-04-15')).toHaveLength(0);
  });
  it('AC-ONB-11: data persists', async () => {
    await onboard('2026-04-05');
    expect((await loadAll())!.ds.envelopes.length).toBeGreaterThan(5);
  });
});

describe('transactions', () => {
  it('AC-EXP-03/08: add, delete (soft), restore; excluded from calculations while deleted', async () => {
    await onboard('2026-04-05');
    const d0 = (await loadAll())!;
    const food = d0.ds.envelopes.find((e) => e.name === 'Food')!;
    const before = new Engine(d0.ds, '2026-04-06').current()!.safe.leftToday;
    const t = await addTransaction({ type: 'expense', date: '2026-04-06', amount: 1000, currency: 'AZN', envelopeId: food.id }, '2026-04-06');
    const mid = new Engine((await loadAll())!.ds, '2026-04-06').current()!.safe.leftToday;
    expect(mid).toBeLessThan(before);
    await deleteTransaction(t.id, '2026-04-06');
    const afterDel = (await loadAll())!;
    expect(new Engine(afterDel.ds, '2026-04-06').current()!.safe.leftToday).toBe(before);
    expect(afterDel.allTx.find((x) => x.id === t.id)!.deletedAt).not.toBeNull();
    await restoreTransaction(t.id, '2026-04-06');
    expect(new Engine((await loadAll())!.ds, '2026-04-06').current()!.safe.leftToday).toBe(mid);
  });
  it('AC-EXP-04: future dates are refused; AC-EXP-02: zero amount refused', async () => {
    await onboard('2026-04-05');
    const food = (await loadAll())!.ds.envelopes.find((e) => e.name === 'Food')!;
    await expect(addTransaction({ type: 'expense', date: '2026-04-09', amount: 100, currency: 'AZN', envelopeId: food.id }, '2026-04-06')).rejects.toThrow('future');
    await expect(addTransaction({ type: 'expense', date: '2026-04-06', amount: 0, currency: 'AZN', envelopeId: food.id }, '2026-04-06')).rejects.toThrow('amount');
  });
  it('AC-CUR-01/02 / AC-EXP-11: foreign currency needs a rate, is converted once, stored rate prefills', async () => {
    await onboard('2026-04-05');
    const food = (await loadAll())!.ds.envelopes.find((e) => e.name === 'Food')!;
    await expect(addTransaction({ type: 'expense', date: '2026-04-06', amount: 1000, currency: 'EUR', envelopeId: food.id }, '2026-04-06')).rejects.toThrow('rate-required');
    const t = await addTransaction({ type: 'expense', date: '2026-04-06', amount: 1000, currency: 'EUR', rate: '1.10', envelopeId: food.id }, '2026-04-06');
    expect(t.amountBase).toBe(1100);
    expect((await loadAll())!.ws.rates.EUR.rate).toBe('1.10');
    const t2 = await addTransaction({ type: 'expense', date: '2026-04-06', amount: 1000, currency: 'EUR', envelopeId: food.id }, '2026-04-06');
    expect(t2.amountBase).toBe(1100);
  });
  it('AC-EXP-09: duplicate (source, sourceRef) is rejected', async () => {
    await onboard('2026-04-05');
    const food = (await loadAll())!.ds.envelopes.find((e) => e.name === 'Food')!;
    const base = { type: 'expense' as const, date: '2026-04-06', amount: 100, currency: 'AZN', envelopeId: food.id, source: 'qr' as const, sourceRef: 'abc' };
    await addTransaction(base, '2026-04-06');
    await expect(addTransaction(base, '2026-04-06')).rejects.toThrow('duplicate');
  });
  it('AC-EXP-05 / AC-PER-03: editing a closed period applies the delta to the current Buffer, snapshot unchanged', async () => {
    await onboard('2026-04-05');
    const d0 = (await loadAll())!;
    const food = d0.ds.envelopes.find((e) => e.name === 'Food')!;
    const t = await addTransaction({ type: 'expense', date: '2026-04-10', amount: 2000, currency: 'AZN', envelopeId: food.id }, '2026-04-10');
    await runMaintenance('2026-05-06');
    let d = (await loadAll())!;
    expect(d.ds.periods.map((p) => p.state)).toEqual(['closing', 'open']);
    await confirmPeriod(d.ds.periods[0].id, '2026-05-06');
    d = (await loadAll())!;
    expect(d.ds.periods[0].state).toBe('closed');
    const bufId = d.ds.envelopes.find((e) => e.kind === 'buffer')!.id;
    const before = new Engine(d.ds, '2026-05-06').current()!.rows[bufId].rolloverIn;
    await updateTransaction(t.id, { amount: 3000 }, '2026-05-06');
    d = (await loadAll())!;
    const after = new Engine(d.ds, '2026-05-06').current()!.rows[bufId].rolloverIn;
    expect(after - before).toBe(-1000);
    expect(d.ds.decisions.find((x) => x.periodId === d.ds.periods[0].id && x.envelopeId === food.id && !x.adjustment)!.leftover).toBeGreaterThan(0);
  });
});

describe('income', () => {
  it('AC-INC-02: marking the salary received funds the plan', async () => {
    await onboard('2026-04-01', {}, 150000); // pay day 5 coming up
    await runMaintenance('2026-05-05');
    const d = (await loadAll())!;
    const ev = d.ds.events.find((e) => e.status === 'expected' && e.expectedDate === '2026-05-05')!;
    const r = await receiveIncome(ev.id, { amount: 150000, currency: 'AZN', date: '2026-05-05' });
    expect(r.uncertain).toBe(false);
    const d2 = (await loadAll())!;
    expect(new Engine(d2.ds, '2026-05-05').current()!.R).toBe(150000);
  });
});

describe('recurring and installments (integration)', () => {
  it('AC-REC-01/03 + AC-INS-01: rules post once, reopening is idempotent, installments post on due dates', async () => {
    await onboard('2026-04-05');
    const d = (await loadAll())!;
    const home = d.ds.envelopes.find((e) => e.name === 'Home')!;
    await saveRule({ name: 'Rent', envelopeId: home.id, amount: 40000, frequency: 'monthly', anchorDate: '2026-04-12', dayOfMonth: 12 }, '2026-04-20');
    await saveRule({ name: 'Rent', envelopeId: home.id, amount: 40000, frequency: 'monthly', anchorDate: '2026-04-12', dayOfMonth: 12 }, '2026-04-20');
    await runMaintenance('2026-04-20');
    await runMaintenance('2026-04-20');
    let all = (await loadAll())!.allTx.filter((t) => t.source === 'recurring');
    expect(all).toHaveLength(2); // two rules saved above; each posts once
    expect(all.every((t) => t.date === '2026-04-12')).toBe(true);
    await saveInstallment({ name: 'Phone', envelopeId: home.id, paymentAmount: 12500, paymentCount: 4, firstDueDate: '2026-04-15' }, '2026-06-20');
    all = (await loadAll())!.allTx.filter((t) => t.source === 'installment');
    expect(all.map((t) => t.installmentNo).sort()).toEqual([1, 2, 3]);
    expect((await loadAll())!.installments[0].status).toBe('active');
    await runMaintenance('2026-07-20');
    expect((await loadAll())!.installments[0].status).toBe('done');
  });
  it('AC-REC-04: estimate bills post as pending and count as spent', async () => {
    await onboard('2026-04-05');
    const home = (await loadAll())!.ds.envelopes.find((e) => e.name === 'Bills')!;
    await saveRule({ name: 'Utilities', envelopeId: home.id, amount: 5000, frequency: 'monthly', anchorDate: '2026-04-10', dayOfMonth: 10, estimate: true }, '2026-04-12');
    const t = (await loadAll())!.allTx.find((x) => x.source === 'recurring')!;
    expect(t.status).toBe('pending');
  });
});

describe('rebalance and plan', () => {
  it('AC-REB-04/06: transfer keeps the sum, soft-undo restores balances', async () => {
    await onboard('2026-04-05');
    const d = (await loadAll())!;
    const [a, b] = d.ds.envelopes.filter((e) => e.kind === 'flexible');
    const pid = d.ds.periods[0].id;
    const sum = (x: typeof d) => Object.values(new Engine(x.ds, '2026-04-06').current()!.available).reduce((s, v) => s + v, 0);
    const s0 = sum(d);
    const tr = await moveMoney({ periodId: pid, from: a.id, to: b.id, amount: 500 }, '2026-04-06');
    expect(sum((await loadAll())!)).toBe(s0);
    expect(tr.amount).toBe(500);
  });
  it('AC-PER-09: changing the cycle start day keeps the current period', async () => {
    await onboard('2026-04-05');
    await updateWorkspace({ cycleStartDay: 15 });
    await runMaintenance('2026-05-06');
    const p = (await loadAll())!.ds.periods;
    expect(p[0].endDate).toBe('2026-05-04');
    expect(p[1]).toMatchObject({ startDate: '2026-05-05', endDate: '2026-05-14' });
  });
});

describe('backup, restore, CSV', () => {
  it('AC-DATA-03: JSON backup restores the identical state (hero equal)', async () => {
    await onboard('2026-04-05');
    const d0 = (await loadAll())!;
    const food = d0.ds.envelopes.find((e) => e.name === 'Food')!;
    await addTransaction({ type: 'expense', date: '2026-04-06', amount: 1234, currency: 'AZN', envelopeId: food.id, note: 'a, "quoted"; note' }, '2026-04-06');
    const file = await buildBackup();
    const heroBefore = new Engine((await loadAll())!.ds, '2026-04-06').current()!.safe.leftToday;
    useTestDb('fresh1');
    const { data } = await parseBackup(JSON.stringify(file));
    await restoreData(data);
    const after = (await loadAll())!;
    expect(new Engine(after.ds, '2026-04-06').current()!.safe.leftToday).toBe(heroBefore);
    expect(after.allTx.some((t) => t.note === 'a, "quoted"; note')).toBe(true);
  });
  it('AC-DATA-04: wrong passphrase fails calmly, nothing changes; right passphrase works', async () => {
    await onboard('2026-04-05');
    const file = await buildBackup('correct horse');
    const text = JSON.stringify(file);
    expect(text).not.toContain('Salary');
    await expect(parseBackup(text, 'wrong')).rejects.toMatchObject({ code: 'passphrase' });
    await expect(parseBackup(text)).rejects.toMatchObject({ code: 'needs-passphrase' });
    expect((await parseBackup(text, 'correct horse')).data.envelopes.length).toBeGreaterThan(5);
  }, 20000);
  it('AC-DATA-05/06: newer schema refused, corrupted file refused', async () => {
    await onboard('2026-04-05');
    const file = await buildBackup();
    await expect(parseBackup(JSON.stringify({ ...file, schemaVersion: 99 }))).rejects.toMatchObject({ code: 'newer' });
    const bad = JSON.parse(JSON.stringify(file));
    bad.data.transactions.push({ id: 'x' });
    await expect(parseBackup(JSON.stringify(bad))).rejects.toMatchObject({ code: 'checksum' });
    await expect(parseBackup('{"nope":1}')).rejects.toBeInstanceOf(BackupError);
    await expect(parseBackup('not json')).rejects.toMatchObject({ code: 'json' });
  });
  it('AC-DATA-07/08: pre-restore snapshot allows undo; failed restore leaves the database unchanged', async () => {
    await onboard('2026-04-05');
    const original = (await loadAll())!;
    const file = await buildBackup();
    // corrupt: duplicate ids in a table -> bulkAdd throws mid-way
    const broken = JSON.parse(JSON.stringify(file.data));
    broken.envelopes.push(broken.envelopes[0]);
    await expect(restoreData(broken)).rejects.toBeTruthy();
    const after = (await loadAll())!;
    expect(after.ds.envelopes.length).toBe(original.ds.envelopes.length);
    expect(after.ws.id).toBe(original.ws.id);
    // good restore of different data, then undo
    const other = JSON.parse(JSON.stringify(file.data));
    other.workspace.name = 'Other';
    await restoreData(other);
    expect((await loadAll())!.ws.name).toBe('Other');
    expect(await undoRestore()).toBe(true);
    expect((await loadAll())!.ws.name).toBe('Me');
  });
  it('AC-DATA-01/02: CSV columns, BOM, delimiter, quoting, decimals, deleted rows excluded', async () => {
    await onboard('2026-04-05');
    const d = (await loadAll())!;
    const food = d.ds.envelopes.find((e) => e.name === 'Food')!;
    const t1 = await addTransaction({ type: 'expense', date: '2026-04-06', amount: 1250, currency: 'AZN', envelopeId: food.id, note: 'milk, "2%"' }, '2026-04-06');
    const t2 = await addTransaction({ type: 'expense', date: '2026-04-06', amount: 999, currency: 'AZN', envelopeId: food.id }, '2026-04-06');
    await deleteTransaction(t2.id, '2026-04-06');
    const all = (await loadAll())!;
    const csv = buildCsv(all.allTx, { semicolon: false, baseCurrency: 'AZN', envelopes: all.ds.envelopes });
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toBe('id,date,type,amount,currency,rate,amount_base,base_currency,envelope,merchant,note,source,status,payee,payment_type,category');
    expect(csv).toContain('12.50');
    expect(csv).toContain('"milk, ""2%"""');
    expect(csv).not.toContain(t2.id);
    expect(lines.length).toBe(1 + all.ds.transactions.length);
    expect(t1.id).toBeTruthy();
    const semi = buildCsv(all.allTx, { semicolon: true, baseCurrency: 'AZN', envelopes: all.ds.envelopes });
    expect(semi.split('\r\n')[0]).toContain(';');
    expect(decimalString(5, 2)).toBe('0.05');
    expect(decimalString(-1234, 2)).toBe('-12.34');
    expect(decimalString(100, 0)).toBe('100');
  });
});

it('db is isolated per test', async () => {
  expect(await db.workspaces.count()).toBe(0);
});

describe('sample data (taksit-first)', () => {
  it('the Azerbaijani template has an Installments envelope and the sample shows one installment falling due this period', async () => {
    const { seedDemo } = await import('./seed');
    const today = '2026-10-30';
    const nm = { ...names, envelope: { ...names.envelope, installments: 'Taksitlər', groceries: 'Groceries' } };
    await seedDemo({
      names: nm, locale: 'az', region: 'AZ', currency: 'AZN', today,
      notes: { coffee: 'c', market: 'm', bus: 'b', lunch: 'l', rent: 'Rent', phone: 'Phone installment', pharmacy: 'p', gift: 'g', cinema: 'ci', taxi: 't' },
    });
    const d = (await loadAll())!;
    const inst = d.ds.envelopes.find((e) => e.icon === 'calendar-clock');
    expect(inst?.name).toBe('Taksitlər');
    expect(inst?.kind).toBe('fixed');
    expect(d.installments).toHaveLength(1);
    expect(d.installments[0].envelopeId).toBe(inst!.id);
    expect(d.installments[0].paidBeforeCount).toBe(2);
    const due = new Engine(d.ds, today).current()!;
    expect(due.rows[inst!.id].planned).toBeGreaterThan(0);
  });
});
