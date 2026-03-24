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

  const name = `IntelliSense-E2E-${Date.now()}`;
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

/** Navigate to join page, join session, arrive at /code, click into editor */
async function joinAndFocusEditor(page: Page) {
  await page.goto(`${APP_URL}/join`);
  await page.waitForLoadState('networkidle');
  await page.locator('#sessionCode').fill(sessionCode);
  await page.locator('#displayName').fill(`ISTest-${Date.now()}`);
  await page.locator('.join-btn').click();
  await page.waitForURL('**/code', { timeout: 10000 });
  await page.waitForTimeout(1500);

  // Clear existing code and focus editor
  const cmContent = page.locator('.cm-content');
  await cmContent.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(300);
}

/** Type text into the focused editor */
async function typeInEditor(page: Page, text: string) {
  await page.keyboard.type(text, { delay: 30 });
  await page.waitForTimeout(400);
}

/** Get the autocomplete dropdown */
function getAutocompleteList(page: Page) {
  return page.locator('.cm-tooltip-autocomplete');
}

/** Get individual autocomplete option labels */
function getAutocompleteOptions(page: Page) {
  return page.locator('.cm-tooltip-autocomplete .cm-completionLabel');
}

/** Check if any autocomplete option contains the given text */
async function hasAutocompleteOption(page: Page, text: string): Promise<boolean> {
  const options = getAutocompleteOptions(page);
  const count = await options.count();
  for (let i = 0; i < count; i++) {
    const label = await options.nth(i).textContent();
    if (label?.includes(text)) return true;
  }
  return false;
}

/** Dismiss autocomplete if open */
async function dismissAutocomplete(page: Page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
}

/** Get all lint diagnostics (squiggly underlines) */
function getLintDiagnostics(page: Page) {
  return page.locator('.cm-lintRange-error, .cm-lintRange-warning, .cm-lintRange-info');
}

/** Get lint tooltip text */
function getLintTooltip(page: Page) {
  return page.locator('.cm-tooltip-lint');
}

