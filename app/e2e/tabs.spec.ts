import { expect, test } from '@playwright/test';
import { addExpense, firstVisit, heroNumber, idbCount, startSample } from './helpers';

test.describe('concurrency between tabs and durability', () => {
  test('a write in tab A shows up live in tab B (no reload); simultaneous writes from both tabs are all kept', async ({ context, page }) => {
    await firstVisit(page);
    await startSample(page);
    const b = await context.newPage();
    await b.goto('/');
    await expect(b.getByText('You can spend today').first()).toBeVisible();
    const before = await idbCount(page, 'transactions');
    const heroB0 = await heroNumber(b);

    await addExpense(page, '9');
    await expect(page.getByText(/^Saved\./)).toBeVisible();
    // tab B was not touched: its hero must change by itself (Dexie live query over BroadcastChannel)
    await expect.poll(() => heroNumber(b), { timeout: 10_000 }).not.toBe(heroB0);
    expect(await heroNumber(b)).toBe(await heroNumber(page));

    // both tabs write at (nearly) the same moment
    await page.bringToFront();
    await Promise.all([addExpense(page, '3'), addExpense(b, '4')]);
    await expect.poll(() => idbCount(page, 'transactions'), { timeout: 10_000 }).toBe(before + 3);
    await expect.poll(async () => (await heroNumber(page)) === (await heroNumber(b)), { timeout: 10_000 }).toBe(true);
  });

  test('two tabs opening at once do not duplicate periods, income events or postings', async ({ context, page }) => {
    await firstVisit(page);
    await startSample(page);
    const snapshot = (p: typeof page) =>
      p.evaluate(() => new Promise<{ periods: number; uniqPeriods: number; events: number; uniqEvents: number; occ: number; uniqOcc: number }>((res) => {
        const r = indexedDB.open('sakin');
        r.onsuccess = () => {
          const db = r.result;
          const t = db.transaction(['periods', 'incomeEvents', 'transactions']);
          const a = t.objectStore('periods').getAll();
          const e = t.objectStore('incomeEvents').getAll();
          const x = t.objectStore('transactions').getAll();
          t.oncomplete = () => {
            const per = (a.result as { startDate: string }[]).map((p) => p.startDate);
            const ev = (e.result as { incomeId: string; expectedDate: string }[]).map((v) => v.incomeId + v.expectedDate);
            const oc = (x.result as { occKey?: string }[]).filter((v) => v.occKey).map((v) => v.occKey);
            res({ periods: per.length, uniqPeriods: new Set(per).size, events: ev.length, uniqEvents: new Set(ev).size, occ: oc.length, uniqOcc: new Set(oc).size });
            db.close();
          };
        };
      }));
    const pages = await Promise.all([context.newPage(), context.newPage(), context.newPage()]);
    await Promise.all(pages.map((p) => p.goto('/')));
    await Promise.all(pages.map((p) => expect(p.getByText('You can spend today').first()).toBeVisible()));
    await page.waitForTimeout(1500);
    const s = await snapshot(page);
    expect(s.periods).toBe(s.uniqPeriods);
    expect(s.events).toBe(s.uniqEvents);
    expect(s.occ).toBe(s.uniqOcc);
  });

  test('durable storage: the app asks for persistence and Chromium answers (recorded in prefs)', async ({ page }) => {
    await firstVisit(page);
    await startSample(page);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('sakin.prefs.v1') ?? '{}').persistResult), { timeout: 8000 }).not.toBe('unknown');
    const res = await page.evaluate(async () => ({ persisted: await navigator.storage.persisted(), quota: (await navigator.storage.estimate()).quota ?? 0 }));
    console.info(`[e2e] storage.persisted=${res.persisted} quota=${Math.round(res.quota / 1e6)}MB prefs=${await page.evaluate(() => JSON.parse(localStorage.getItem('sakin.prefs.v1') ?? '{}').persistResult)}`);
    expect(res.quota).toBeGreaterThan(50 * 1e6);
  });
});
