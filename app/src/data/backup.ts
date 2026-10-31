import { db, DATA_TABLES, isQuotaError, upgradeEnvelope, upgradeInstallment, upgradeRule } from './db';
import { assignCategoryKeys, isCategoryKey } from '../domain/categories';
import type { Envelope } from '../domain';
import { nowIso, uuidv7 } from './ids';
import { SCHEMA_VERSION } from './repo';

export const APP_VERSION = '1.0.0';
export const BACKUP_FORMAT = 'sakin-backup';

type Tables = Record<(typeof DATA_TABLES)[number], unknown[]>;
export interface BackupData {
  workspace: unknown;
  envelopes: unknown[];
  incomes: unknown[];
  incomeEvents: unknown[];
  periods: unknown[];
  planLines: unknown[];
  transactions: unknown[];
  commitmentRules: unknown[];
  installmentPlans: unknown[];
  transfers: unknown[];
  rolloverDecisions: unknown[];
}
export interface BackupFile {
  format: string;
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  checksum: string;
  data?: BackupData;
  encrypted?: { kdf: 'PBKDF2-SHA256'; iterations: number; salt: string; iv: string; ciphertext: string };
}
export type BackupErrorCode = 'format' | 'newer' | 'checksum' | 'passphrase' | 'needs-passphrase' | 'structure' | 'json' | 'storage' | 'write';
export class BackupError extends Error {
  constructor(readonly code: BackupErrorCode) {
    super(code);
  }
}

const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export async function sha256Hex(s: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
const PBKDF2_ITER = 600_000;
async function deriveKey(pass: string, salt: Uint8Array, iterations: number) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function collect(): Promise<BackupData> {
  const [ws] = await db.workspaces.toArray();
  const live = async <T extends { deletedAt: string | null }>(t: { toArray(): Promise<T[]> }) => (await t.toArray()).filter((x) => !x.deletedAt);
  return {
    workspace: ws ?? null,
    envelopes: await live(db.envelopes), incomes: await live(db.incomes), incomeEvents: await live(db.incomeEvents), periods: await live(db.periods),
    planLines: await live(db.planLines), transactions: await live(db.transactions), commitmentRules: await live(db.rules),
    installmentPlans: await live(db.installments), transfers: await live(db.transfers), rolloverDecisions: await live(db.decisions),
  };
}

export async function buildBackup(passphrase?: string, data?: BackupData): Promise<BackupFile> {
  const d = data ?? (await collect());
  const plain = JSON.stringify(d);
  const checksum = await sha256Hex(plain);
  const head = { format: BACKUP_FORMAT, schemaVersion: SCHEMA_VERSION, appVersion: APP_VERSION, exportedAt: nowIso(), checksum };
  if (!passphrase) return { ...head, data: d };
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, PBKDF2_ITER);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, enc.encode(plain)));
  return { ...head, encrypted: { kdf: 'PBKDF2-SHA256', iterations: PBKDF2_ITER, salt: b64(salt), iv: b64(iv), ciphertext: b64(ct) } };
}

/**
 * Backup schemaVersion migrations. Each step upgrades one version; files from the future are rejected before this runs.
 * v1 -> v2 adds payee / loan kind / auto-or-confirm fields (Payments panel); v2 -> v3 adds the envelope `categoryKey`.
 */
export const MIGRATIONS: Record<number, (d: BackupData) => BackupData> = {
  // v1 -> v2 (Payments panel): same field backfill as the IndexedDB v3 upgrade; old files keep auto mode
  1: (d) => ({
    ...d,
    commitmentRules: Array.isArray(d.commitmentRules) ? d.commitmentRules.map((r) => upgradeRule({ ...(r as Record<string, unknown>) })) : d.commitmentRules,
    installmentPlans: Array.isArray(d.installmentPlans) ? d.installmentPlans.map((p) => upgradeInstallment({ ...(p as Record<string, unknown>) })) : d.installmentPlans,
  }),
  // v2 -> v3 (payment categories): same inference as the IndexedDB v4 upgrade ("Kommunal" -> utilities); never a duplicate key
  2: (d) => {
    if (!Array.isArray(d.envelopes)) return d;
    const envs = d.envelopes.filter((e): e is Envelope => !!e && typeof e === 'object' && typeof (e as Envelope).id === 'string');
    const keys = assignCategoryKeys(envs.map((e) => ({ ...e, order: typeof e.order === 'number' ? e.order : 0 })));
    return { ...d, envelopes: d.envelopes.map((e) => (e && typeof e === 'object' ? upgradeEnvelope({ ...(e as Record<string, unknown>) }, keys) : e)) };
  },
};
export function migrate(data: BackupData, from: number): BackupData {
  let d = data;
  for (let v = from; v < SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) throw new BackupError('format');
    d = step(d);
  }
  return d;
}

