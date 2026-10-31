// Runs Lighthouse (mobile and desktop) against `vite preview` using the Chromium that Playwright installed.
// Usage: npm run build && npm run lighthouse      (needs network once, to fetch the lighthouse CLI through npx)
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('@playwright/test');
const PORT = 4182;
const DEBUG = 9333;
const out = join(process.cwd(), 'e2e', '.results');
mkdirSync(out, { recursive: true });

const preview = spawn(process.execPath, [join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', windowsHide: true });
const profile = mkdtempSync(join(tmpdir(), 'sakin-lh-'));
// Prefer Playwright's headless shell (it launches reliably from Node on locked-down Windows machines); fall back to full Chromium.
function browserPath() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || join(process.env.LOCALAPPDATA || join(process.env.HOME || '', '.cache'), 'ms-playwright');
  try {
    for (const d of readdirSync(root).filter((x) => x.startsWith('chromium_headless_shell-'))) {
      for (const sub of readdirSync(join(root, d)).filter((x) => x.startsWith('chrome-headless-shell'))) {
        for (const exe of ['chrome-headless-shell.exe', 'chrome-headless-shell']) {
          const f = join(root, d, sub, exe);
          if (existsSync(f)) return f;
        }
      }
    }
  } catch { /* fall through */ }
  return chromium.executablePath();
}
const chrome = spawn(browserPath(), ['--no-sandbox', `--remote-debugging-port=${DEBUG}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(4000);

const summary = {};
try {
  for (const form of ['mobile', 'desktop']) {
    const file = join(out, `lh-${form}.json`);
    const args = ['--yes', 'lighthouse', `http://127.0.0.1:${PORT}/`, `--port=${DEBUG}`, '--output=json', `--output-path="${file}"`, '--quiet', '--only-categories=performance,accessibility,best-practices,seo'];
    if (form === 'desktop') args.push('--preset=desktop');
    const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, { stdio: 'inherit', shell: process.platform === 'win32', windowsHide: true });
    if (r.status !== 0) throw new Error(`lighthouse ${form} failed (${r.status})`);
    const j = JSON.parse(readFileSync(file, 'utf8'));
    summary[form] = {
      ...Object.fromEntries(Object.entries(j.categories).map(([k, v]) => [k, Math.round(v.score * 100)])),
      FCP: j.audits['first-contentful-paint'].displayValue, LCP: j.audits['largest-contentful-paint'].displayValue, TBT: j.audits['total-blocking-time'].displayValue,
      CLS: j.audits['cumulative-layout-shift'].displayValue, SI: j.audits['speed-index'].displayValue, lighthouse: j.lighthouseVersion,
    };
  }
  console.log(JSON.stringify(summary, null, 2));
} finally {
  chrome.kill();
  preview.kill();
}
