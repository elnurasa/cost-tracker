import type { Envelope, Minor, Region } from './types';
import { distribute, pow10, roundNearestTo, sum } from './money';

type Alloc = Record<string, Minor>;
const byOrder = (a: Envelope, b: Envelope) => a.order - b.order;

/**
 * Reduce `amount` proportionally (largest remainder) across `ids`, never taking more than cap[id].
 * Returns reductions per id and what could not be taken.
 */
export function reduceProportionally(amount: Minor, weights: Alloc, caps: Alloc, ids: string[]): { cut: Alloc; short: Minor } {
  const cut: Alloc = {};
  ids.forEach((id) => (cut[id] = 0));
  let remaining = amount;
  let active = ids.filter((id) => (caps[id] ?? 0) > 0 && (weights[id] ?? 0) > 0);
  while (remaining > 0 && active.length > 0) {
    const parts = distribute(remaining, active.map((id) => weights[id]));
    let capped = false;
    active.forEach((id, i) => {
      const room = (caps[id] ?? 0) - cut[id];
      if (parts[i] > room) capped = true;
    });
    if (!capped) {
      active.forEach((id, i) => (cut[id] += parts[i]));
      remaining = 0;
      break;
    }
    // cap the ones that overflow, then redistribute the rest
    const next: string[] = [];
    active.forEach((id, i) => {
      const room = (caps[id] ?? 0) - cut[id];
      if (parts[i] >= room) {
        cut[id] += room;
        remaining -= room;
      } else next.push(id);
    });
    active = next;
  }
  return { cut, short: remaining };
}

export interface MakeRoomResult {
  newAlloc: Alloc; // non-buffer plan lines after the change (target raised)
  fromBuffer: Minor;
  fromFlexible: Alloc;
  short: Minor; // not enough room (4.7 step 3)
}
/**
 * Make room (4.7): `amount` more for `targetId`. Takes from the derived Buffer line first, then from flexible
 * allocations proportionally (floored at spent). Pocket and Savings are never reduced automatically.
 */
export function makeRoom(p: { amount: Minor; targetId: string; planned: Alloc; bufferAlloc: Minor; envelopes: Envelope[]; spent: Alloc }): MakeRoomResult {
  const newAlloc: Alloc = { ...p.planned };
  newAlloc[p.targetId] = (newAlloc[p.targetId] ?? 0) + p.amount;
  const fromBuffer = Math.min(p.amount, Math.max(0, p.bufferAlloc));
  const rest = p.amount - fromBuffer;
  const flex = p.envelopes.filter((e) => e.kind === 'flexible' && !e.archived && e.id !== p.targetId).sort(byOrder).map((e) => e.id);
  const caps: Alloc = {};
  flex.forEach((id) => (caps[id] = Math.max(0, (p.planned[id] ?? 0) - Math.max(0, p.spent[id] ?? 0))));
  const { cut, short } = reduceProportionally(rest, p.planned, caps, flex);
  for (const id of flex) newAlloc[id] = (newAlloc[id] ?? 0) - cut[id];
  return { newAlloc, fromBuffer, fromFlexible: cut, short };
}

/**
 * Fit plan to income (4.7): cut `over` from Savings (proportional), then flexible (proportional, floored at spent),
 * then Pocket only when includePocket. Fixed commitments are never reduced.
 */
export function fitPlanToIncome(p: { over: Minor; planned: Alloc; envelopes: Envelope[]; spent: Alloc; includePocket: boolean }): { newAlloc: Alloc; short: Minor } {
  const newAlloc: Alloc = { ...p.planned };
  let rem = p.over;
  const stage = (kind: Envelope['kind'], floor: boolean) => {
    if (rem <= 0) return;
    const ids = p.envelopes.filter((e) => e.kind === kind && !e.archived).sort(byOrder).map((e) => e.id);
    const caps: Alloc = {};
    ids.forEach((id) => (caps[id] = Math.max(0, (newAlloc[id] ?? 0) - (floor ? Math.max(0, p.spent[id] ?? 0) : 0))));
    const { cut, short } = reduceProportionally(rem, newAlloc, caps, ids);
    ids.forEach((id) => (newAlloc[id] -= cut[id]));
    rem = short;
  };
  stage('savings', false);
  stage('flexible', true);
  if (p.includePocket) stage('pocket', true);
  return { newAlloc, short: rem };
}

/** New period plan (4.4): copy master plan, raise fixed envelopes to cover commitments due in the period. */
export function buildPeriodPlan(master: Alloc, envelopes: Envelope[], dueByEnvelope: Alloc): Alloc {
  const out: Alloc = {};
  for (const e of envelopes) {
    if (e.kind === 'buffer' || e.archived) continue; // archived envelopes are never funded again
    let a = master[e.id] ?? 0;
    if (e.kind === 'fixed') a = Math.max(a, dueByEnvelope[e.id] ?? 0);
    out[e.id] = a;
  }
  return out;
}

