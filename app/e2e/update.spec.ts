import { expect, test } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { addExpense, idbCount, startSample } from './helpers';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
};
let dir = '';
let server: Server;
const PORT = 4181;
const URL0 = `http://127.0.0.1:${PORT}`;

test.beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'sakin-update-'));
  cpSync(join(process.cwd(), 'dist'), dir, { recursive: true });
  server = createServer((req, res) => {
    const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])).replace(/^[\/]+/, '') || 'index.html';
    let file = join(dir, path);
    if (!file.startsWith(dir) || !existsSync(file) || statSync(file).isDirectory()) file = join(dir, 'index.html');
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(readFileSync(file));
  });
  await new Promise<void>((r) => server.listen(PORT, '127.0.0.1', r));
});
test.afterAll(async () => {
  await new Promise((r) => server.close(r));
  rmSync(dir, { recursive: true, force: true });
});

test.describe('AC-PWA-02: a new version installs on the next launch without data loss', () => {
  test('v1 -> v2: update waits (prompt), data survives, new shell is served after Update', async ({ page }) => {
    await page.goto(URL0 + '/');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await startSample(page);
    await addExpense(page, '7');
    await expect(page.getByText(/^Saved\./)).toBeVisible();
    const tx = await idbCount(page, 'transactions');
    const shell1 = await page.evaluate(async () => (await (await fetch('/index.html')).text()).includes('SAKIN-V2'));
    expect(shell1).toBe(false);

    // ship "v2": new shell content and a new precache revision for index.html
    writeFileSync(join(dir, 'index.html'), readFileSync(join(dir, 'index.html'), 'utf8').replace('</body>', '<!-- SAKIN-V2 --></body>'));
    const sw = readFileSync(join(dir, 'sw.js'), 'utf8');
    expect(sw).toMatch(/url:"index\.html",revision:"[0-9a-f]+"/);
    writeFileSync(join(dir, 'sw.js'), sw.replace(/(url:"index\.html",revision:")[0-9a-f]+(")/, '$1v2rev$2'));

    await page.reload(); // browser fetches sw.js on navigation, installs v2 in the background
    await expect(page.getByText('A new version is ready.')).toBeVisible({ timeout: 20_000 });
    // the running session is untouched: data is there, nothing was force-reloaded
    expect(await idbCount(page, 'transactions')).toBe(tx);
    await page.getByRole('button', { name: 'Update' }).click();
    await page.waitForEvent('framenavigated').catch(() => undefined);
    await expect(page.getByText('You can spend today').first()).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => page.evaluate(async () => (await (await fetch('/index.html')).text()).includes('SAKIN-V2'))).toBe(true);
    expect(await idbCount(page, 'transactions')).toBe(tx);
    await expect(page.getByText('A new version is ready.')).toHaveCount(0);
  });
});