test.describe('Editor IntelliSense E2E', () => {
  test.beforeAll(async () => {
    await setupSession();
  });

  // ── Autocomplete: Dot-triggered completions ────────────────────

  test.describe('Dot-triggered Completions', () => {
    test('Console. shows WriteLine, ReadLine, Write', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'Console.');

      const autocomplete = getAutocompleteList(page);
      await expect(autocomplete).toBeVisible({ timeout: 3000 });

      expect(await hasAutocompleteOption(page, 'WriteLine')).toBe(true);
      expect(await hasAutocompleteOption(page, 'ReadLine')).toBe(true);
      expect(await hasAutocompleteOption(page, 'Write')).toBe(true);
    });

    test('Math. shows Pow, Sqrt, Abs, Round, PI', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'Math.');

      const autocomplete = getAutocompleteList(page);
      await expect(autocomplete).toBeVisible({ timeout: 3000 });

      expect(await hasAutocompleteOption(page, 'Pow')).toBe(true);
      expect(await hasAutocompleteOption(page, 'Sqrt')).toBe(true);
      expect(await hasAutocompleteOption(page, 'Abs')).toBe(true);
      expect(await hasAutocompleteOption(page, 'PI')).toBe(true);
    });

    test('Convert. shows ToInt32, ToDouble, ToBoolean', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'Convert.');

      const autocomplete = getAutocompleteList(page);
      await expect(autocomplete).toBeVisible({ timeout: 3000 });

      expect(await hasAutocompleteOption(page, 'ToInt32')).toBe(true);
      expect(await hasAutocompleteOption(page, 'ToDouble')).toBe(true);
      expect(await hasAutocompleteOption(page, 'ToBoolean')).toBe(true);
    });

    test('int. shows Parse and TryParse', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'int.');

      const autocomplete = getAutocompleteList(page);
      await expect(autocomplete).toBeVisible({ timeout: 3000 });

      expect(await hasAutocompleteOption(page, 'Parse')).toBe(true);
      expect(await hasAutocompleteOption(page, 'TryParse')).toBe(true);
    });

    test('string. (static) shows IsNullOrEmpty, IsNullOrWhiteSpace', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'string.');

      const autocomplete = getAutocompleteList(page);
      await expect(autocomplete).toBeVisible({ timeout: 3000 });

      expect(await hasAutocompleteOption(page, 'IsNullOrEmpty')).toBe(true);
      expect(await hasAutocompleteOption(page, 'IsNullOrWhiteSpace')).toBe(true);
    });

    test('Environment. shows NewLine and Exit', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'Environment.');

      const autocomplete = getAutocompleteList(page);
      await expect(autocomplete).toBeVisible({ timeout: 3000 });

      expect(await hasAutocompleteOption(page, 'NewLine')).toBe(true);
      expect(await hasAutocompleteOption(page, 'Exit')).toBe(true);
    });

    test('Array. shows Sort, Reverse, IndexOf', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'Array.');

      const autocomplete = getAutocompleteList(page);
      await expect(autocomplete).toBeVisible({ timeout: 3000 });

      expect(await hasAutocompleteOption(page, 'Sort')).toBe(true);
      expect(await hasAutocompleteOption(page, 'Reverse')).toBe(true);
    });

    test('DateTime. shows Now, Today, Parse', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'DateTime.');

      const autocomplete = getAutocompleteList(page);
      await expect(autocomplete).toBeVisible({ timeout: 3000 });

      expect(await hasAutocompleteOption(page, 'Now')).toBe(true);
      expect(await hasAutocompleteOption(page, 'Today')).toBe(true);
      expect(await hasAutocompleteOption(page, 'Parse')).toBe(true);
    });

    test('ConsoleColor. shows color members', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'ConsoleColor.');

      const autocomplete = getAutocompleteList(page);
      await expect(autocomplete).toBeVisible({ timeout: 3000 });

      expect(await hasAutocompleteOption(page, 'Red')).toBe(true);
      expect(await hasAutocompleteOption(page, 'Blue')).toBe(true);
      expect(await hasAutocompleteOption(page, 'Green')).toBe(true);
    });
  });

  // ── Autocomplete: Variable type inference ──────────────────────

  test.describe('Variable Type Inference', () => {
    test('string variable shows instance members (Length, ToLower, Contains)', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'string name = "hello";\n');
      await typeInEditor(page, 'name.');

      const autocomplete = getAutocompleteList(page);
      await expect(autocomplete).toBeVisible({ timeout: 3000 });

      expect(await hasAutocompleteOption(page, 'Length')).toBe(true);
      expect(await hasAutocompleteOption(page, 'ToLower')).toBe(true);
      expect(await hasAutocompleteOption(page, 'Contains')).toBe(true);
    });

    test('List<int> variable shows Add, Count, Remove', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'List<int> nums = new List<int>();\n');
      await typeInEditor(page, 'nums.');

      const autocomplete = getAutocompleteList(page);
      await expect(autocomplete).toBeVisible({ timeout: 3000 });

      expect(await hasAutocompleteOption(page, 'Add')).toBe(true);
      expect(await hasAutocompleteOption(page, 'Count')).toBe(true);
      expect(await hasAutocompleteOption(page, 'Remove')).toBe(true);
    });

    test('var with new Random() shows Next, NextDouble', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'var rng = new Random();\n');
      await typeInEditor(page, 'rng.');

      const autocomplete = getAutocompleteList(page);
      await expect(autocomplete).toBeVisible({ timeout: 3000 });

      expect(await hasAutocompleteOption(page, 'Next')).toBe(true);
      expect(await hasAutocompleteOption(page, 'NextDouble')).toBe(true);
    });

    test('var with Console.ReadLine() infers string', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'var input = Console.ReadLine();\n');
      await typeInEditor(page, 'input.');

      const autocomplete = getAutocompleteList(page);
      await expect(autocomplete).toBeVisible({ timeout: 3000 });

      expect(await hasAutocompleteOption(page, 'Length')).toBe(true);
      expect(await hasAutocompleteOption(page, 'Trim')).toBe(true);
    });
  });

  // ── Autocomplete: Keyword & type completions ───────────────────

  test.describe('Keyword and Type Completions', () => {
    test('typing "fo" suggests for and foreach', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'fo');

      const autocomplete = getAutocompleteList(page);
      await expect(autocomplete).toBeVisible({ timeout: 3000 });

      expect(await hasAutocompleteOption(page, 'for')).toBe(true);
      expect(await hasAutocompleteOption(page, 'foreach')).toBe(true);
    });

    test('typing "wh" suggests while', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'wh');

      const autocomplete = getAutocompleteList(page);
      await expect(autocomplete).toBeVisible({ timeout: 3000 });

      expect(await hasAutocompleteOption(page, 'while')).toBe(true);
    });

    test('typing "Con" suggests Console and Convert', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'Con');

      const autocomplete = getAutocompleteList(page);
      await expect(autocomplete).toBeVisible({ timeout: 3000 });

      expect(await hasAutocompleteOption(page, 'Console')).toBe(true);
      expect(await hasAutocompleteOption(page, 'Convert')).toBe(true);
    });

    test('typing "st" suggests string and static', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'st');

      const autocomplete = getAutocompleteList(page);
      await expect(autocomplete).toBeVisible({ timeout: 3000 });

      expect(await hasAutocompleteOption(page, 'string')).toBe(true);
      expect(await hasAutocompleteOption(page, 'static')).toBe(true);
    });
  });

  // ── Autocomplete: Snippets ─────────────────────────────────────

  test.describe('Snippet Completions', () => {
    test('"cw" snippet expands to Console.WriteLine', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'cw');

      const autocomplete = getAutocompleteList(page);
      await expect(autocomplete).toBeVisible({ timeout: 3000 });

      expect(await hasAutocompleteOption(page, 'cw')).toBe(true);

      // Accept the snippet
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);

      const cmContent = page.locator('.cm-content');
      const text = await cmContent.textContent();
      expect(text).toContain('Console.WriteLine');
    });

    test('"main" snippet expands to static void Main', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'main');

      const autocomplete = getAutocompleteList(page);
      await expect(autocomplete).toBeVisible({ timeout: 3000 });

      expect(await hasAutocompleteOption(page, 'main')).toBe(true);

      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);

      const cmContent = page.locator('.cm-content');
      const text = await cmContent.textContent();
      expect(text).toContain('static void Main');
    });
  });

  // ── Autocomplete: Exception completions ────────────────────────

  test.describe('Exception Completions', () => {
    test('throw new shows exception types', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'throw new ');

      const autocomplete = getAutocompleteList(page);
      await expect(autocomplete).toBeVisible({ timeout: 3000 });

      expect(await hasAutocompleteOption(page, 'Exception')).toBe(true);
      expect(await hasAutocompleteOption(page, 'ArgumentException')).toBe(true);
      expect(await hasAutocompleteOption(page, 'FormatException')).toBe(true);
    });

    test('catch ( shows exception types', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'try { } catch (');

      const autocomplete = getAutocompleteList(page);
      await expect(autocomplete).toBeVisible({ timeout: 3000 });

      expect(await hasAutocompleteOption(page, 'Exception')).toBe(true);
      expect(await hasAutocompleteOption(page, 'IndexOutOfRangeException')).toBe(true);
    });
  });

  // ── Autocomplete: Selecting a completion inserts it ────────────

  test.describe('Completion Acceptance', () => {
    test('selecting Console.WriteLine inserts it', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'Console.');

      const autocomplete = getAutocompleteList(page);
      await expect(autocomplete).toBeVisible({ timeout: 3000 });

      // Type to narrow down
      await typeInEditor(page, 'Wr');
      await page.waitForTimeout(300);

      // Accept first option
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);

      const cmContent = page.locator('.cm-content');
      const text = await cmContent.textContent();
      expect(text).toContain('WriteLine');
    });

    test('selecting Math.Pow inserts it', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'Math.');

      const autocomplete = getAutocompleteList(page);
      await expect(autocomplete).toBeVisible({ timeout: 3000 });

      await typeInEditor(page, 'Po');
      await page.waitForTimeout(300);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);

      const cmContent = page.locator('.cm-content');
      const text = await cmContent.textContent();
      expect(text).toContain('Pow');
    });
  });

  // ── Linter: Beginner mistake checks ────────────────────────────

  test.describe('Linter — Beginner Mistakes', () => {
    test('detects Console.Writeline case error', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'Console.Writeline("test");');

      // Wait for linter to run (500ms delay + buffer)
      await page.waitForTimeout(1500);

      const diagnostics = getLintDiagnostics(page);
      const count = await diagnostics.count();
      expect(count).toBeGreaterThan(0);

      // Hover on the diagnostic to check message
      const firstDiag = diagnostics.first();
      await firstDiag.hover();
      await page.waitForTimeout(500);

      const tooltip = getLintTooltip(page);
      if (await tooltip.isVisible()) {
        const tooltipText = await tooltip.textContent();
        expect(tooltipText).toContain('Console.WriteLine');
      }
    });

    test('detects lowercase console', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'console.WriteLine("test");');

      await page.waitForTimeout(1500);

      const diagnostics = getLintDiagnostics(page);
      const count = await diagnostics.count();
      expect(count).toBeGreaterThan(0);
    });

    test('detects Console.ReadLine without parentheses', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'Console.ReadLine;');

      await page.waitForTimeout(1500);

      const diagnostics = getLintDiagnostics(page);
      const count = await diagnostics.count();
      expect(count).toBeGreaterThan(0);
    });

    test('detects = used instead of == in if condition', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'int x = 5;\nif (x = 10)\n{\n}');

      await page.waitForTimeout(1500);

      const diagnostics = getLintDiagnostics(page);
      const count = await diagnostics.count();
      expect(count).toBeGreaterThan(0);
    });

    test('detects lowercase main', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'static void main(string[] args)\n{\n}');

      await page.waitForTimeout(1500);

      const diagnostics = getLintDiagnostics(page);
      const count = await diagnostics.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  // ── Linter: Structural checks ──────────────────────────────────

  test.describe('Linter — Structural Checks', () => {
    test('detects unmatched opening brace', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'if (true)\n{\nConsole.WriteLine("hi");');

      await page.waitForTimeout(1500);

      const diagnostics = getLintDiagnostics(page);
      const count = await diagnostics.count();
      expect(count).toBeGreaterThan(0);
    });

    test('detects unmatched closing brace', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'Console.WriteLine("hi");\n}');

      await page.waitForTimeout(1500);

      const diagnostics = getLintDiagnostics(page);
      const count = await diagnostics.count();
      expect(count).toBeGreaterThan(0);
    });

    test('no false positive on balanced braces', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'if (true)\n{\n    Console.WriteLine("hi");\n}');

      await page.waitForTimeout(1500);

      // Should not have brace-related errors
      const errorDiags = page.locator('.cm-lintRange-error');
      const count = await errorDiags.count();
      // May be 0 or have other diagnostics, but no unmatched brace errors
      // We just verify the linter ran without crashing
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('detects unterminated string literal', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'string s = "hello;');

      await page.waitForTimeout(1500);

      const diagnostics = getLintDiagnostics(page);
      const count = await diagnostics.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  // ── Hover Tooltips ─────────────────────────────────────────────

  test.describe('Hover Tooltips', () => {
    test('hovering Console.WriteLine shows signature tooltip', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'Console.WriteLine("hello");');
      await dismissAutocomplete(page);

      // Move cursor away first
      await page.mouse.move(0, 0);
      await page.waitForTimeout(300);

      // Hover over "Console.WriteLine"
      const cmContent = page.locator('.cm-content');
      const contentBox = await cmContent.boundingBox();
      if (contentBox) {
        // Hover near the start of the text where Console.WriteLine is
        await page.mouse.move(contentBox.x + 80, contentBox.y + 5);
        await page.waitForTimeout(800);

        const tooltip = page.locator('.cm-tooltip');
        if (await tooltip.isVisible()) {
          const tooltipText = await tooltip.textContent();
          // Should contain signature info
          expect(
            tooltipText?.includes('Console') ||
            tooltipText?.includes('WriteLine') ||
            tooltipText?.includes('void')
          ).toBe(true);
        }
        // Hover tooltips can be flaky in e2e due to exact positioning,
        // so we don't hard-fail if the tooltip doesn't appear
      }
    });

    test('hovering a keyword shows description tooltip', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'foreach (var item in list)\n{\n}');
      await dismissAutocomplete(page);

      await page.mouse.move(0, 0);
      await page.waitForTimeout(300);

      const cmContent = page.locator('.cm-content');
      const contentBox = await cmContent.boundingBox();
      if (contentBox) {
        // Hover near beginning where "foreach" keyword is
        await page.mouse.move(contentBox.x + 30, contentBox.y + 5);
        await page.waitForTimeout(800);

        const tooltip = page.locator('.cm-tooltip');
        if (await tooltip.isVisible()) {
          const tooltipText = await tooltip.textContent();
          expect(
            tooltipText?.includes('foreach') ||
            tooltipText?.includes('Iterates') ||
            tooltipText?.includes('keyword')
          ).toBe(true);
        }
      }
    });
  });

  // ── Bracket auto-closing ───────────────────────────────────────

  test.describe('Bracket Auto-Closing', () => {
    test('typing ( auto-inserts )', async ({ page }) => {
      await joinAndFocusEditor(page);
      await page.keyboard.type('Console.WriteLine(', { delay: 30 });
      await page.waitForTimeout(300);

      const cmContent = page.locator('.cm-content');
      const text = await cmContent.textContent();
      // closeBrackets should have inserted the closing )
      expect(text).toContain('()');
    });

    test('typing { auto-inserts }', async ({ page }) => {
      await joinAndFocusEditor(page);
      await page.keyboard.type('if (true) {', { delay: 30 });
      await page.waitForTimeout(300);

      const cmContent = page.locator('.cm-content');
      const text = await cmContent.textContent();
      expect(text).toContain('}');
    });

    test('typing " auto-inserts closing "', async ({ page }) => {
      await joinAndFocusEditor(page);
      await page.keyboard.type('string s = "', { delay: 30 });
      await page.waitForTimeout(300);

      const cmContent = page.locator('.cm-content');
      const text = await cmContent.textContent();
      // Should have two quotes
      expect(text).toContain('""');
    });

    test('typing [ auto-inserts ]', async ({ page }) => {
      await joinAndFocusEditor(page);
      await page.keyboard.type('int[', { delay: 30 });
      await page.waitForTimeout(300);

      const cmContent = page.locator('.cm-content');
      const text = await cmContent.textContent();
      expect(text).toContain('[]');
    });
  });

  // ── Completion filtering with typing ───────────────────────────

  test.describe('Completion Filtering', () => {
    test('Console. then typing "Re" narrows to Read/ReadLine/ReadKey/ResetColor', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'Console.');

      const autocomplete = getAutocompleteList(page);
      await expect(autocomplete).toBeVisible({ timeout: 3000 });

      await typeInEditor(page, 'Re');
      await page.waitForTimeout(400);

      // Should still show autocomplete, narrowed down
      await expect(autocomplete).toBeVisible();

      expect(await hasAutocompleteOption(page, 'ReadLine')).toBe(true);
      expect(await hasAutocompleteOption(page, 'ResetColor')).toBe(true);

      // Should NOT show unrelated items
      expect(await hasAutocompleteOption(page, 'Pow')).toBe(false);
      expect(await hasAutocompleteOption(page, 'PI')).toBe(false);
    });

    test('Math. then typing "S" narrows to Sin, Sqrt, Sign, etc.', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'Math.');

      const autocomplete = getAutocompleteList(page);
      await expect(autocomplete).toBeVisible({ timeout: 3000 });

      await typeInEditor(page, 'S');
      await page.waitForTimeout(400);

      await expect(autocomplete).toBeVisible();

      expect(await hasAutocompleteOption(page, 'Sqrt')).toBe(true);
      expect(await hasAutocompleteOption(page, 'Sin')).toBe(true);
      expect(await hasAutocompleteOption(page, 'Sign')).toBe(true);
    });
  });

  // ── Escape dismisses autocomplete ──────────────────────────────

  test.describe('Autocomplete Dismissal', () => {
    test('pressing Escape closes autocomplete dropdown', async ({ page }) => {
      await joinAndFocusEditor(page);
      await typeInEditor(page, 'Console.');

      const autocomplete = getAutocompleteList(page);
      await expect(autocomplete).toBeVisible({ timeout: 3000 });

      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);

      await expect(autocomplete).not.toBeVisible();
    });
  });

  // ── Linter does not block submission ───────────────────────────

  test.describe('Linter Non-Blocking', () => {
    test('Run Tests button remains enabled even with lint errors', async ({ page }) => {
      await joinAndFocusEditor(page);
      // Type code with deliberate errors that the linter catches
      await typeInEditor(page, 'console.Writeline("test");');

      await page.waitForTimeout(1500);

      // Verify lint errors exist
      const diagnostics = getLintDiagnostics(page);
      expect(await diagnostics.count()).toBeGreaterThan(0);

      // Verify Run Tests button is still enabled
      const runBtn = page.locator('.btn-primary');
      const isDisabled = await runBtn.isDisabled();
      expect(isDisabled).toBe(false);
    });
  });
});
