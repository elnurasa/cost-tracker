import { expect, test } from '@playwright/test';
import { firstVisit } from './helpers';

/** The sample-data start routes to #/today a moment after the data appears; that must not close a sheet the user already opened. */
test('a sheet opened right after "Try with sample data" stays open', async ({ page }) => {
  await firstVisit(page);
  await page.getByRole('button', { name: 'Try with sample data' }).click();
  const add = page.getByRole('button', { name: 'Add expense' }).first();
  await add.click({ timeout: 15_000 });
  const pad = page.getByRole('group', { name: 'Number pad' });
  await expect(pad).toBeVisible();
  await page.waitForTimeout(1500); // longer than the onboarding hand-off
  await expect(pad).toBeVisible();
});

test('the Azerbaijani sample has an installment envelope and one installment', async ({ page }) => {
  await firstVisit(page);
  await page.evaluate(() => localStorage.setItem('sakin.prefs.v1', JSON.stringify({ locale: 'az' })));
  await page.reload();
  await page.locator('button', { hasText: /nümunə/i }).first().click();
  await page.waitForFunction(() => location.hash === '#/today');
  await page.evaluate(() => { location.hash = '#/coming/installments'; });
  await expect(page.getByText('Telefon taksiti').first()).toBeVisible();
  await page.evaluate(() => { location.hash = '#/plan'; });
  await expect(page.getByText('Taksitlər').first()).toBeVisible();
});
