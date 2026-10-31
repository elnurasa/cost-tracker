import { defineConfig, devices } from '@playwright/test';

/**
 * Real-browser checks (headless Chromium) against the PRODUCTION build served by `vite preview` on port 4180
 * (4173 belongs to start-app.cmd, 5173 to the dev server). `npm run test:e2e` builds first.
 */
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'e2e/.results',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4180',
    locale: 'en-US',
    timezoneId: 'Asia/Baku',
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: false } }],
  webServer: {
    command: 'npx vite preview --host 127.0.0.1 --port 4180 --strictPort',
    url: 'http://127.0.0.1:4180/manifest.webmanifest',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
