import { describe, expect, it } from 'vitest';
import { buildItems, filterItems, flatten, fold, type HFilter } from './HistoryQuery';
import { tx } from '../domain/testkit';
import type { Transaction } from '../domain';
import { addDays } from '../domain';

const ENVS = ['Home', 'Bills', 'Food', 'Transport', 'Family', 'Fun', 'My share', 'Savings', 'Buffer'];
const NOTES = ['Bravo market', 'Taxi', 'Kofe', 'Eczane', 'Metro', 'Pharmacy', 'Çay evi', 'Əhməd dükanı', 'Магазин', 'Wolt', ''];

function make(n: number): { txs: Transaction[]; names: Map<string, string> } {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const names = new Map<string, string>(ENVS.map((e) => [e.toLowerCase(), e]));
  const txs = Array.from({ length: n }, (_, i) => {
    const env = ENVS[Math.floor(rnd() * ENVS.length)].toLowerCase();
    return tx(`t${i}`, env, addDays('2024-01-01', Math.floor(i / 5)), 50 + Math.floor(rnd() * 20000), {
      note: NOTES[Math.floor(rnd() * NOTES.length)] || null, createdAt: new Date(1_700_000_000_000 + i * 1000).toISOString(),
    });
  });
  return { txs, names };
}
const ALL: HFilter = { from: '0000-01-01', to: '9999-12-31', envs: [], types: [], autoOnly: null, needle: '' };
const time = <T,>(fn: () => T, reps = 5): { ms: number; out: T } => {
  let best = Infinity;
  let out!: T;
  for (let i = 0; i < reps; i++) {
    const t = performance.now();
    out = fn();
    best = Math.min(best, performance.now() - t);
  }
  return { ms: best, out };
};

describe('AC-EXP-07: History query on 5,000+ entries', () => {
  const { txs, names } = make(5000);
  const nm = (id: string | null) => names.get(id ?? '') ?? '';
  const built = time(() => buildItems(txs, [], nm, 'AZN'), 3);
  const items = built.out;

  it('is complete and newest first', () => {
    expect(items).toHaveLength(5000);
    for (let i = 1; i < items.length; i++) expect(items[i - 1].date >= items[i].date).toBe(true);
  });
  it('index build (once per data change) is fast', () => {
    console.info(`[perf] buildItems(5000): ${built.ms.toFixed(1)} ms`);
    expect(built.ms).toBeLessThan(200);
  });
  const cases: [string, HFilter][] = [
    ['text "bravo"', { ...ALL, needle: fold('bravo') }],
    ['text with diacritics "ehmed" matches "Əhməd"', { ...ALL, needle: fold('ehmed') }],
    ['text "кофе"/"магазин"', { ...ALL, needle: fold('магазин') }],
    ['amount prefix "12"', { ...ALL, needle: '12' }],
    ['envelope Food + Transport', { ...ALL, envs: ['food', 'transport'] }],
    ['date range (one year)', { ...ALL, from: '2025-01-01', to: '2025-12-31' }],
    ['combined: range + envelope + text', { ...ALL, from: '2025-01-01', to: '2026-12-31', envs: ['food'], needle: fold('market') }],
  ];
  for (const [label, f] of cases) {
    it(`filter ${label} < 200 ms (budget) and correct`, () => {
      const r = time(() => filterItems(items, f));
      console.info(`[perf] filter ${label}: ${r.ms.toFixed(2)} ms -> ${r.out.length} rows`);
      expect(r.ms).toBeLessThan(200);
      for (const it of r.out) {
        expect(it.date >= f.from && it.date <= f.to).toBe(true);
        if (f.envs.length && it.kind === 'tx') expect(f.envs).toContain(it.tx.envelopeId);
      }
    });
  }
  it('Azerbaijani/Turkish letters fold so "ehmed" and "cay" find "Əhməd" and "Çay"', () => {
    expect(filterItems(items, { ...ALL, needle: fold('ehmed') }).length).toBeGreaterThan(0);
    expect(filterItems(items, { ...ALL, needle: fold('cay') }).length).toBeGreaterThan(0);
    expect(fold('İSTANBUL')).toBe('istanbul');
  });
  it('flatten produces one header per day plus the entries (the virtual list row model)', () => {
    const r = time(() => flatten(items), 3);
    console.info(`[perf] flatten(5000): ${r.ms.toFixed(1)} ms -> ${r.out.length} rows`);
    const heads = r.out.filter((x) => x.kind === 'head').length;
    expect(r.out.length).toBe(5000 + heads);
    expect(heads).toBe(1000);
    expect(r.ms).toBeLessThan(200);
  });
  it('scales: 20,000 entries still filter inside the budget', () => {
    const big = make(20000);
    const it2 = buildItems(big.txs, [], (id) => big.names.get(id ?? '') ?? '', 'AZN');
    const r = time(() => filterItems(it2, { ...ALL, envs: ['food'], needle: fold('taxi') }));
    console.info(`[perf] filter(20000): ${r.ms.toFixed(2)} ms`);
    expect(r.ms).toBeLessThan(200);
  });
});
