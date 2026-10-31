import type { Envelope, Minor } from './types';
import { distribute, sum } from './money';

/** Derived Buffer allocation (4.4). `planned` has non-buffer lines only. */
export function withBuffer(
  planned: Record<string, Minor>,
  envelopes: Envelope[],
  pInc: Minor,
): { alloc: Record<string, Minor>; overPlanned: Minor; nonBufferTotal: Minor } {
  const buffer = envelopes.find((e) => e.kind === 'buffer');
  const alloc: Record<string, Minor> = {};
  let total = 0;
  for (const e of envelopes) {
    if (e.kind === 'buffer') continue;
    const a = Math.max(0, planned[e.id] ?? 0);
    alloc[e.id] = a;
    total += a;
  }
  if (buffer) alloc[buffer.id] = Math.max(0, pInc - total);
  return { alloc, overPlanned: Math.max(0, total - pInc), nonBufferTotal: total };
}

const byOrder = (a: Envelope, b: Envelope) => a.order - b.order;

/**
 * Funding (4.5): plan activates on receipt. Bills/installments first (pro-rata if R < F),
 * then everything else shares what is left pro-rata (largest remainder), surplus goes to Buffer.
 */
export function computeFunding(R: Minor, alloc: Record<string, Minor>, envelopes: Envelope[]): Record<string, Minor> {
  const funded: Record<string, Minor> = {};
  for (const e of envelopes) funded[e.id] = 0;
  if (R <= 0) return funded;
  const fixed = envelopes.filter((e) => e.kind === 'fixed').sort(byOrder);
  const others = envelopes.filter((e) => e.kind !== 'fixed').sort(byOrder);
  const buffer = envelopes.find((e) => e.kind === 'buffer');
  const F = sum(fixed.map((e) => alloc[e.id] ?? 0));
  const T2 = sum(others.map((e) => alloc[e.id] ?? 0));
  if (R < F) {
    const parts = distribute(R, fixed.map((e) => alloc[e.id] ?? 0));
    fixed.forEach((e, i) => (funded[e.id] = parts[i]));
    return funded;
  }
  for (const e of fixed) funded[e.id] = alloc[e.id] ?? 0;
  const R2 = R - F;
  if (T2 === 0) {
    if (buffer) funded[buffer.id] += R2;
  } else if (R2 >= T2) {
    for (const e of others) funded[e.id] = alloc[e.id] ?? 0;
    if (buffer) funded[buffer.id] += R2 - T2;
  } else {
    const parts = distribute(R2, others.map((e) => alloc[e.id] ?? 0));
    others.forEach((e, i) => (funded[e.id] = parts[i]));
  }
  return funded;
}
