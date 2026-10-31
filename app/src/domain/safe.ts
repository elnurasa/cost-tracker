import type { DateStr, Envelope, Minor } from './types';
import { diffDays, addDays } from './dates';

export type HorizonMode = 'scheduled' | 'late' | 'cover' | 'period_end';
export interface Horizon {
  H: number;
  nextDate: DateStr;
  mode: HorizonMode;
  /** the event (or cover date) that is late / due today, if any */
  dueToday: boolean;
}
export interface HorizonInput {
  today: DateStr;
  periodEnd: DateStr;
  /** expected (unreceived) events of steady incomes */
  steadyExpectedDates: DateStr[];
  coverUntil: DateStr | null;
  lateAssumedArrival: DateStr | null;
}
export const LATE_GRACE_DAYS = 3;
export const STALE_DAYS = 14;

export function horizon(i: HorizonInput): Horizon {
  const { today } = i;
  const late = i.steadyExpectedDates.filter((d) => d < today && diffDays(today, d) <= STALE_DAYS);
  const assumed = () => (i.lateAssumedArrival && i.lateAssumedArrival >= today ? i.lateAssumedArrival : addDays(today, LATE_GRACE_DAYS));
  if (late.length > 0) {
    const nextDate = assumed();
    return { H: Math.max(1, diffDays(nextDate, today)), nextDate, mode: 'late', dueToday: false };
  }
  const upcoming = i.steadyExpectedDates.filter((d) => d >= today).sort()[0];
  if (upcoming) {
    return { H: Math.max(1, diffDays(upcoming, today)), nextDate: upcoming, mode: 'scheduled', dueToday: upcoming === today };
  }
  if (i.coverUntil && i.coverUntil >= today) {
    return { H: Math.max(1, diffDays(i.coverUntil, today)), nextDate: i.coverUntil, mode: 'cover', dueToday: false };
  }
  if (i.coverUntil && diffDays(today, i.coverUntil) <= STALE_DAYS) {
    const nextDate = assumed();
    return { H: Math.max(1, diffDays(nextDate, today)), nextDate, mode: 'late', dueToday: false };
  }
  return { H: Math.max(1, diffDays(i.periodEnd, today) + 1), nextDate: addDays(i.periodEnd, 1), mode: 'period_end', dueToday: false };
}

export type SafeState = 'normal' | 'used_up' | 'past_today' | 'last_day' | 'no_flexible';
export interface SafeResult {
  leftToday: Minor;
  allowance: Minor;
  pool: Minor;
  poolStart: Minor;
  flexPool: Minor;
  H: number;
  nextDate: DateStr;
  mode: HorizonMode;
  D: Minor;
  cover: Minor;
  netDeficit: Minor;
  bridged: boolean;
  bufferAvailable: Minor;
  spentTodayFlex: Minor;
  tomorrow: Minor;
  state: SafeState;
}
export interface SafeInput {
  envelopes: Envelope[];
  available: Record<string, Minor>;
  R: Minor;
  horizon: Horizon;
  bridgeBuffer: boolean;
  spentTodayFlex: Minor;
}

/** Safe-to-spend (4.6). Pure. */
export function safeToSpend(i: SafeInput): SafeResult {
  const av = (e: Envelope) => i.available[e.id] ?? 0;
  const flex = i.envelopes.filter((e) => e.kind === 'flexible' && !e.archived);
  const buffer = i.envelopes.find((e) => e.kind === 'buffer');
  const D = i.envelopes
    .filter((e) => e.kind === 'fixed' || e.kind === 'pocket' || e.kind === 'savings')
    .reduce((s, e) => s + Math.max(0, -av(e)), 0);
  const bufferAvl = buffer ? av(buffer) : 0;
  const cover = Math.min(D, Math.max(0, bufferAvl));
  const netDeficit = D - cover;
  const flexPool = flex.reduce((s, e) => s + av(e), 0);
  let pool = flexPool - netDeficit;
  const h = i.horizon;
  const bridged = i.bridgeBuffer && (i.R === 0 || h.mode === 'late');
  if (bridged) pool += Math.max(0, bufferAvl - cover);
  const poolStart = pool + i.spentTodayFlex;
  const allowance = poolStart <= 0 ? 0 : Math.floor(poolStart / h.H);
  const leftToday = Math.max(0, allowance - i.spentTodayFlex);
  const tomorrow = h.H > 1 && pool > 0 ? Math.floor(pool / (h.H - 1)) : 0;
  let state: SafeState = 'normal';
  if (flex.length === 0) state = 'no_flexible';
  else if (pool <= 0) state = 'used_up';
  else if (leftToday === 0 && h.H > 1 && i.spentTodayFlex > 0 && i.spentTodayFlex >= allowance) state = 'past_today';
  else if (h.H === 1) state = 'last_day';
  return {
    leftToday, allowance, pool, poolStart, flexPool, H: h.H, nextDate: h.nextDate, mode: h.mode, D, cover, netDeficit,
    bridged, bufferAvailable: bufferAvl, spentTodayFlex: i.spentTodayFlex, tomorrow, state,
  };
}