/** ~64 MB of text: far above 5,000 entries (~3 MB) yet stops a wrong file from freezing the tab. */
export const MAX_BACKUP_CHARS = 64 * 1024 * 1024;

export async function parseBackup(text: string, passphrase?: string): Promise<{ data: BackupData; file: BackupFile }> {
  if (typeof text !== 'string' || text.length > MAX_BACKUP_CHARS) throw new BackupError('format');
  let file: BackupFile;
  try {
    file = JSON.parse(text);
  } catch {
    throw new BackupError('json');
  }
  if (!file || file.format !== BACKUP_FORMAT || typeof file.schemaVersion !== 'number') throw new BackupError('format');
  if (file.schemaVersion > SCHEMA_VERSION) throw new BackupError('newer');
  let plain: string;
  if (file.encrypted) {
    if (!passphrase) throw new BackupError('needs-passphrase');
    try {
      const e = file.encrypted;
      const key = await deriveKey(passphrase, unb64(e.salt), e.iterations);
      plain = dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(e.iv) as BufferSource }, key, unb64(e.ciphertext) as BufferSource));
    } catch {
      throw new BackupError('passphrase');
    }
  } else {
    if (!file.data) throw new BackupError('format');
    plain = JSON.stringify(file.data);
  }
  if ((await sha256Hex(plain)) !== file.checksum) throw new BackupError('checksum');
  const data = migrate(JSON.parse(plain) as BackupData, file.schemaVersion);
  validate(data);
  return { data, file };
}

