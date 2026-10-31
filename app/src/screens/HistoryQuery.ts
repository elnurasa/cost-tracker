import { currencyExponent, type EnvelopeTransfer, type Transaction } from '../domain';

/** Pure History data layer (kept out of the component so it can be benchmarked and unit-tested). */
export type HItem =
  | { kind: 'tx'; date: string; at: string; tx: Transaction; hay: string; major: string }
  | { kind: 'move'; date: string; at: string; tr: EnvelopeTransfer; hay: string };

export interface HFilter {
  from: string;
  to: string;
  envs: string[];
  types: string[];
  autoOnly: 'auto' | 'manual' | null;
  needle: string; // already folded
}

export function fold(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[ıİ]/g, 'i').replace(/ə/g, 'e').replace(/ё/g, 'е');
}

/** Sorted newest first; the search haystack is folded once here, not on every keystroke. */
export function buildItems(txs: Transaction[], transfers: EnvelopeTransfer[], envName: (id: string | null) => string, base: string): HItem[] {
  const exp = currencyExponent(base);
  const cache = new Map<string, string>();
  const name = (id: string | null) => {
    const k = id ?? '';
    let v = cache.get(k);
    if (v === undefined) cache.set(k, (v = fold(envName(id))));
    return v;
  };
  const out: HItem[] = [];
  for (const tx of txs) {
    out.push({ kind: 'tx', date: tx.date, at: tx.createdAt, tx, hay: `${fold(tx.note ?? '')} ${fold(tx.merchant ?? '')} ${name(tx.envelopeId)}`, major: (tx.amountBase / 10 ** exp).toString() });
  }
  for (const tr of transfers) out.push({ kind: 'move', date: tr.date, at: tr.createdAt, tr, hay: `${name(tr.fromEnvelopeId)} ${name(tr.toEnvelopeId)}` });
  return out.sort((a, b) => (a.date === b.date ? (a.at < b.at ? 1 : a.at > b.at ? -1 : 0) : a.date < b.date ? 1 : -1));
}

export function filterItems(items: HItem[], f: HFilter): HItem[] {
  const envSet = f.envs.length ? new Set(f.envs) : null;
  const typeSet = f.types.length ? new Set(f.types) : null;
  const digits = f.needle.replace(',', '.');
  const numeric = /^[\d.]+$/.test(digits);
  const out: HItem[] = [];
  for (const it of items) {
    if (it.date < f.from || it.date > f.to) continue;
    if (it.kind === 'move') {
      if (typeSet && !typeSet.has('move')) continue;
      if (envSet && !envSet.has(it.tr.fromEnvelopeId) && !envSet.has(it.tr.toEnvelopeId)) continue;
      if (f.autoOnly) continue;
      if (f.needle && !it.hay.includes(f.needle)) continue;
      out.push(it);
      continue;
    }
    const tx = it.tx;
    if (typeSet && !typeSet.has(tx.type === 'income' ? 'income' : 'expense')) continue;
    if (envSet && (!tx.envelopeId || !envSet.has(tx.envelopeId))) continue;
    const auto = tx.source === 'recurring' || tx.source === 'installment';
    if (f.autoOnly === 'auto' && !auto) continue;
    if (f.autoOnly === 'manual' && auto) continue;
    if (f.needle && !(it.hay.includes(f.needle) || (numeric && it.major.startsWith(digits)))) continue;
    out.push(it);
  }
  return out;
}

export const signedSpend = (tx: Transaction) => (tx.status === 'void' ? 0 : tx.type === 'expense' ? tx.amountBase : tx.type === 'refund' ? -tx.amountBase : 0);

export type Row = { key: string; kind: 'head'; date: string; total: number } | { key: string; kind: 'item'; item: HItem; first: boolean; last: boolean };

/** Flatten into day-header + entry rows (the unit the virtual list measures). */
export function flatten(items: HItem[]): Row[] {
  const rows: Row[] = [];
  let i = 0;
  while (i < items.length) {
    const date = items[i].date;
    let j = i;
    let total = 0;
    while (j < items.length && items[j].date === date) {
      const it = items[j];
      if (it.kind === 'tx') total += it.tx.type === 'expense' ? it.tx.amountBase : it.tx.type === 'refund' ? -it.tx.amountBase : 0;
      j++;
    }
    rows.push({ key: `h:${date}`, kind: 'head', date, total });
    for (let k = i; k < j; k++) {
      const it = items[k];
      rows.push({ key: it.kind === 'tx' ? it.tx.id : it.tr.id, kind: 'item', item: it, first: k === i, last: k === j - 1 });
    }
    i = j;
  }
  return rows;
}
