import { test, expect, Page } from '@playwright/test';

async function loginAsStudent(page: Page) {
  await page.goto('/login');
  await page.evaluate(() => {
    sessionStorage.setItem('codefest_jwt', 'fake-jwt-token');
    sessionStorage.setItem(
      'codefest_user',
      JSON.stringify({
        id: 3,
        email: 'student@test.com',
        name: 'Alice',
        role: 'Student',
        pictureUrl: null,
      })
    );
  });
}

test.describe('Student Home', () => {
  test('should show student home page when authenticated', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/student');

    await expect(page.locator('.logo')).toContainText('CodeFest');
    await expect(page.locator('.user-info')).toContainText('Alice');
  });

  test('should show session code input', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/student');

    await expect(page.locator('.input-code')).toBeVisible();
  });

  test('should have sign out button', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/student');

    await expect(page.locator('.btn-signout')).toBeVisible();
  });
});

test.describe('Join Page', () => {
  test('should show join form', async ({ page }) => {
    await page.goto('/join');

    await expect(page.locator('#sessionCode')).toBeVisible();
    await expect(page.locator('#displayName')).toBeVisible();
    await expect(page.locator('.join-btn')).toBeVisible();
  });

  test('should pre-fill code from URL param', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/join/ABC123');

    const input = page.locator('#sessionCode');
    await expect(input).toHaveValue('ABC123');
  });

  test('should disable join button when fields are empty', async ({ page }) => {
    await page.goto('/join');

    const button = page.locator('.join-btn');
    await expect(button).toBeDisabled();
  });
});
