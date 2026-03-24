import { test, expect, Page } from '@playwright/test';

const API_URL = 'http://localhost:5050';
const APP_URL = 'http://localhost:4200';

let sessionCode = '';
let challengeIds: number[] = [];

async function setupSession() {
  // Seed challenges
  const seedRes = await fetch(`${API_URL}/api/challenges/seed`, { method: 'POST' });
  await seedRes.json();

  // Get challenge IDs
  const challengesRes = await fetch(`${API_URL}/api/challenges`);
  const challenges = await challengesRes.json();
  challengeIds = challenges.map((c: any) => c.id);

  // Create session
  const createRes = await fetch(`${API_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Interactive Console E2E', challengeIds }),
  });
  const session = await createRes.json();
  sessionCode = session.code;

  // Start session
  await fetch(`${API_URL}/api/sessions/${sessionCode}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'start' }),
  });

  return sessionCode;
}

async function joinAsStudent(page: Page, name: string) {
  await page.goto(`${APP_URL}/join`);
  await page.locator('#sessionCode').fill(sessionCode);
  await page.locator('#displayName').fill(name);
  await page.locator('.join-btn').click();

  // Wait for coding view
  await page.waitForURL('**/code', { timeout: 10000 });
  await page.waitForSelector('.coding-layout', { timeout: 10000 });
}

async function setEditorCode(page: Page, code: string) {
  // Click on the editor to focus it
  const editor = page.locator('.cm-editor .cm-content');
  await editor.click();

  // Select all and delete
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');

  // Type new code
  await page.keyboard.type(code, { delay: 10 });
}

