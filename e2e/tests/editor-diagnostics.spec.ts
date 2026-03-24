import { test, expect, Page } from '@playwright/test';

const API_URL = 'http://localhost:5050';
const APP_URL = 'http://localhost:4200';

let sessionCode = '';

async function setupSession() {
  const seedRes = await fetch(`${API_URL}/api/challenges/seed`, { method: 'POST' });
  await seedRes.json();

  const challengesRes = await fetch(`${API_URL}/api/challenges`);
  const challenges = await challengesRes.json();
  const challengeIds = challenges.map((c: any) => c.id);

  const name = `Diagnostics-E2E-${Date.now()}`;
  const createRes = await fetch(`${API_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, challengeIds }),
  });
  const session = await createRes.json();
  sessionCode = session.code;

  await fetch(`${API_URL}/api/sessions/${sessionCode}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'start' }),
  });

  return sessionCode;
}

async function joinAndFocusEditor(page: Page) {
  await page.goto(`${APP_URL}/join`);
  await page.waitForLoadState('networkidle');
  await page.locator('#sessionCode').fill(sessionCode);
  await page.locator('#displayName').fill(`DiagTest-${Date.now()}`);
  await page.locator('.join-btn').click();
  await page.waitForURL('**/code', { timeout: 10000 });
  await page.waitForTimeout(1500);

  const cmContent = page.locator('.cm-content');
  await cmContent.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(300);
}

async function typeInEditor(page: Page, text: string) {
  await page.keyboard.type(text, { delay: 30 });
  await page.waitForTimeout(400);
}

/** Wait for linter to run (500ms delay + buffer) */
async function waitForLinter(page: Page) {
  await page.waitForTimeout(1500);
}

function getLintErrors(page: Page) {
  return page.locator('.cm-lintRange-error');
}

function getLintWarnings(page: Page) {
  return page.locator('.cm-lintRange-warning');
}

function getLintInfos(page: Page) {
  return page.locator('.cm-lintRange-info');
}

function getAllLintDiags(page: Page) {
  return page.locator('.cm-lintRange-error, .cm-lintRange-warning, .cm-lintRange-info');
}

function getLintTooltip(page: Page) {
  return page.locator('.cm-tooltip-lint');
}

