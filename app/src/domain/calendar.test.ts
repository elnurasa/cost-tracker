import { afterAll, describe, expect, it } from 'vitest';
import {
  addDays, addMonthsClamped, cycleStartIn, daysInMonth, diffDays, installmentDueDate, nextBoundaryAfter, normalizePayDay, periodBoundsFor, planPeriods,
  ruleOccurrences, scheduleDates, todayLocal,
} from './index';
import type { CycleDay } from './index';

const ORIGINAL_TZ = process.env.TZ;
afterAll(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

describe('month-end and leap years (pay day 28-31)', () => {
  it('daysInMonth knows leap years including the 100/400 rules', () => {
    expect([2024, 2025, 2028, 2100, 2000].map((y) => daysInMonth(y, 2))).toEqual([29, 28, 29, 28, 29]);
  });
  it('cycle start for day 29, 30, 31 and L clamps to the real last day', () => {
    const cases: [number, number, CycleDay, string][] = [
      [2026, 2, 29, '2026-02-28'], [2028, 2, 29, '2028-02-29'], [2026, 2, 30, '2026-02-28'], [2026, 4, 31, '2026-04-30'], [2026, 1, 31, '2026-01-31'],
      [2026, 2, 'L', '2026-02-28'], [2028, 2, 'L', '2028-02-29'], [2026, 12, 'L', '2026-12-31'],
    ];
    for (const [y, m, c, want] of cases) expect(cycleStartIn(y, m, c)).toBe(want);
  });
  it('periods tile the calendar with no gap or overlap for every cycle day across 8 years', () => {
    for (const c of [1, 5, 15, 28, 29, 30, 31, 'L'] as CycleDay[]) {
      for (let i = 0; i < 365 * 8; i += 3) {
        const day = addDays('2024-01-01', i);
        const p = periodBoundsFor(day, c);
        expect(p.startDate <= day && day <= p.endDate, `${c} ${day}`).toBe(true);
        expect(nextBoundaryAfter(p.startDate, c)).toBe(addDays(p.endDate, 1));
        const len = diffDays(p.endDate, p.startDate) + 1;
        expect(len, `${c} ${day}`).toBeGreaterThanOrEqual(27);
        expect(len).toBeLessThanOrEqual(32);
      }
    }
  });
  it('planPeriods from a stale chain creates contiguous months, including Feb of a leap year', () => {
    const base = { id: 'p0', createdAt: '', updatedAt: '', deletedAt: null, rev: '0', workspaceId: 'w', startDate: '2027-12-31', endDate: '2028-01-30', state: 'open' as const, closedAt: null, scaledFirstPeriod: false };
    const plan = planPeriods([base], 'L', '2028-04-15');
    const all = [{ startDate: base.startDate, endDate: base.endDate }, ...plan.create];
    for (let i = 1; i < all.length; i++) expect(addDays(all[i - 1].endDate, 1)).toBe(all[i].startDate);
    expect(all.map((p) => p.startDate)).toContain('2028-02-29');
  });
  it('monthly income and rules on the 29th-31st land on the last day of short months and snap back afterwards', () => {
    expect(scheduleDates({ type: 'monthly', day: 31 }, '2028-01-01', '2028-05-31')).toEqual(['2028-01-31', '2028-02-29', '2028-03-31', '2028-04-30', '2028-05-31']);
    expect(scheduleDates({ type: 'monthly', day: 30 }, '2027-01-01', '2027-03-31')).toEqual(['2027-01-30', '2027-02-28', '2027-03-30']);
    expect(ruleOccurrences({ frequency: 'monthly', anchorDate: '2027-01-31', dayOfMonth: 31, endDate: null }, '2027-01-01', '2027-04-30')).toEqual(['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30']);
    expect(ruleOccurrences({ frequency: 'yearly', anchorDate: '2024-02-29', dayOfMonth: 29, endDate: null }, '2024-01-01', '2028-12-31')).toEqual(['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29']);
  });
  it('installment due dates never skip a month when the first payment is on the 31st', () => {
    const due = Array.from({ length: 6 }, (_, i) => installmentDueDate({ firstDueDate: '2027-08-31' }, i + 1));
    expect(due).toEqual(['2027-08-31', '2027-09-30', '2027-10-31', '2027-11-30', '2027-12-31', '2028-01-31']);
    expect(addMonthsClamped('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonthsClamped('2027-01-31', 13, 31)).toBe('2028-02-29');
  });
  it('pay day normalisation: 29-31 means "last day"', () => {
    expect([28, 29, 30, 31].map(normalizePayDay)).toEqual([28, 'L', 'L', 'L']);
  });
});

describe('time zones and DST', () => {
  const setTz = (tz: string) => {
    process.env.TZ = tz;
  };
  const dstGap = () => new Date(2026, 2, 8, 2, 30).getHours(); // New York spring-forward gap: 02:30 does not exist -> 03:30
  it('the runtime honours TZ changes (guards the tests below from passing vacuously)', () => {
    setTz('America/New_York');
    expect(dstGap()).toBe(3);
    setTz('Asia/Baku');
    expect(dstGap()).toBe(2);
  });
  it('todayLocal is the wall-clock date of the device around midnight and DST changes', () => {
    const zones: [string, string, string][] = [
      ['Asia/Baku', '2026-03-28T23:30:00+04:00', '2026-03-28'],
      ['Asia/Baku', '2026-03-29T00:10:00+04:00', '2026-03-29'],
      ['Europe/Istanbul', '2026-10-25T00:05:00+03:00', '2026-10-25'],
      ['Europe/Moscow', '2026-03-01T23:59:59+03:00', '2026-03-01'],
      ['America/New_York', '2026-03-08T01:59:00-05:00', '2026-03-08'],
      ['America/New_York', '2026-03-08T03:00:00-04:00', '2026-03-08'],
      ['America/New_York', '2026-11-01T01:30:00-04:00', '2026-11-01'],
      ['America/New_York', '2026-11-01T01:30:00-05:00', '2026-11-01'],
      ['Pacific/Auckland', '2026-09-27T03:30:00+13:00', '2026-09-27'],
      ['Pacific/Kiritimati', '2026-06-15T23:59:00+14:00', '2026-06-15'],
    ];
    for (const [tz, iso, want] of zones) {
      setTz(tz);
      expect(todayLocal(new Date(iso)), `${tz} ${iso}`).toBe(want);
    }
  });
  it('day arithmetic is calendar based and exact across every DST change', () => {
    for (const tz of ['America/New_York', 'Europe/Berlin', 'Australia/Lord_Howe', 'Pacific/Auckland', 'Asia/Baku']) {
      setTz(tz);
      for (const d of ['2026-03-07', '2026-03-28', '2026-10-24', '2026-11-01', '2026-04-04', '2026-09-26', '2026-10-03']) {
        expect(diffDays(addDays(d, 1), d)).toBe(1);
        expect(diffDays(addDays(d, 30), d)).toBe(30);
        expect(addDays(addDays(d, 1), -1)).toBe(d);
      }
      expect(diffDays('2027-01-01', '2026-01-01')).toBe(365);
      expect(diffDays('2029-01-01', '2028-01-01')).toBe(366);
    }
  });
  it('the period chain is identical in every time zone (no hidden dependence on the machine zone)', () => {
    const chain = (tz: string) => {
      setTz(tz);
      return Array.from({ length: 60 }, (_, i) => periodBoundsFor(addDays('2026-01-01', i * 17), 5)).map((p) => `${p.startDate}/${p.endDate}`).join();
    };
    const ref = chain('UTC');
    for (const tz of ['America/Los_Angeles', 'Asia/Baku', 'Pacific/Auckland', 'Pacific/Kiritimati', 'Asia/Kolkata']) expect(chain(tz)).toBe(ref);
  });
});
