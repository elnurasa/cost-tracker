import { expect, test, type Page } from '@playwright/test';
import { firstVisit, heroNumber, idbCount, startSample } from './helpers';

const go = (page: Page, hash: string) => page.evaluate((h) => { location.hash = h; }, hash);
const sheet = (page: Page) => page.getByRole('dialog');

test.describe('Payments panel', () => {
  test('add a bank loan, mark a payment paid, pay extra: left to repay follows the real payments', async ({ page }) => {
    await firstVisit(page);
    await startSample(page);
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Payments' }).click();
    await expect(page.getByText('Still to pay this period')).toBeVisible();
    await page.getByRole('button', { name: 'New payment' }).first().click();
    await sheet(page).getByRole('button', { name: /Loan or installment/ }).click();
    await sheet(page).getByRole('radio', { name: /Bank loan/ }).click();
    await sheet(page).getByLabel('Name', { exact: true }).fill('Test loan');
    await sheet(page).locator('#pf-payee').fill('Test bank');
    await sheet(page).getByLabel('Monthly payment').fill('100');
    // number of payments: 12 (default), nothing counted as paid unless said so
    await expect(sheet(page).getByText(/Total .*1,200/)).toBeVisible();
    await sheet(page).getByRole('button', { name: 'Save payment' }).click();
    // a "make room" step can follow when the installments envelope is too small: either answer saves the loan
    await page.waitForTimeout(600);
    const room = page.getByRole('dialog').getByRole('button', { name: /Skip|Confirm|Take/ }).last();
    if (await room.isVisible().catch(() => false)) await room.click();
    await expect(page.getByText('Test loan').first()).toBeVisible();
    await page.getByRole('button', { name: /^Test loan/ }).first().click();
    await expect(page.getByText('Left to repay').first()).toBeVisible();
    const left = page.locator('.primary-number .pn-value');
    await expect(left).toContainText('1,200');
    // pay the first one early (not due yet)
    await page.getByRole('button', { name: 'I paid', exact: true }).click();
    await expect(sheet(page).getByText(/Not due yet/)).toBeVisible();
    await sheet(page).getByRole('button', { name: 'Save payment' }).click();
    await expect(page.getByText(/^Saved: /)).toBeVisible();
    await expect(left).toContainText('1,100');
    // pay extra 300 -> 800 left, 8 payments left (term shorter, same monthly amount)
    await page.getByRole('button', { name: 'Pay extra' }).click();
    await sheet(page).getByLabel('Amount paid').fill('300');
    await sheet(page).getByRole('button', { name: 'Save payment' }).click();
    await expect(page.getByText(/Left to repay: .*800/)).toBeVisible();
    await expect(left).toContainText('800');
    await expect(page.getByText('8 payments left')).toBeVisible();
    // undo the extra payment from the toast
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(left).toContainText('1,100');
  });

  test('confirm mode: a bill waits for "I paid", the hero does not jump, and the waiting group empties', async ({ page }) => {
    await firstVisit(page);
    await startSample(page);
    const heroBefore = await heroNumber(page);
    await go(page, '#/payments');
    const waiting = page.getByRole('region', { name: 'Waiting for you' });
    await expect(waiting).toBeVisible();
    await expect(page.getByText(/1 payment waiting for you/)).toBeVisible();
    await waiting.getByRole('button', { name: /^I paid: / }).first().click();
    await sheet(page).getByLabel('Amount paid').fill('31.40');
    await sheet(page).getByRole('button', { name: 'Save payment' }).click();
    await expect(page.getByText(/^Saved: /)).toBeVisible();
    await expect(page.getByRole('region', { name: 'Waiting for you' })).toHaveCount(0);
    await expect(page.getByText('Nothing is waiting for you.')).toBeVisible();
    await go(page, '#/today');
    await expect(page.getByText('You can spend today').first()).toBeVisible();
    expect(await heroNumber(page)).toBe(heroBefore);
  });

  test('offline: "I paid" works without a network and survives an offline reload', async ({ page, context }) => {
    await firstVisit(page);
    await startSample(page);
    const before = await idbCount(page, 'transactions');
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByText('You can spend today').first()).toBeVisible();
    await go(page, '#/payments');
    await page.getByRole('region', { name: 'Waiting for you' }).getByRole('button', { name: /^I paid: / }).first().click();
    await sheet(page).getByRole('button', { name: 'Save payment' }).click();
    await expect(page.getByText(/^Saved: /)).toBeVisible();
    expect(await idbCount(page, 'transactions')).toBe(before + 1);
    await page.reload();
    await go(page, '#/payments');
    await expect(page.getByText('Nothing is waiting for you.')).toBeVisible();
    expect(await idbCount(page, 'transactions')).toBe(before + 1);
    await context.setOffline(false);
  });

  test('categories: typing "qaz" suggests Utilities; a new envelope is created inline from a payment, and Undo removes it', async ({ page }) => {
    await firstVisit(page);
    await startSample(page);
    await go(page, '#/payments');
    await page.getByRole('button', { name: 'New payment' }).first().click();
    await sheet(page).getByRole('button', { name: /^Repeating/ }).click();
    // auto-suggest: "qaz" (AZ for gas) -> the Utilities envelope ("Bills" in the EN template), marked as suggested
    await sheet(page).getByLabel('Name', { exact: true }).fill('qaz');
    await expect(sheet(page).getByRole('radio', { name: 'Bills', exact: true })).toHaveAttribute('aria-checked', 'true');
    await expect(sheet(page).getByText('Suggested from the name. Tap another one to change it.')).toBeVisible();
    // "Netflix" -> Subscriptions; one tap changes it and the suggestion stops following the name
    await sheet(page).getByLabel('Name', { exact: true }).fill('Netflix');
    await expect(sheet(page).getByRole('radio', { name: 'Subscriptions', exact: true })).toHaveAttribute('aria-checked', 'true');
    // ambiguous text never auto-picks a suggestion
    await sheet(page).getByLabel('Name', { exact: true }).fill('Internet su');
    await expect(sheet(page).getByText('Suggested from the name. Tap another one to change it.')).toHaveCount(0);
    // inline "+ New envelope": name only, icon suggested, created on save together with the payment
    await sheet(page).getByLabel('Name', { exact: true }).fill('Gym');
    await sheet(page).getByLabel('Amount', { exact: true }).fill('20');
    await sheet(page).getByRole('button', { name: 'New envelope' }).click();
    await sheet(page).getByLabel('Envelope name').fill('Sport club');
    await sheet(page).getByRole('button', { name: 'Add and select' }).click();
    await expect(sheet(page).getByRole('radio', { name: 'Sport club, new envelope' })).toHaveAttribute('aria-checked', 'true');
    await expect(sheet(page).getByLabel('Name', { exact: true })).toHaveValue('Gym'); // the form kept what was typed
    await expect(sheet(page).getByText('New envelope. It is created when you save.')).toBeVisible();
    await sheet(page).getByRole('button', { name: 'Save payment' }).click();
    await page.waitForTimeout(600);
    const room = page.getByRole('dialog').getByRole('button', { name: /Confirm|Take/ }).first();
    if (await room.isVisible().catch(() => false)) await room.click();
    await expect(page.getByText(/New envelope: Sport club\./)).toBeVisible();
    await go(page, '#/plan');
    await expect(page.getByText('Sport club').first()).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText('Undone.')).toBeVisible();
    await expect(page.getByText('Sport club')).toHaveCount(0);
  });

  test('categories: By category shows a monthly and yearly total per envelope and opens the filtered list', async ({ page }) => {
    await firstVisit(page);
    await startSample(page);
    await go(page, '#/payments');
    const still = await page.locator('.primary-number .pn-value').textContent();
    await page.getByRole('radio', { name: 'By category' }).click();
    // two subscriptions (8 + 24 in the sample's AZN prices; the test browser is detected as Azerbaijan): 32 a month, 384 a year
    const subs = page.getByRole('button', { name: /^Subscriptions\./ });
    await expect(subs).toHaveAttribute('aria-label', /₼32 a month\. ₼384 a year\. 2 payments/);
    await expect(subs).toContainText('/mo');
    // a one-time payment is shown apart, not as a monthly amount
    await expect(page.getByRole('button', { name: /^Insurance\./ })).toHaveAttribute('aria-label', /One-time: .*450/);
    // still one primary number on the screen, unchanged
    await expect(page.locator('.pn-value')).toHaveCount(1);
    await expect(page.locator('.primary-number .pn-value')).toHaveText(still ?? '');
    await subs.click();
    await expect(page.getByRole('heading', { name: 'Envelope: Subscriptions' })).toBeVisible();
    await expect(page.getByText('Music subscription')).toBeVisible();
    await expect(page.getByText('Video subscription')).toBeVisible();
    await expect(page.getByText('Car loan')).toHaveCount(0);
    await page.getByRole('button', { name: 'All categories' }).click();
    await expect(page.getByRole('button', { name: /^Loans\./ })).toBeVisible();
    // the deep link opens the same view
    await go(page, '#/today');
    await go(page, '#/payments/category');
    await expect(page.getByRole('radio', { name: 'By category' })).toHaveAttribute('aria-checked', 'true');
  });

  test('old "Coming up" links open the Payments panel; a lone "." in an amount never crashes', async ({ page }) => {
    await firstVisit(page);
    await startSample(page);
    await go(page, '#/coming/installments');
    await expect(page.getByText('Still to pay this period')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Loans' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: 'New payment' }).first().click();
    await sheet(page).getByRole('button', { name: /Loan or installment/ }).click();
    await sheet(page).getByLabel('Monthly payment').fill('.');
    await expect(sheet(page).getByRole('button', { name: 'Save payment' })).toHaveAttribute('aria-disabled', 'true');
    await sheet(page).getByLabel('Monthly payment').fill(',');
    await expect(page.locator('.fatal')).toHaveCount(0);
    // the first due date defaults to a month from today, nothing counted as paid
    await expect(sheet(page).locator('.stepper-value').nth(1)).toHaveText('0');
  });
});
