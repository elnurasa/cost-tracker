import { expect, test, type Page } from '@playwright/test';
import { firstVisit, startSample } from './helpers';

/** Expert walkthrough fixes (docs/07): E-01 Add sheet layout, E-03 AZ numbers, E-04 scroll, onboarding income list. */

const box = async (page: Page, sel: string) => page.locator(sel).first().evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) };
});

for (const size of [{ width: 360, height: 640 }, { width: 360, height: 560 }, { width: 375, height: 812 }]) {
  test(`E-01: Add sheet at ${size.width}x${size.height}: every key above the Save bar, no jump, fast taps all land`, async ({ page }) => {
    await page.setViewportSize(size);
    await firstVisit(page);
    await startSample(page);
    await page.waitForTimeout(700);
    await page.getByRole('button', { name: 'Add expense' }).first().click();
    const pad = page.getByRole('group', { name: 'Number pad' });
    await expect(pad).toBeVisible();
    await page.waitForTimeout(600); // slide-in
    const chipsBefore = await box(page, '[data-sheet="add"] .chip-row');
    const bar = await box(page, '[data-sheet="add"] .sheet-actions');
    const keysBottom = await pad.getByRole('button').evaluateAll((els) => Math.max(...els.map((e) => e.getBoundingClientRect().bottom)));
    // 360 x 640 and taller: the whole pad, "0" included, is above the Save bar without scrolling; 560 px high: one short scroll
    if (size.height >= 640) expect(keysBottom).toBeLessThanOrEqual(bar.top + 1);
    else await pad.getByRole('button', { name: '0', exact: true }).scrollIntoViewIfNeeded();
    const keysBefore = await pad.getByRole('button').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(chipsBefore.height).toBeGreaterThanOrEqual(44); // the envelope chips are fully visible before the first digit
    // fast typing: 4 , 5 0 with no pause
    for (const name of ['4', 'Decimal point', '5', '0']) await pad.getByRole('button', { name, exact: true }).click({ delay: 0 });
    await expect(page.locator('[data-sheet="add"] .amount-num')).toHaveText('4.50');
    const keysAfter = await pad.getByRole('button').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(keysAfter).toEqual(keysBefore); // nothing moved after the first digit
    expect((await box(page, '[data-sheet="add"] .chip-row')).height).toBe(chipsBefore.height);
    expect((await box(page, '[data-sheet="add"] .sheet-actions')).top).toBe(bar.top);
  });
}

test('E-03 / E-04: Azerbaijani shows "1.234,50 ₼" style amounts everywhere, and Today opens at the top', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await firstVisit(page);
  await page.evaluate(() => localStorage.setItem('sakin.prefs.v1', JSON.stringify({ locale: 'az' })));
  await page.reload();
  await page.locator('button', { hasText: /nümunə/i }).first().click();
  await page.waitForFunction(() => location.hash === '#/today');
  await page.waitForTimeout(700);
  // scroll down on Plan, then go to Today: it must open at the top
  await page.evaluate(() => { location.hash = '#/plan'; });
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.evaluate(() => { location.hash = '#/today'; });
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  const text = await page.locator('main').first().innerText();
  expect(text).toMatch(/\d,\d{2}\s?₼/); // comma decimal, symbol after
  expect(text).not.toMatch(/₼\s?\d/); // never "₼ 1,500" (symbol first, English style)
  expect(text).not.toMatch(/\d\.\d{2}\s?₼/); // never a dot decimal
  // screen-reader name of the hero is Azerbaijani, not "Azerbaijani manats"
  const aria = (await page.locator('.hero-number-btn').getAttribute('aria-label')) ?? '';
  expect(aria).not.toMatch(/Azerbaijani|manats/);
  // the decimal key is a comma
  await page.getByRole('button', { name: 'Xərc əlavə et' }).first().click();
  await expect(page.getByRole('group', { name: /rəqəm|klaviatura|pad/i }).getByRole('button', { name: 'Vergül' })).toHaveText(',');
});

test('onboarding income list: two equal rows, each amount typed on the pad, monthly total, then the first number', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await firstVisit(page);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('radio', { name: 'Advance + salary' }).click();
  const pad = page.getByRole('group', { name: 'Number pad' });
  const amounts = page.locator('.inc-amount');
  await expect(amounts).toHaveCount(2);
  await amounts.nth(0).click();
  for (const d of '1100') await pad.getByRole('button', { name: d, exact: true }).click();
  await amounts.nth(1).click();
  await expect(amounts.nth(1)).toHaveAttribute('aria-pressed', 'true');
  for (const d of '500') await pad.getByRole('button', { name: d, exact: true }).click();
  await expect(amounts.nth(0)).toContainText('1,100');
  await expect(amounts.nth(1)).toContainText('500');
  await expect(page.getByText('Total a month: $1,600').or(page.getByText(/Total a month: .*1,600/))).toBeVisible();
  // a third income can be added and removed again
  await page.getByRole('button', { name: 'Add another income' }).click();
  await expect(amounts).toHaveCount(3);
  await page.getByRole('button', { name: /^Remove / }).last().click();
  await expect(amounts).toHaveCount(2);
  // the pay day grid: salary on the last day of the month
  await page.locator('.inc-sched').first().click();
  await page.getByRole('radio', { name: 'Last day of the month' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.locator('.inc-sched').first()).toContainText('last day');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Looks good' }).click();
  await expect(page.getByText('You can spend today').first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/today');
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await page.evaluate(() => { location.hash = '#/income'; });
  await expect(page.getByText('Salary').first()).toBeVisible();
  await expect(page.getByText('Advance').first()).toBeVisible();
});
