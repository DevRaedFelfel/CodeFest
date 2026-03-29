# CodeFest — Electron Windows Kiosk App Specification

## Student-Only Secure Exam Client for Windows

---

## Overview

A lightweight Electron shell that loads the CodeFest Angular web app in a fully locked-down kiosk window. The student cannot exit, switch apps, or use secondary monitors. The only way out is the in-app **Exit Exam** button, which submits all work to the server before closing.

This app contains **zero teacher features**. It is a single-purpose exam client.

### Tech Stack

| Layer | Technology |
|-------|------------|
| Shell | Electron 30+ (Chromium-based) |
| Content | CodeFest Angular app (loaded via URL or bundled) |
| Installer | electron-builder → `.exe` (NSIS) or `.msi` |
| Auto-update | None — exam apps are versioned per semester |
| Target OS | Windows 10/11 (64-bit) |

### Architecture

```
┌─────────────────────────────────────────────┐
│              Electron Main Process           │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │         BrowserWindow (kiosk)          │  │
│  │                                        │  │
│  │   Angular App loaded from:             │  │
│  │   https://codefest.example.com/join    │  │
│  │        or                              │  │
│  │   file://bundled/index.html            │  │
│  │                                        │  │
│  │   ┌──────────────────────────────┐     │  │
│  │   │  CodeMirror Editor           │     │  │
│  │   │  Challenge Panel             │     │  │
│  │   │  Terminal Panel              │     │  │
│  │   │  Timer + Leaderboard         │     │  │
│  │   └──────────────────────────────┘     │  │
│  │                                        │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Services:                                   │
│  ├── KioskEnforcer (main process)            │
│  ├── DisplayMonitor (screen watcher)         │
│  ├── ProcessWatcher (kill task manager etc.)  │
│  └── IPCBridge (main ↔ renderer)             │
└─────────────────────────────────────────────┘
         │
         │  SignalR WebSocket
         ▼
   CodeFest Server (.NET 8 API)
```

---

## 1. Project Structure

```
codefest-electron/
├── package.json
├── electron-builder.yml          # Build/installer config
├── src/
│   ├── main/
│   │   ├── main.ts               # Electron entry point
│   │   ├── kiosk-enforcer.ts     # Fullscreen + keyboard lockdown
│   │   ├── display-monitor.ts    # Multi-monitor detection + enforcement
│   │   ├── process-watcher.ts    # Block Task Manager, Alt+Tab, etc.
│   │   ├── ipc-handlers.ts       # IPC channel definitions
│   │   ├── exit-manager.ts       # Graceful exit with submission
│   │   └── config.ts             # Server URL, exam settings
│   ├── preload/
│   │   └── preload.ts            # Secure bridge (contextBridge)
│   └── renderer/                 # Only if bundling Angular; otherwise loads URL
│       └── (Angular dist files)
├── assets/
│   ├── icon.ico                  # App icon
│   └── splash.html               # Pre-exam check screen
└── scripts/
    └── build.sh                  # Build + package script
```

---

## 2. Kiosk Window Configuration

### 2.1 — BrowserWindow Settings

The main window is created with maximum lockdown. Every setting here is deliberate.

