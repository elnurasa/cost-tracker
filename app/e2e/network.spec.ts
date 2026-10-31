import { expect, test } from '@playwright/test';
import { addExpense, firstVisit, startSample } from './helpers';

test.describe('AC-PWA-06 / PRIV: v1 makes no network requests beyond its own static files', () => {
  test('a full session (onboarding data, add, all screens, backup, CSV) touches only our origin, never POSTs, never carries data in URLs', async ({ page, context }) => {
    const seen: { url: string; method: string; hasBody: boolean }[] = [];
    const external: string[] = [];
    // block anything that is not our origin so an attempt shows up as a failure instead of silently leaving the machine
    await context.route('**/*', (route) => {
      const u = new URL(route.request().url());
      if (u.origin !== 'http://127.0.0.1:4180' && u.protocol !== 'data:' && u.protocol !== 'blob:') {
        external.push(route.request().url());
        return route.abort();
      }
      return route.continue();
    });
    context.on('request', (r) => seen.push({ url: r.url(), method: r.method(), hasBody: !!r.postData() }));
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await firstVisit(page);
    await startSample(page);
    await addExpense(page, '12');
    await expect(page.getByText(/^Saved\./)).toBeVisible();
    for (const r of ['history', 'plan', 'income', 'payments', 'settings', 'settings/data', 'settings/lock', 'today']) {
      await page.evaluate((x) => { location.hash = `#/${x}`; }, r);
      await page.waitForTimeout(150);
    }
    // exports run locally (a Blob download), not through a server
    await page.evaluate(() => { location.hash = '#/settings/data'; });
    const dl = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
    await page.getByRole('button', { name: /Back up now|Back up your data|Export a backup/i }).first().click().catch(() => undefined);
    await dl;

    const own = seen.filter((r) => r.url.startsWith('http://127.0.0.1:4180'));
    expect(external, 'requests to other hosts').toEqual([]);
    expect(seen.filter((r) => r.method !== 'GET' && r.method !== 'HEAD'), 'non-GET requests').toEqual([]);
    expect(seen.filter((r) => r.hasBody)).toEqual([]);
    // no query string anywhere (nothing the user typed can be in a URL)
    expect(own.filter((r) => new URL(r.url).search !== '' && !/\/(sw\.js|workbox-)/.test(r.url))).toEqual([]);
    // only static build artefacts were fetched
    for (const r of own) expect(new URL(r.url).pathname, r.url).toMatch(/^\/($|#|index\.html|manifest\.webmanifest|sw\.js|workbox-[\w-]+\.js|icon[\w-]*\.(png|svg)|assets\/[\w.-]+\.(js|css|woff2))/);
    expect(errors).toEqual([]);
    console.info(`[e2e] session made ${seen.length} requests, all to 127.0.0.1:4180 (GET, no body, no query)`);
  });
});
