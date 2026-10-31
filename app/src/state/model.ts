import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { loadAll, type AppData } from '../data/repo';
import type { Transaction } from '../domain';
import { Engine, commitmentsDue, currencyExponent, paymentsOverview, todayLocal, type Envelope, type EnvelopeKind, type Snapshot, type Period, type DueItem, type Overview } from '../domain';

export function useToday(): string {
  const [today, setToday] = useState(todayLocal());
  useEffect(() => {
    const check = () => setToday((t) => {
      const n = todayLocal();
      return n === t ? t : n;
    });
    const id = window.setInterval(check, 30000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);
  return today;
}

export interface Model {
  data: AppData;
  today: string;
  engine: Engine;
  snap: Snapshot;
  period: Period;
  base: string;
  exp: number;
  envelopes: Envelope[]; // active (not archived), ordered
  allEnvelopes: Envelope[];
  env: (id: string | null | undefined) => Envelope | undefined;
  byKind: (k: EnvelopeKind) => Envelope[];
  buffer: Envelope;
  pocket: Envelope | undefined;
  closing: Period[];
  upcoming: DueItem[];
  /** Payments panel: every bill, one-time payment and loan with its waiting / scheduled / paid state (domain/payments.ts) */
  payments: Overview;
  periodDays: { elapsed: number; total: number };
}

export type ModelState = { loading: true } | { loading: false; empty: true } | { loading: false; empty: false; m: Model };

/**
 * Optimistic path: right after a write resolves, the caller hands the new row to `patchWithTransaction`; the model is rebuilt once from
 * the in-memory data (no second read of every table). The live query still runs and its result replaces the patched copy (the patch is
 * dropped as soon as a fresh query result arrives, so the database stays the single source of truth).
 */
type Patch = (d: AppData) => AppData;
const patchSubs = new Set<(f: Patch) => void>();
export function patchWithTransaction(tx: Transaction): void {
  patchSubs.forEach((s) =>
    s((d) => (d.allTx.some((x) => x.id === tx.id) ? d : { ...d, allTx: [...d.allTx, tx], ds: { ...d.ds, transactions: [...d.ds.transactions, tx] } })),
  );
}

export function rollbackPatch(): void {
  patchSubs.forEach((s) => s(() => ROLLBACK));
}
const ROLLBACK = Symbol('rollback') as unknown as AppData;

export function useModel(): ModelState {
  const live = useLiveQuery(async () => (await loadAll()) ?? null, [], undefined);
  const liveRef = useRef(live);
  liveRef.current = live;
  const [patched, setPatched] = useState<{ base: AppData; data: AppData } | null>(null);
  useEffect(() => {
    const sub = (f: Patch) =>
      setPatched((p) => {
        const cur = liveRef.current;
        if (!cur) return p;
        const from = p && p.base === cur ? p.data : cur;
        const next = f(from);
        if (next === ROLLBACK) return null;
        return next === from ? p : { base: cur, data: next };
      });
    patchSubs.add(sub);
    return () => void patchSubs.delete(sub);
  }, []);
  const data = live && patched && patched.base === live ? patched.data : live;
  const today = useToday();
  return useMemo<ModelState>(() => {
    if (data === undefined) return { loading: true };
    if (data === null) return { loading: false, empty: true };
    const engine = new Engine(data.ds, today);
    const period = engine.currentPeriod();
    const snap = engine.current();
    const buffer = data.ds.envelopes.find((e) => e.kind === 'buffer');
    if (!period || !snap || !buffer) return { loading: false, empty: true };
    const allEnvelopes = data.ds.envelopes;
    const envelopes = allEnvelopes.filter((e) => !e.archived);
    const map = new Map(allEnvelopes.map((e) => [e.id, e]));
    const toMs = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 86400000;
    const total = toMs(period.endDate) - toMs(period.startDate) + 1;
    const elapsed = Math.min(total, Math.max(1, toMs(today) - toMs(period.startDate) + 1));
    const upcoming = commitmentsDue(data.rules, data.installments, data.allTx, today, snap.horizon.nextDate > period.endDate ? snap.horizon.nextDate : period.endDate)
      .filter((d) => d.date >= today);
    const payments = paymentsOverview({
      rules: data.rules, plans: data.installments, txns: data.ds.transactions, today, firstStart: engine.periods[0]?.startDate ?? period.startDate,
      to: period.endDate, periodStart: period.startDate, periodEnd: period.endDate, base: data.ws.baseCurrency, rates: data.ws.rates,
    });
    const m: Model = {
      data, today, engine, snap, period, base: data.ws.baseCurrency, exp: currencyExponent(data.ws.baseCurrency), envelopes, allEnvelopes,
      env: (id) => (id ? map.get(id) : undefined), byKind: (k) => envelopes.filter((e) => e.kind === k), buffer,
      pocket: envelopes.find((e) => e.kind === 'pocket'), closing: engine.periods.filter((p) => p.state === 'closing'), upcoming, payments,
      periodDays: { elapsed, total },
    };
    return { loading: false, empty: false, m };
  }, [data, today]);
}