```typescript
// main.ts — window creation
const win = new BrowserWindow({
  // === KIOSK MODE ===
  kiosk: true,                    // True kiosk: fullscreen, no title bar, no taskbar
  fullscreen: true,               // Redundant safety — ensures fullscreen even if kiosk glitches
  alwaysOnTop: true,              // Stay above all other windows
  closable: false,                // Prevent programmatic close except via our exit flow
  minimizable: false,             // Cannot minimize
  maximizable: false,             // Already fullscreen
  resizable: false,               // Cannot resize
  movable: false,                 // Cannot drag
  frame: false,                   // No window frame, no title bar, no close/min/max buttons
  skipTaskbar: true,              // Do not show in taskbar (prevents right-click → close)
  focusable: true,                // Must be focusable
  autoHideMenuBar: true,          // No menu bar
  
  // === SECURITY ===
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,       // Isolate preload from renderer
    nodeIntegration: false,       // No Node.js in renderer
    sandbox: true,                // Chromium sandbox enabled
    devTools: false,              // No DevTools (F12 disabled)
    webviewTag: false,            // No <webview> tag
    navigateOnDragDrop: false,    // Prevent drag-drop navigation
    spellcheck: false,            // No spellcheck popups
  },
});

// Prevent new windows (popups, window.open, target="_blank")
win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

// Prevent navigation away from the app
win.webContents.on('will-navigate', (event, url) => {
  if (!isAllowedURL(url)) {
    event.preventDefault();
  }
});

// Block all permission requests (camera, mic, geolocation, notifications)
win.webContents.session.setPermissionRequestHandler(
  (_webContents, _permission, callback) => {
    callback(false);
  }
);
```

### 2.2 — Allowed URLs

The app may only navigate to the CodeFest server. Everything else is blocked.

```typescript
// config.ts
const ALLOWED_ORIGINS = [
  'https://codefest.example.com',    // Production
  'http://localhost:4200',            // Local dev
  'http://192.168.*',                 // LAN addresses (classroom)
];

function isAllowedURL(url: string): boolean {
  return ALLOWED_ORIGINS.some(origin => {
    if (origin.includes('*')) {
      const pattern = new RegExp('^' + origin.replace(/\*/g, '[\\d]+'));
      return pattern.test(url);
    }
    return url.startsWith(origin);
  });
}
```

---

## 3. Keyboard & Shortcut Lockdown

### 3.1 — Blocked Shortcuts (Main Process)

All OS-level and browser shortcuts that could allow escape are intercepted and swallowed.

```typescript
// kiosk-enforcer.ts

// Register global shortcuts BEFORE the window loads
const BLOCKED_SHORTCUTS = [
  // === OS-LEVEL ESCAPE ===
  'Alt+Tab',              // Switch windows
  'Alt+Shift+Tab',        // Switch windows (reverse)
  'Alt+F4',               // Close window
  'Alt+Escape',           // Cycle windows
  'Alt+Space',            // Window system menu
  'Super',                // Start menu (Windows key)
  'Super+D',              // Show desktop
  'Super+E',              // File Explorer
  'Super+R',              // Run dialog
  'Super+L',              // Lock screen
  'Super+Tab',            // Task View
  'Ctrl+Alt+Delete',      // (cannot be blocked — see § 3.3)
  'Ctrl+Shift+Escape',    // Task Manager

  // === BROWSER / CHROMIUM ===
  'F11',                  // Toggle fullscreen
  'Escape',               // Exit fullscreen — THE KEY ONE
  'F12',                  // DevTools
  'Ctrl+Shift+I',         // DevTools
  'Ctrl+Shift+J',         // Console
  'Ctrl+U',               // View source
  'Ctrl+L',               // Address bar
  'Ctrl+T',               // New tab
  'Ctrl+N',               // New window
  'Ctrl+W',               // Close tab
  'Ctrl+Shift+T',         // Reopen tab
  'Ctrl+Tab',             // Switch tab
  'Ctrl+R',               // Reload (optional: allow for reconnect)
  'Ctrl+Shift+R',         // Hard reload
  'Ctrl+P',               // Print
  'Ctrl+S',               // Save page
  'Ctrl+F5',              // Hard reload
  'Ctrl+H',               // History
  'Ctrl+J',               // Downloads
];

function registerBlockedShortcuts(): void {
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

// Also block at the renderer level via before-input-event
win.webContents.on('before-input-event', (event, input) => {
  // Block F-keys (except F5 if allowing refresh)
  if (input.key.startsWith('F') && input.key !== 'F5') {
    event.preventDefault();
  }

  // Block Ctrl+Shift+anything (DevTools shortcuts)
  if (input.control && input.shift) {
    event.preventDefault();
  }

  // Block Alt+anything (OS shortcuts)
  if (input.alt && input.key !== 'Alt') {
    event.preventDefault();
  }
});
```

