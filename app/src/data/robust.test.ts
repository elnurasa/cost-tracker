import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DB_VERSION, SakinDB, isQuotaError, useTestDb, db } from './db';
import {
  addTransaction, completeOnboarding, loadAll, moveMoney, receiveIncome, runMaintenance, saveInstallment, saveRule, updateEnvelope, createEnvelope,
} from './repo';
import { BackupError, MAX_BACKUP_CHARS, MIGRATIONS, buildBackup, migrate, parseBackup, restoreData, sha256Hex } from './backup';
import { TELEMETRY_ENDPOINT, buildTelemetryPayload, flushTelemetry } from './telemetry';
import { ensurePersisted } from './storage';
import { Engine } from '../domain';
import type { OnboardInput } from '../domain';
import { eveningReminderDue, parseHM } from '../domain/nudges';

let n = 0;
beforeEach(() => {
  useTestDb(`r${++n}`);
});
afterEach(() => vi.restoreAllMocks());

const names = {
  envelope: { home: 'Home', bills: 'Bills', food: 'Food', transport: 'Transport', family: 'Family', fun: 'Fun', pocket: 'My share', savings: 'Savings', buffer: 'Buffer' },
  income: { salary: 'Salary', first: 'First', second: 'Second', allowance: 'Allowance', freelance: 'Freelance' },
  starting: 'Starting amount', workspace: 'Me',
};
const input = (today: string, over: Partial<OnboardInput> = {}): OnboardInput => ({ today, freq: 'monthly', amount: 150000, day: 5, amount2: 0, day2: 20, nextPayDate: null, exp: 2, ...over });
const onboard = (today: string, over: Partial<OnboardInput> = {}) =>
  completeOnboarding({ input: input(today, over), locale: 'en', region: 'AZ', currency: 'AZN', moneyNow: 150000, names });
const env = async (name: string) => (await loadAll())!.ds.envelopes.find((e) => e.name === name)!;

describe('IndexedDB schema versioning and migrations', () => {
  it('opens at the current version and records it', async () => {
    await onboard('2026-04-05');
    expect(db.verno).toBe(DB_VERSION);
  });
  it('migrates a v1 database in place: data kept, missing fields backfilled, meta row written', async () => {
    const name = `legacy${++n}`;
    const old = new Dexie(name);
    old.version(1).stores({
      workspaces: 'id', envelopes: 'id, workspaceId', incomes: 'id', incomeEvents: 'id, incomeId, expectedDate, status', periods: 'id, startDate',
      planLines: 'id, periodId', transactions: 'id, date, envelopeId, dedupeKey, occKey, deletedAt', rules: 'id', installments: 'id', transfers: 'id, periodId',
      decisions: 'id, periodId', snapshots: 'id',
    });
    await old.open();
    await old.table('transactions').bulkAdd([
      { id: 'a', date: '2026-04-06', amount: 100, amountBase: 100, currency: 'AZN' }, // an old build that did not write status/deletedAt
      { id: 'b', date: '2026-04-07', amount: 200, amountBase: 200, currency: 'AZN', status: 'pending', deletedAt: null },
    ]);
    old.close();
    const upgraded = new SakinDB(name);
    await upgraded.open();
    expect(upgraded.verno).toBe(DB_VERSION);
    const rows = await upgraded.table('transactions').orderBy('id').toArray();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: 'a', status: 'posted', deletedAt: null, amount: 100 });
    expect(rows[1]).toMatchObject({ id: 'b', status: 'pending' });
    expect((await upgraded.table('meta').get('migration'))!.value).toMatchObject({ to: DB_VERSION }); // records the last step (v3: Payments panel)
    upgraded.close();
  });
  it('a database already at a HIGHER native version (newer build, rolled-back app) opens and keeps its data', async () => {
    const name = `future${++n}`;
    const f = new Dexie(name);
    f.version(5).stores({ workspaces: 'id' });
    await f.open();
    await f.table('workspaces').add({ id: 'w1', baseCurrency: 'AZN' });
    f.close();
    const cur = new SakinDB(name);
    await cur.open(); // Dexie 4 adopts the higher native version instead of throwing; nothing is dropped
    expect((await cur.table('workspaces').get('w1'))!.baseCurrency).toBe('AZN');
    cur.close();
  });
  it('backup schema: migrate() walks the chain and rejects a gap', () => {
    const d = {} as never;
    expect(migrate(d, 2)).toBe(d); // current version: nothing to do (v1 -> v2 is the Payments panel step)
    MIGRATIONS[0] = (x) => ({ ...x, marked: true } as never);
    expect((migrate(d, 0) as unknown as { marked: boolean }).marked).toBe(true);
    delete MIGRATIONS[0];
    expect(() => migrate(d, 0)).toThrow(BackupError);
  });
});

