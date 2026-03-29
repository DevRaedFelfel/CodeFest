import { BrowserWindow, globalShortcut } from 'electron';

const BLOCKED_SHORTCUTS = [
  // OS-level escape
  'Alt+Tab',
  'Alt+Shift+Tab',
  'Alt+F4',
  'Alt+Escape',
  'Alt+Space',
  'Super',
  'Super+D',
  'Super+E',
  'Super+R',
  'Super+L',
  'Super+Tab',
  'Ctrl+Shift+Escape',

  // Browser / Chromium
  'F11',
  'Escape',
  'F12',
  'Ctrl+Shift+I',
  'Ctrl+Shift+J',
  'Ctrl+U',
  'Ctrl+L',
  'Ctrl+T',
  'Ctrl+N',
  'Ctrl+W',
  'Ctrl+Shift+T',
  'Ctrl+Tab',
  'Ctrl+R',
  'Ctrl+Shift+R',
  'Ctrl+P',
  'Ctrl+S',
  'Ctrl+F5',
  'Ctrl+H',
  'Ctrl+J',
];

export function registerBlockedShortcuts(): void {
  for (const shortcut of BLOCKED_SHORTCUTS) {
    try {
      globalShortcut.register(shortcut, () => {
        // Swallow — do nothing
      });
    } catch {
      // Some shortcuts (e.g., Super) may fail on certain OS versions
    }
  }
}

export function setupInputBlocker(win: BrowserWindow): void {
  win.webContents.on('before-input-event', (event, input) => {
    // Block F-keys (except F5 for refresh if needed)
    if (input.key.startsWith('F') && /^F\d+$/.test(input.key)) {
      event.preventDefault();
      return;
    }

    // Block Ctrl+Shift+anything (DevTools shortcuts)
    if (input.control && input.shift) {
      event.preventDefault();
      return;
    }

    // Block Alt+anything (OS shortcuts)
    if (input.alt && input.key !== 'Alt') {
      event.preventDefault();
      return;
    }

    // Block Escape at renderer level (Layer 2)
    if (input.key === 'Escape') {
      event.preventDefault();
      return;
    }
  });
}

export function setupFocusRecovery(win: BrowserWindow): void {
  win.on('blur', () => {
    // Log the blur event
    win.webContents.send('security-violation', {
      type: 'FocusLost',
      timestamp: new Date().toISOString(),
    });

    // Aggressively reclaim focus
    setTimeout(() => {
      if (!win.isDestroyed()) {
        win.focus();
        win.moveTop();
        if (!win.isKiosk()) {
          win.setKiosk(true);
        }
      }
    }, 500);

    // Retry every second for 10 seconds
    let retries = 0;
    const focusInterval = setInterval(() => {
      if (win.isDestroyed()) {
        clearInterval(focusInterval);
        return;
      }

      if (win.isFocused() || retries > 10) {
        clearInterval(focusInterval);
        if (win.isFocused()) {
          win.webContents.send('security-violation', {
            type: 'FocusRegained',
            awayDurationMs: retries * 1000,
            timestamp: new Date().toISOString(),
          });
        }
        return;
      }

      win.focus();
      win.moveTop();
      retries++;
    }, 1000);
  });
}

export function unregisterAllShortcuts(): void {
  globalShortcut.unregisterAll();
}
