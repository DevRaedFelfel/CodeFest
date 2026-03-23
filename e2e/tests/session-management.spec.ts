import { test, expect } from '@playwright/test';

const API_URL = 'http://localhost:5050';
const APP_URL = 'http://localhost:4200';

// Helper: create a session via API
async function createSession(name: string): Promise<{ code: string }> {
  await fetch(`${API_URL}/api/challenges/seed`, { method: 'POST' });
  const challengesRes = await fetch(`${API_URL}/api/challenges`);
  const challenges = await challengesRes.json();
  const challengeIds = challenges.map((c: any) => c.id).slice(0, 1);

  const res = await fetch(`${API_URL}/api/teacher/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, challengeIds }),
  });
  return res.json();
}

// Helper: set session status via API
async function setStatus(code: string, status: string) {
  return fetch(`${API_URL}/api/teacher/sessions/${code}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}

test.describe('Session Management - Delete', () => {
  test('Delete a session from the session list', async ({ browser }) => {
    const session = await createSession('Delete Me Session');

    const context = await browser.newContext();
    const page = await context.newPage();

    // Set up dialog handler before navigating
    page.on('dialog', (dialog) => dialog.accept());

    await page.goto(`${APP_URL}/teacher`);
    await page.waitForLoadState('networkidle');

    // Verify session appears in the list
    const sessionCard = page.locator('.session-card', { hasText: 'Delete Me Session' });
    await expect(sessionCard).toBeVisible();

    // Click the delete button
    const deleteBtn = sessionCard.locator('.btn-delete-session');
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // Session should disappear from the list
    await expect(sessionCard).toBeHidden({ timeout: 5000 });

    await context.close();
  });

  test('Delete session via API returns 204', async ({ request }) => {
    const session = await createSession('API Delete Session');

    const res = await request.delete(`${API_URL}/api/teacher/sessions/${session.code}`);
    expect(res.status()).toBe(204);

    // Verify it's gone
    const getRes = await request.get(`${API_URL}/api/teacher/sessions/${session.code}`);
    expect(getRes.status()).toBe(404);
  });

  test('Delete nonexistent session returns 404', async ({ request }) => {
    const res = await request.delete(`${API_URL}/api/teacher/sessions/ZZZZZZ`);
    expect(res.status()).toBe(404);
  });
});

test.describe('Session Management - Close (End)', () => {
  test('End an active session from dashboard', async ({ page }) => {
    const session = await createSession('Close Me Session');
    await setStatus(session.code, 'start');

    await page.goto(`${APP_URL}/teacher`);
    await page.waitForLoadState('networkidle');

    // Select the session
    const sessionCard = page.locator('.session-card', { hasText: 'Close Me Session' });
    await sessionCard.click();

    // Wait for dashboard to load with session control
    const statusBadge = page.locator('.status-badge');
    await expect(statusBadge).toContainText('Active', { timeout: 5000 });

    // Click End Session
    const endBtn = page.locator('.btn-end');
    await expect(endBtn).toBeVisible();
    await endBtn.click();

    // Status should change to Ended
    await expect(statusBadge).toContainText('Ended', { timeout: 10000 });
  });

  test('End session via API', async ({ request }) => {
    const session = await createSession('API End Session');
    await setStatus(session.code, 'start');

    const res = await request.put(`${API_URL}/api/teacher/sessions/${session.code}/status`, {
      data: { status: 'end' },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('Ended');
  });
});

test.describe('Session Management - Reopen', () => {
  test('Reopen an ended session from dashboard', async ({ page }) => {
    const session = await createSession('Reopen Me Session');
    await setStatus(session.code, 'start');
    await setStatus(session.code, 'end');

    await page.goto(`${APP_URL}/teacher`);
    await page.waitForLoadState('networkidle');

    // Select the ended session
    const sessionCard = page.locator('.session-card', { hasText: 'Reopen Me Session' });
    await sessionCard.click();

    // Wait for session control
    const statusBadge = page.locator('.status-badge');
    await expect(statusBadge).toContainText('Ended', { timeout: 5000 });

    // Click Reopen Session
    const reopenBtn = page.locator('.btn-reopen');
    await expect(reopenBtn).toBeVisible();
    await reopenBtn.click();

    // Status should change to Lobby
    await expect(statusBadge).toContainText('Lobby', { timeout: 5000 });

    // Start Session button should now be visible
    const startBtn = page.locator('.btn-start');
    await expect(startBtn).toBeVisible();
  });

  test('Reopen session via API', async ({ request }) => {
    const session = await createSession('API Reopen Session');
    await setStatus(session.code, 'start');
    await setStatus(session.code, 'end');

    const res = await request.put(`${API_URL}/api/teacher/sessions/${session.code}/status`, {
      data: { status: 'reopen' },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('Lobby');
  });

  test('Reopen non-ended session returns bad request', async ({ request }) => {
    const session = await createSession('Non-Ended Session');

    const res = await request.put(`${API_URL}/api/teacher/sessions/${session.code}/status`, {
      data: { status: 'reopen' },
    });
    expect(res.status()).toBe(400);
  });
});
