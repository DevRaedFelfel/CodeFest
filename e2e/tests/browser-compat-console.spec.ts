import { test, expect, Page } from '@playwright/test';

const API_URL = 'http://localhost:5050';
const APP_URL = 'http://localhost:4200';

let sessionCode = '';

async function setupSession() {
  await fetch(`${API_URL}/api/challenges/seed`, { method: 'POST' });
  const challengesRes = await fetch(`${API_URL}/api/challenges`);
  const challenges = await challengesRes.json();
  const challengeIds = challenges.map((c: any) => c.id);

  const createRes = await fetch(`${API_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Browser Compat E2E', challengeIds }),
  });
  const session = await createRes.json();
  sessionCode = session.code;

  await fetch(`${API_URL}/api/sessions/${sessionCode}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'start' }),
  });
}

async function joinSession(page: Page) {
  await page.goto(`${APP_URL}/join`);
  await page.locator('#sessionCode').fill(sessionCode);
  await page.locator('#displayName').fill(`Browser-${Date.now()}`);
  await page.locator('.join-btn').click();
  await page.waitForURL('**/code', { timeout: 10000 });
  await page.waitForSelector('.coding-layout', { timeout: 10000 });
}

async function setEditorContent(page: Page, code: string) {
  const editor = page.locator('.cm-editor .cm-content');
  await editor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.keyboard.type(code, { delay: 10 });
}

test.describe('Cross-Browser — Interactive Console', () => {
  test.beforeAll(async () => {
    await setupSession();
  });

  test('Basic run works', async ({ page, browserName }) => {
    await joinSession(page);
    await setEditorContent(page, 'Console.WriteLine("hello from browser");');
    await page.click('[data-testid="run-button"]');

    await expect(page.locator('[data-testid="terminal-panel"]')).toContainText(
      'hello from browser',
      { timeout: 15000 }
    );

    console.log(`✓ Basic run works on ${browserName}`);
  });

  test('Interactive input works', async ({ page, browserName }) => {
    await joinSession(page);

    const code = [
      'Console.Write("Input: ");',
      'var v = Console.ReadLine();',
      'Console.WriteLine("Got: " + v);',
    ].join('\n');

    await setEditorContent(page, code);
    await page.click('[data-testid="run-button"]');

    await expect(page.locator('[data-testid="terminal-panel"]')).toContainText(
      'Input:',
      { timeout: 15000 }
    );

    await page.locator('[data-testid="terminal-panel"]').click();
    await page.keyboard.type('browser-test');
    await page.keyboard.press('Enter');

    await expect(page.locator('[data-testid="terminal-panel"]')).toContainText(
      'Got: browser-test',
      { timeout: 10000 }
    );

    console.log(`✓ Interactive input works on ${browserName}`);
  });

  test('Reconnection after network interruption', async ({
    page,
    context,
  }) => {
    await joinSession(page);

    const code = [
      'Console.Write("Before: ");',
      'var x = Console.ReadLine();',
      'Console.WriteLine("After: " + x);',
    ].join('\n');

    await setEditorContent(page, code);
    await page.click('[data-testid="run-button"]');

    await expect(page.locator('[data-testid="terminal-panel"]')).toContainText(
      'Before:',
      { timeout: 15000 }
    );

    // Simulate network interruption
    await context.setOffline(true);
    await page.waitForTimeout(2000);

    // Should show reconnecting message
    await expect(page.locator('[data-testid="terminal-panel"]')).toContainText(
      'reconnecting',
      { timeout: 5000 }
    );

    // Restore network
    await context.setOffline(false);

    // Should reconnect
    await expect(page.locator('[data-testid="terminal-panel"]')).toContainText(
      'Reconnected',
      { timeout: 15000 }
    );

    // Program should still be waiting for input — send it
    await page.locator('[data-testid="terminal-panel"]').click();
    await page.keyboard.type('survived');
    await page.keyboard.press('Enter');

    await expect(page.locator('[data-testid="terminal-panel"]')).toContainText(
      'After: survived',
      { timeout: 10000 }
    );
  });

  test('Mobile layout: phone viewport shows tabs', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await joinSession(page);

    await setEditorContent(page, 'Console.WriteLine("phone");');
    await page.click('[data-testid="run-button"]');

    // Terminal tab should exist
    await expect(
      page.locator('[data-testid="terminal-tab"]')
    ).toBeVisible({ timeout: 10000 });

    // Output should be visible
    await expect(page.locator('[data-testid="terminal-panel"]')).toContainText(
      'phone',
      { timeout: 15000 }
    );
  });
});