### 3.2 — Escape Key Handling

The Escape key is the primary concern. In Electron kiosk mode, Escape does **not** exit fullscreen (unlike a regular browser). However, we add defense in depth:

```typescript
// Three layers of Escape blocking:

// Layer 1: globalShortcut (catches it before Chromium)
globalShortcut.register('Escape', () => { /* swallow */ });

// Layer 2: before-input-event (catches it in the renderer pipeline)
win.webContents.on('before-input-event', (event, input) => {
  if (input.key === 'Escape') {
    event.preventDefault();
  }
});

// Layer 3: DOM-level (in preload, as final fallback)
// window.addEventListener('keydown', (e) => {
//   if (e.key === 'Escape') e.preventDefault();
// });
```

### 3.3 — Ctrl+Alt+Delete (Cannot Be Blocked)

Windows reserves Ctrl+Alt+Delete at the kernel level. No application can intercept it. Mitigation strategies:

**Strategy A: Process Watcher (recommended)**
A background interval checks if Task Manager or other dangerous processes are running. If detected, log the event to the server and bring the kiosk window back to focus.

```typescript
// process-watcher.ts
const DANGEROUS_PROCESSES = [
  'taskmgr.exe',          // Task Manager
  'cmd.exe',              // Command Prompt
  'powershell.exe',       // PowerShell
  'explorer.exe',         // File Explorer (if not the shell)
  'regedit.exe',          // Registry Editor
  'msconfig.exe',         // System Config
];

// Every 2 seconds, check for dangerous processes
setInterval(async () => {
  const processes = await getRunningProcesses();  // uses 'tasklist' command
  const violations = processes.filter(p =>
    DANGEROUS_PROCESSES.includes(p.toLowerCase())
  );

  if (violations.length > 0) {
    // Log to server via IPC → SignalR
    ipcMain.emit('security-violation', {
      type: 'DangerousProcess',
      processes: violations,
      timestamp: new Date().toISOString(),
    });

    // Force focus back to kiosk
    win.focus();
    win.moveTop();
  }
}, 2000);
```

**Strategy B: Windows Group Policy (classroom setup)**
On lab machines, disable Task Manager via Group Policy before the exam:
```
Computer Configuration → Administrative Templates →
  System → Ctrl+Alt+Del Options → Remove Task Manager = Enabled
```

**Strategy C: Accept and log**
If the student opens Task Manager and kills the app, the server already has their last code snapshot (auto-saved every 30 seconds). The teacher sees a `Disconnected` event on the dashboard. The student gains nothing — their code is already saved.

---

## 4. Multi-Monitor Detection & Enforcement

### 4.1 — Pre-Exam Display Check

Before the student can enter a session, the app checks for multiple monitors. If more than one display is detected, the student is blocked.

```typescript
// display-monitor.ts
import { screen } from 'electron';

interface DisplayCheckResult {
  allowed: boolean;
  displayCount: number;
  displays: Electron.Display[];
  message: string;
}

function checkDisplays(): DisplayCheckResult {
  const displays = screen.getAllDisplays();

  if (displays.length > 1) {
    return {
      allowed: false,
      displayCount: displays.length,
      displays,
      message: `Multiple monitors detected (${displays.length}). `
             + 'Please disconnect all extra monitors before starting the exam. '
             + 'Only one monitor is allowed.',
    };
  }

  return {
    allowed: true,
    displayCount: 1,
    displays,
    message: 'Display check passed.',
  };
}
```

### 4.2 — Continuous Monitoring

Monitors can be connected after the exam starts. The app watches for display changes throughout the session.

