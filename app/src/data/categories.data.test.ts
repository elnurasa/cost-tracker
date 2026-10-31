import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { SakinDB, useTestDb } from './db';
import {
  SCHEMA_VERSION, addTransaction, capturePlan, completeOnboarding, ensureEnvelope, loadAll, saveRule, savePlan, undoExpenseWithEnvelope, undoPaymentSave, updateEnvelope,
} from './repo';
import { BackupError, buildBackup, parseBackup, sha256Hex } from './backup';
import { buildCsv } from './csv';
import { Engine, makeRoom, paymentsByCategory, paymentsOverview } from '../domain';

let n = 0;
beforeEach(() => {
  useTestDb(`cat${++n}`);
});
const names = {
  envelope: { home: 'Ev', bills: 'Kommunal', food: 'Food', transport: 'Transport', family: 'Family', fun: 'Fun', pocket: 'My share', savings: 'Savings', buffer: 'Buffer', installments: 'Taksitlər' },
  income: { salary: 'Salary', first: 'First', second: 'Second', allowance: 'Allowance', freelance: 'Freelance' },
  starting: 'Starting amount', workspace: 'Me',
};
const T = '2026-04-06';
const onboard = () =>
  completeOnboarding({ input: { today: '2026-04-05', freq: 'monthly', amount: 150000, day: 5, amount2: 0, day2: 20, nextPayDate: null, exp: 2 }, locale: 'az', region: 'AZ', currency: 'AZN', moneyNow: 150000, names });
const snap = async () => {
  const d = (await loadAll())!;
  return { d, s: new Engine(d.ds, T).current()! };
};
const totalAvailable = async () => Object.values((await snap()).s.available).reduce((a, b) => a + b, 0);

describe('envelope = category: keys on envelopes', () => {
  it('onboarding gives the template payment envelopes their stable key; everyday envelopes have none', async () => {
    await onboard();
    const d = (await loadAll())!;
    const key = (name: string) => d.ds.envelopes.find((e) => e.name === name)?.categoryKey;
    expect(key('Kommunal')).toBe('utilities');
    expect(key('Ev')).toBe('housing');
    expect(key('Taksitlər')).toBe('installments');
    expect(key('Food')).toBeNull();
    expect(key('Buffer')).toBeNull();
  });
  it('never a duplicate: asking for an existing category returns it; an archived one comes back', async () => {
    await onboard();
    const a = await ensureEnvelope({ name: 'Utilities', icon: 'zap', kind: 'fixed', categoryKey: 'utilities' });
    expect(a.created).toBe(false);
    expect(a.envelope.name).toBe('Kommunal');
    const b = await ensureEnvelope({ name: 'Kreditlər', icon: 'landmark', kind: 'fixed', categoryKey: 'loans' });
    expect(b.created).toBe(true);
    await updateEnvelope(b.envelope.id, { archived: true });
    const c = await ensureEnvelope({ name: 'Loans', icon: 'landmark', kind: 'fixed', categoryKey: 'loans' });
    expect(c).toMatchObject({ created: false, unarchived: true });
    expect(c.envelope.id).toBe(b.envelope.id);
    const d = (await loadAll())!;
    expect(d.ds.envelopes.filter((e) => e.categoryKey === 'loans')).toHaveLength(1);
  });
  it('a fixed envelope typed by hand gets the inferred key only when it is free', async () => {
    await onboard();
    const x = await ensureEnvelope({ name: 'Netflix', icon: 'receipt', kind: 'fixed' });
    expect(x.envelope.categoryKey).toBe('subscriptions');
    const y = await ensureEnvelope({ name: 'Su', icon: 'droplets', kind: 'fixed' });
    expect(y.created).toBe(true); // utilities already belongs to Kommunal: a second envelope is allowed, without the key
    expect(y.envelope.categoryKey).toBeNull();
    const z = await ensureEnvelope({ name: 'Kafe', icon: 'coffee', kind: 'flexible' });
    expect(z.envelope.categoryKey).toBeNull();
  });
});

