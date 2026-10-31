import { describe, expect, it } from 'vitest';
import { Engine } from './index';
import { example1, tx } from './testkit';
import { en } from '../i18n/en';
import { az } from '../i18n/az';
import { tr } from '../i18n/tr';
import { ru } from '../i18n/ru';

/**
 * Overspend wording (product spec 4.5: a plan is funded when the pay arrives, so an envelope can only spend what was funded).
 * With only the first of two pays received, a row can be "of 350 planned, 285 spent" and still be over what is available:
 * the status must say "over what is available", never "over plan" (which would be false: 285 < 350).
 */
describe('overspend is measured against what is available, not against the plan', () => {
  const { ds, per } = example1('2026-04-08');
  const spentFood = 28500;
  const withSpend = { ...ds, transactions: [tx('big', 'food', '2026-04-07', spentFood)] };
  const row = new Engine(withSpend, '2026-04-08').snapshotFor(per.id)!.rows.food;

  it('only part of the plan is funded, so spending below the plan is already over what is available', () => {
    expect(row.planned).toBe(35000);
    expect(row.spent).toBe(spentFood);
    expect(row.spent).toBeLessThan(row.planned); // not over plan ...
    expect(row.available).toBeLessThan(0); // ... but over what has actually been funded
    expect(-row.available).toBe(row.spent - 15979); // the over amount is measured from the funded amount (15,979), not from the plan
  });

  // E-13 (walkthrough): the status now says what is SHORT ('₼ 2,50 çatmır'), still measured against what is available,
  // never 'over plan' and never an accusing 'spent too much'
  it('the wording says "short" in every language and never claims "over plan"', () => {
    for (const [name, c] of Object.entries({ en, az, tr, ru })) {
      for (const k of ['row.over', 'row.overPlan', 'env.detail.overBy', 'add.savedOver'] as const) {
        const s = String(c[k]);
        expect(s, `${name} ${k}`).not.toMatch(/over plan|plandan|план(а|ом)\b(?!у)/i);
      }
    }
    expect(en['row.over']).toContain('short');
    expect(az['row.over']).toContain('çatmır');
    expect(tr['row.over']).toContain('eksik');
    expect(ru['row.over']).toContain('Не хватает');
    for (const c of [en, az, tr, ru]) expect(String(c['add.savedOver'])).not.toMatch(/çox xərc|spent too much|fazla harcan|больше доступного/i);
    // the plan is shown separately and is called what it is
    expect(en['row.ofPlan']).toContain('planned');
  });
});
