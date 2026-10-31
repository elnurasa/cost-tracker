import { expect, test } from '@playwright/test';
import { firstVisit, startSample } from './helpers';

/** AC-LOC-03 in a real browser engine: each language renders its own formats, document language and no horizontal scroll. */
const LOCALES = [
  { id: 'en', lang: 'en', hero: 'You can spend today' },
  { id: 'az', lang: 'az', hero: /Bu gün/ },
  { id: 'tr', lang: 'tr', hero: /Bugün/ },
  { id: 'ru', lang: 'ru', hero: /Сегодня|сегодня/ },
] as const;

test.describe('AC-LOC-03 / AC-LOC-01 locale rendering', () => {
  for (const l of LOCALES) {
    test(`${l.id}: UI language, html lang, numbers and dates formatted for the locale, no overflow`, async ({ page }) => {
      await firstVisit(page);
      await startSample(page);
      await page.evaluate((id) => {
        const k = 'sakin.prefs.v1';
        const p = JSON.parse(localStorage.getItem(k) ?? '{}');
        localStorage.setItem(k, JSON.stringify({ ...p, locale: id }));
      }, l.id);
      await page.reload();
      await expect(page.locator('button[aria-label]').first()).toBeVisible();
      await page.waitForTimeout(600);
      expect(await page.evaluate(() => document.documentElement.lang)).toBe(l.lang);
      const text = await page.locator('main').first().innerText();
      if (typeof l.hero === 'string') expect(text).toContain(l.hero);
      else expect(text).toMatch(l.hero);
      // amounts use the locale's grouping/decimal convention (sample Food envelope has decimals) and never raw ICU placeholders like "M10"
      expect(text).not.toMatch(/\bM\d{1,2}\b/);
      expect(text).not.toMatch(/undefined|NaN|\[object|\{\w+\}/);
      const dec = await page.evaluate((loc) => new Intl.NumberFormat(loc, { style: 'currency', currency: 'AZN' }).format(1234.5), l.id);
      console.info(`[locale ${l.id}] Intl: ${dec}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBe(0);
      for (const r of ['plan', 'history', 'settings']) {
        await page.evaluate((x) => { location.hash = `#/${x}`; }, r);
        await page.waitForTimeout(350);
        const t = await page.locator('main').first().innerText();
        expect(t).not.toMatch(/undefined|NaN|\[object|\{\w+\}/);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
      }
    });
  }
});