describe('migration (AC-CAT-07)', () => {
  it('IndexedDB v3 -> v4: existing envelopes are matched by name/icon, names untouched, no duplicates', async () => {
    const name = `v3-${++n}`;
    const old = new Dexie(name);
    old.version(3).stores({
      workspaces: 'id', envelopes: 'id, workspaceId', incomes: 'id', incomeEvents: 'id, incomeId, expectedDate, status', periods: 'id, startDate',
      planLines: 'id, periodId', transactions: 'id, date, envelopeId, dedupeKey, occKey, deletedAt', rules: 'id', installments: 'id', transfers: 'id, periodId',
      decisions: 'id, periodId', snapshots: 'id', meta: 'key',
    });
    await old.open();
    const env = (id: string, nm: string, icon: string, kind: string, order: number) => ({ id, workspaceId: 'w', name: nm, icon, kind, order, archived: false, rolloverRule: 'carry', deletedAt: null });
    await old.table('envelopes').bulkAdd([
      env('a', 'Kommunal', 'receipt', 'fixed', 1), env('b', 'Ev', 'house', 'fixed', 0), env('c', 'Taksitlər', 'calendar-clock', 'fixed', 2),
      env('d', 'Bills', 'receipt', 'fixed', 3), env('e', 'Food', 'shopping-basket', 'flexible', 4), env('f', 'Buffer', 'shield', 'buffer', 5),
    ]);
    await old.table('workspaces').add({ id: 'w', schemaVersion: 2 });
    old.close();
    const d4 = new SakinDB(name);
    await d4.open();
    const got = Object.fromEntries((await d4.envelopes.toArray()).map((e) => [e.id, e.categoryKey]));
    expect(got).toEqual({ a: 'utilities', b: 'housing', c: 'installments', d: null, e: null, f: null });
    expect((await d4.envelopes.get('a'))!.name).toBe('Kommunal');
    expect((await d4.workspaces.get('w'))!.schemaVersion).toBe(3);
    expect((await d4.table('meta').get('migration'))!.value).toMatchObject({ from: 3, to: 4 });
    d4.close();
  });
  it('backup v2 files import with inferred keys; new backups are v3; an unknown key is refused', async () => {
    await onboard();
    const cur = await buildBackup();
    expect(SCHEMA_VERSION).toBe(3);
    expect(cur.schemaVersion).toBe(3);
    const data = JSON.parse(JSON.stringify(cur.data));
    for (const e of data.envelopes) delete e.categoryKey;
    const v2 = { ...cur, schemaVersion: 2, data, checksum: await sha256Hex(JSON.stringify(data)) };
    const { data: back } = await parseBackup(JSON.stringify(v2));
    const k = (nm: string) => (back.envelopes as { name: string; categoryKey: string | null }[]).find((e) => e.name === nm)!.categoryKey;
    expect(k('Kommunal')).toBe('utilities');
    expect(k('Food')).toBeNull();
    const bad = JSON.parse(JSON.stringify(cur.data));
    bad.envelopes[0].categoryKey = 'weird';
    const forged = { ...cur, data: bad, checksum: await sha256Hex(JSON.stringify(bad)) };
    await expect(parseBackup(JSON.stringify(forged))).rejects.toBeInstanceOf(BackupError);
  });
  it('CSV has a category column with the stable key', async () => {
    await onboard();
    const d = (await loadAll())!;
    const bills = d.ds.envelopes.find((e) => e.name === 'Kommunal')!;
    await addTransaction({ type: 'expense', date: T, amount: 1000, currency: 'AZN', envelopeId: bills.id }, T);
    const d2 = (await loadAll())!;
    const csv = buildCsv(d2.allTx, { semicolon: false, baseCurrency: 'AZN', envelopes: d2.ds.envelopes });
    expect(csv.split('\r\n')[0]).toMatch(/,payee,payment_type,category$/);
    expect(csv).toMatch(/,Kommunal,.*,utilities\r\n/);
  });
});

describe('inline envelope from a payment: make room, conservation, undo (AC-CAT-02)', () => {
  it('the new fixed envelope is funded from Buffer/flexible, money is conserved, and undo restores everything', async () => {
    await onboard();
    const before = await snap();
    const totalBefore = await totalAvailable();
    const plan0 = await capturePlan(before.s.periodId);
    const period = before.d.ds.periods.find((p) => p.id === before.s.periodId)!;
    // what the form does on save: create the category envelope, make room for the payment due this period, save the rule
    const env = await ensureEnvelope({ name: 'Abunəliklər', icon: 'repeat', kind: 'fixed', categoryKey: 'subscriptions' });
    const planned = Object.fromEntries(before.d.ds.envelopes.filter((e) => e.kind !== 'buffer').map((e) => [e.id, before.s.rows[e.id]?.planned ?? 0]));
    const buffer = before.d.ds.envelopes.find((e) => e.kind === 'buffer')!;
    const room = makeRoom({ amount: 3200, targetId: '__new__', planned, bufferAlloc: before.s.alloc[buffer.id] ?? 0, envelopes: before.d.ds.envelopes, spent: {} });
    const na = { ...room.newAlloc, [env.envelope.id]: room.newAlloc.__new__ };
    delete na.__new__;
    await savePlan(period.id, na, true);
    const r = (await saveRule({ name: 'Video', envelopeId: env.envelope.id, amount: 3200, frequency: 'monthly', anchorDate: '2026-04-20', dayOfMonth: 20, autoPost: false }, T))!;
    const after = await snap();
    expect(after.s.rows[env.envelope.id].planned).toBe(3200);
    expect(await totalAvailable()).toBe(totalBefore); // money is moved, never created
    const o = paymentsOverview({ rules: after.d.rules, plans: after.d.installments, txns: after.d.ds.transactions, today: T, firstStart: period.startDate, to: period.endDate, periodStart: period.startDate, periodEnd: period.endDate });
    expect(paymentsByCategory(o.items, after.d.rules, after.d.installments, T).find((x) => x.envelopeId === env.envelope.id)).toMatchObject({ perMonth: 3200, perYear: 38400, count: 1 });
    await undoPaymentSave({ ref: 'rule', id: r.id, before: null, plan: plan0, createdEnvelopeId: env.envelope.id, unarchivedEnvelopeId: null });
    const undone = await snap();
    expect(undone.d.rules).toHaveLength(0);
    expect(undone.d.ds.envelopes.find((e) => e.id === env.envelope.id)).toBeUndefined();
    expect(undone.s.safe.leftToday).toBe(before.s.safe.leftToday);
    expect(await totalAvailable()).toBe(totalBefore);
    expect(undone.d.ws.masterPlan).toEqual(before.d.ws.masterPlan);
  });
  it('add-expense: an envelope created with the expense goes away with Undo; a used one stays', async () => {
    await onboard();
    const e = await ensureEnvelope({ name: 'Kafe', icon: 'coffee', kind: 'flexible' });
    const tx = await addTransaction({ type: 'expense', date: T, amount: 500, currency: 'AZN', envelopeId: e.envelope.id }, T);
    await undoExpenseWithEnvelope(tx.id, e.envelope.id, T);
    expect((await loadAll())!.ds.envelopes.find((x) => x.id === e.envelope.id)).toBeUndefined();
    const f = await ensureEnvelope({ name: 'Kitab', icon: 'book-open', kind: 'flexible' });
    const t1 = await addTransaction({ type: 'expense', date: T, amount: 500, currency: 'AZN', envelopeId: f.envelope.id }, T);
    await addTransaction({ type: 'expense', date: T, amount: 700, currency: 'AZN', envelopeId: f.envelope.id }, T);
    await undoExpenseWithEnvelope(t1.id, f.envelope.id, T);
    expect((await loadAll())!.ds.envelopes.find((x) => x.id === f.envelope.id)).toBeDefined();
  });
});

