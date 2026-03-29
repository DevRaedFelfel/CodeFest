import { BrowserWindow, app, ipcMain } from 'electron';
import { unregisterAllShortcuts } from './kiosk-enforcer';
import { stopDisplayWatcher } from './display-monitor';
import { stopProcessWatcher } from './process-watcher';

let submissionResolve: (() => void) | null = null;

export function setupExitManager(win: BrowserWindow): void {
  ipcMain.handle('request-exit', async () => {
    win.webContents.send('show-exit-confirmation');
  });

  ipcMain.handle('confirm-exit', async () => {
    await handleExitConfirm(win);
  });

  ipcMain.handle('cancel-exit', async () => {
    // Nothing to clean up — renderer handles its own UI
  });

  ipcMain.handle('submission-complete', async () => {
    if (submissionResolve) {
      submissionResolve();
      submissionResolve = null;
    }
  });
}

async function handleExitConfirm(win: BrowserWindow): Promise<void> {
  // Tell renderer to submit all work
  win.webContents.send('submit-all-and-exit');

  // Wait for renderer to confirm submission complete (max 30s timeout)
  const submitted = await waitForSubmissionComplete(30000);

  if (!submitted) {
    console.warn('Submission timeout — force exiting. Server has 30s snapshots.');
  }

  performCleanExit(win);
}

function waitForSubmissionComplete(timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      submissionResolve = null;
      resolve(false);
    }, timeoutMs);

    submissionResolve = () => {
      clearTimeout(timeout);
      resolve(true);
    };
  });
}

export function performCleanExit(win: BrowserWindow): void {
  // Stop all watchers
  stopDisplayWatcher();
  stopProcessWatcher();

  // Unregister all global shortcuts
  unregisterAllShortcuts();

  // Allow the window to close
  if (!win.isDestroyed()) {
    win.closable = true;
    win.close();
  }

  app.quit();
}

export function handleSessionEnded(win: BrowserWindow): void {
  // When teacher ends session, the Angular app handles the celebration screen.
  // We just need to set up a clean exit path.
  // The Angular app will call confirmExit when the student clicks the Exit button.
  // For session-end, we skip the confirmation — just allow clean exit.
  ipcMain.handleOnce('session-ended-exit', async () => {
    performCleanExit(win);
  });
}
