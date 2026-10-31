import { expect, type BrowserContext, type Page } from '@playwright/test';

export const BASE = 'http://127.0.0.1:4180';

/** Fresh profile state, first visit: wait for the service worker, then reload so the page is controlled by it. */
export async function firstVisit(page: Page) {
  await page.goto('/');
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.active?.state;
  });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
}

/** Onboarding shortcut: "Try with sample data" gives a populated workspace. */
export async function startSample(page: Page) {
  await page.getByRole('button', { name: 'Try with sample data' }).click();
  await expect(page.getByText('You can spend today').first()).toBeVisible();
  // onboarding finishes by routing to #/today a moment later; let that settle so later navigation sticks
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/today');
  await page.waitForTimeout(700);
}

export async function addExpense(page: Page, digits: string) {
  const pad = page.getByRole('group', { name: 'Number pad' });
  // the first tap right after a data load can land while the screen re-renders: retry opening until the sheet is stable
  await expect(async () => {
    if (!(await pad.isVisible())) await page.getByRole('button', { name: 'Add expense' }).first().click();
    await expect(pad).toBeVisible({ timeout: 1500 });
    await page.waitForTimeout(500); // sheet slide-in animation
    await expect(pad.getByRole('button', { name: '0', exact: true })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
  for (const d of digits) await pad.getByRole('button', { name: d, exact: true }).click();
  await page.getByRole('button', { name: /^Save/ }).click();
}

export const heroNumber = async (page: Page) => {
  const btn = page.locator('button[aria-label^="You can spend"]').first();
  const label = (await btn.getAttribute('aria-label')) ?? '';
  return label;
};

export async function idbCount(page: Page, store: string): Promise<number> {
  return page.evaluate(
    (s) =>
      new Promise<number>((resolve, reject) => {
        const r = indexedDB.open('sakin');
        r.onsuccess = () => {
          const db = r.result;
          const q = db.transaction(s).objectStore(s).count();
          q.onsuccess = () => (db.close(), resolve(q.result));
          q.onerror = () => reject(q.error);
        };
        r.onerror = () => reject(r.error);
      }),
    store,
  );
}

export async function trackRequests(context: BrowserContext) {
  const urls: { url: string; method: string; body: string | null }[] = [];
  context.on('request', (r) => urls.push({ url: r.url(), method: r.method(), body: r.postData() }));
  return urls;
}
