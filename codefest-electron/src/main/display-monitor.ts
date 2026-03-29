import { BrowserWindow, screen, Display } from 'electron';

export interface DisplayCheckResult {
  allowed: boolean;
  displayCount: number;
  displays: Display[];
  message: string;
}

let watcherInterval: ReturnType<typeof setInterval> | null = null;
let recoveryInterval: ReturnType<typeof setInterval> | null = null;

export function checkDisplays(): DisplayCheckResult {
  const displays = screen.getAllDisplays();

  if (displays.length > 1) {
    return {
      allowed: false,
      displayCount: displays.length,
      displays,
      message:
        `Multiple monitors detected (${displays.length}). ` +
        'Please disconnect all extra monitors before starting the exam. ' +
        'Only one monitor is allowed.',
    };
  }

  return {
    allowed: true,
    displayCount: 1,
    displays,
    message: 'Display check passed.',
  };
}

export function startDisplayWatcher(
  win: BrowserWindow,
  checkIntervalMs: number = 5000
): void {
  // Listen for display-added events
  screen.on('display-added', (_event: Electron.Event, newDisplay: Display) => {
    handleDisplayViolation(win, 'MonitorConnected', newDisplay);
  });

  // Poll as a safety net (some connections don't fire events reliably)
  watcherInterval = setInterval(() => {
    if (win.isDestroyed()) {
      stopDisplayWatcher();
      return;
    }

    const displays = screen.getAllDisplays();
    if (displays.length > 1) {
      handleDisplayViolation(win, 'MultipleMonitors', displays[1]);
    }
  }, checkIntervalMs);
}

function handleDisplayViolation(
  win: BrowserWindow,
  type: string,
  display: Display
): void {
  if (win.isDestroyed()) return;

  // 1. Log to renderer → server via SignalR
  win.webContents.send('security-violation', {
    type,
    displayCount: screen.getAllDisplays().length,
    addedDisplay: {
      id: display.id,
      bounds: display.bounds,
      label: display.label,
    },
    timestamp: new Date().toISOString(),
  });

  // 2. Show blocking overlay in the renderer
  win.webContents.send('show-monitor-warning');

  // 3. Keep checking — unblock only when back to 1 monitor
  if (recoveryInterval) {
    clearInterval(recoveryInterval);
  }

  recoveryInterval = setInterval(() => {
    if (win.isDestroyed()) {
      if (recoveryInterval) clearInterval(recoveryInterval);
      return;
    }

    if (screen.getAllDisplays().length === 1) {
      if (recoveryInterval) clearInterval(recoveryInterval);
      recoveryInterval = null;
      win.webContents.send('hide-monitor-warning');

      win.webContents.send('security-violation', {
        type: 'MonitorDisconnected',
        displayCount: 1,
        timestamp: new Date().toISOString(),
      });
    }
  }, 2000);
}

export function stopDisplayWatcher(): void {
  if (watcherInterval) {
    clearInterval(watcherInterval);
    watcherInterval = null;
  }
  if (recoveryInterval) {
    clearInterval(recoveryInterval);
    recoveryInterval = null;
  }
}