```typescript
// display-monitor.ts (continued)

function startDisplayWatcher(win: BrowserWindow): void {
  // Electron fires 'display-added' when a new monitor connects
  screen.on('display-added', (event, newDisplay) => {
    handleDisplayViolation(win, 'MonitorConnected', newDisplay);
  });

  // Also poll every 5 seconds as a safety net
  // (some display connections don't fire events reliably)
  setInterval(() => {
    const displays = screen.getAllDisplays();
    if (displays.length > 1) {
      handleDisplayViolation(win, 'MultipleMonitors', displays[1]);
    }
  }, 5000);
}

function handleDisplayViolation(
  win: BrowserWindow,
  type: string,
  display: Electron.Display
): void {
  // 1. Log to server
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
  const checkInterval = setInterval(() => {
    if (screen.getAllDisplays().length === 1) {
      clearInterval(checkInterval);
      win.webContents.send('hide-monitor-warning');
    }
  }, 2000);
}
```

### 4.3 — Blocking Overlay (Renderer Side)

When multiple monitors are detected, the Angular app shows a full-screen blocking overlay that cannot be dismissed. The student cannot interact with the editor until the extra monitor is disconnected.

```
┌─────────────────────────────────────────────────┐
│                                                   │
│                    ⚠  WARNING                    │
│                                                   │
│     An additional monitor has been detected.      │
│                                                   │
│     Please disconnect all extra monitors          │
│     to continue your exam.                        │
│                                                   │
│     This event has been logged and reported        │
│     to your instructor.                           │
│                                                   │
│     Monitors detected: 2                          │
│                                                   │
│           [ Waiting for single monitor... ]        │
│                                                   │
└─────────────────────────────────────────────────┘
```

---

## 5. Pre-Exam Check Screen

Before the student joins a session, a checklist screen validates the environment. All checks must pass before the "Join Session" button becomes active.

### 5.1 — Check Sequence

```
┌─────────────────────────────────────────────────┐
│                                                   │
│              CodeFest — Exam Ready?               │
│                                                   │
│   ✅  Single monitor detected                     │
│   ✅  Kiosk mode active                           │
│   ✅  Keyboard lockdown active                    │
│   ✅  Server connection established               │
│   ⏳  Waiting for session code...                 │
│                                                   │
│   ┌───────────────────────────────────────────┐   │
│   │  Session Code: [______]                   │   │
│   │  Your Name:    [______]                   │   │
│   │                                           │   │
│   │         [ Join Session ]  (disabled)      │   │
│   └───────────────────────────────────────────┘   │
│                                                   │
└─────────────────────────────────────────────────┘
```

### 5.2 — Checks Performed

| # | Check | Method | Failure Action |
|---|-------|--------|----------------|
| 1 | Single monitor | `screen.getAllDisplays().length === 1` | Block with message |
| 2 | Kiosk mode active | `win.isKiosk()` | Auto-retry, block if fails |
| 3 | Keyboard lockdown | Verify globalShortcuts registered | Auto-retry |
| 4 | Server reachable | HTTP GET to `/api/health` | Retry every 5s, show connection status |
| 5 | Session code valid | POST to `/api/sessions/validate` | Show "invalid code" message |

---

## 6. IPC Bridge (Main ↔ Renderer)

### 6.1 — Preload Script

The preload script exposes a minimal, safe API to the Angular renderer. No Node.js access, no Electron APIs directly.

```typescript
// preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('codefestKiosk', {
  // === DISPLAY ===
  getDisplayCount: () => ipcRenderer.invoke('get-display-count'),
  onMonitorWarning: (cb: (show: boolean) => void) => {
    ipcRenderer.on('show-monitor-warning', () => cb(true));
    ipcRenderer.on('hide-monitor-warning', () => cb(false));
  },

  // === EXIT ===
  requestExit: () => ipcRenderer.invoke('request-exit'),
  confirmExit: () => ipcRenderer.invoke('confirm-exit'),
  cancelExit: () => ipcRenderer.invoke('cancel-exit'),

  // === SECURITY EVENTS ===
  onSecurityViolation: (cb: (data: any) => void) => {
    ipcRenderer.on('security-violation', (_event, data) => cb(data));
  },

  // === SESSION ===
  reportClientType: () => 'electron-windows',
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // === ENVIRONMENT CHECKS ===
  runPreExamChecks: () => ipcRenderer.invoke('run-pre-exam-checks'),
});
```

