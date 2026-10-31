import Dexie, { type Table } from 'dexie';
import type {
  CommitmentRule, Envelope, EnvelopeTransfer, Income, IncomeEvent, InstallmentPlan, Period, PlanLine, RolloverDecision,
  Transaction, Workspace,
} from '../domain';
import { assignCategoryKeys } from '../domain/categories';

export interface SnapshotRow {
  id: string;
  createdAt: string;
  json: string;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

/** IndexedDB structure version (Dexie). The backup/data-model version is SCHEMA_VERSION in repo.ts; they move independently. */
export const DB_VERSION = 4;

export class SakinDB extends Dexie {
  workspaces!: Table<Workspace, string>;
  envelopes!: Table<Envelope, string>;
  incomes!: Table<Income, string>;
  incomeEvents!: Table<IncomeEvent, string>;
  periods!: Table<Period, string>;
  planLines!: Table<PlanLine, string>;
  transactions!: Table<Transaction, string>;
  rules!: Table<CommitmentRule, string>;
  installments!: Table<InstallmentPlan, string>;
  transfers!: Table<EnvelopeTransfer, string>;
  decisions!: Table<RolloverDecision, string>;
  snapshots!: Table<SnapshotRow, string>;
  meta!: Table<MetaRow, string>;

  constructor(name = 'sakin') {
    super(name);
    this.version(1).stores({
      workspaces: 'id',
      envelopes: 'id, workspaceId',
      incomes: 'id',
      incomeEvents: 'id, incomeId, expectedDate, status',
      periods: 'id, startDate',
      planLines: 'id, periodId',
      transactions: 'id, date, envelopeId, dedupeKey, occKey, deletedAt',
      rules: 'id',
      installments: 'id',
      transfers: 'id, periodId',
      decisions: 'id, periodId',
      snapshots: 'id',
    });
    // v2: key/value meta table (records the last migration) and a backfill of fields older builds did not write.
    this.version(2)
      .stores({ meta: 'key' })
      .upgrade(async (tx) => {
        await tx.table('transactions').toCollection().modify((t: Record<string, unknown>) => {
          if (!t.status) t.status = 'posted';
          if (t.deletedAt === undefined) t.deletedAt = null;
        });
        await tx.table('meta').put({ key: 'migration', value: { from: 1, to: 2, at: new Date().toISOString() } });
      });
    // v3 (Payments panel): payee, loan kind and the auto/confirm switch. Existing commitments keep AUTO mode (no behaviour
    // change); the old "skip" meant "not owed", so those numbers are copied to `waived`.
    this.version(3).upgrade(async (tx) => {
      await tx.table('rules').toCollection().modify((r: Record<string, unknown>) => upgradeRule(r));
      await tx.table('installments').toCollection().modify((p: Record<string, unknown>) => upgradeInstallment(p));
      await tx.table('workspaces').toCollection().modify((w: Record<string, unknown>) => {
        w.schemaVersion = 2;
      });
      await tx.table('meta').put({ key: 'migration', value: { from: 2, to: 3, at: new Date().toISOString() } });
    });
    // v4 (payment categories): envelopes get an optional stable `categoryKey`. Existing fixed envelopes are matched by name
    // or icon ("Kommunal" -> utilities, "Taksitlər" -> installments); a key is never given twice. Names are not touched.
    this.version(4).upgrade(async (tx) => {
      const envs = (await tx.table('envelopes').toArray()) as Envelope[];
      const keys = assignCategoryKeys(envs);
      await tx.table('envelopes').toCollection().modify((e: Record<string, unknown>) => upgradeEnvelope(e, keys));
      await tx.table('workspaces').toCollection().modify((w: Record<string, unknown>) => {
        w.schemaVersion = 3;
      });
      await tx.table('meta').put({ key: 'migration', value: { from: 3, to: 4, at: new Date().toISOString() } });
    });
  }
}

/** Shared by the IndexedDB v4 upgrade and the backup v2 -> v3 migration. Idempotent. */
export function upgradeEnvelope(e: Record<string, unknown>, keys: Record<string, string>) {
  if (e.categoryKey === undefined || e.categoryKey === null) e.categoryKey = keys[e.id as string] ?? null;
  return e;
}

/** Shared by the IndexedDB v3 upgrade and the backup v1 -> v2 migration. Idempotent. */
export function upgradeRule(r: Record<string, unknown>) {
  if (r.payee === undefined) r.payee = null;
  if (r.autoPost === undefined) r.autoPost = true;
  if (r.autoFrom === undefined) r.autoFrom = null;
  if (r.pausedAt === undefined) r.pausedAt = null;
  return r;
}
export function upgradeInstallment(p: Record<string, unknown>) {
  if (p.payee === undefined) p.payee = null;
  if (p.kind === undefined) p.kind = 'installment';
  if (p.principal === undefined) p.principal = null;
  if (p.interestRate === undefined) p.interestRate = null;
  if (p.autoPost === undefined) p.autoPost = true;
  if (p.autoFrom === undefined) p.autoFrom = null;
  if (p.waived === undefined) p.waived = Array.isArray(p.skipped) ? [...(p.skipped as number[])] : [];
  return p;
}

export let db = new SakinDB();

export function isQuotaError(e: unknown): boolean {
  const x = e as { name?: string; inner?: { name?: string } } | null;
  return x?.name === 'QuotaExceededError' || x?.inner?.name === 'QuotaExceededError';
}
export const STORAGE_FULL_EVENT = 'sakin:storage-full';

/** Reports a full disk once to the UI (a toast) instead of failing silently; the failing write still rejects. */
function installQuotaWatch(d: SakinDB) {
  d.use({
    stack: 'dbcore',
    name: 'quotaWatch',
    create(down) {
      return {
        ...down,
        table(name) {
          const t = down.table(name);
          return {
            ...t,
            mutate: (req) =>
              t.mutate(req).catch((e: unknown) => {
                if (isQuotaError(e) && typeof window !== 'undefined') window.dispatchEvent(new Event(STORAGE_FULL_EVENT));
                throw e;
              }),
          };
        },
      };
    },
  });
  // another tab/SW generation upgraded the schema: close so the upgrade is not blocked, then reload onto the new code
  d.on('versionchange', () => {
    d.close();
    if (typeof window !== 'undefined' && typeof location !== 'undefined' && typeof location.reload === 'function') setTimeout(() => location.reload(), 50);
    return false;
  });
}
installQuotaWatch(db);
/** Test hook: swap the database instance. */
export function useTestDb(name: string) {
  db = new SakinDB(name);
  installQuotaWatch(db);
  return db;
}

export const DATA_TABLES = [
  'workspaces', 'envelopes', 'incomes', 'incomeEvents', 'periods', 'planLines', 'transactions', 'rules', 'installments', 'transfers', 'decisions',
] as const;
