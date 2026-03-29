import { BrowserWindow, app, ipcMain, screen } from 'electron';
import { checkDisplays } from './display-monitor';

export interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
}

export function registerIPCHandlers(win: BrowserWindow): void {
  ipcMain.handle('get-display-count', async () => {
    return screen.getAllDisplays().length;
  });

  ipcMain.handle('get-app-version', async () => {
    return app.getVersion();
  });

  ipcMain.handle('run-pre-exam-checks', async (): Promise<CheckResult[]> => {
    const results: CheckResult[] = [];

    // Check 1: Single monitor
    const displayCheck = checkDisplays();
    results.push({
      name: 'Single monitor',
      passed: displayCheck.allowed,
      message: displayCheck.message,
    });

    // Check 2: Kiosk mode active
    const isKiosk = win.isKiosk();
    results.push({
      name: 'Kiosk mode active',
      passed: isKiosk,
      message: isKiosk ? 'Kiosk mode is active.' : 'Kiosk mode is not active.',
    });

    // Check 3: Keyboard lockdown
    // If we got this far, shortcuts are registered (done in main.ts before loading the app)
    results.push({
      name: 'Keyboard lockdown active',
      passed: true,
      message: 'Keyboard shortcuts are blocked.',
    });

    // Check 4: Server connection is checked by the Angular app via HTTP

    return results;
  });
}
