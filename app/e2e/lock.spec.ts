import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { firstVisit, startSample } from './helpers';

async function virtualAuthenticator(context: BrowserContext, page: Page, verified: boolean) {
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = (await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: verified, automaticPresenceSimulation: true },
  })) as { authenticatorId: string };
  return { cdp, authenticatorId };
}
const pressPin = async (page: Page, pin: string, scope?: string) => {
  const pad = (scope ? page.locator(scope) : page).getByRole('group', { name: 'Number pad' });
  for (const d of pin) await pad.getByRole('button', { name: d, exact: true }).click();
};

async function setUpLock(page: Page, pin: string) {
  await page.evaluate(() => { location.hash = '#/settings/lock'; });
  await page.getByRole('button', { name: 'Lock the app' }).click();
  await expect(page.getByRole('group', { name: 'Number pad' })).toBeVisible();
  await page.waitForTimeout(500);
  await pressPin(page, pin);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Enter the PIN again').first()).toBeVisible();
  await page.waitForTimeout(250);
  await pressPin(page, pin);
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByRole('group', { name: 'Number pad' })).toHaveCount(0);
}

// WebAuthn needs a valid RP ID: an IP address (127.0.0.1) is rejected, so these tests use the localhost origin.
test.use({ baseURL: 'http://localhost:4180' });

test.describe('AC-LOCK-01..05 in a real browser engine (Chromium virtual authenticator)', () => {
  test('PIN: the app starts locked, wrong PIN counts tries, right PIN opens; only a hash is stored', async ({ page }) => {
    await firstVisit(page);
    await startSample(page);
    await setUpLock(page, '4821');
    const stored = await page.evaluate(() => localStorage.getItem('sakin.prefs.v1') ?? '');
    expect(stored).not.toContain('4821');
    expect(JSON.parse(stored).lock).toMatchObject({ enabled: true, len: 4 });
    expect(JSON.parse(stored).lock.hash.length).toBeGreaterThan(30);
    await page.reload();
    const dialog = page.getByRole('dialog', { name: 'Locked' });
    await expect(dialog).toBeVisible();
    // no financial number is in the DOM behind the lock
    expect(await page.locator('button[aria-label^="You can spend"]').count()).toBe(0);
    await pressPin(page, '0000', '[role=dialog]');
    await expect(page.getByText(/Tries left: 4/)).toBeVisible();
    await pressPin(page, '4821', '[role=dialog]');
    await expect(page.getByRole('dialog', { name: 'Locked' })).toHaveCount(0);
    await expect(page.getByText('PIN is on.')).toBeVisible(); // back on the screen we were on
  });

  test('5 wrong PINs start a 30 s wait and the right PIN is refused during it (AC-LOCK-02)', async ({ page }) => {
    await firstVisit(page);
    await startSample(page);
    await setUpLock(page, '1357');
    await page.reload();
    for (let i = 0; i < 5; i++) {
      await pressPin(page, '0000', '[role=dialog]');
      await page.waitForTimeout(250);
    }
    await expect(page.getByText(/wait|Try again in|seconds/i).first()).toBeVisible();
    await pressPin(page, '1357', '[role=dialog]');
    await page.waitForTimeout(400);
    await expect(page.getByRole('dialog', { name: 'Locked' })).toBeVisible(); // still locked
    const lock = await page.evaluate(() => JSON.parse(localStorage.getItem('sakin.prefs.v1')!).lock);
    expect(lock.lockedUntil).toBeGreaterThan(Date.now());
    expect(lock.lockedUntil - Date.now()).toBeLessThanOrEqual(31_000);
  });

  test('biometric: registers a platform credential, the lock screen prompts and unlocks without typing the PIN (AC-LOCK-03)', async ({ page, context }) => {
    await firstVisit(page);
    await virtualAuthenticator(context, page, true);
    await startSample(page);
    await setUpLock(page, '2468');
    const credId = await page.evaluate(() => JSON.parse(localStorage.getItem('sakin.prefs.v1')!).lock.credId);
    expect(credId).toBeTruthy();
    await page.reload();
    // the biometric prompt fires by itself on the lock screen: Today appears with no PIN typed
    await expect(page.getByText('PIN is on.')).toBeVisible({ timeout: 10_000 });
    expect(await page.getByRole('dialog', { name: 'Locked' }).count()).toBe(0);
  });

  test('biometric cancelled or failed: the PIN pad is right there and works (AC-LOCK-03)', async ({ page, context }) => {
    await firstVisit(page);
    const { cdp, authenticatorId } = await virtualAuthenticator(context, page, true);
    await startSample(page);
    await setUpLock(page, '2468');
    await cdp.send('WebAuthn.setUserVerified', { authenticatorId, isUserVerified: false }); // user cancels / fails the check
    await page.reload();
    await expect(page.getByRole('dialog', { name: 'Locked' })).toBeVisible();
    await page.waitForTimeout(800);
    await expect(page.getByRole('dialog', { name: 'Locked' })).toBeVisible(); // still locked after the failed prompt
    await pressPin(page, '2468', '[role=dialog]');
    await expect(page.getByRole('dialog', { name: 'Locked' })).toHaveCount(0);
    await expect(page.getByText('PIN is on.')).toBeVisible(); // back on the screen we were on
  });
});
