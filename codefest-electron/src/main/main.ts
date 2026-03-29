import { app, BrowserWindow, globalShortcut, session } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { loadConfig, isAllowedURL, AppConfig } from './config';
import { registerBlockedShortcuts, setupInputBlocker, setupFocusRecovery } from './kiosk-enforcer';
import { startDisplayWatcher } from './display-monitor';
import { startProcessWatcher } from './process-watcher';
import { registerIPCHandlers } from './ipc-handlers';
import { setupExitManager } from './exit-manager';

let mainWindow: BrowserWindow | null = null;
let config: AppConfig;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    // === KIOSK MODE ===
    kiosk: true,
    fullscreen: true,
    alwaysOnTop: true,
    closable: false,
    minimizable: false,
    maximizable: false,
    resizable: false,
    movable: false,
    frame: false,
    skipTaskbar: true,
    focusable: true,
    autoHideMenuBar: true,

    // === SECURITY ===
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: false,
      webviewTag: false,
      navigateOnDragDrop: false,
      spellcheck: false,
    },
  });

  // Prevent new windows (popups, window.open, target="_blank")
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' as const }));

  // Prevent navigation away from the app
  win.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedURL(url, config)) {
      event.preventDefault();
    }
  });

  // Block all permission requests (camera, mic, geolocation, notifications)
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => {
      callback(false);
    }
  );

  return win;
}

function getLoadURL(): string {
  // Check if bundled Angular files exist
  const rendererPath = path.join(__dirname, '..', 'renderer', 'index.html');
  if (fs.existsSync(rendererPath)) {
    return `file://${rendererPath}`;
  }

  // Load from remote server
  return config.serverUrl;
}

async function initialize(): Promise<void> {
  config = loadConfig();

  console.log('CodeFest Exam Client starting...');
  console.log(`Server URL: ${config.serverUrl}`);
  console.log(`Process watching: ${config.kioskSettings.blockProcesses}`);

  mainWindow = createWindow();

  // Register IPC handlers before loading content (so preload can communicate)
  registerIPCHandlers(mainWindow);
  setupExitManager(mainWindow);

  // Register keyboard lockdown
  registerBlockedShortcuts();
  setupInputBlocker(mainWindow);

  // Start security watchers
  startDisplayWatcher(mainWindow, config.kioskSettings.displayCheckIntervalMs);

  if (config.kioskSettings.blockProcesses) {
    startProcessWatcher(mainWindow, config.kioskSettings.processCheckIntervalMs);
  }

  // Setup focus recovery
  setupFocusRecovery(mainWindow);

  // Load the Angular app
  const loadURL = getLoadURL();
  console.log(`Loading: ${loadURL}`);

  if (loadURL.startsWith('file://')) {
    mainWindow.loadFile(loadURL.replace('file://', ''));
  } else {
    mainWindow.loadURL(loadURL);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Focus the existing window if a second instance is launched
    if (mainWindow) {
      mainWindow.focus();
      mainWindow.moveTop();
    }
  });
}

// App lifecycle
app.whenReady().then(initialize);

app.on('window-all-closed', () => {
  // Prevent app from quitting when all windows close
  // Only exit through the exit-manager flow
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('activate', () => {
  if (mainWindow === null) {
    initialize();
  }
});