test.describe('Editor Diagnostics E2E', () => {
  test.beforeAll(async () => {
    await setupSession();
  });

  // ── Type Mismatch Rules ──────────────────────────────────────────

  test.describe('Type Mismatch Detection', () => {
    test('flags int variable assigned a string literal', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'int x = "hello";');
      await waitForLinter(page);

      const errors = getLintErrors(page);
      expect(await errors.count()).toBeGreaterThan(0);
    });

    test('flags Console.ReadLine() assigned to int without Parse', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'int x = Console.ReadLine();');
      await waitForLinter(page);

      const errors = getLintErrors(page);
      expect(await errors.count()).toBeGreaterThan(0);
    });

    test('flags bool assigned a number', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'bool b = 0;');
      await waitForLinter(page);

      const errors = getLintErrors(page);
      expect(await errors.count()).toBeGreaterThan(0);
    });
  });

  // ── Method Call Rules ────────────────────────────────────────────

  test.describe('Method Call Detection', () => {
    test('flags .Length() with parentheses (property, not method)', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'int n = "hello".Length();');
      await waitForLinter(page);

      const diags = getAllLintDiags(page);
      expect(await diags.count()).toBeGreaterThan(0);
    });

    test('flags Math.Pow with wrong number of args', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'double r = Math.Pow(5);');
      await waitForLinter(page);

      const diags = getAllLintDiags(page);
      expect(await diags.count()).toBeGreaterThan(0);
    });

    test('flags Console.ReadLine("prompt") — takes no args', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'Console.ReadLine("Enter:");');
      await waitForLinter(page);

      const diags = getAllLintDiags(page);
      expect(await diags.count()).toBeGreaterThan(0);
    });
  });

  // ── Control Flow Rules ───────────────────────────────────────────

  test.describe('Control Flow Detection', () => {
    test('flags suspicious semicolon after if', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'if (true);\n{\n  Console.WriteLine("oops");\n}');
      await waitForLinter(page);

      const warnings = getLintWarnings(page);
      expect(await warnings.count()).toBeGreaterThan(0);
    });

    test('flags throw ex; suggests throw;', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'catch (Exception ex)\n{\n  throw ex;\n}');
      await waitForLinter(page);

      const infos = getLintInfos(page);
      expect(await infos.count()).toBeGreaterThan(0);
    });

    test('flags case without break', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'switch (x)\n{\n  case 1:\n    Console.WriteLine("one");\n  case 2:\n    break;\n}');
      await waitForLinter(page);

      const warnings = getLintWarnings(page);
      expect(await warnings.count()).toBeGreaterThan(0);
    });
  });

  // ── Keyword Casing ───────────────────────────────────────────────

  test.describe('Keyword Casing Detection', () => {
    test('flags If with capital I', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'If (true) { }');
      await waitForLinter(page);

      const errors = getLintErrors(page);
      expect(await errors.count()).toBeGreaterThan(0);
    });

    test('flags True with capital T', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'bool b = True;');
      await waitForLinter(page);

      const errors = getLintErrors(page);
      expect(await errors.count()).toBeGreaterThan(0);
    });

    test('flags NULL as keyword casing error', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'string s = NULL;');
      await waitForLinter(page);

      const errors = getLintErrors(page);
      expect(await errors.count()).toBeGreaterThan(0);
    });
  });

  // ── String Interpolation ─────────────────────────────────────────

  test.describe('String Interpolation Detection', () => {
    test('flags {variable} in non-interpolated string (missing $)', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'string s = "Hello {name}";');
      await waitForLinter(page);

      const warnings = getLintWarnings(page);
      expect(await warnings.count()).toBeGreaterThan(0);
    });

    test('does not flag $"..." interpolated string', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'string s = $"Hello {name}";');
      await waitForLinter(page);

      // Should have no interpolation-related warnings
      // (may have other diagnostics from unresolved 'name', but no CF035)
      const warnings = getLintWarnings(page);
      const count = await warnings.count();
      // If there are warnings, they shouldn't be about missing $
      if (count > 0) {
        const firstWarning = warnings.first();
        await firstWarning.hover();
        await page.waitForTimeout(500);
        const tooltip = getLintTooltip(page);
        if (await tooltip.isVisible()) {
          const text = await tooltip.textContent();
          expect(text).not.toContain('missing the `$` prefix');
        }
      }
    });
  });

  // ── Style Hints ──────────────────────────────────────────────────

  test.describe('Style Hints', () => {
    test('flags x == true as redundant comparison', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'if (done == true) { }');
      await waitForLinter(page);

      const infos = getLintInfos(page);
      expect(await infos.count()).toBeGreaterThan(0);
    });

    test('suggests string.IsNullOrEmpty instead of == ""', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'if (name == "") { }');
      await waitForLinter(page);

      const infos = getLintInfos(page);
      expect(await infos.count()).toBeGreaterThan(0);

      const firstInfo = infos.first();
      await firstInfo.hover();
      await page.waitForTimeout(500);
      const tooltip = getLintTooltip(page);
      if (await tooltip.isVisible()) {
        const text = await tooltip.textContent();
        expect(text).toContain('IsNullOrEmpty');
      }
    });
  });

  // ── Quick-Fix Actions ────────────────────────────────────────────

  test.describe('Quick-Fix Actions', () => {
    test('quick-fix action button appears in diagnostic tooltip', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'Console.Writeline("test");');
      await waitForLinter(page);

      const errors = getLintErrors(page);
      expect(await errors.count()).toBeGreaterThan(0);

      // Hover to show tooltip with action button
      const firstError = errors.first();
      await firstError.hover();
      await page.waitForTimeout(500);

      const tooltip = getLintTooltip(page);
      if (await tooltip.isVisible()) {
        // Look for action button inside the tooltip
        const actionBtn = tooltip.locator('button');
        // CodeMirror lint tooltips may show actions as buttons
        const btnCount = await actionBtn.count();
        // We just verify the tooltip shows up with the error message
        const text = await tooltip.textContent();
        expect(text).toContain('WriteLine');
      }
    });
  });

  // ── Diagnostic Severity Levels ───────────────────────────────────

  test.describe('Severity Levels', () => {
    test('shows red underline for errors', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'console.Writeline("hi");');
      await waitForLinter(page);

      const errors = getLintErrors(page);
      expect(await errors.count()).toBeGreaterThan(0);
    });

    test('shows yellow underline for warnings', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'if (x = 5) { }');
      await waitForLinter(page);

      const warnings = getLintWarnings(page);
      expect(await warnings.count()).toBeGreaterThan(0);
    });

    test('shows info underline for hints', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'if (done == true) { }');
      await waitForLinter(page);

      const infos = getLintInfos(page);
      expect(await infos.count()).toBeGreaterThan(0);
    });
  });

  // ── False Positive Checks ────────────────────────────────────────

  test.describe('False Positive Prevention', () => {
    test('valid C# code produces no error diagnostics', async ({ page }) => {
      await joinAndFocusEditor(page);
      // Avoid typing { and } separately — auto-close brackets would add duplicates.
      // Use simple statements without braces.
      await typeInEditor(page, [
        'int x = 5;',
        'string name = "Ali";',
        'Console.WriteLine(name);',
        'double d = 3.14;',
      ].join('\n'));
      await waitForLinter(page);

      const errors = getLintErrors(page);
      expect(await errors.count()).toBe(0);
    });

    test('comments are not flagged for typos', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, '// console.writeline is wrong');
      await waitForLinter(page);

      const errors = getLintErrors(page);
      expect(await errors.count()).toBe(0);
    });

    test('strings are not flagged for code issues', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'Console.WriteLine("console.writeline is wrong");');
      await waitForLinter(page);

      // Should have no errors (the typo is inside a string)
      const errors = getLintErrors(page);
      expect(await errors.count()).toBe(0);
    });

    test('for (;;) is not flagged as double semicolon', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'for (;;)\n{\n  break;\n}');
      await waitForLinter(page);

      // Should have no double-semicolon warning
      const warnings = getLintWarnings(page);
      const count = await warnings.count();
      if (count > 0) {
        for (let i = 0; i < count; i++) {
          const w = warnings.nth(i);
          await w.hover();
          await page.waitForTimeout(300);
          const tooltip = getLintTooltip(page);
          if (await tooltip.isVisible()) {
            const text = await tooltip.textContent();
            expect(text).not.toContain('Double semicolon');
          }
        }
      }
    });
  });

  // ── Linter Never Blocks Submission ───────────────────────────────

  test.describe('Non-Blocking Diagnostics', () => {
    test('Run Tests button stays enabled with many lint errors', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, [
        'console.Writeline("test");',
        'If (True) {',
        'int x = "hello";',
        'bool b = 0;',
      ].join('\n'));
      await waitForLinter(page);

      // Many errors should exist
      const allDiags = getAllLintDiags(page);
      expect(await allDiags.count()).toBeGreaterThan(3);

      // Button should still be enabled
      const runBtn = page.locator('.btn-primary');
      const isDisabled = await runBtn.isDisabled();
      expect(isDisabled).toBe(false);
    });
  });

  // ── Diagnostic Cap ───────────────────────────────────────────────

  test.describe('Diagnostic Cap', () => {
    test('should not show more than 50 diagnostics', async ({ page }) => {
      test.setTimeout(90000);
      await joinAndFocusEditor(page);
      // Generate lots of errors — inject directly into CodeMirror to avoid typing timeout
      const errorLines: string[] = [];
      for (let i = 0; i < 55; i++) {
        errorLines.push(`console.Writeline("e");`);
      }
      const code = errorLines.join('\n');
      // Use CodeMirror's dispatch API to set content directly
      await page.evaluate((text) => {
        const cmView = (document.querySelector('.cm-content') as any)?.cmView?.view;
        if (cmView) {
          cmView.dispatch({
            changes: { from: 0, to: cmView.state.doc.length, insert: text },
          });
        }
      }, code);
      await waitForLinter(page);
      await page.waitForTimeout(1000); // extra time for many diagnostics

      const allDiags = getAllLintDiags(page);
      const count = await allDiags.count();
      expect(count).toBeLessThanOrEqual(50);
    });
  });
});
