import { expect, test } from '@playwright/test';
import { addExpense, firstVisit, heroNumber, idbCount, startSample } from './helpers';

test.describe('PWA-01 / PWA-02: service worker and offline', () => {
  test('registers on the production build, controls the page, precaches the shell', async ({ page }) => {
    await firstVisit(page);
    const info = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const keys = await caches.keys();
      const cache = await caches.open(keys.find((k) => k.includes('precache'))!);
      const urls = (await cache.keys()).map((r) => new URL(r.url).pathname);
      return { scope: reg?.scope, state: reg?.active?.state, script: reg?.active?.scriptURL, urls };
    });
    expect(info.state).toBe('activated');
    expect(info.scope).toMatch(/127\.0\.0\.1:4180\/$/);
    expect(info.script).toMatch(/\/sw\.js$/);
    expect(info.urls).toContain('/index.html');
    expect(info.urls.some((u) => u.endsWith('.js'))).toBe(true);
    expect(info.urls.some((u) => u.endsWith('.woff2'))).toBe(true);
    expect(info.urls.some((u) => u.includes('manifest.webmanifest'))).toBe(true);
    console.info(`[e2e] precache entries: ${info.urls.length}`);
  });

  test('airplane mode: app loads, an expense can be added, survives an offline reload', async ({ page, context }) => {
    await firstVisit(page);
    await startSample(page);
    const before = await idbCount(page, 'transactions');
    await context.setOffline(true);
    await page.reload(); // served entirely by the service worker
    await expect(page.getByText('You can spend today').first()).toBeVisible();
    const heroBefore = await heroNumber(page);
    await addExpense(page, '25');
    await expect(page.getByText(/^Saved\./)).toBeVisible();
    expect(await idbCount(page, 'transactions')).toBe(before + 1);
    await expect.poll(() => heroNumber(page)).not.toBe(heroBefore);
    const heroAfter = await heroNumber(page);
    await page.reload();
    await expect(page.getByText('You can spend today').first()).toBeVisible();
    expect(await idbCount(page, 'transactions')).toBe(before + 1);
    expect(await heroNumber(page)).toBe(heroAfter);
    // every tab works offline (lazy chunks come from the precache)
    for (const route of ['history', 'plan', 'settings', 'income', 'payments']) {
      await page.evaluate((r) => { location.hash = `#/${r}`; }, route);
      await expect(page.locator('main, .page').first()).toBeVisible();
      await expect(page.locator('.fatal')).toHaveCount(0);
    }
    await page.evaluate(() => { location.hash = '#/history'; });
    await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
    await page.evaluate(() => { location.hash = '#/settings'; });
    await expect(page.getByRole('heading', { name: 'Settings' }).first()).toBeVisible();
    await context.setOffline(false);
  });

  test('a cold offline start (new tab, never online in this tab) still works', async ({ page, context }) => {
    await firstVisit(page);
    await startSample(page);
    await context.setOffline(true);
    const p2 = await context.newPage();
    await p2.goto('/');
    await expect(p2.getByText('You can spend today').first()).toBeVisible();
    await context.setOffline(false);
  });
});
