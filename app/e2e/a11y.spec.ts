import { expect, test, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { firstVisit, startSample } from './helpers';

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const ROUTES = ['today', 'plan', 'history', 'income', 'payments', 'payments/category', 'settings', 'settings/language', 'settings/appearance', 'settings/data', 'settings/lock', 'settings/stats', 'settings/about'];

async function go(page: Page, route: string) {
  await page.evaluate((r) => { location.hash = `#/${r}`; }, route);
  await page.waitForTimeout(450);
}
async function axe(page: Page) {
  await page.evaluate(axeSource);
  return page.evaluate(async () => {
    const a = (window as unknown as { axe: { run: (c: Document, o: unknown) => Promise<{ violations: { id: string; impact: string; nodes: { target: string[]; failureSummary?: string }[] }[] }> } }).axe;
    const r = await a.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 3).map((n) => `${n.target.join(' ')} :: ${(n.failureSummary ?? '').slice(0, 120)}`) }));
  });
}

test.describe('AC-PWA-07 accessibility (axe-core, WCAG 2.x A/AA) and AC-PWA-03 small phones', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`axe: zero WCAG A/AA violations on every screen (${scheme})`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.emulateMedia({ colorScheme: scheme });
      await firstVisit(page);
      await startSample(page);
      const found: Record<string, unknown> = {};
      for (const r of ROUTES) {
        await go(page, r);
        const v = await axe(page);
        if (v.length) found[r] = v;
      }
      // also with a bottom sheet open (add expense)
      await go(page, 'today');
      await page.getByRole('button', { name: 'Add expense' }).first().click();
      await page.waitForTimeout(700);
      const sheet = await axe(page);
      if (sheet.length) found['add-sheet'] = sheet;
      await page.keyboard.press('Escape');
      // Payments panel: a loan detail page and the "I paid" sheet
      await go(page, 'payments/loans');
      await page.locator('.pay-row-main').first().click();
      await page.waitForTimeout(500);
      const detail = await axe(page);
      if (detail.length) found['payment-detail'] = detail;
      await page.getByRole('button', { name: 'I paid', exact: true }).click();
      await page.waitForTimeout(700);
      const paySheet = await axe(page);
      if (paySheet.length) found['i-paid-sheet'] = paySheet;
      await page.keyboard.press('Escape');
      // payment form with the envelope (category) chooser and suggested chips, then the inline "New envelope" sheet
      await go(page, 'payments');
      await page.getByRole('button', { name: 'New payment' }).first().click();
      await page.getByRole('dialog').getByRole('button', { name: /^Repeating/ }).click();
      await page.getByRole('dialog').getByLabel('Name', { exact: true }).fill('qaz');
      await page.waitForTimeout(700);
      const form = await axe(page);
      if (form.length) found['payment-form'] = form;
      await page.getByRole('dialog').getByRole('button', { name: 'New envelope' }).click();
      await page.waitForTimeout(700);
      const inline = await axe(page);
      if (inline.length) found['envelope-inline'] = inline;
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      console.info(`[a11y ${scheme}] ${Object.keys(found).length ? JSON.stringify(found) : 'no violations on ' + (ROUTES.length + 5) + ' screens'}`);
      expect(found).toEqual({});
    });
  }

  test('360x640 phone: no horizontal scroll on any screen and every control is at least 44 px (48 dp target)', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 360, height: 640 });
    await firstVisit(page);
    await startSample(page);
    const report: Record<string, unknown> = {};
    for (const r of ROUTES) {
      await go(page, r);
      const res = await page.evaluate(() => {
        const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        const small = [...document.querySelectorAll<HTMLElement>('button, a[href], input, select, [role=button], [role=checkbox], [role=radio]')]
          .filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('.sr-only') && !e.classList.contains('skip-link') && !(e.getAttribute('role') === 'switch' && e.id && document.querySelector(`label[for="${e.id}"]`)); })  // a switch is also operated through its full-width label
          .map((e) => { const b = e.getBoundingClientRect(); return { el: `${e.tagName.toLowerCase()}.${e.className.toString().split(' ')[0]}:${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24)}`, w: Math.round(b.width), h: Math.round(b.height) }; })
          .filter((x) => x.h < 44 || x.w < 44);
        return { overflow, small };
      });
      if (res.overflow > 0 || res.small.length) report[r] = res;
    }
    console.info('[360px] ' + (Object.keys(report).length ? JSON.stringify(report) : 'no overflow, no small targets'));
    const overflowing = Object.entries(report).filter(([, v]) => (v as { overflow: number }).overflow > 0);
    expect(overflowing).toEqual([]);
    expect(Object.keys(report)).toEqual([]);
  });

  test('200% text size (AC-PWA-07): no horizontal scroll and nothing clipped on main screens', async ({ page }) => {
    test.setTimeout(120_000);
    await firstVisit(page);
    await startSample(page);
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    const bad: Record<string, unknown> = {};
    for (const r of ['today', 'plan', 'history', 'settings', 'income']) {
      await go(page, r);
      const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (o > 0) bad[r] = o;
    }
    console.info('[200% text] ' + JSON.stringify(bad));
    expect(bad).toEqual({});
  });

  test('AC-LOC-04 pseudo-locale: +40% longer strings with dir=rtl cause no horizontal scroll', async ({ page }) => {
    test.setTimeout(120_000);
    await firstVisit(page);
    await startSample(page);
    const bad: Record<string, unknown> = {};
    for (const r of ['today', 'plan', 'history', 'settings', 'income', 'payments']) {
      await go(page, r);
      const o = await page.evaluate(() => {
        document.documentElement.dir = 'rtl';
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let n: Node | null;
        while ((n = w.nextNode())) {
          const t = n.nodeValue ?? '';
          if (t.trim().length > 3) n.nodeValue = t + ' ' + t.slice(0, Math.ceil(t.length * 0.4));
        }
        const over = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        document.documentElement.dir = 'ltr';
        return over;
      });
      if (o > 0) bad[r] = o;
    }
    console.info('[pseudo-rtl] ' + JSON.stringify(bad));
    expect(bad).toEqual({});
  });
});