test.describe('Interactive Console', () => {
  test.beforeAll(async () => {
    await setupSession();
  });

  test('Run button opens terminal and shows output', async ({ page }) => {
    await joinAsStudent(page, 'RunTest');

    await setEditorCode(page, 'Console.WriteLine("Hello E2E!");');

    // Click Run
    await page.click('[data-testid="run-button"]');

    // Terminal should appear
    await expect(page.locator('[data-testid="terminal-panel"]')).toBeVisible({
      timeout: 10000,
    });

    // Wait for output
    await expect(page.locator('[data-testid="terminal-panel"]')).toContainText(
      'Hello E2E!',
      { timeout: 15000 }
    );

    // Wait for "Program ended"
    await expect(page.locator('[data-testid="terminal-panel"]')).toContainText(
      'Program ended (exit code 0)',
      { timeout: 10000 }
    );
  });

  test('Interactive input: student types name and sees greeting', async ({
    page,
  }) => {
    await joinAsStudent(page, 'InputTest');

    const code = [
      'using System;',
      'Console.Write("Enter name: ");',
      'var name = Console.ReadLine();',
      'Console.WriteLine($"Hello, {name}!");',
    ].join('\n');

    await setEditorCode(page, code);
    await page.click('[data-testid="run-button"]');

    // Wait for prompt
    await expect(page.locator('[data-testid="terminal-panel"]')).toContainText(
      'Enter name:',
      { timeout: 15000 }
    );

    // Click terminal to focus, type input
    await page.locator('[data-testid="terminal-panel"]').click();
    await page.keyboard.type('Playwright');
    await page.keyboard.press('Enter');

    // Wait for greeting
    await expect(page.locator('[data-testid="terminal-panel"]')).toContainText(
      'Hello, Playwright!',
      { timeout: 10000 }
    );
  });

  test('Compile error shown in terminal', async ({ page }) => {
    await joinAsStudent(page, 'CompileErrTest');

    await setEditorCode(
      page,
      'using System;\nConsole.WritLine("typo");'
    );
    await page.click('[data-testid="run-button"]');

    // Should show compile error
    await expect(page.locator('[data-testid="terminal-panel"]')).toContainText(
      'Compile Error',
      { timeout: 15000 }
    );
  });

  test('Stop button kills running program', async ({ page }) => {
    await joinAsStudent(page, 'StopTest');

    await setEditorCode(
      page,
      'while(true) { Console.WriteLine("loop"); }'
    );
    await page.click('[data-testid="run-button"]');

    // Wait for some output
    await expect(page.locator('[data-testid="terminal-panel"]')).toContainText(
      'loop',
      { timeout: 15000 }
    );

    // Click stop
    await page.click('[data-testid="stop-button"]');

    // Should show "Program ended"
    await expect(page.locator('[data-testid="terminal-panel"]')).toContainText(
      'Program ended',
      { timeout: 10000 }
    );

    // Run button should be enabled again
    await expect(page.locator('[data-testid="run-button"]')).toBeEnabled({
      timeout: 5000,
    });
  });

  test('Ctrl+Enter triggers run', async ({ page }) => {
    await joinAsStudent(page, 'ShortcutTest');

    await setEditorCode(page, 'Console.WriteLine("shortcut!");');

    // Focus editor area and press Ctrl+Enter
    await page.locator('.editor-area').click();
    await page.keyboard.press('Control+Enter');

    await expect(page.locator('[data-testid="terminal-panel"]')).toContainText(
      'shortcut!',
      { timeout: 15000 }
    );
  });

  test('Multiple runs show separator and preserve history', async ({
    page,
  }) => {
    await joinAsStudent(page, 'MultiRunTest');

    await setEditorCode(page, 'Console.WriteLine("run 1");');
    await page.click('[data-testid="run-button"]');

    await expect(page.locator('[data-testid="terminal-panel"]')).toContainText(
      'run 1',
      { timeout: 15000 }
    );

    // Wait for program to end
    await expect(page.locator('[data-testid="terminal-panel"]')).toContainText(
      'Program ended',
      { timeout: 10000 }
    );

    // Change code and run again
    await setEditorCode(page, 'Console.WriteLine("run 2");');
    await page.click('[data-testid="run-button"]');

    await expect(page.locator('[data-testid="terminal-panel"]')).toContainText(
      'Run #2',
      { timeout: 15000 }
    );

    await expect(page.locator('[data-testid="terminal-panel"]')).toContainText(
      'run 2',
      { timeout: 10000 }
    );
  });

  test('Clear button wipes terminal history', async ({ page }) => {
    await joinAsStudent(page, 'ClearTest');

    await setEditorCode(page, 'Console.WriteLine("will be cleared");');
    await page.click('[data-testid="run-button"]');

    await expect(page.locator('[data-testid="terminal-panel"]')).toContainText(
      'will be cleared',
      { timeout: 15000 }
    );

    await page.click('[data-testid="clear-button"]');

    // After clear, terminal should not contain old text
    await expect(
      page.locator('[data-testid="terminal-panel"]')
    ).not.toContainText('will be cleared', { timeout: 3000 });
  });

  test('Runtime exception shown in terminal', async ({ page }) => {
    await joinAsStudent(page, 'ExceptionTest');

    await setEditorCode(
      page,
      'int[] a = new int[1]; Console.WriteLine(a[5]);'
    );
    await page.click('[data-testid="run-button"]');

    await expect(page.locator('[data-testid="terminal-panel"]')).toContainText(
      'IndexOutOfRangeException',
      { timeout: 15000 }
    );
  });

  test('Run disabled during execution, Submit disabled during run', async ({
    page,
  }) => {
    await joinAsStudent(page, 'ButtonStateTest');

    await setEditorCode(
      page,
      'using System;\nSystem.Threading.Thread.Sleep(3000);\nConsole.WriteLine("done");'
    );
    // Note: Thread.Sleep may be blocked. Use a loop-based delay instead.
    await setEditorCode(
      page,
      'Console.Write("Enter: ");\nvar x = Console.ReadLine();\nConsole.WriteLine("Got: " + x);'
    );

    await page.click('[data-testid="run-button"]');

    // Wait for waiting state (program is waiting for input)
    await expect(page.locator('[data-testid="terminal-panel"]')).toContainText(
      'Enter:',
      { timeout: 15000 }
    );

    // During execution, Run should be disabled and Submit should be disabled
    await expect(page.locator('[data-testid="run-button"]')).toBeDisabled();
    await expect(page.locator('[data-testid="submit-button"]')).toBeDisabled();

    // Stop button should be visible
    await expect(page.locator('[data-testid="stop-button"]')).toBeVisible();

    // Send input to finish
    await page.locator('[data-testid="terminal-panel"]').click();
    await page.keyboard.type('test');
    await page.keyboard.press('Enter');

    // Wait for program to finish
    await expect(page.locator('[data-testid="terminal-panel"]')).toContainText(
      'Got: test',
      { timeout: 10000 }
    );

    // Run and Submit should be enabled again
    await expect(page.locator('[data-testid="run-button"]')).toBeEnabled({
      timeout: 5000,
    });
    await expect(page.locator('[data-testid="submit-button"]')).toBeEnabled({
      timeout: 5000,
    });
  });

  test('Multiple ReadLine inputs work sequentially', async ({ page }) => {
    await joinAsStudent(page, 'SeqInputTest');

    const code = [
      'using System;',
      'Console.Write("First: ");',
      'var a = Console.ReadLine();',
      'Console.Write("Second: ");',
      'var b = Console.ReadLine();',
      'Console.WriteLine($"{a} and {b}");',
    ].join('\n');

    await setEditorCode(page, code);
    await page.click('[data-testid="run-button"]');

    // First input
    await expect(page.locator('[data-testid="terminal-panel"]')).toContainText(
      'First:',
      { timeout: 15000 }
    );

    await page.locator('[data-testid="terminal-panel"]').click();
    await page.keyboard.type('Hello');
    await page.keyboard.press('Enter');

    // Second input
    await expect(page.locator('[data-testid="terminal-panel"]')).toContainText(
      'Second:',
      { timeout: 10000 }
    );

    await page.keyboard.type('World');
    await page.keyboard.press('Enter');

    // Final output
    await expect(page.locator('[data-testid="terminal-panel"]')).toContainText(
      'Hello and World',
      { timeout: 10000 }
    );
  });
});

test.describe('Teacher Dashboard — Interactive Run Monitoring', () => {
  test('Teacher sees student run activity in feed', async ({ browser }) => {
    const teacherContext = await browser.newContext();
    const studentContext = await browser.newContext();

    const teacherPage = await teacherContext.newPage();
    const studentPage = await studentContext.newPage();

    try {
      // Teacher goes to dashboard and selects session
      await teacherPage.goto(`${APP_URL}/teacher`);
      await teacherPage.waitForSelector('.teacher-layout', { timeout: 10000 });

      // Look for the session card and click it
      const sessionCard = teacherPage.locator(`.session-card`).first();
      if (await sessionCard.isVisible({ timeout: 5000 })) {
        await sessionCard.click();
      }

      // Student joins and runs code
      await joinAsStudent(studentPage, 'TeacherViewTest');
      await setEditorCode(studentPage, 'Console.WriteLine("teacher can see this");');
      await studentPage.click('[data-testid="run-button"]');

      // Wait for program to finish
      await expect(
        studentPage.locator('[data-testid="terminal-panel"]')
      ).toContainText('teacher can see this', { timeout: 15000 });

      // Teacher should see the activity (InteractiveRun) in the feed
      // The exact feed format depends on the activity feed component
      await expect(
        teacherPage.locator('.feed-list')
      ).toContainText('started running', { timeout: 15000 });
    } finally {
      await teacherContext.close();
      await studentContext.close();
    }
  });
});