### 6.2 — Angular Integration

The Angular `KioskService` detects whether it's running inside Electron and uses the IPC bridge instead of browser Fullscreen API.

```typescript
// Angular: kiosk.service.ts
@Injectable({ providedIn: 'root' })
export class KioskService {
  private isElectron = !!(window as any).codefestKiosk;
  private kiosk = (window as any).codefestKiosk;

  getClientType(): 'electron-windows' | 'electron-android' | 'web' {
    if (this.isElectron) return this.kiosk.reportClientType();
    return 'web';
  }

  async runPreExamChecks(): Promise<CheckResult[]> {
    if (this.isElectron) {
      return this.kiosk.runPreExamChecks();
    }
    // Browser fallback — soft checks only
    return this.runBrowserChecks();
  }

  onMonitorWarning(callback: (show: boolean) => void): void {
    if (this.isElectron) {
      this.kiosk.onMonitorWarning(callback);
    }
  }

  async requestExit(): Promise<void> {
    if (this.isElectron) {
      return this.kiosk.requestExit();
    }
    // Browser: just show warning
  }
}
```

---

## 7. Exit Exam Flow

The student can only leave through the in-app **Exit Exam** button. This is a deliberate, multi-step process that ensures no work is lost.

### 7.1 — Exit Sequence

```
Student clicks "Exit Exam" button
        │
        ▼
┌──────────────────────────────────────┐
│         Are you sure?                │
│                                      │
│  Your current code will be submitted │
│  for all challenges. You cannot      │
│  re-enter the exam after leaving.    │
│                                      │
│  Time remaining: 23:45               │
│                                      │
│    [ Cancel ]    [ Submit & Exit ]   │
└──────────────────────────────────────┘
        │
        ▼ (student confirms)
    1. Disable editor (read-only)
    2. Show "Submitting your work..." spinner
    3. For each challenge (current + any incomplete):
       → POST current code as forced submission
       → Wait for server acknowledgment
    4. Send SignalR: LogActivity(type: 'StudentExited')
    5. Disconnect SignalR cleanly
    6. Unregister all global shortcuts
    7. Set win.closable = true
    8. app.quit()
```

### 7.2 — Exit Manager Implementation

```typescript
// exit-manager.ts
async function handleExitRequest(win: BrowserWindow): Promise<void> {
  // Tell renderer to show confirmation dialog
  win.webContents.send('show-exit-confirmation');
}

async function handleExitConfirm(win: BrowserWindow): Promise<void> {
  // Tell renderer to submit all work
  win.webContents.send('submit-all-and-exit');

  // Wait for renderer to confirm submission complete (max 30s timeout)
  const submitted = await waitForSubmissionComplete(30000);

  if (!submitted) {
    // Timeout — force exit anyway (server has 30s snapshots)
    console.warn('Submission timeout — force exiting');
  }

  // Cleanup
  globalShortcut.unregisterAll();
  win.closable = true;
  win.close();
  app.quit();
}
```

### 7.3 — Session End by Teacher

When the teacher ends the session from the dashboard, the Electron app receives a SignalR `SessionEnded` event. The app:

1. Shows the final leaderboard and celebration screen (confetti, scores).
2. Replaces the editor with a read-only "Exam Complete" view.
3. Shows an **"Exit"** button that closes the app cleanly (no confirmation needed — session is already over).

---

## 8. Security Events Logged to Server

Every security-relevant event is sent to the server via SignalR `LogActivity` and stored in the `ActivityLog` table. The teacher sees these in real-time on the dashboard.

