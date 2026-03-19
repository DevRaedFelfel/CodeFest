import { test, expect, Page } from '@playwright/test';

const API_URL = 'http://localhost:5050';
const APP_URL = 'http://localhost:4200';

// Helper: seed challenges via API
async function seedChallenges(): Promise<number[]> {
  await fetch(`${API_URL}/api/challenges/seed`, { method: 'POST' });
  const res = await fetch(`${API_URL}/api/challenges`);
  const challenges = await res.json();
  return challenges.map((c: any) => c.id);
}

// Helper: create a session via API
async function createSession(name: string, challengeIds: number[]): Promise<string> {
  const res = await fetch(`${API_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, challengeIds }),
  });
  const session = await res.json();
  return session.code;
}

test.describe('Teacher Dashboard', () => {
  test('should load the teacher dashboard page', async ({ page }) => {
    await page.goto(`${APP_URL}/teacher`);

    // Should show the dashboard header
    await expect(page.locator('text=CodeFest')).toBeVisible();
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('should show session list view with create button', async ({ page }) => {
    await page.goto(`${APP_URL}/teacher`);

    // Should show "Your Sessions" heading and create button
    await expect(page.locator('text=Your Sessions')).toBeVisible();
    await expect(page.locator('text=+ Create Session')).toBeVisible();
  });

  test('should show session creator when clicking create button', async ({ page }) => {
    await page.goto(`${APP_URL}/teacher`);
    await page.click('text=+ Create Session');

    // Should show the session creation form
    await expect(page.locator('text=Create New Session')).toBeVisible();
    await expect(page.locator('#sessionName')).toBeVisible();
    await expect(page.locator('text=Select Challenges')).toBeVisible();
    await expect(page.locator('text=Cancel')).toBeVisible();
  });

  test('should cancel session creation', async ({ page }) => {
    await page.goto(`${APP_URL}/teacher`);
    await page.click('text=+ Create Session');

    await expect(page.locator('text=Create New Session')).toBeVisible();
    await page.click('text=Cancel');

    // Should go back to session list
    await expect(page.locator('text=Your Sessions')).toBeVisible();
  });

  test('should display existing sessions in the list', async ({ page }) => {
    // Create a session via API first
    const challengeIds = await seedChallenges();
    const code = await createSession('Teacher E2E Session', challengeIds);

    await page.goto(`${APP_URL}/teacher`);

    // Wait for sessions to load
    await page.waitForTimeout(1500);

    // Should show the created session
    await expect(page.locator(`text=Teacher E2E Session`)).toBeVisible();
    await expect(page.locator(`text=${code}`)).toBeVisible();
  });

  test('should navigate to dashboard view when selecting a session', async ({ page }) => {
    const challengeIds = await seedChallenges();
    const code = await createSession('Dashboard Test Session', challengeIds);

    await page.goto(`${APP_URL}/teacher`);
    await page.waitForTimeout(1500);

    // Click on the session card
    await page.click(`text=Dashboard Test Session`);

    // Should show dashboard elements
    await expect(page.locator(`text=${code}`)).toBeVisible();
    await expect(page.locator('text=Activity Feed')).toBeVisible();
    await expect(page.locator('text=Broadcast')).toBeVisible();
  });

  test('should show session control with correct status for Lobby session', async ({ page }) => {
    const challengeIds = await seedChallenges();
    const code = await createSession('Lobby Session', challengeIds);

    await page.goto(`${APP_URL}/teacher`);
    await page.waitForTimeout(1500);
    await page.click('text=Lobby Session');

    // Should show session code prominently
    await expect(page.locator(`text=${code}`)).toBeVisible();

    // Should show Lobby status
    await expect(page.locator('text=Lobby')).toBeVisible();

    // Should show Start Session button
    await expect(page.locator('text=Start Session')).toBeVisible();
  });

  test('should show empty student grid message', async ({ page }) => {
    const challengeIds = await seedChallenges();
    await createSession('Empty Session', challengeIds);

    await page.goto(`${APP_URL}/teacher`);
    await page.waitForTimeout(1500);
    await page.click('text=Empty Session');

    // Should show empty state
    await expect(page.locator('text=No students have joined yet')).toBeVisible();
  });

  test('should navigate back to session list', async ({ page }) => {
    const challengeIds = await seedChallenges();
    await createSession('Back Test Session', challengeIds);

    await page.goto(`${APP_URL}/teacher`);
    await page.waitForTimeout(1500);
    await page.click('text=Back Test Session');

    // Should be on dashboard view
    await expect(page.locator('text=Activity Feed')).toBeVisible();

    // Click back button
    await page.click('text=Sessions');

    // Should be back on list
    await expect(page.locator('text=Your Sessions')).toBeVisible();
  });

  test('should show broadcast panel with message input', async ({ page }) => {
    const challengeIds = await seedChallenges();
    await createSession('Broadcast Test', challengeIds);

    await page.goto(`${APP_URL}/teacher`);
    await page.waitForTimeout(1500);
    await page.click('text=Broadcast Test');

    // Should show broadcast section
    await expect(page.locator('text=Broadcast')).toBeVisible();
    await expect(page.locator('textarea[placeholder*="broadcast"]')).toBeVisible();
    await expect(page.locator('text=Send Hint')).toBeVisible();
  });

  test('session creator should load challenges from API', async ({ page }) => {
    await seedChallenges();

    await page.goto(`${APP_URL}/teacher`);
    await page.click('text=+ Create Session');

    // Wait for challenges to load
    await page.waitForTimeout(1500);

    // Should show challenge checkboxes (we seeded 5 challenges)
    await expect(page.locator('text=Hello CodeFest')).toBeVisible();
    await expect(page.locator('text=Sum Machine')).toBeVisible();
  });

  test('should keep create button disabled until name and challenges selected', async ({ page }) => {
    await seedChallenges();

    await page.goto(`${APP_URL}/teacher`);
    await page.click('text=+ Create Session');
    await page.waitForTimeout(1500);

    // Create button should be disabled
    const createBtn = page.locator('button:has-text("Create Session")');
    await expect(createBtn).toBeDisabled();

    // Fill in name
    await page.fill('#sessionName', 'Test Session');

    // Still disabled - no challenges selected
    await expect(createBtn).toBeDisabled();

    // Select a challenge
    await page.click('text=Hello CodeFest');

    // Now should be enabled
    await expect(createBtn).toBeEnabled();
  });
});