const ENV_KINDS = new Set(['fixed', 'flexible', 'pocket', 'savings', 'buffer']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isInt = (x: unknown) => typeof x === 'number' && Number.isSafeInteger(x);
const isStr = (x: unknown) => typeof x === 'string';
type Rec = Record<string, unknown>;

/** Structural validation before anything is written: shapes, enums, integer money, unique ids, references. */
export function validate(d: BackupData) {
  const bad = (): never => {
    throw new BackupError('structure');
  };
  const arrays: (keyof BackupData)[] = ['envelopes', 'incomes', 'incomeEvents', 'periods', 'planLines', 'transactions', 'commitmentRules', 'installmentPlans', 'transfers', 'rolloverDecisions'];
  const ws = d.workspace as Rec | null;
  if (!ws || typeof ws !== 'object' || !isStr(ws.id) || !isStr(ws.baseCurrency) || !/^[A-Z]{3}$/.test(ws.baseCurrency as string)) bad();
  for (const k of arrays) {
    const arr = d[k] as unknown[];
    if (!Array.isArray(arr)) bad();
    const ids = new Set<string>();
    for (const x of arr) {
      const r = x as Rec;
      if (!r || typeof r !== 'object' || !isStr(r.id) || ids.has(r.id as string)) bad();
      ids.add(r.id as string);
    }
  }
  const envIds = new Set((d.envelopes as Rec[]).map((e) => e.id as string));
  const periodIds = new Set((d.periods as Rec[]).map((e) => e.id as string));
  let buffers = 0;
  for (const e of d.envelopes as Rec[]) {
    if (!isStr(e.name) || !ENV_KINDS.has(e.kind as string)) bad();
    if (e.categoryKey != null && !isCategoryKey(e.categoryKey)) bad();
    if (e.kind === 'buffer') buffers++;
  }
  if (buffers !== 1) bad();
  for (const p of d.periods as Rec[]) if (!DATE_RE.test(p.startDate as string) || !DATE_RE.test(p.endDate as string) || (p.startDate as string) > (p.endDate as string)) bad();
  for (const t of d.transactions as Rec[]) {
    if (!DATE_RE.test(t.date as string) || !isInt(t.amount) || !isInt(t.amountBase) || !isStr(t.currency)) bad();
    if (t.envelopeId != null && !envIds.has(t.envelopeId as string)) bad();
  }
  for (const l of d.planLines as Rec[]) if (!isInt(l.amount) || !envIds.has(l.envelopeId as string) || !periodIds.has(l.periodId as string)) bad();
  for (const t of d.transfers as Rec[]) {
    if (!isInt(t.amount) || !envIds.has(t.fromEnvelopeId as string) || !envIds.has(t.toEnvelopeId as string) || !DATE_RE.test(t.date as string)) bad();
  }
  const optStr = (x: unknown) => x == null || isStr(x);
  const optBool = (x: unknown) => x === undefined || typeof x === 'boolean';
  for (const r of d.commitmentRules as Rec[]) {
    if (!isInt(r.amount) || !envIds.has(r.envelopeId as string) || !optStr(r.payee) || !optBool(r.autoPost)) bad();
  }
  for (const r of d.installmentPlans as Rec[]) {
    if (!isInt(r.paymentAmount) || !envIds.has(r.envelopeId as string) || !optStr(r.payee) || !optBool(r.autoPost)) bad();
    if (r.kind != null && r.kind !== 'loan' && r.kind !== 'installment') bad();
    if (r.principal != null && (!isInt(r.principal) || (r.principal as number) < 0)) bad();
    if (r.interestRate != null && (typeof r.interestRate !== 'number' || !Number.isFinite(r.interestRate) || r.interestRate < 0 || r.interestRate > 1000)) bad();
  }
}

export interface BackupSummary {
  entries: number;
  from: string | null;
  to: string | null;
}
export function summarize(d: BackupData): BackupSummary {
  const dates = (d.transactions as { date: string }[]).map((t) => t.date).sort();
  return { entries: d.transactions.length, from: dates[0] ?? null, to: dates[dates.length - 1] ?? null };
}

const SNAP_ID = 'pre-restore';
/** Atomic restore (one IndexedDB transaction). Keeps the previous state as a 7-day snapshot. */
export async function restoreData(d: BackupData, opts: { snapshot?: boolean } = {}): Promise<void> {
  const prev = opts.snapshot === false ? null : JSON.stringify(await buildBackup());
  const map: Tables = {
    workspaces: d.workspace ? [d.workspace] : [], envelopes: d.envelopes, incomes: d.incomes, incomeEvents: d.incomeEvents, periods: d.periods,
    planLines: d.planLines, transactions: d.transactions, rules: d.commitmentRules, installments: d.installmentPlans, transfers: d.transfers, decisions: d.rolloverDecisions,
  };
  const tables = DATA_TABLES.map((n) => db.table(n));
  try {
    // one IndexedDB transaction: any failure (duplicate key, quota, abort) rolls everything back, leaving the old data intact
    await db.transaction('rw', [...tables, db.snapshots], async () => {
      for (const n of DATA_TABLES) {
        await db.table(n).clear();
        await db.table(n).bulkAdd(map[n]);
      }
      if (prev) await db.snapshots.put({ id: SNAP_ID, createdAt: nowIso(), json: prev });
    });
  } catch (e) {
    throw new BackupError(isQuotaError(e) ? 'storage' : 'write');
  }
}
export async function getRestoreSnapshot(): Promise<{ createdAt: string } | null> {
  const s = await db.snapshots.get(SNAP_ID);
  if (!s) return null;
  if (Date.now() - new Date(s.createdAt).getTime() > 7 * 86400000) {
    await db.snapshots.delete(SNAP_ID);
    return null;
  }
  return { createdAt: s.createdAt };
}
export async function undoRestore(): Promise<boolean> {
  const s = await db.snapshots.get(SNAP_ID);
  if (!s) return false;
  const { data } = await parseBackup(s.json);
  await restoreData(data, { snapshot: false });
  await db.snapshots.delete(SNAP_ID);
  return true;
}
export const newInstallId = uuidv7;
