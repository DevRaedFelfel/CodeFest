# CodeFest — Electron Windows Kiosk App: Build & Deployment Guide

Build and deploy the CodeFest Electron kiosk exam client for Windows.

---

## Prerequisites

### Development Machine

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| npm | 9+ | Comes with Node.js |
| Angular CLI | 17+ | `npm install -g @angular/cli` |
| Git | Latest | [git-scm.com](https://git-scm.com) |
| Windows 10/11 (64-bit) | Required for building `.exe` | — |

> **Note:** You can develop on macOS/Linux, but building the Windows `.exe` installer requires a Windows machine or CI running Windows.

---

## Project Setup (One-Time)

### 1. Create the Electron Project

```bash
# From the CodeFest repo root
mkdir codefest-electron
cd codefest-electron
npm init -y
```

### 2. Install Dependencies

```bash
# Electron
npm install --save-dev electron electron-builder

# TypeScript (optional but recommended)
npm install --save-dev typescript
```

### 3. Project Structure

Create the following structure:

```
codefest-electron/
├── package.json
├── electron-builder.yml
├── tsconfig.json
├── src/
│   ├── main/
│   │   ├── main.ts               # Electron entry point
│   │   ├── kiosk-enforcer.ts     # Fullscreen + keyboard lockdown
│   │   ├── display-monitor.ts    # Multi-monitor detection
│   │   ├── process-watcher.ts    # Block Task Manager, etc.
│   │   ├── ipc-handlers.ts       # IPC channel definitions
│   │   ├── exit-manager.ts       # Graceful exit with submission
│   │   └── config.ts             # Server URL, exam settings
│   └── preload/
│       └── preload.ts            # Secure bridge (contextBridge)
├── assets/
│   ├── icon.ico                  # App icon (256x256)
│   └── splash.html               # Pre-exam check screen
└── scripts/
    └── build.sh                  # Build + package script
```

### 4. Configure package.json

```json
{
  "name": "codefest-exam",
  "version": "1.0.0",
  "description": "CodeFest Secure Exam Client for Windows",
  "main": "dist/main/main.js",
  "scripts": {
    "dev": "tsc && electron . --server-url=http://localhost:4200",
    "build": "tsc && electron-builder --win",
    "build:dir": "tsc && electron-builder --win --dir",
    "compile": "tsc",
    "start": "electron ."
  },
  "build": {
    "extends": "electron-builder.yml"
  },
  "devDependencies": {
    "electron": "^30.0.0",
    "electron-builder": "^24.0.0",
    "typescript": "^5.4.0"
  }
}
```

### 5. Configure electron-builder.yml

```yaml
appId: com.codefest.exam
productName: CodeFest Exam
directories:
  output: installer
win:
  target:
    - target: nsis
      arch: [x64]
  icon: assets/icon.ico
  requestedExecutionLevel: asInvoker
nsis:
  oneClick: true
  perMachine: false
  allowToChangeInstallationDirectory: false
  deleteAppDataOnUninstall: true
files:
  - dist/**/*
  - assets/**/*
  - "!src/**/*"
  - "!scripts/**/*"
```

### 6. Configure TypeScript

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
```

---

## Configuration

### Runtime Config File

The app reads `codefest-config.json` from the same directory as the `.exe`. This lets teachers configure each machine without rebuilding.

```json
{
  "serverUrl": "https://codefest.yourdomain.com",
  "allowedOrigins": [
    "https://codefest.yourdomain.com",
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

### Command-Line Overrides

For quick setup and testing:

```bash
# Connect to local dev server
codefest.exe --server-url=http://localhost:4200

# Disable process watcher (testing only)
codefest.exe --no-process-watch

# Pre-fill session code (batch deployment)
codefest.exe --session-code=ABC123
```

---

## Development Workflow

### Running in Dev Mode

Start the Angular dev server and Electron together:

**Terminal 1 — Angular:**
```bash
cd codefest-client
npx ng serve
# Runs on http://localhost:4200
```

**Terminal 2 — Electron:**
```bash
cd codefest-electron
npm run dev
# Launches Electron pointing to http://localhost:4200
```

### Running with Bundled Angular

To test the production-like experience (Angular built into the Electron app):

```bash
# 1. Build Angular
cd codefest-client
npx ng build --configuration production

# 2. Copy build output to Electron renderer directory
cp -r dist/codefest-client/browser ../codefest-electron/src/renderer/

# 3. Run Electron (loads from file:// instead of URL)
cd ../codefest-electron
npm run dev
```

---

## Build the Windows Installer

### Debug Build (Unpacked — Fast Iteration)

```bash
cd codefest-electron
npm run build:dir
```

**Output:** `installer/win-unpacked/CodeFest Exam.exe` (run directly, no install needed)

### Production Build (NSIS Installer)

```bash
cd codefest-electron

# 1. Compile TypeScript
npm run compile

# 2. Build the installer
npm run build
```

**Output:** `installer/CodeFest Exam Setup 1.0.0.exe` (~80 MB)

### Build with Bundled Angular

To create a self-contained installer that doesn't need a server for the UI:

```bash
# 1. Build Angular
cd codefest-client
npx ng build --configuration production

# 2. Copy to Electron
cp -r dist/codefest-client/browser ../codefest-electron/src/renderer/

# 3. Build installer
cd ../codefest-electron
npm run build
```

In this mode, the app loads the Angular UI from the local filesystem. The API/SignalR connection still goes to the remote server specified in `codefest-config.json`.

---

## Deployment Options

| Method | How | Best For |
|--------|-----|----------|
| **USB drive** | Copy `.exe` installer to each machine | No network required |
| **Network share** | `\\server\codefest\setup.exe` | Lab machines on same domain |
| **Web download** | Host on CodeFest server | Any machine with internet |
| **Pre-installed** | Install on lab machines before exam day | Permanent lab setups |
| **Group Policy / SCCM** | Push via Active Directory | Enterprise/school-managed PCs |

### Hosting the Installer on the CodeFest Server

Place the installer on your production server:

```bash
# On the server
mkdir -p ~/codefest/downloads
cp "CodeFest Exam Setup 1.0.0.exe" ~/codefest/downloads/
```

Add to nginx config:
```nginx
location /download/ {
    alias /home/user/codefest/downloads/;
    autoindex off;
}
```

Students download from `https://codefest.yourdomain.com/download/CodeFest%20Exam%20Setup%201.0.0.exe`

---

## Machine Setup

### Install the App

1. Copy the installer to the machine (USB, network share, or download).
2. Double-click `CodeFest Exam Setup 1.0.0.exe`.
3. The app installs per-user (no admin rights required).

### Place the Config File

Copy `codefest-config.json` next to the installed executable:

- Default install path: `C:\Users\<username>\AppData\Local\Programs\codefest-exam\`
- Place `codefest-config.json` in that directory.

### (Optional) Disable Task Manager via Group Policy

For maximum lockdown on lab machines, disable Task Manager before the exam:

1. Open **Group Policy Editor** (`gpedit.msc`) as administrator.
2. Navigate to: `Computer Configuration → Administrative Templates → System → Ctrl+Alt+Del Options`
3. Set **Remove Task Manager** to **Enabled**.

Or via registry:
```cmd
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v DisableTaskMgr /t REG_DWORD /d 1 /f
```

To re-enable after the exam:
```cmd
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v DisableTaskMgr /f
```

---

## Security Features

### Kiosk Window Lockdown

The Electron window is created with maximum lockdown:

- **Kiosk mode** — true fullscreen, no title bar, no taskbar icon
- **Always on top** — stays above all other windows
- **Not closable** — no close/minimize/maximize buttons
- **DevTools disabled** — F12 and Ctrl+Shift+I do nothing
- **No navigation** — cannot type URLs or navigate away
- **No popups** — `window.open()` and `target="_blank"` blocked
- **All permissions denied** — camera, mic, geolocation, notifications

### Keyboard Shortcuts Blocked

All OS and browser shortcuts that could allow escape are intercepted:

| Category | Shortcuts Blocked |
|----------|------------------|
| OS escape | Alt+Tab, Alt+F4, Alt+Escape, Win key, Win+D, Win+E, Win+R, Win+L, Win+Tab, Ctrl+Shift+Escape |
| Browser/Chromium | F11, F12, Escape, Ctrl+Shift+I, Ctrl+U, Ctrl+L, Ctrl+T, Ctrl+N, Ctrl+W, Ctrl+Tab, Ctrl+P, Ctrl+S, Ctrl+H, Ctrl+J |

### Process Monitoring

A background watcher detects and logs dangerous processes every 2 seconds:
- `taskmgr.exe` (Task Manager)
- `cmd.exe` (Command Prompt)
- `powershell.exe` (PowerShell)
- `regedit.exe` (Registry Editor)
- `snippingtool.exe` (Snipping Tool)

When detected: the event is logged to the server and the kiosk window reclaims focus.

### Multi-Monitor Detection

- **Pre-exam check:** blocks if more than one monitor is detected
- **Continuous monitoring:** blocks the UI if a second monitor is connected mid-exam
- **All events logged** to the server and visible on the teacher dashboard

### Focus Recovery

If the student manages to switch away (e.g., via Ctrl+Alt+Delete):
1. The blur event is logged to the server.
2. The app aggressively reclaims focus within 500ms.
3. Retries every second for 10 seconds.
4. Focus regained event is logged.

---

## Exam Day Checklist

### Before the Exam

- [ ] Install `CodeFest Exam Setup.exe` on all student machines
- [ ] Place `codefest-config.json` next to the `.exe` with correct `serverUrl`
- [ ] Verify server is running: `curl https://codefest.yourdomain.com/api/health`
- [ ] Create a session in the teacher dashboard — note the join code
- [ ] Test from one student machine: launch app → pre-exam checks → enter code → verify connection
- [ ] (Optional) Disable Task Manager via Group Policy on lab machines
- [ ] Write session code on the board

### During the Exam

- [ ] Students launch the app → pre-exam checks run automatically
- [ ] Students enter session code + name → join the session
- [ ] Monitor the teacher dashboard for red flags (process violations, monitor events, disconnects)
- [ ] All code is auto-saved every 30 seconds — no work can be lost

### After the Exam

- [ ] End session from dashboard → all students see final leaderboard
- [ ] Students click "Exit" to close the app
- [ ] Export activity logs from dashboard
- [ ] (Optional) Uninstall from lab machines
- [ ] (Optional) Re-enable Task Manager if disabled via Group Policy

---

## Updating the App

When the CodeFest codebase is updated:

```bash
cd codefest-electron

# 1. Pull latest code
git pull

# 2. Install any new dependencies
npm install

# 3. If bundling Angular, rebuild it first
cd ../codefest-client
npx ng build --configuration production
cp -r dist/codefest-client/browser ../codefest-electron/src/renderer/

# 4. Build the installer
cd ../codefest-electron
npm run build
```

Then redistribute the new installer to all machines.

---

## Limitations

| Constraint | Impact | Mitigation |
|-----------|--------|------------|
| Ctrl+Alt+Delete cannot be blocked | Student can open Task Manager | Process watcher detects + logs it; Group Policy can disable Task Manager |
| Windows key may flash Start menu briefly | Brief visual glitch | Focus recovery reclaims window within 500ms |
| Force power-off | Student loses work since last 30s snapshot | Server has snapshots; teacher sees disconnect |
| Running as non-admin | Cannot disable OS features system-wide | Sufficient for exam integrity — all violations are logged |
| Screen capture tools | Student could screenshot questions | Process watcher blocks `snippingtool.exe`, `sharex.exe`; logged if detected |
| ~80 MB installer size | Large download for slow networks | Pre-install on lab machines; use USB drive for distribution |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| App won't start | Check that `codefest-config.json` is in the same directory as the `.exe` |
| White screen | Verify `serverUrl` in config points to a running CodeFest server |
| "Cannot connect to server" | Ensure the server is running and accessible from the student machine |
| Build fails with `electron-builder` error | Run `npm install` again; verify Node.js 18+ |
| App doesn't block Alt+Tab | Some keyboard layouts/drivers interfere; rely on focus recovery |
| Task Manager appears | Process watcher will log it; consider Group Policy to disable |
| Multiple monitors not detected | Check Windows display settings; some virtual displays may not trigger Electron's `screen` API |
| Installer blocked by antivirus | Sign the `.exe` with a code signing certificate, or add an exception |

### Code Signing (Recommended for Distribution)

Unsigned `.exe` files trigger Windows SmartScreen warnings. For smooth deployment:

1. Obtain a code signing certificate (e.g., from DigiCert, Sectigo, or a free one from your organization).
2. Add to `electron-builder.yml`:

```yaml
win:
  certificateFile: path/to/certificate.pfx
  certificatePassword: your_password
```

3. Rebuild — the installer will be signed and trusted by Windows.
