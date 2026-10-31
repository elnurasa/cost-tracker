import { expect, test } from '@playwright/test';
import { firstVisit } from './helpers';

test.describe('AC-PWA-01 installability and manifest', () => {
  test('manifest is complete, icons resolve with the declared sizes, Chromium reports no installability errors', async ({ page, context }) => {
    await firstVisit(page);
    const res = await page.request.get('/manifest.webmanifest');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/manifest\+json|application\/json/);
    const m = await res.json();
    expect(m).toMatchObject({ name: 'Sakin', short_name: 'Sakin', display: 'standalone', start_url: '/', scope: '/' });
    expect(m.theme_color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(m.background_color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    const sizes = m.icons.map((i: { sizes: string; purpose?: string }) => `${i.sizes}${i.purpose ? ':' + i.purpose : ''}`);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512', '512x512:maskable']));
    for (const icon of m.icons as { src: string; sizes: string; type: string }[]) {
      const r = await page.request.get('/' + icon.src.replace(/^\//, ''));
      expect(r.status(), icon.src).toBe(200);
      expect(r.headers()['content-type']).toContain(icon.type.split('/')[1]);
      if (icon.type === 'image/png') {
        const png = await r.body();
        const w = png.readUInt32BE(16);
        const h = png.readUInt32BE(20);
        expect(`${w}x${h}`, icon.src).toBe(icon.sizes);
      }
    }
    // Chromium's own installability check (the same criteria as the install button / beforeinstallprompt)
    const cdp = await context.newCDPSession(page);
    await cdp.send('Page.enable');
    const { installabilityErrors } = (await cdp.send('Page.getInstallabilityErrors')) as { installabilityErrors: { errorId: string }[] };
    console.info(`[e2e] installability errors: ${JSON.stringify(installabilityErrors)}`);
    expect(installabilityErrors).toEqual([]);
    const meta = await page.evaluate(() => ({
      viewport: document.querySelector('meta[name=viewport]')?.getAttribute('content'),
      theme: [...document.querySelectorAll('meta[name=theme-color]')].length,
      link: document.querySelector('link[rel=manifest]')?.getAttribute('href'),
      apple: document.querySelector('link[rel=apple-touch-icon]')?.getAttribute('href'),
    }));
    expect(meta.link).toBe('/manifest.webmanifest');
    expect(meta.viewport).toContain('width=device-width');
    expect(meta.apple).toBeTruthy();
    expect(meta.theme).toBeGreaterThan(0);
  });

  test('security headers/CSP: the production page carries a strict CSP and the app runs under it with zero violations', async ({ page }) => {
    const violations: string[] = [];
    page.on('console', (c) => {
      if (/Content Security Policy|Refused to/i.test(c.text())) violations.push(c.text());
    });
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) => console.error('CSPV ' + e.violatedDirective + ' ' + e.blockedURI));
    });
    await firstVisit(page);
    const csp = await page.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content'));
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    await page.getByRole('button', { name: 'Try with sample data' }).click();
    await expect(page.getByText('You can spend today').first()).toBeVisible();
    for (const r of ['history', 'plan', 'settings', 'income', 'payments', 'today']) await page.evaluate((x) => { location.hash = `#/${x}`; }, r);
    expect(violations).toEqual([]);
  });
});