// ---------------- onboarding templates (5.1) ----------------

export interface TemplateItem {
  key: string; // i18n key suffix, e.g. 'home'
  kind: Envelope['kind'];
  icon: string;
  pct: number;
}
export const TEMPLATES: Record<'AZ' | 'TR' | 'GLOBAL', TemplateItem[]> = {
  AZ: [
    { key: 'home', kind: 'fixed', icon: 'house', pct: 25 },
    { key: 'bills', kind: 'fixed', icon: 'receipt', pct: 7 },
    { key: 'installments', kind: 'fixed', icon: 'calendar-clock', pct: 7 },
    { key: 'food', kind: 'flexible', icon: 'shopping-basket', pct: 22 },
    { key: 'transport', kind: 'flexible', icon: 'bus', pct: 8 },
    { key: 'family', kind: 'flexible', icon: 'gift', pct: 6 },
    { key: 'fun', kind: 'flexible', icon: 'sparkles', pct: 7 },
    { key: 'pocket', kind: 'pocket', icon: 'hand-coins', pct: 6 },
    { key: 'savings', kind: 'savings', icon: 'piggy-bank', pct: 5 },
  ],
  TR: [
    { key: 'home', kind: 'fixed', icon: 'house', pct: 28 },
    { key: 'bills', kind: 'fixed', icon: 'receipt', pct: 7 },
    { key: 'installments', kind: 'fixed', icon: 'calendar-clock', pct: 10 },
    { key: 'groceries', kind: 'flexible', icon: 'shopping-basket', pct: 18 },
    { key: 'transport', kind: 'flexible', icon: 'bus', pct: 7 },
    { key: 'fun', kind: 'flexible', icon: 'sparkles', pct: 5 },
    { key: 'pocket', kind: 'pocket', icon: 'hand-coins', pct: 5 },
    { key: 'savings', kind: 'savings', icon: 'piggy-bank', pct: 5 },
  ],
  GLOBAL: [
    { key: 'home', kind: 'fixed', icon: 'house', pct: 30 },
    { key: 'bills', kind: 'fixed', icon: 'receipt', pct: 8 },
    { key: 'food', kind: 'flexible', icon: 'shopping-basket', pct: 15 },
    { key: 'transport', kind: 'flexible', icon: 'bus', pct: 7 },
    { key: 'fun', kind: 'flexible', icon: 'sparkles', pct: 8 },
    { key: 'pocket', kind: 'pocket', icon: 'hand-coins', pct: 7 },
    { key: 'savings', kind: 'savings', icon: 'piggy-bank', pct: 15 },
  ],
};
export const templateFor = (region: Region) => TEMPLATES[region === 'AZ' || region === 'CIS' ? 'AZ' : region === 'TR' ? 'TR' : 'GLOBAL'];

/** Rounding step in minor units: 10 major units (adaptive for small incomes so rows are not all zero). */
export function templateStep(monthlyIncome: Minor, exp: number): Minor {
  const major = monthlyIncome / pow10(exp);
  return (major >= 400 ? 10 : major >= 100 ? 5 : 1) * pow10(exp);
}
/** Template amounts (percent of monthly income, rounded to nearest step), never exceeding the income. */
export function templateAmounts(items: TemplateItem[], monthlyIncome: Minor, exp: number): Alloc {
  const step = templateStep(monthlyIncome, exp);
  const out: Alloc = {};
  for (const it of items) out[it.key] = roundNearestTo(Math.floor((monthlyIncome * it.pct) / 100), step);
  let over = sum(Object.values(out)) - monthlyIncome;
  const order = items.filter((i) => i.kind === 'flexible').sort((a, b) => out[b.key] - out[a.key]);
  for (let guard = 0; over > 0 && guard < 1000; guard++) {
    const t = order[guard % order.length] ?? items[0];
    const cut = Math.min(step, out[t.key]);
    out[t.key] -= cut;
    over -= cut;
  }
  return out;
}
/** Scale a first partial period's plan lines (5.1 O3). */
export function scaleAmounts(amounts: Alloc, opening: Minor, monthlyIncome: Minor): Alloc {
  const keys = Object.keys(amounts);
  if (monthlyIncome <= 0) return Object.fromEntries(keys.map((k) => [k, 0]));
  const total = Math.round((sum(Object.values(amounts)) * opening) / monthlyIncome);
  const parts = distribute(total, keys.map((k) => amounts[k]));
  return Object.fromEntries(keys.map((k, i) => [k, parts[i]]));
}