describe('sample data shows the categories (AC-CAT-08)', () => {
  it('Utilities (electricity, gas, water), Phone & internet, Loans, Installments, Subscriptions (2), Insurance one-time', async () => {
    const { seedDemo } = await import('./seed');
    const today = '2026-10-30';
    await seedDemo({
      names, locale: 'az', region: 'AZ', currency: 'AZN', today,
      notes: { coffee: 'c', market: 'm', bus: 'b', lunch: 'l', rent: 'Kirayə', phone: 'Telefon taksiti', pharmacy: 'p', gift: 'g', cinema: 'ci', taxi: 't', carLoan: 'Avtomobil krediti', electricity: 'İşıq', gas: 'Qaz', water: 'Su', internet: 'İnternet', insurance: 'Sığorta', music: 'Musiqi', video: 'Video' },
      catNames: { phone: 'Telefon və internet', loans: 'Kreditlər', subscriptions: 'Abunəliklər', insurance: 'Sığorta' },
    });
    const d = (await loadAll())!;
    const eng = new Engine(d.ds, today);
    const p = eng.currentPeriod()!;
    const s = eng.current()!;
    const byKey = (k: string) => d.ds.envelopes.find((e) => e.categoryKey === k)!;
    const inEnv = (k: string) => [...d.rules, ...d.installments].filter((x) => x.envelopeId === byKey(k).id).map((x) => x.name).sort();
    expect(inEnv('utilities')).toEqual(['Qaz', 'Su', 'İşıq'].sort());
    expect(inEnv('phone')).toEqual(['İnternet']);
    expect(inEnv('loans')).toEqual(['Avtomobil krediti']);
    expect(inEnv('installments')).toEqual(['Telefon taksiti']);
    expect(inEnv('subscriptions')).toEqual(['Musiqi', 'Video']);
    expect(inEnv('insurance')).toEqual(['Sığorta']);
    expect(d.ds.envelopes.filter((e) => e.categoryKey).map((e) => e.categoryKey).sort()).toEqual(['housing', 'installments', 'insurance', 'loans', 'phone', 'subscriptions', 'utilities']);
    const o = paymentsOverview({ rules: d.rules, plans: d.installments, txns: d.ds.transactions, today, firstStart: eng.periods[0].startDate, to: p.endDate, periodStart: p.startDate, periodEnd: p.endDate });
    const rows = paymentsByCategory(o.items, d.rules, d.installments, today);
    expect(rows.find((r) => r.envelopeId === byKey('subscriptions').id)).toMatchObject({ perMonth: 3200, perYear: 38400 });
    expect(rows.find((r) => r.envelopeId === byKey('insurance').id)).toMatchObject({ oneTime: 45000, recurring: false });
    // every fixed envelope has its payments due this period set aside, and the day-to-day number stays positive
    for (const k of ['loans', 'phone', 'subscriptions', 'installments']) expect(s.rows[byKey(k).id].planned, k).toBeGreaterThan(0);
    expect(s.safe.leftToday).toBeGreaterThan(0);
  });
});