| Event | ActivityType | Data (JSON) |
|-------|-------------|-------------|
| App launched | `KioskStarted` | `{ clientType: "electron-windows", version: "1.0.0", os: "win32" }` |
| Pre-exam checks passed | `PreExamChecksPassed` | `{ displayCount: 1, checks: [...] }` |
| Extra monitor connected | `MonitorConnected` | `{ displayCount: 2, addedDisplay: {...} }` |
| Extra monitor removed | `MonitorDisconnected` | `{ displayCount: 1 }` |
| Dangerous process detected | `DangerousProcess` | `{ processes: ["taskmgr.exe"] }` |
| Focus lost (Alt+Tab attempt) | `FocusLost` | `{ duration: 0 }` |
| Focus regained | `FocusRegained` | `{ awayDurationMs: 1200 }` |
| Student exited via button | `StudentExited` | `{ allSubmitted: true, remainingTime: 1425 }` |
| App crashed / killed | `Disconnected` | (automatic — SignalR detects connection drop) |

---

## 9. Focus Recovery

If the student somehow manages to switch away from the app (e.g., via Ctrl+Alt+Delete → Task Manager), the app fights to regain focus.

```typescript
// kiosk-enforcer.ts
win.on('blur', () => {
  // Log the blur event
  win.webContents.send('security-violation', {
    type: 'FocusLost',
    timestamp: new Date().toISOString(),
  });

  // Aggressively reclaim focus
  setTimeout(() => {
    win.focus();
    win.moveTop();
    if (!win.isKiosk()) {
      win.setKiosk(true);
    }
  }, 500);

  // Retry every second for 10 seconds
  let retries = 0;
  const focusInterval = setInterval(() => {
    if (win.isFocused() || retries > 10) {
      clearInterval(focusInterval);
      if (win.isFocused()) {
        win.webContents.send('security-violation', {
          type: 'FocusRegained',
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
```

---

## 10. Auto-Save & Crash Recovery

### 10.1 — Auto-Save (Every 30 Seconds)

The Angular app already sends `CodeChanged` snapshots every 30 seconds via SignalR. In Electron, we add an additional safety layer:

```typescript
// In the renderer (Angular ActivityTrackerService):
// Every 30 seconds, the current code for each challenge is sent via:
//   SignalR → LogActivity(type: 'CodeChanged', data: { challengeId, code })
//
// This is identical to the web version.
// No change needed — the existing Angular service handles this.
```

### 10.2 — Crash Recovery

If the Electron app crashes or is force-killed:

1. The server detects SignalR disconnection → logs `Disconnected`.
2. The teacher sees the student go offline on the dashboard.
3. When the student relaunches the app and re-joins with the same name + session code:
   - Server recognizes them (same `DisplayName` + `SessionId`).
   - Sends back their last `CodeChanged` snapshot for each challenge.
   - Restores their challenge progress (`CurrentChallengeIndex`).
   - Logs `Reconnected` event.
4. The student continues where they left off. Time continues from where it was (server-tracked).

---

## 11. Configuration

### 11.1 — Runtime Config

The app reads configuration from a JSON file next to the executable, allowing teachers to pre-configure it per classroom without rebuilding.

```json
// codefest-config.json (next to .exe)
{
  "serverUrl": "https://codefest.example.com",
  "allowedOrigins": [
    "https://codefest.example.com",
    "http://192.168.1.100:4200"
  ],
  "kioskSettings": {
    "blockProcesses": true,
    "processCheckIntervalMs": 2000,
    "displayCheckIntervalMs": 5000,
    "autoSaveIntervalMs": 30000,
    "exitRequiresConfirmation": true
  }
}
```

### 11.2 — Command-Line Arguments

For quick overrides during setup:

```bash
# Connect to local dev server
codefest.exe --server-url=http://localhost:4200

# Disable process watcher (for testing only)
codefest.exe --no-process-watch

# Pre-fill session code (for batch deployment)
codefest.exe --session-code=ABC123
```

---

## 12. Build & Distribution

### 12.1 — Build Configuration

```yaml
# electron-builder.yml
appId: com.codefest.exam
productName: CodeFest Exam
win:
  target:
    - target: nsis
      arch: [x64]
  icon: assets/icon.ico
  requestedExecutionLevel: asInvoker    # No admin rights needed
nsis:
  oneClick: true                         # Simple install for students
  perMachine: false                      # Per-user install (no admin)
  allowToChangeInstallationDirectory: false
  deleteAppDataOnUninstall: true
```

