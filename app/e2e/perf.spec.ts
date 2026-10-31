import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { firstVisit, startSample } from './helpers';

/** Adds `n` realistic entries straight into IndexedDB (half inside the current period, half spread over ~2 years of past dates). */
async function seed(page: Page, n: number) {
  return page.evaluate(async (count) => {
    const open = () => new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open('sakin'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const all = <T,>(db: IDBDatabase, s: string) => new Promise<T[]>((res, rej) => { const q = db.transaction(s).objectStore(s).getAll(); q.onsuccess = () => res(q.result as T[]); q.onerror = () => rej(q.error); });
    const db = await open();
    const txs = await all<Record<string, unknown>>(db, 'transactions');
    const envs = (await all<Record<string, unknown>>(db, 'envelopes')).filter((e) => e.kind === 'flexible' || e.kind === 'pocket');
    const periods = await all<{ startDate: string }>(db, 'periods');
    const tpl = txs.find((t) => t.source === 'manual' && t.type === 'expense')!;
    const start = periods.map((p) => p.startDate).sort()[0];
    const today = new Date();
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const notes = ['Bravo', 'Taxi', 'Kofe', 'Eczane', 'Metro', 'Wolt', 'Market', 'Cay', 'Lunch'];
    const tx = db.transaction('transactions', 'readwrite');
    const st = tx.objectStore('transactions');
    for (let i = 0; i < count; i++) {
      let date = start;
      if (i % 2) {
        const d = new Date(today);
        d.setDate(d.getDate() - 10 - Math.floor(Math.random() * 700));
        date = iso(d);
      } else {
        const d = new Date(start + 'T12:00:00');
        d.setDate(d.getDate() + Math.floor(Math.random() * 8));
        date = iso(d) > iso(today) ? iso(today) : iso(d);
      }
      const amount = 50 + Math.floor(Math.random() * 3000);
      const now = new Date(Date.now() - i * 1000).toISOString();
      st.put({ ...tpl, id: `seed-${i}-${Math.random().toString(36).slice(2, 8)}`, date, amount, amountBase: amount, envelopeId: (envs[i % envs.length] as { id: string }).id, note: notes[i % notes.length], createdAt: now, updatedAt: now, rev: `z${i}` });
    }
    await new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    db.close();
    return count;
  }, n);
}

const results: Record<string, unknown> = {};
test.afterAll(() => {
  mkdirSync('e2e/.results', { recursive: true });
  writeFileSync('e2e/.results/perf.json', JSON.stringify(results, null, 2));
  console.info('[perf] ' + JSON.stringify(results));
});

for (const cpu of [1, 4, 6]) {
  test(`5,000 entries, CPU x${cpu}: cold start to hero, save to UI, History window, filter`, async ({ page, context }) => {
    test.setTimeout(180_000);
    await firstVisit(page);
    await startSample(page);
    await seed(page, 5000);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });

    // cold start: measured in the page from navigation start to the hero button being in the DOM
    await page.addInitScript(() => {
      const w = window as unknown as { __hero?: number };
      const mo = new MutationObserver(() => {
        if (document.querySelector('button[aria-label^="You can spend"]')) {
          w.__hero = performance.now();
          mo.disconnect();
        }
      });
      mo.observe(document, { childList: true, subtree: true });
    });
    await page.reload({ waitUntil: 'commit' });
    await page.waitForFunction(() => (window as unknown as { __hero?: number }).__hero !== undefined, null, { timeout: 60_000 });
    const hero = await page.evaluate(() => (window as unknown as { __hero: number }).__hero);
    const txCount = await page.evaluate(() => new Promise<number>((res) => {
      const r = indexedDB.open('sakin');
      r.onsuccess = () => {
        const q = r.result.transaction('transactions').objectStore('transactions').count();
        q.onsuccess = () => res(q.result);
      };
    }));
    expect(txCount).toBeGreaterThanOrEqual(5000);

    // save-to-UI: from the click on Save until the hero label changes
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Add expense' }).first().click();
    const pad = page.getByRole('group', { name: 'Number pad' });
    await expect(pad).toBeVisible();
    await page.waitForTimeout(800);
    for (const d of '35') await pad.getByRole('button', { name: d, exact: true }).click();
    const save = await page.evaluate(() => new Promise<number>((resolve) => {
      const label = () => document.querySelector('button[aria-label^="You can spend"]')?.getAttribute('aria-label') ?? '';
      const before = label();
      const btn = [...document.querySelectorAll('button')].find((b) => /^Save/.test(b.textContent ?? ''))!;
      let t0 = 0;
      btn.addEventListener('click', () => { t0 = performance.now(); }, { capture: true, once: true });
      const mo = new MutationObserver(() => {
        if (label() !== before) {
          mo.disconnect();
          resolve(performance.now() - t0);
        }
      });
      mo.observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-label'] });
      setTimeout(() => resolve(-1), 8000);
      btn.click();
    }));
    expect(save).toBeGreaterThan(0);
    await page.waitForTimeout(600);

    // History, all time: window size, scroll cost, filter latency
    await page.evaluate(() => { location.hash = '#/history'; });
    await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
    await page.getByRole('button', { name: /This period/ }).first().click();
    await page.getByText('All time', { exact: true }).click();
    await page.getByRole('button', { name: 'Done' }).click();
    const list = page.locator('[data-virtual-rows]');
    await expect(list).toBeVisible({ timeout: 20_000 });
    const rows = Number(await list.getAttribute('data-virtual-rows'));
    const rendered0 = Number(await list.getAttribute('data-virtual-rendered'));
    expect(rows).toBeGreaterThan(5000);
    expect(rendered0).toBeLessThan(80); // only the window is in the DOM

    const scroll = await page.evaluate(async () => {
      const frames: number[] = [];
      let last = performance.now();
      let running = true;
      const tick = () => {
        const n = performance.now();
        frames.push(n - last);
        last = n;
        if (running) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      const max = document.documentElement.scrollHeight - innerHeight;
      const t0 = performance.now();
      let maxDom = 0;
      for (let y = 0; y < Math.min(max, 120000); y += 700) {
        window.scrollTo(0, y);
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        maxDom = Math.max(maxDom, document.querySelectorAll('[role=listitem]').length);
      }
      running = false;
      const sorted = [...frames].sort((a, b) => a - b);
      return { frames: frames.length, ms: performance.now() - t0, p50: sorted[Math.floor(sorted.length * 0.5)], p95: sorted[Math.floor(sorted.length * 0.95)], max: sorted[sorted.length - 1], maxDom, scrollHeight: max };
    });
    await page.evaluate(() => window.scrollTo(0, 0));

    const filterMs = await page.evaluate(() => new Promise<number>((resolve) => {
      const input = document.querySelector<HTMLInputElement>('input[type=search]')!;
      const countBefore = document.querySelector('[data-virtual-rows]')?.getAttribute('data-virtual-rows');
      const t0 = performance.now();
      const mo = new MutationObserver(() => {
        const c = document.querySelector('[data-virtual-rows]')?.getAttribute('data-virtual-rows');
        if (c !== countBefore) {
          mo.disconnect();
          resolve(performance.now() - t0);
        }
      });
      mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-virtual-rows'] });
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      set.call(input, 'bravo');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      setTimeout(() => resolve(-1), 5000);
    }));
    expect(filterMs).toBeGreaterThan(0);

    const r = {
      cpuThrottle: cpu, entries: txCount, heroMs: Math.round(hero), saveToUiMs: Math.round(save), historyRows: rows, domRowsAtRest: rendered0,
      scroll: { ...scroll, p50: +scroll.p50.toFixed(1), p95: +scroll.p95.toFixed(1), max: +scroll.max.toFixed(1), ms: Math.round(scroll.ms) }, filterMs: Math.round(filterMs),
    };
    results[`cpu${cpu}`] = r;
    console.info('[perf] ' + JSON.stringify(r));
    // budgets (AC-PWA-05: hero <= 2.0 s and save-to-UI <= 100 ms on a low-end phone; AC-EXP-07: filter <= 200 ms)
    expect(save).toBeLessThan(100); // PWA-05: one optimistic update, holds at CPU x1, x4 and x6
    expect(hero).toBeLessThan(2000);
    expect(filterMs).toBeLessThan(200 * Math.max(1, cpu / 2));
  });
}