describe('backup file: format, corruption and restore atomicity', () => {
  it('writes format, schemaVersion, appVersion and a checksum', async () => {
    await onboard('2026-04-05');
    const f = await buildBackup();
    expect(f).toMatchObject({ format: 'sakin-backup', schemaVersion: 3 });
    expect(f.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(f.appVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
  it('rejects: not JSON, truncated, wrong format, empty, array, oversized', async () => {
    await onboard('2026-04-05');
    const good = JSON.stringify(await buildBackup());
    for (const bad of ['', 'not json', good.slice(0, good.length >> 1), '[]', 'null', '{"format":"other","schemaVersion":1}', '{"format":"sakin-backup","schemaVersion":"1"}']) {
      await expect(parseBackup(bad)).rejects.toBeInstanceOf(BackupError);
    }
    await expect(parseBackup('x'.repeat(MAX_BACKUP_CHARS + 1))).rejects.toMatchObject({ code: 'format' });
  });
  it('a flipped byte in the payload fails the checksum', async () => {
    await onboard('2026-04-05');
    const text = JSON.stringify(await buildBackup());
    await expect(parseBackup(text.replace('"Food"', '"Fo0d"'))).rejects.toMatchObject({ code: 'checksum' });
  });
  it('a hand-edited file with a RECOMPUTED checksum is still stopped by structure validation', async () => {
    await onboard('2026-04-05');
    const f = await buildBackup();
    const data = JSON.parse(JSON.stringify(f.data));
    const cases: ((d: typeof data) => void)[] = [
      (d) => { d.transactions.push({ id: 'x', date: '2026-04-06', amount: 1.5, amountBase: 1.5, currency: 'AZN', envelopeId: null }); }, // non-integer money
      (d) => { d.transactions.push({ id: 'y', date: 'yesterday', amount: 1, amountBase: 1, currency: 'AZN', envelopeId: null }); },
      (d) => { d.transactions.push({ id: 'z', date: '2026-04-06', amount: 1, amountBase: 1, currency: 'AZN', envelopeId: 'ghost' }); }, // dangling reference
      (d) => { d.envelopes = d.envelopes.filter((e: { kind: string }) => e.kind !== 'buffer'); }, // no Buffer
      (d) => { d.envelopes.push({ ...d.envelopes[0] }); }, // duplicate id
      (d) => { d.workspace = null; },
      (d) => { d.planLines = 'nope'; },
    ];
    for (const mutate of cases) {
      const d = JSON.parse(JSON.stringify(data));
      mutate(d);
      const forged = { ...f, data: d, checksum: await sha256Hex(JSON.stringify(d)) };
      await expect(parseBackup(JSON.stringify(forged))).rejects.toMatchObject({ code: 'structure' });
    }
  });
  it('restore is all-or-nothing: a failure in the middle leaves the previous data untouched', async () => {
    await onboard('2026-04-05');
    const food = await env('Food');
    await addTransaction({ type: 'expense', date: '2026-04-06', amount: 1234, currency: 'AZN', envelopeId: food.id }, '2026-04-06');
    const before = JSON.stringify(await buildBackup(undefined));
    const backup = await buildBackup();
    // fail while writing the 7th table
    const spy = vi.spyOn(db.table('transactions'), 'bulkAdd').mockRejectedValue(new Error('disk exploded'));
    await expect(restoreData(backup.data!)).rejects.toMatchObject({ code: 'write' });
    spy.mockRestore();
    const after = JSON.stringify(await buildBackup(undefined));
    // exportedAt differs; compare data only
    expect(JSON.parse(after).data).toEqual(JSON.parse(before).data);
    expect((await db.snapshots.count())).toBe(0); // the pre-restore snapshot belongs to the rolled-back transaction
  });
  it('quota exceeded during restore is reported as "storage" and nothing changes', async () => {
    await onboard('2026-04-05');
    const backup = await buildBackup();
    const quota = Object.assign(new Error('full'), { name: 'QuotaExceededError' });
    expect(isQuotaError(quota)).toBe(true);
    expect(isQuotaError(new Error('x'))).toBe(false);
    vi.spyOn(db.table('planLines'), 'bulkAdd').mockRejectedValue(quota);
    await expect(restoreData(backup.data!)).rejects.toMatchObject({ code: 'storage' });
    expect((await loadAll())!.ds.envelopes.length).toBeGreaterThan(5);
  });
});

describe('persistence and storage', () => {
  it('ensurePersisted: granted, denied, already persisted, API missing', async () => {
    const stub = (storage: unknown) => vi.stubGlobal('navigator', { storage });
    stub({ persist: vi.fn().mockResolvedValue(true), persisted: vi.fn().mockResolvedValue(false) });
    expect(await ensurePersisted()).toBe(true);
    stub({ persist: vi.fn().mockResolvedValue(false), persisted: vi.fn().mockResolvedValue(false) });
    expect(await ensurePersisted()).toBe(false);
    const persist = vi.fn();
    stub({ persist, persisted: vi.fn().mockResolvedValue(true) });
    expect(await ensurePersisted()).toBe(true);
    expect(persist).not.toHaveBeenCalled();
    stub(undefined);
    expect(await ensurePersisted()).toBeNull();
    stub({ persist: () => Promise.reject(new Error('blocked')) });
    expect(await ensurePersisted()).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe('concurrency: two tabs run maintenance at the same time', () => {
  it('no duplicate periods, income events or recurring postings', async () => {
    await onboard('2026-01-05');
    const home = await env('Home');
    await saveRule({ name: 'Rent', envelopeId: home.id, amount: 40000, frequency: 'monthly', anchorDate: '2026-01-06', dayOfMonth: 6 }, '2026-01-06');
    await saveInstallment({ name: 'Phone', envelopeId: home.id, paymentAmount: 5000, paymentCount: 4, firstDueDate: '2026-01-10', paidBeforeCount: 0 }, '2026-01-10');
    await Promise.all([runMaintenance('2026-04-20'), runMaintenance('2026-04-20'), runMaintenance('2026-04-20'), runMaintenance('2026-04-20')]);
    const d = (await loadAll())!;
    const starts = d.ds.periods.map((p) => p.startDate);
    expect(new Set(starts).size).toBe(starts.length);
    expect(starts).toEqual(['2026-01-05', '2026-02-05', '2026-03-05', '2026-04-05']);
    const keys = d.allTx.filter((t) => t.occKey).map((t) => t.occKey);
    expect(new Set(keys).size).toBe(keys.length);
    const evKeys = d.ds.events.map((e) => `${e.incomeId}:${e.expectedDate}`);
    expect(new Set(evKeys).size).toBe(evKeys.length);
    // 4 installment payments + rent on Jan 6, Feb 6, Mar 6, Apr 6
    expect(d.allTx.filter((t) => t.source === 'installment')).toHaveLength(4);
    expect(d.allTx.filter((t) => t.source === 'recurring')).toHaveLength(4);
  });
  it('two tabs adding expenses at once both land (no lost update)', async () => {
    await onboard('2026-04-05');
    const food = await env('Food');
    await Promise.all(Array.from({ length: 8 }, (_, i) => addTransaction({ type: 'expense', date: '2026-04-06', amount: 100 + i, currency: 'AZN', envelopeId: food.id }, '2026-04-06')));
    expect((await loadAll())!.ds.transactions.filter((t) => t.envelopeId === food.id)).toHaveLength(8);
  });
});

describe('device clock changes', () => {
  it('moving the clock back never deletes periods or double posts; moving forward catches up once', async () => {
    await onboard('2026-01-05');
    const home = await env('Home');
    await saveRule({ name: 'Rent', envelopeId: home.id, amount: 40000, frequency: 'monthly', anchorDate: '2026-01-06', dayOfMonth: 6 }, '2026-01-06');
    await runMaintenance('2026-03-20');
    const a = (await loadAll())!;
    await runMaintenance('2026-02-01'); // clock set back
    await runMaintenance('2025-06-01'); // far back
    const b = (await loadAll())!;
    expect(b.ds.periods.map((p) => p.startDate)).toEqual(a.ds.periods.map((p) => p.startDate));
    expect(b.allTx.length).toBe(a.allTx.length);
    // engine with an earlier "today" still renders every snapshot without throwing
    const eng = new Engine(b.ds, '2025-06-01');
    expect(eng.current()).toBeDefined();
    await runMaintenance('2026-03-20');
    expect((await loadAll())!.allTx.length).toBe(a.allTx.length);
  });
  it('a future-dated expense cannot be entered after the clock is corrected backwards', async () => {
    await onboard('2026-04-05');
    const food = await env('Food');
    await expect(addTransaction({ type: 'expense', date: '2026-04-20', amount: 100, currency: 'AZN', envelopeId: food.id }, '2026-04-10')).rejects.toThrow('future');
  });
});

describe('remove envelope = archive (money conserved)', () => {
  it('blocked while the balance is not zero; Buffer and My share can never be archived', async () => {
    await onboard('2026-04-05');
    await runMaintenance('2026-04-06');
    const food = await env('Food');
    await expect(updateEnvelope(food.id, { archived: true })).rejects.toThrow('balance');
    await expect(updateEnvelope((await env('Buffer')).id, { archived: true })).rejects.toThrow('blocked');
    await expect(updateEnvelope((await env('My share')).id, { archived: true })).rejects.toThrow('blocked');
  });
  it('after the balance is moved away, archiving keeps history, drops the master plan, and the total stays the same', async () => {
    await onboard('2026-04-05');
    const today = '2026-04-06';
    await runMaintenance(today);
    const sumAvail = async (t: string) => {
      const d = (await loadAll())!;
      const s = new Engine(d.ds, t).current()!;
      return { total: Object.values(s.available).reduce((a, b) => a + b, 0), s, d };
    };
    const fam = await createEnvelope({ name: 'Trip', icon: 'plane', kind: 'flexible' });
    const food = await env('Food');
    await addTransaction({ type: 'expense', date: today, amount: 777, currency: 'AZN', envelopeId: food.id }, today);
    const b0 = await sumAvail(today);
    // give the new envelope some money, then move it all out so it can be archived
    const periodId = b0.s.periodId;
    await moveMoney({ periodId, from: (await env('Buffer')).id, to: fam.id, amount: 5000 }, today);
    await moveMoney({ periodId, from: fam.id, to: (await env('Buffer')).id, amount: 5000 }, today);
    await updateEnvelope(fam.id, { archived: true });
    const b1 = await sumAvail(today);
    expect(b1.total).toBe(b0.total);
    expect(b1.d.ds.envelopes.find((e) => e.id === fam.id)!.archived).toBe(true);
    // archive Food too after spending its remainder down to zero via a move
    const foodLeft = b1.s.available[food.id];
    await moveMoney({ periodId, from: food.id, to: (await env('Buffer')).id, amount: foodLeft }, today);
    await updateEnvelope(food.id, { archived: true });
    const b2 = await sumAvail(today);
    expect(b2.total).toBe(b0.total);
    expect(b2.d.ds.transactions.filter((t) => t.envelopeId === food.id)).toHaveLength(1); // history stays
    expect(b2.d.ws.masterPlan[food.id]).toBeUndefined();
    // next period does not fund the archived envelope; the Buffer (remainder) absorbs it
    await runMaintenance('2026-05-06');
    const d = (await loadAll())!;
    const cur = new Engine(d.ds, '2026-05-06').current()!;
    expect(cur.alloc[food.id] ?? 0).toBe(0);
    expect(cur.available[food.id] ?? 0).toBe(0);
    const sumAlloc = Object.values(cur.alloc).reduce((a, b) => a + b, 0);
    expect(sumAlloc).toBe(cur.pInc); // all income still accounted for
  });
});

describe('v1 privacy: telemetry cannot carry user data', () => {
  const ctx = { appVersion: '1.0.0', locale: 'az', installId: '0123456789abcdef' };
  it('has no endpoint and flush sends nothing', async () => {
    expect(TELEMETRY_ENDPOINT).toBeNull();
    expect(await flushTelemetry([])).toBe('disabled');
  });
  it('AC-PRIV-02: only whitelisted events and integer counts pass; names, notes, amounts do not', () => {
    expect(buildTelemetryPayload('expense_added', { entries_period: 12 }, ctx)).toEqual({ event: 'expense_added', counts: { entries_period: 12 }, appVersion: '1.0.0', locale: 'az', installId: ctx.installId });
    expect(() => buildTelemetryPayload('custom_event', {}, ctx)).toThrow();
    expect(() => buildTelemetryPayload('app_open', { amount: 5 }, ctx)).toThrow();
    expect(() => buildTelemetryPayload('app_open', { entries_period: 1.5 }, ctx)).toThrow();
    expect(() => buildTelemetryPayload('app_open', { entries_period: '12' as unknown as number }, ctx)).toThrow();
    expect(() => buildTelemetryPayload('app_open', {}, { ...ctx, installId: 'Anna Petrova' })).toThrow();
    const json = JSON.stringify(buildTelemetryPayload('app_open', { days_with_entries: 3 }, ctx));
    expect(json).not.toMatch(/note|merchant|envelope name|amount/i);
  });
});

describe('AC-NUD-05: in-app evening reminder', () => {
  const at = (h: number, m: number) => new Date(2026, 3, 10, h, m);
  const base = { enabled: true, time: '20:30', entryToday: false, dismissedToday: false, ignoredInRow: 0, nudgesOn: true };
  it('is off by default and only appears after the chosen time', () => {
    expect(eveningReminderDue({ ...base, enabled: false, now: at(21, 0) })).toBe(false);
    expect(eveningReminderDue({ ...base, now: at(20, 29) })).toBe(false);
    expect(eveningReminderDue({ ...base, now: at(20, 30) })).toBe(true);
  });
  it('an entry already made today means no reminder', () => {
    expect(eveningReminderDue({ ...base, now: at(20, 31), entryToday: true })).toBe(false);
  });
  it('max once a day, paused after 3 ignored in a row, master switch, quiet hours', () => {
    expect(eveningReminderDue({ ...base, now: at(21, 0), dismissedToday: true })).toBe(false);
    expect(eveningReminderDue({ ...base, now: at(21, 0), ignoredInRow: 3 })).toBe(false);
    expect(eveningReminderDue({ ...base, now: at(21, 0), ignoredInRow: 2 })).toBe(true);
    expect(eveningReminderDue({ ...base, now: at(21, 0), nudgesOn: false })).toBe(false);
    expect(eveningReminderDue({ ...base, time: '21:30', now: at(22, 30) })).toBe(false); // 22:00-08:00 is quiet
    expect(eveningReminderDue({ ...base, time: '07:00', now: at(7, 30) })).toBe(false);
  });
  it('parses the time defensively', () => {
    expect(parseHM('20:30')).toBe(1230);
    expect(parseHM('garbage')).toBe(1230);
    expect(parseHM('99:99')).toBe(23 * 60 + 59);
  });
});

describe('income received flow stays consistent under repeated taps', () => {
  it('receiving the same event twice does not double count', async () => {
    await onboard('2026-04-05');
    await runMaintenance('2026-05-05');
    const d = (await loadAll())!;
    const ev = d.ds.events.find((e) => e.status === 'expected' && (e.expectedDate ?? '') <= '2026-05-05')!;
    await receiveIncome(ev.id, { amount: ev.expectedAmount, currency: 'AZN', date: '2026-05-05' });
    const r1 = (await loadAll())!.allTx.filter((t) => t.type === 'income').length;
    await receiveIncome(ev.id, { amount: ev.expectedAmount, currency: 'AZN', date: '2026-05-05' }).catch(() => undefined);
    const r2 = (await loadAll())!.allTx.filter((t) => t.type === 'income').length;
    expect(r2).toBe(r1);
  });
});