### 12.2 — Build Commands

```bash
# Install dependencies
cd codefest-electron
npm install

# Development (with Angular dev server)
npm run dev    # → electron . --server-url=http://localhost:4200

# Production build
npm run build  # → electron-builder --win

# Output:
# dist/CodeFest Exam Setup 1.0.0.exe    (~80MB)
```

### 12.3 — Distribution Options

| Method | How |
|--------|-----|
| USB drive | Copy `.exe` installer to each machine |
| Network share | `\\server\codefest\setup.exe` |
| Web download | Host on CodeFest server: `https://codefest.example.com/download/windows` |
| Pre-installed | Install on lab machines before exam day |

---

## 13. Exam Day Checklist (for Teachers)

### Before the exam

- [ ] Install `CodeFest Exam.exe` on all student machines
- [ ] Place `codefest-config.json` next to the `.exe` with correct `serverUrl`
- [ ] Verify server is running: `curl https://codefest.example.com/api/health`
- [ ] Create a session in the teacher dashboard, note the join code
- [ ] Test from one student machine: launch app → enter code → verify connection
- [ ] (Optional) Disable Task Manager via Group Policy on lab machines
- [ ] Write session code on the board

### During the exam

- [ ] Students launch the app → pre-exam checks run automatically
- [ ] Students enter session code + name → join the session
- [ ] Monitor the teacher dashboard for red flags (process violations, monitor events)
- [ ] All code is auto-saved every 30 seconds — no work can be lost

### After the exam

- [ ] End session from dashboard → all students see final leaderboard
- [ ] Students click "Exit" to close the app
- [ ] Export activity logs from dashboard
- [ ] (Optional) Uninstall from lab machines

---

## 14. Limitations & Known Constraints

| Constraint | Impact | Mitigation |
|-----------|--------|------------|
| Ctrl+Alt+Delete cannot be blocked | Student can open Task Manager | Process watcher detects + logs it; Group Policy can disable Task Manager on lab machines |
| Windows key may not block on all keyboards | Brief Start menu flash | Focus recovery reclaims the window within 500ms |
| Force power-off | Student loses unsaved work since last 30s snapshot | Server has snapshots; teacher sees disconnect |
| Running as non-admin | Cannot disable OS features system-wide | Sufficient for exam integrity — all violations are logged and visible to teacher |
| Screen capture tools (Snipping Tool, etc.) | Student could screenshot questions | Process watcher blocks `snippingtool.exe`, `sharex.exe`; logged if detected |

---

## 15. Security Model Summary

```
LAYER 1 — ELECTRON KIOSK
  ✓ No title bar, no close button, no taskbar icon
  ✓ Escape key blocked at 3 levels (global, renderer, DOM)
  ✓ All browser shortcuts blocked (F12, Ctrl+T, Ctrl+W, etc.)
  ✓ No DevTools, no view-source, no navigation

LAYER 2 — DISPLAY ENFORCEMENT
  ✓ Pre-exam check: must have exactly 1 monitor
  ✓ Continuous monitoring: blocks UI if 2nd monitor connected mid-exam
  ✓ All display events logged to server

LAYER 3 — PROCESS MONITORING
  ✓ Task Manager, CMD, PowerShell detected and logged
  ✓ Focus recovery fights to reclaim the window
  ✓ (Optional) Group Policy disables Task Manager entirely

LAYER 4 — DATA SAFETY
  ✓ Code auto-saved every 30 seconds via SignalR
  ✓ Crash recovery restores progress on reconnect
  ✓ Exit button forces submission before closing
  ✓ Teacher can see all code snapshots in real-time

LAYER 5 — AUDIT TRAIL
  ✓ Every security event logged with timestamp
  ✓ Teacher sees violations in real-time on dashboard
  ✓ Full activity log exportable after session
```
