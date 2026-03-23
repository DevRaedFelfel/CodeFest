import { test, expect, Page, BrowserContext } from '@playwright/test';

const API_URL = 'http://localhost:5050';
const APP_URL = 'http://localhost:4200';

test.describe('Teacher Creates Session → Student Joins → Teacher Starts', () => {
  let teacherPage: Page;
  let studentPage: Page;
  let teacherContext: BrowserContext;
  let studentContext: BrowserContext;
  let sessionCode: string;

  test.beforeAll(async ({ browser }) => {
    // Seed challenges via API
    await fetch(`${API_URL}/api/challenges/seed`, { method: 'POST' });

    // Create separate browser contexts for teacher and student
    teacherContext = await browser.newContext();
    studentContext = await browser.newContext();
    teacherPage = await teacherContext.newPage();
    studentPage = await studentContext.newPage();
  });

  test.afterAll(async () => {
    await teacherContext?.close();
    await studentContext?.close();
  });

  test('1. Teacher opens dashboard and sees session list', async () => {
    await teacherPage.goto(`${APP_URL}/teacher`);
    await teacherPage.waitForLoadState('networkidle');

    // Should see the dashboard header
    const logo = teacherPage.locator('.logo');
    await expect(logo).toBeVisible();
    await expect(logo).toContainText('CodeFest');

    // Should see "Create Session" button
    const createBtn = teacherPage.locator('.btn-create');
    await expect(createBtn).toBeVisible();
    await expect(createBtn).toContainText('Create Session');
  });

  test('2. Teacher creates a new session', async () => {
    // Click "Create Session"
    await teacherPage.locator('.btn-create').click();

    // Session creator should appear
    const creator = teacherPage.locator('app-session-creator');
    await expect(creator).toBeVisible();

    // Fill session name
    await teacherPage.locator('#sessionName').fill('E2E Test Session');

    // Select the first challenge
    const firstChallenge = teacherPage.locator('.challenge-item').first();
    await expect(firstChallenge).toBeVisible();
    await firstChallenge.locator('input[type="checkbox"]').check();

    // Click "Create Session" button
    const createBtn = teacherPage.locator('.create-btn');
    await expect(createBtn).toBeEnabled();
    await createBtn.click();

    // Should navigate to dashboard with session control showing the code
    const codeDisplay = teacherPage.locator('.code-display .code');
    await expect(codeDisplay).toBeVisible({ timeout: 10000 });

    // Grab the session code
    sessionCode = (await codeDisplay.textContent())!.trim();
    expect(sessionCode.length).toBeGreaterThanOrEqual(3);
    console.log(`Session code: ${sessionCode}`);

    // Status should be "Lobby"
    const statusBadge = teacherPage.locator('.status-badge');
    await expect(statusBadge).toContainText('Lobby');

    // "Start Session" button should be visible
    const startBtn = teacherPage.locator('.btn-start');
    await expect(startBtn).toBeVisible();
    await expect(startBtn).toContainText('Start Session');
  });

  test('3. Student joins the session', async () => {
    await studentPage.goto(`${APP_URL}/join`);
    await studentPage.waitForLoadState('networkidle');

    // Fill session code and name
    await studentPage.locator('#sessionCode').fill(sessionCode);
    await studentPage.locator('#displayName').fill('TestStudent');

    // Join button should be enabled
    const joinBtn = studentPage.locator('.join-btn');
    await expect(joinBtn).toBeEnabled();

    // Click join
    await joinBtn.click();

    // Should navigate to /code
    await studentPage.waitForURL('**/code', { timeout: 10000 });
    expect(studentPage.url()).toContain('/code');

    // Student should see the waiting overlay (session not started yet)
    const overlay = studentPage.locator('.overlay');
    await expect(overlay).toBeVisible({ timeout: 5000 });
  });

  test('4. Teacher sees student joined and starts the session', async () => {
    // Wait for student to appear in teacher's student grid
    const studentCard = teacherPage.locator('app-student-card');
    await expect(studentCard.first()).toBeVisible({ timeout: 10000 });

    // Verify student name appears
    await expect(teacherPage.locator('app-student-card')).toContainText('TestStudent');

    // Teacher clicks "Start Session"
    const startBtn = teacherPage.locator('.btn-start');
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    // Status should change to "Active"
    const statusBadge = teacherPage.locator('.status-badge');
    await expect(statusBadge).toContainText('Active', { timeout: 10000 });
  });

  test('5. Student sees session started and can code', async () => {
    // Overlay should disappear
    const overlay = studentPage.locator('.overlay');
    await expect(overlay).toBeHidden({ timeout: 10000 });

    // Challenge panel should be visible
    const challengePanel = studentPage.locator('.challenge-panel');
    await expect(challengePanel).toBeVisible({ timeout: 5000 });

    // Code editor should be visible
    const cmEditor = studentPage.locator('.cm-editor');
    await expect(cmEditor).toBeVisible({ timeout: 5000 });

    // Run Tests button should be visible
    const runBtn = studentPage.locator('.btn-primary');
    await expect(runBtn).toBeVisible();
  });
});
