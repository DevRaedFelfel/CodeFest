import { test, expect, Page, BrowserContext } from '@playwright/test';

const API_URL = 'http://localhost:5050';
const APP_URL = 'http://localhost:4200';

async function seedChallenges(): Promise<number[]> {
  await fetch(`${API_URL}/api/challenges/seed`, { method: 'POST' });
  const res = await fetch(`${API_URL}/api/challenges`);
  const challenges = await res.json();
  return challenges.map((c: any) => c.id);
}

async function createSession(
  name: string,
  challengeIds: number[]
): Promise<string> {
  const res = await fetch(`${API_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, challengeIds }),
  });
  const session = await res.json();
  return session.code;
}

test.describe('Select existing session renders without errors', () => {
  test('selecting a session from the list does not produce JS errors', async ({
    browser,
  }) => {
    const challengeIds = await seedChallenges();
    const name = `NoError E2E ${Date.now()}`;
    const code = await createSession(name, challengeIds);

    const context = await browser.newContext({
      viewport: { width: 1400, height: 900 },
    });
    const page = await context.newPage();

    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(`${APP_URL}/teacher`);
    await page.waitForTimeout(2000);
    await page.click(`text=${name}`);

    // Dashboard should render: session code, broadcast panel, activity feed
    await expect(page.locator(`text=${code}`)).toBeVisible({ timeout: 5000 });
    await expect(page.locator('app-broadcast-panel')).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator('text=Activity Feed')).toBeVisible();

    // Wait a moment for any deferred errors
    await page.waitForTimeout(2000);

    // Should have no JS errors (the .length crash would appear here)
    const lengthErrors = errors.filter((e) =>
      e.includes("Cannot read properties of undefined (reading 'length')")
    );
    expect(lengthErrors).toHaveLength(0);

    await context.close();
  });
});

test.describe.serial('Broadcast & Hint Feature', () => {
  let teacherPage: Page;
  let studentPage: Page;
  let teacherContext: BrowserContext;
  let studentContext: BrowserContext;
  let sessionCode: string;

  test.beforeAll(async ({ browser }) => {
    const challengeIds = await seedChallenges();
    const uniqueName = `Broadcast E2E ${Date.now()}`;
    sessionCode = await createSession(uniqueName, challengeIds);

    teacherContext = await browser.newContext({
      viewport: { width: 1400, height: 900 },
    });
    studentContext = await browser.newContext();
    teacherPage = await teacherContext.newPage();
    studentPage = await studentContext.newPage();

    // Teacher opens dashboard and selects the session
    await teacherPage.goto(`${APP_URL}/teacher`);
    await teacherPage.waitForTimeout(2000);
    await teacherPage.click(`text=${uniqueName}`);
    await expect(teacherPage.locator(`text=${sessionCode}`)).toBeVisible({
      timeout: 5000,
    });

    // Teacher starts the session
    const startBtn = teacherPage.locator('.btn-start');
    await expect(startBtn).toBeVisible();
    await startBtn.click();
    await expect(teacherPage.locator('.status-badge')).toContainText(
      'Active',
      { timeout: 10000 }
    );

    // Student joins the active session
    await studentPage.goto(`${APP_URL}/join`);
    await studentPage.waitForLoadState('networkidle');
    await studentPage.locator('#sessionCode').fill(sessionCode);
    await studentPage.locator('#displayName').fill('BroadcastStudent');
    await studentPage.locator('.join-btn').click();
    await studentPage.waitForURL('**/code', { timeout: 10000 });

    // Wait for student coding UI
    await expect(studentPage.locator('.cm-editor')).toBeVisible({
      timeout: 10000,
    });
  });

  test.afterAll(async () => {
    await teacherContext?.close();
    await studentContext?.close();
  });

  test('1. Teacher broadcast panel is visible', async () => {
    const panel = teacherPage.locator('app-broadcast-panel');
    await panel.scrollIntoViewIfNeeded();

    await expect(panel.locator('textarea.message-input')).toBeVisible();
    await expect(panel.locator('.btn-broadcast')).toBeVisible();
    await expect(panel.locator('.challenge-input')).toBeVisible();
    await expect(panel.locator('.hint-input')).toBeVisible();
    await expect(panel.locator('.btn-hint')).toBeVisible();
  });

  test('2. Teacher sends broadcast and student sees the message', async () => {
    const broadcastMessage = `Hello students! ${Date.now()}`;
    const panel = teacherPage.locator('app-broadcast-panel');
    await panel.scrollIntoViewIfNeeded();

    // Type message and send
    await panel.locator('textarea.message-input').fill(broadcastMessage);
    await expect(panel.locator('textarea.message-input')).toHaveValue(
      broadcastMessage
    );
    await panel.locator('.btn-broadcast').click();

    // Student should see the broadcast toast with the message text
    const toast = studentPage.locator('.broadcast-toast');
    await expect(toast).toBeVisible({ timeout: 8000 });

    const toastText = studentPage.locator('.broadcast-text');
    await expect(toastText).toContainText(broadcastMessage, { timeout: 3000 });
  });

  test('3. Broadcast toast auto-dismisses after ~8 seconds', async () => {
    const panel = teacherPage.locator('app-broadcast-panel');
    await panel.scrollIntoViewIfNeeded();

    await panel.locator('textarea.message-input').fill('Auto-dismiss test');
    await panel.locator('.btn-broadcast').click();

    const toast = studentPage.locator('.broadcast-toast');
    await expect(toast).toBeVisible({ timeout: 8000 });

    // Wait for auto-dismiss (~8 seconds)
    await expect(toast).toBeHidden({ timeout: 12000 });
  });

  test('4. Broadcast toast dismisses on click', async () => {
    const panel = teacherPage.locator('app-broadcast-panel');
    await panel.scrollIntoViewIfNeeded();

    await panel.locator('textarea.message-input').fill('Click-dismiss test');
    await panel.locator('.btn-broadcast').click();

    const toast = studentPage.locator('.broadcast-toast');
    await expect(toast).toBeVisible({ timeout: 8000 });

    await toast.click();
    await expect(toast).toBeHidden({ timeout: 2000 });
  });

  test('5. Teacher sends hint and student sees it in challenge panel', async () => {
    const hintMessage = `Try using a loop! ${Date.now()}`;
    const panel = teacherPage.locator('app-broadcast-panel');
    await panel.scrollIntoViewIfNeeded();

    await panel.locator('.challenge-input').fill('1');
    await panel.locator('.hint-input').fill(hintMessage);
    await panel.locator('.btn-hint').click();

    // Student should see the hint in the challenge panel
    const challengePanel = studentPage.locator('app-challenge-panel');
    await expect(challengePanel).toContainText(hintMessage, { timeout: 8000 });
  });

  test('6. Multiple broadcasts show the latest message', async () => {
    const msg1 = `First ${Date.now()}`;
    const msg2 = `Second ${Date.now() + 1}`;
    const panel = teacherPage.locator('app-broadcast-panel');
    await panel.scrollIntoViewIfNeeded();

    // Send first
    await panel.locator('textarea.message-input').fill(msg1);
    await panel.locator('.btn-broadcast').click();
    await expect(studentPage.locator('.broadcast-toast')).toBeVisible({
      timeout: 8000,
    });

    // Wait briefly then send second
    await teacherPage.waitForTimeout(1000);
    await panel.locator('textarea.message-input').fill(msg2);
    await panel.locator('.btn-broadcast').click();

    // Toast should show the latest message
    await expect(studentPage.locator('.broadcast-text')).toContainText(msg2, {
      timeout: 5000,
    });
  });
});
