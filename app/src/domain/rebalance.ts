import type { Dataset, DateStr, Envelope, Minor } from './types';
import type { Snapshot } from './engine';
import { Engine, hypotheticalTransfer } from './engine';
import { pow10, roundUpTo } from './money';

export interface MoveSuggestion {
  toId: string | null;
  fromId: string | null;
  amount: Minor;
}
const active = (e: Envelope) => !e.archived;

/** Suggest a Move (4.8 / 5.4). `toId` is the envelope in need if the caller already knows it. */
export function suggestMove(snap: Snapshot, envelopes: Envelope[], exp: number, toId?: string): MoveSuggestion {
  const flex = envelopes.filter((e) => e.kind === 'flexible' && active(e));
  const av = (id: string) => snap.available[id] ?? 0;
  const buffer = envelopes.find((e) => e.kind === 'buffer');
  const savings = envelopes.filter((e) => e.kind === 'savings' && active(e));
  const needy = toId ?? [...flex].sort((a, b) => av(a.id) - av(b.id))[0]?.id ?? null;
  const step = 10 * pow10(exp);
  const poolNeg = snap.safe.pool <= 0 ? -snap.safe.pool : 0;
  const envNeg = needy && av(needy) < 0 ? -av(needy) : 0;
  // row trigger (toId given): the envelope's shortfall; hero trigger: the pool's shortfall (4.8, Example 4)
  const shortfall = toId ? (envNeg > 0 ? envNeg : poolNeg) : poolNeg > 0 ? poolNeg : envNeg;
  const amount = roundUpTo(Math.max(shortfall, 1), step);
  let fromId: string | null = null;
  if (snap.safe.pool > 0 && needy && av(needy) < 0) {
    const donor = flex.filter((e) => e.id !== needy && av(e.id) > 0).sort((a, b) => av(b.id) - av(a.id))[0];
    if (donor) fromId = donor.id;
  }
  if (!fromId) {
    if (buffer && av(buffer.id) > 0) fromId = buffer.id;
    else {
      const sv = savings.filter((e) => av(e.id) > 0).sort((a, b) => av(b.id) - av(a.id))[0];
      fromId = sv?.id ?? buffer?.id ?? null;
    }
  }
  return { toId: needy, fromId, amount };
}

/** Cap for the stepper: only Buffer and Savings are capped by their balance (AC-REB-03). */
export function sourceCap(snap: Snapshot, envelopes: Envelope[], fromId: string | null): Minor | null {
  const e = envelopes.find((x) => x.id === fromId);
  if (!e || (e.kind !== 'buffer' && e.kind !== 'savings')) return null;
  return Math.max(0, snap.available[e.id] ?? 0);
}

export interface MovePart { from: string; amount: Minor }
/**
 * E-06: a move must never dead-end when the first source cannot cover the need. Splits `amount` over sources in the
 * 4.8 order: the chosen source first (Buffer/Savings capped by their balance, a flexible source as chosen), then other
 * flexible envelopes with spare money (largest first), then Buffer, then Savings. Pocket is never added automatically.
 * `rest` is what no envelope can cover (it then simply comes out of the next income).
 */
export function planMove(snap: Snapshot, envelopes: Envelope[], toId: string, fromId: string, amount: Minor): { parts: MovePart[]; rest: Minor } {
  const av = (id: string) => snap.available[id] ?? 0;
  const parts: MovePart[] = [];
  let left = amount;
  const cap = sourceCap(snap, envelopes, fromId);
  const first = cap === null ? left : Math.min(left, cap);
  if (first > 0) parts.push({ from: fromId, amount: first });
  left -= first;
  const ok = (e: Envelope) => !e.archived && e.id !== toId && e.id !== fromId && av(e.id) > 0;
  const order = [
    ...envelopes.filter((e) => e.kind === 'flexible' && ok(e)).sort((a, b) => av(b.id) - av(a.id)),
    ...envelopes.filter((e) => e.kind === 'buffer' && ok(e)),
    ...envelopes.filter((e) => e.kind === 'savings' && ok(e)).sort((a, b) => av(b.id) - av(a.id)),
  ];
  for (const e of order) {
    if (left <= 0) break;
    const take = Math.min(left, av(e.id));
    parts.push({ from: e.id, amount: take });
    left -= take;
  }
  return { parts, rest: Math.max(0, left) };
}

/** Hero preview after several hypothetical transfers into `to`. */
export function previewHeroParts(ds: Dataset, today: DateStr, periodId: string, parts: MovePart[], to: string, exp: number): number {
  const eng = new Engine(ds, today, parts.filter((p) => p.amount > 0).map((p) => hypotheticalTransfer(periodId, p.from, to, p.amount, today)));
  const s = eng.snapshotFor(periodId);
  return s ? Math.floor(s.safe.leftToday / pow10(exp)) : 0;
}

/** Preview of the hero (whole major units) after a hypothetical transfer. */
export function previewHero(ds: Dataset, today: DateStr, periodId: string, from: string, to: string, amount: Minor, exp: number): number {
  const eng = new Engine(ds, today, amount > 0 ? [hypotheticalTransfer(periodId, from, to, amount, today)] : []);
  const s = eng.snapshotFor(periodId);
  return s ? Math.floor(s.safe.leftToday / pow10(exp)) : 0;
}
