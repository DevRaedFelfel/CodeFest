import { test, expect, Page } from '@playwright/test';

// Helper to simulate authenticated session by setting sessionStorage
async function loginAs(page: Page, role: 'SuperAdmin' | 'Instructor' | 'Student', name = 'Test User') {
  await page.goto('/login');

  // Set auth in sessionStorage before navigating
  await page.evaluate(
    ({ role, name }) => {
      sessionStorage.setItem('codefest_jwt', 'fake-jwt-token');
      sessionStorage.setItem(
        'codefest_user',
        JSON.stringify({
          id: 1,
          email: `${role.toLowerCase()}@test.com`,
          name,
          role,
          pictureUrl: null,
        })
      );
    },
    { role, name }
  );
}

test.describe('Admin Dashboard', () => {
  test('should show admin dashboard for SuperAdmin', async ({ page }) => {
    await loginAs(page, 'SuperAdmin', 'Admin');
    await page.goto('/admin');

    await expect(page.locator('.page-title')).toContainText('Dashboard');
    await expect(page.locator('.sidebar-title')).toContainText('CodeFest Admin');
  });

  test('should show admin sidebar navigation', async ({ page }) => {
    await loginAs(page, 'SuperAdmin');
    await page.goto('/admin');

    // Check sidebar links exist
    await expect(page.locator('.sidebar-nav a')).toHaveCount(6);
  });

  test('should navigate to users page', async ({ page }) => {
    await loginAs(page, 'SuperAdmin');
    await page.goto('/admin/users');

    await expect(page.locator('.page-title')).toContainText('Users');
  });

  test('should navigate to courses page', async ({ page }) => {
    await loginAs(page, 'SuperAdmin');
    await page.goto('/admin/courses');

    await expect(page.locator('.page-title')).toContainText('Courses');
  });

  test('should navigate to enrollments page', async ({ page }) => {
    await loginAs(page, 'SuperAdmin');
    await page.goto('/admin/enrollments');

    await expect(page.locator('.page-title')).toContainText('Enrollments');
  });

  test('should navigate to enrollment requests page', async ({ page }) => {
    await loginAs(page, 'SuperAdmin');
    await page.goto('/admin/enrollment-requests');

    await expect(page.locator('.page-title')).toContainText('Enrollment Requests');
  });

  test('should navigate to academic loads page', async ({ page }) => {
    await loginAs(page, 'SuperAdmin');
    await page.goto('/admin/academic-loads');

    await expect(page.locator('.page-title')).toContainText('Academic Loads');
  });
});
