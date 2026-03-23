import { test, expect, Page } from '@playwright/test';

const API_URL = 'http://localhost:5050';
const APP_URL = 'http://localhost:4200';

let sessionCode = '';
let challengeIds: number[] = [];
const consoleLogs: string[] = [];
const consoleErrors: string[] = [];

// Helper: seed challenges and create+start a session via API
async function setupSession() {
  console.log('=== SETUP: Seeding challenges ===');
  const seedRes = await fetch(`${API_URL}/api/challenges/seed`, { method: 'POST' });
  const seedData = await seedRes.json();
  console.log('Seed response:', JSON.stringify(seedData));

  console.log('=== SETUP: Fetching challenge IDs ===');
  const challengesRes = await fetch(`${API_URL}/api/challenges`);
  const challenges = await challengesRes.json();
  challengeIds = challenges.map((c: any) => c.id);
  console.log('Challenge IDs:', challengeIds);

  console.log('=== SETUP: Creating session ===');
  const createRes = await fetch(`${API_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'E2E Test Session', challengeIds }),
  });
  const session = await createRes.json();
  sessionCode = session.code;
  console.log('Session created:', JSON.stringify(session));

  console.log('=== SETUP: Starting session ===');
  const startRes = await fetch(`${API_URL}/api/sessions/${sessionCode}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'start' }),
  });
  const startData = await startRes.json();
  console.log('Session started:', JSON.stringify(startData));

  return sessionCode;
}

// Helper: attach console listeners
function attachConsoleListeners(page: Page) {
  page.on('console', (msg) => {
    const text = `[${msg.type()}] ${msg.text()}`;
    consoleLogs.push(text);
    console.log(`  BROWSER ${text}`);
  });

  page.on('pageerror', (err) => {
    const text = `[PAGE_ERROR] ${err.message}`;
    consoleErrors.push(text);
    console.log(`  BROWSER ${text}`);
  });
}

