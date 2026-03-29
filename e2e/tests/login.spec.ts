import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test('should display login page with Google Sign-In', async ({ page }) => {
    await page.goto('/login');

    // Verify the login page elements
    await expect(page.locator('h1')).toContainText('CodeFest');
    await expect(page.locator('.tagline')).toContainText('Celebrative Coding Sessions');
    await expect(page.locator('.hint')).toContainText('institutional Gmail');
  });

  test('should redirect to /login when accessing protected routes', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect to /login when accessing student home', async ({ page }) => {
    await page.goto('/student');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect to /login when accessing teacher dashboard', async ({ page }) => {
    await page.goto('/teacher');
    await expect(page).toHaveURL(/\/login/);
  });
});