test.describe('Student Flow E2E', () => {
  test.beforeAll(async () => {
    await setupSession();
  });

  test.afterAll(async () => {
    console.log('\n\n========== CONSOLE LOG SUMMARY ==========');
    console.log(`Total logs: ${consoleLogs.length}`);
    console.log(`Total errors: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.log('\n--- ERRORS ---');
      consoleErrors.forEach((e) => console.log(e));
    }
    console.log('==========================================\n');
  });

  test('1. Join page loads and has all elements', async ({ page }) => {
    attachConsoleListeners(page);
    console.log('\n=== TEST 1: Join page loads ===');

    await page.goto(APP_URL);
    console.log('  Page loaded, URL:', page.url());

    // Should redirect to /join
    await page.waitForURL('**/join');
    console.log('  Redirected to:', page.url());

    // Check for logo
    const logo = page.locator('h1');
    const logoVisible = await logo.isVisible();
    const logoText = await logo.textContent();
    console.log(`  Logo visible: ${logoVisible}, text: "${logoText}"`);
    expect(logoVisible).toBe(true);
    expect(logoText).toContain('CodeFest');

    // Check for session code input
    const codeInput = page.locator('#sessionCode');
    const codeVisible = await codeInput.isVisible();
    console.log(`  Session code input visible: ${codeVisible}`);
    expect(codeVisible).toBe(true);

    // Check for name input
    const nameInput = page.locator('#displayName');
    const nameVisible = await nameInput.isVisible();
    console.log(`  Display name input visible: ${nameVisible}`);
    expect(nameVisible).toBe(true);

    // Check for join button
    const joinBtn = page.locator('.join-btn');
    const btnVisible = await joinBtn.isVisible();
    const btnText = await joinBtn.textContent();
    const btnDisabled = await joinBtn.isDisabled();
    console.log(`  Join button visible: ${btnVisible}, text: "${btnText}", disabled: ${btnDisabled}`);
    expect(btnVisible).toBe(true);
    expect(btnDisabled).toBe(true); // Should be disabled when inputs empty
  });

  test('2. Join button enables when inputs filled', async ({ page }) => {
    attachConsoleListeners(page);
    console.log('\n=== TEST 2: Join button enables ===');

    await page.goto(`${APP_URL}/join`);

    const codeInput = page.locator('#sessionCode');
    const nameInput = page.locator('#displayName');
    const joinBtn = page.locator('.join-btn');

    // Fill session code
    await codeInput.fill(sessionCode);
    const codeValue = await codeInput.inputValue();
    console.log(`  Session code filled: "${codeValue}"`);

    // Fill name
    await nameInput.fill('TestStudent');
    const nameValue = await nameInput.inputValue();
    console.log(`  Display name filled: "${nameValue}"`);

    // Button should now be enabled
    const btnDisabled = await joinBtn.isDisabled();
    console.log(`  Join button disabled after fill: ${btnDisabled}`);
    expect(btnDisabled).toBe(false);
  });

  test('3. Successfully join session and navigate to /code', async ({ page }) => {
    attachConsoleListeners(page);
    console.log('\n=== TEST 3: Join session ===');

    await page.goto(`${APP_URL}/join`);
    await page.waitForLoadState('networkidle');

    // Fill and join
    await page.locator('#sessionCode').fill(sessionCode);
    await page.locator('#displayName').fill('E2EStudent');
    console.log(`  Joining session ${sessionCode} as E2EStudent`);

    // Click join
    await page.locator('.join-btn').click();
    console.log('  Join button clicked');

    // Wait for navigation
    try {
      await page.waitForURL('**/code', { timeout: 10000 });
      console.log('  Navigated to:', page.url());
    } catch {
      console.log('  FAILED to navigate to /code. Current URL:', page.url());

      // Check for error message
      const error = page.locator('.error');
      if (await error.isVisible()) {
        const errorText = await error.textContent();
        console.log(`  Error displayed: "${errorText}"`);
      }

      // Take note of any issues
      const pageContent = await page.content();
      console.log('  Page HTML length:', pageContent.length);
    }

    expect(page.url()).toContain('/code');
  });

  test('4. Coding view - check all parts visibility', async ({ page }) => {
    attachConsoleListeners(page);
    console.log('\n=== TEST 4: Coding view visibility ===');

    // Join first
    await page.goto(`${APP_URL}/join`);
    await page.waitForLoadState('networkidle');
    await page.locator('#sessionCode').fill(sessionCode);
    await page.locator('#displayName').fill('VisibilityTest');
    await page.locator('.join-btn').click();
    await page.waitForURL('**/code', { timeout: 10000 });
    console.log('  Joined and at /code');

    // Wait a moment for rendering
    await page.waitForTimeout(2000);

    // === TOP BAR ===
    const topBar = page.locator('.top-bar');
    console.log(`  Top bar visible: ${await topBar.isVisible()}`);

    const logoSm = page.locator('.logo-sm');
    console.log(`  Logo-sm visible: ${await logoSm.isVisible()}, text: "${await logoSm.textContent().catch(() => 'N/A')}"`);

    const challengeTitle = page.locator('.challenge-title');
    const ctVisible = await challengeTitle.isVisible();
    const ctText = await challengeTitle.textContent().catch(() => 'N/A');
    console.log(`  Challenge title in top bar visible: ${ctVisible}, text: "${ctText}"`);

    // Progress dots
    const dots = page.locator('.dot');
    const dotCount = await dots.count();
    console.log(`  Progress dots count: ${dotCount}`);
    for (let i = 0; i < dotCount; i++) {
      const cls = await dots.nth(i).getAttribute('class');
      console.log(`    Dot ${i}: class="${cls}"`);
    }

    // Timer
    const timer = page.locator('app-timer .timer');
    const timerVisible = await timer.isVisible();
    const timerText = await timer.textContent().catch(() => 'N/A');
    console.log(`  Timer visible: ${timerVisible}, text: "${timerText}"`);

    // Points badge
    const pointsBadge = page.locator('.points-badge');
    console.log(`  Points badge visible: ${await pointsBadge.isVisible()}, text: "${await pointsBadge.textContent().catch(() => 'N/A')}"`);

    // Connection dot
    const connDot = page.locator('.connection-dot');
    const connClass = await connDot.getAttribute('class');
    console.log(`  Connection dot class: "${connClass}"`);

    // === CHALLENGE PANEL (LEFT) ===
    const challengePanel = page.locator('.panel.challenge');
    const cpVisible = await challengePanel.isVisible();
    const cpBox = await challengePanel.boundingBox();
    console.log(`  Challenge panel visible: ${cpVisible}, box: ${JSON.stringify(cpBox)}`);

    // Challenge panel inner content
    const challengePanelInner = page.locator('.challenge-panel');
    const cpiVisible = await challengePanelInner.isVisible();
    console.log(`  Challenge panel inner (.challenge-panel) visible: ${cpiVisible}`);

    if (cpiVisible) {
      const diffBadge = page.locator('.difficulty');
      console.log(`    Difficulty badge visible: ${await diffBadge.isVisible()}, text: "${await diffBadge.textContent().catch(() => 'N/A')}"`);

      const title = page.locator('.challenge-panel .title');
      console.log(`    Title visible: ${await title.isVisible()}, text: "${await title.textContent().catch(() => 'N/A')}"`);

      const desc = page.locator('.challenge-panel .description');
      const descVisible = await desc.isVisible();
      const descHTML = await desc.innerHTML().catch(() => 'N/A');
      console.log(`    Description visible: ${descVisible}, HTML length: ${descHTML.length}`);
      console.log(`    Description HTML: "${descHTML.substring(0, 200)}"`);

      const testCases = page.locator('.test-case');
      console.log(`    Test cases count: ${await testCases.count()}`);
    } else {
      console.log('  !!! Challenge panel inner content NOT visible - investigating...');

      // Check if currentChallenge exists by looking at editor
      const editorExists = await page.locator('app-code-editor').isVisible();
      console.log(`    Editor component exists: ${editorExists}`);

      // Check what's in the challenge panel div
      const cpHTML = await challengePanel.innerHTML();
      console.log(`    Challenge panel HTML (first 500 chars): "${cpHTML.substring(0, 500)}"`);
    }

    // === EDITOR PANEL (RIGHT) ===
    const editorPanel = page.locator('.panel.editor');
    const epVisible = await editorPanel.isVisible();
    const epBox = await editorPanel.boundingBox();
    console.log(`  Editor panel visible: ${epVisible}, box: ${JSON.stringify(epBox)}`);

    const codeEditor = page.locator('app-code-editor');
    console.log(`  Code editor component visible: ${await codeEditor.isVisible()}`);

    const cmEditor = page.locator('.cm-editor');
    const cmVisible = await cmEditor.isVisible();
    console.log(`  CodeMirror editor visible: ${cmVisible}`);

    if (cmVisible) {
      const cmBox = await cmEditor.boundingBox();
      console.log(`    CodeMirror box: ${JSON.stringify(cmBox)}`);

      const cmContent = page.locator('.cm-content');
      const editorText = await cmContent.textContent().catch(() => 'N/A');
      console.log(`    Editor content (first 200): "${editorText?.substring(0, 200)}"`);
    }

    // === BOTTOM BAR ===
    const bottomBar = page.locator('.bottom-bar');
    console.log(`  Bottom bar visible: ${await bottomBar.isVisible()}`);

    const runTestsBtn = page.locator('.btn-primary');
    const rtVisible = await runTestsBtn.isVisible();
    const rtText = await runTestsBtn.textContent();
    const rtDisabled = await runTestsBtn.isDisabled();
    console.log(`  Run Tests button visible: ${rtVisible}, text: "${rtText}", disabled: ${rtDisabled}`);

    // === OVERLAYS ===
    const overlay = page.locator('.overlay');
    const overlayVisible = await overlay.isVisible();
    console.log(`  Overlay visible: ${overlayVisible}`);
    if (overlayVisible) {
      const overlayHTML = await overlay.innerHTML();
      console.log(`    Overlay content: "${overlayHTML.substring(0, 300)}"`);
    }

    // === MOBILE TABS ===
    const mobileTabs = page.locator('.mobile-tabs');
    console.log(`  Mobile tabs visible: ${await mobileTabs.isVisible()}`);
  });

  test('5. Coding view - editor interactivity', async ({ page }) => {
    attachConsoleListeners(page);
    console.log('\n=== TEST 5: Editor interactivity ===');

    // Join first
    await page.goto(`${APP_URL}/join`);
    await page.waitForLoadState('networkidle');
    await page.locator('#sessionCode').fill(sessionCode);
    await page.locator('#displayName').fill('EditorTest');
    await page.locator('.join-btn').click();
    await page.waitForURL('**/code', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Check if editor is present
    const cmEditor = page.locator('.cm-editor');
    const cmVisible = await cmEditor.isVisible();
    console.log(`  CodeMirror visible: ${cmVisible}`);

    if (cmVisible) {
      // Try typing in editor
      const cmContent = page.locator('.cm-content');
      await cmContent.click();
      console.log('  Clicked editor content area');

      // Type some code
      await page.keyboard.type('Console.WriteLine("Hello E2E!");');
      console.log('  Typed code into editor');

      await page.waitForTimeout(500);

      const editorText = await cmContent.textContent();
      console.log(`  Editor text after typing: "${editorText?.substring(0, 300)}"`);

      const hasTypedText = editorText?.includes('Hello E2E');
      console.log(`  Contains typed text: ${hasTypedText}`);
    } else {
      console.log('  !!! CodeMirror NOT visible - cannot test editor');
    }
  });

  test('6. Coding view - Run Tests button click', async ({ page }) => {
    attachConsoleListeners(page);
    console.log('\n=== TEST 6: Run Tests button ===');

    // Join first
    await page.goto(`${APP_URL}/join`);
    await page.waitForLoadState('networkidle');
    await page.locator('#sessionCode').fill(sessionCode);
    await page.locator('#displayName').fill('RunTestUser');
    await page.locator('.join-btn').click();
    await page.waitForURL('**/code', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Click Run Tests
    const runBtn = page.locator('.btn-primary');
    const btnVisible = await runBtn.isVisible();
    const btnDisabled = await runBtn.isDisabled();
    console.log(`  Run Tests button visible: ${btnVisible}, disabled: ${btnDisabled}`);

    if (btnVisible && !btnDisabled) {
      await runBtn.click();
      console.log('  Clicked Run Tests');

      // Wait for results
      await page.waitForTimeout(5000);

      // Check for test results panel
      const resultsPanel = page.locator('.results-panel');
      const rpVisible = await resultsPanel.isVisible();
      console.log(`  Results panel visible: ${rpVisible}`);

      if (rpVisible) {
        const score = page.locator('.score');
        console.log(`    Score: "${await score.textContent().catch(() => 'N/A')}"`);

        const testItems = page.locator('.test-item');
        const testCount = await testItems.count();
        console.log(`    Test items count: ${testCount}`);
        for (let i = 0; i < testCount; i++) {
          const cls = await testItems.nth(i).getAttribute('class');
          const text = await testItems.nth(i).textContent();
          console.log(`      Test ${i}: class="${cls}", text="${text?.substring(0, 100)}"`);
        }

        // Check for compile/runtime errors
        const compileErr = page.locator('.compile-error');
        if (await compileErr.isVisible()) {
          console.log(`    Compile error: "${await compileErr.textContent()}"`);
        }

        const runtimeErr = page.locator('.runtime-error');
        if (await runtimeErr.isVisible()) {
          console.log(`    Runtime error: "${await runtimeErr.textContent()}"`);
        }
      } else {
        console.log('  !!! Results panel NOT visible after clicking Run Tests');
        // Check results container
        const resultsContainer = page.locator('.results-container');
        console.log(`    Results container visible: ${await resultsContainer.isVisible()}`);
      }
    } else {
      console.log('  !!! Run Tests button not clickable');
    }
  });

  test('7. Responsive - mobile view', async ({ page }) => {
    attachConsoleListeners(page);
    console.log('\n=== TEST 7: Mobile view ===');

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });

    // Join
    await page.goto(`${APP_URL}/join`);
    await page.waitForLoadState('networkidle');

    // Check join page on mobile
    const joinCard = page.locator('.join-card');
    console.log(`  Join card visible on mobile: ${await joinCard.isVisible()}`);
    const jcBox = await joinCard.boundingBox();
    console.log(`  Join card box: ${JSON.stringify(jcBox)}`);

    await page.locator('#sessionCode').fill(sessionCode);
    await page.locator('#displayName').fill('MobileUser');
    await page.locator('.join-btn').click();
    await page.waitForURL('**/code', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Mobile tabs should be visible
    const mobileTabs = page.locator('.mobile-tabs');
    const mtVisible = await mobileTabs.isVisible();
    console.log(`  Mobile tabs visible: ${mtVisible}`);

    if (mtVisible) {
      const tabButtons = page.locator('.mobile-tabs button');
      const tabCount = await tabButtons.count();
      console.log(`  Tab buttons count: ${tabCount}`);
      for (let i = 0; i < tabCount; i++) {
        const text = await tabButtons.nth(i).textContent();
        const cls = await tabButtons.nth(i).getAttribute('class');
        console.log(`    Tab ${i}: "${text}", class="${cls}"`);
      }

      // Click Challenge tab
      await tabButtons.nth(0).click();
      await page.waitForTimeout(500);
      const challengeVisible = page.locator('.panel.challenge.mobile-visible');
      console.log(`  After clicking Challenge tab - challenge panel has mobile-visible: ${await challengeVisible.count() > 0}`);

      // Click Code tab
      await tabButtons.nth(1).click();
      await page.waitForTimeout(500);
      const editorVisible = page.locator('.panel.editor.mobile-visible');
      console.log(`  After clicking Code tab - editor panel has mobile-visible: ${await editorVisible.count() > 0}`);

      // Click Ranks tab
      await tabButtons.nth(2).click();
      await page.waitForTimeout(500);
      const lbVisible = page.locator('.panel.leaderboard-mobile.mobile-visible');
      console.log(`  After clicking Ranks tab - leaderboard panel has mobile-visible: ${await lbVisible.count() > 0}`);
    }
  });

  test('8. Full page state dump', async ({ page }) => {
    attachConsoleListeners(page);
    console.log('\n=== TEST 8: Full state dump ===');

    await page.goto(`${APP_URL}/join`);
    await page.waitForLoadState('networkidle');
    await page.locator('#sessionCode').fill(sessionCode);
    await page.locator('#displayName').fill('StateDump');
    await page.locator('.join-btn').click();
    await page.waitForURL('**/code', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Dump all visible elements with their bounding boxes
    const elements = [
      '.top-bar', '.logo-sm', '.challenge-title', '.progress-dots',
      'app-timer', '.points-badge', '.connection-dot',
      '.panel.challenge', '.challenge-panel', '.difficulty', '.title', '.description',
      '.test-cases', '.test-case',
      '.panel.editor', 'app-code-editor', '.cm-editor', '.cm-content',
      '.bottom-bar', '.btn-primary',
      '.overlay', '.mobile-tabs',
      '.results-panel', '.mini-leaderboard',
    ];

    for (const sel of elements) {
      const el = page.locator(sel).first();
      const visible = await el.isVisible().catch(() => false);
      const box = await el.boundingBox().catch(() => null);
      const text = await el.textContent().catch(() => '');
      console.log(`  ${sel}: visible=${visible}, box=${JSON.stringify(box)}, text="${text?.substring(0, 80)}"`);
    }

    // Also grab the full page HTML for the coding layout
    const layoutHTML = await page.locator('.coding-layout').innerHTML().catch(() => 'NOT FOUND');
    console.log(`\n  Coding layout HTML length: ${layoutHTML.length}`);
    console.log(`  First 1000 chars:\n${layoutHTML.substring(0, 1000)}`);
  });
});
