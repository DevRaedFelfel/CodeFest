# CodeFest — Android Kiosk App Specification

## Student-Only Secure Exam Client for Android

---

## Overview

A native Android shell (Capacitor + custom plugins) that loads the CodeFest Angular web app inside a fully locked-down kiosk. The student cannot exit the app, access notifications, switch apps, or use the home button. The only way out is the in-app **Exit Exam** button, which submits all work to the server before releasing the device.

This app contains **zero teacher features**. It is a single-purpose exam client.

### Tech Stack

| Layer | Technology |
|-------|------------|
| Shell | Capacitor 5+ (WebView-based) |
| Native Plugins | Custom Java/Kotlin Capacitor plugins |
| Content | CodeFest Angular app (bundled in APK) |
| Lock Mechanism | Android Lock Task Mode (Device Owner) |
| Target OS | Android 9+ (API 28+) |
| Build | Gradle → APK / AAB |
| Distribution | Sideload via ADB, local HTTP, or MDM |

### Architecture

```
┌─────────────────────────────────────────────┐
│           Android Device                     │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │        CodeFest Kiosk App              │  │
│  │                                        │  │
│  │   ┌──────────────────────────────┐     │  │
│  │   │  Capacitor WebView           │     │  │
│  │   │                              │     │  │
│  │   │  Angular App (bundled)       │     │  │
│  │   │  ├── CodeMirror Editor       │     │  │
│  │   │  ├── Challenge Panel         │     │  │
│  │   │  ├── Terminal Panel          │     │  │
│  │   │  └── Timer + Leaderboard     │     │  │
│  │   │                              │     │  │
│  │   └──────────────────────────────┘     │  │
│  │                                        │  │
│  │   Native Plugins:                      │  │
│  │   ├── LockTaskPlugin.java              │  │
│  │   ├── DisplayPlugin.java               │  │
│  │   ├── DeviceAdminReceiver.java         │  │
│  │   └── SecurityPlugin.java              │  │
│  │                                        │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  System Level:                               │
│  ├── Device Owner (DPC) registration         │
│  ├── Lock Task Mode (pinned app)             │
│  └── Disabled: Home, Recents, Status Bar     │
└─────────────────────────────────────────────┘
         │
         │  SignalR WebSocket
         ▼
   CodeFest Server (.NET 8 API)
```

---

## 1. Project Structure

```
codefest-client/
├── android/
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── java/com/codefest/app/
│   │   │   │   ├── MainActivity.java           # Capacitor activity + lock task
│   │   │   │   ├── DeviceAdminReceiver.java    # Device Owner receiver
│   │   │   │   ├── plugins/
│   │   │   │   │   ├── LockTaskPlugin.java     # Start/stop lock task mode
│   │   │   │   │   ├── DisplayPlugin.java      # Screen detection + casting block
│   │   │   │   │   ├── SecurityPlugin.java     # Security event reporting
│   │   │   │   │   └── ExitPlugin.java         # Graceful exit with submission
│   │   │   │   └── services/
│   │   │   │       ├── KioskService.java        # Background kiosk enforcement
│   │   │   │       └── ScreenCaptureBlocker.java # Block screenshots + recording
│   │   │   ├── res/
│   │   │   │   ├── xml/
│   │   │   │   │   └── device_admin.xml         # Device admin policies
│   │   │   │   └── values/
│   │   │   │       └── strings.xml
│   │   │   └── AndroidManifest.xml
│   │   └── build.gradle
│   ├── build.gradle
│   └── settings.gradle
├── src/                                         # Angular source (shared with web)
├── capacitor.config.ts
└── package.json
```

---

## 2. Android Lock Task Mode

Android provides two levels of app pinning. This spec requires **Level 2 (Device Owner)** for true exam lockdown.

### 2.1 — Level 1: Screen Pinning (Not Sufficient for Exams)

- Uses `Activity.startLockTask()` with user confirmation prompt.
- Student taps "OK" on a system dialog to pin the app.
- Student can unpin by long-pressing Back + Overview simultaneously.
- **Verdict: NOT secure.** Only useful for casual classroom use where trust is acceptable.

### 2.2 — Level 2: Device Owner Lock Task (Required for Exams)

- The app is registered as a **Device Owner** (Device Policy Controller / DPC).
- `startLockTask()` activates **without** user confirmation.
- The student literally cannot exit. Home, Recents, Back, Status Bar — all disabled by the OS.
- Only the app itself can call `stopLockTask()`, gated behind a teacher PIN or server command.
- This is how commercial kiosk apps and enterprise MDM solutions work.

### 2.3 — Device Owner Registration

Device Owner must be set via ADB. This is a **one-time setup per device**, done before the exam.

```bash
# PREREQUISITE: Remove all accounts from the device first
# Settings → Accounts → Remove all Google accounts
# (Device Owner registration fails if any account exists)

# Set CodeFest as Device Owner
adb shell dpm set-device-owner com.codefest.app/.DeviceAdminReceiver

# Verify registration
adb shell dpm list-owners
# Expected output:
# Device owner: ComponentInfo{com.codefest.app/com.codefest.app.DeviceAdminReceiver}

# To remove Device Owner later (after exam season):
adb shell dpm remove-active-admin com.codefest.app/.DeviceAdminReceiver
```

### 2.4 — DeviceAdminReceiver

```java
// DeviceAdminReceiver.java
public class DeviceAdminReceiver extends android.app.admin.DeviceAdminReceiver {

    @Override
    public void onEnabled(Context context, Intent intent) {
        // Device Owner is now active
        Log.i("CodeFest", "Device Owner enabled");
    }

    @Override
    public void onDisabled(Context context, Intent intent) {
        Log.i("CodeFest", "Device Owner disabled");
    }
}
```

### 2.5 — AndroidManifest.xml Declarations

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.codefest.app">

    <!-- Permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />

    <application
        android:name=".MainApplication"
        android:allowBackup="false"
        android:icon="@mipmap/ic_launcher"
        android:label="CodeFest Exam"
        android:theme="@style/AppTheme"
        android:usesCleartextTraffic="true">

        <!-- Main Activity -->
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTask"
            android:screenOrientation="portrait"
            android:configChanges="orientation|screenSize"
            android:lockTaskMode="if_whitelisted">

            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
                <!-- Also act as default HOME app in lock task mode -->
                <category android:name="android.intent.category.HOME" />
                <category android:name="android.intent.category.DEFAULT" />
            </intent-filter>
        </activity>

        <!-- Device Admin Receiver -->
        <receiver
            android:name=".DeviceAdminReceiver"
            android:exported="true"
            android:permission="android.permission.BIND_DEVICE_ADMIN">
            <meta-data
                android:name="android.app.device_admin"
                android:resource="@xml/device_admin" />
            <intent-filter>
                <action android:name="android.app.action.DEVICE_ADMIN_ENABLED" />
            </intent-filter>
        </receiver>

        <!-- Kiosk Enforcement Service -->
        <service
            android:name=".services.KioskService"
            android:foregroundServiceType="specialUse"
            android:exported="false" />

    </application>
</manifest>
```

### 2.6 — Device Admin Policy

```xml
<!-- res/xml/device_admin.xml -->
<device-admin xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-policies>
        <limit-password />
        <watch-login />
        <reset-password />
        <force-lock />
        <wipe-data />
    </uses-policies>
</device-admin>
```

---

## 3. MainActivity — Lock Task Activation

### 3.1 — Lock Task on Launch

The activity enters lock task mode as soon as it starts. In Device Owner mode, this requires no user confirmation.

```java
// MainActivity.java
public class MainActivity extends BridgeActivity {

    private DevicePolicyManager dpm;
    private ComponentName adminComponent;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Register Capacitor plugins BEFORE super.onCreate
        registerPlugin(LockTaskPlugin.class);
        registerPlugin(DisplayPlugin.class);
        registerPlugin(SecurityPlugin.class);
        registerPlugin(ExitPlugin.class);

        super.onCreate(savedInstanceState);

        dpm = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        adminComponent = new ComponentName(this, DeviceAdminReceiver.class);

        setupDeviceOwnerPolicies();
        enterLockTaskMode();
    }

    private void setupDeviceOwnerPolicies() {
        if (!dpm.isDeviceOwnerApp(getPackageName())) {
            // Not Device Owner — fall back to Level 1 (user-confirmed pinning)
            Log.w("CodeFest", "Not Device Owner. Kiosk will be soft-locked.");
            return;
        }

        // Whitelist this app for lock task mode (no user prompt)
        dpm.setLockTaskPackages(adminComponent,
            new String[]{ getPackageName() });

        // Configure which system features are available in lock task
        // LOCK_TASK_FEATURE_NONE = disable everything
        dpm.setLockTaskFeatures(adminComponent,
            DevicePolicyManager.LOCK_TASK_FEATURE_NONE);
            // This disables:
            //   - Home button (does nothing)
            //   - Recents/Overview button (does nothing)
            //   - Status bar pull-down (blocked)
            //   - Notifications (hidden)
            //   - Global actions (power menu shows only power off, no restart)
            //   - System info in lock task (hidden)

        // Block uninstallation of this app
        dpm.setUninstallBlocked(adminComponent, getPackageName(), true);

        // Disable status bar expansion
        dpm.setStatusBarDisabled(adminComponent, true);

        // Keep screen on during exam (prevent sleep)
        dpm.setGlobalSetting(adminComponent,
            Settings.Global.STAY_ON_WHILE_PLUGGED_IN, "7");
            // 7 = BatteryManager.BATTERY_PLUGGED_AC | USB | WIRELESS
    }

    private void enterLockTaskMode() {
        if (dpm.isDeviceOwnerApp(getPackageName())) {
            // Level 2: silent lock — no user prompt
            startLockTask();
            Log.i("CodeFest", "Lock Task Mode entered (Device Owner)");
        } else {
            // Level 1: will show system confirmation dialog
            startLockTask();
            Log.i("CodeFest", "Lock Task Mode entered (user-confirmed)");
        }
    }

    @Override
    public void onBackPressed() {
        // Block the back button entirely during exam
        // Do nothing — student cannot go back
    }

    @Override
    protected void onPause() {
        super.onPause();
        // In lock task mode, the OS prevents leaving anyway.
        // But as defense in depth, report the event if it fires.
        reportSecurityEvent("AppPaused");
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Ensure we're still in lock task mode
        ActivityManager am = (ActivityManager) getSystemService(ACTIVITY_SERVICE);
        if (am.getLockTaskModeState() == ActivityManager.LOCK_TASK_MODE_NONE) {
            enterLockTaskMode();
            reportSecurityEvent("LockTaskRestored");
        }
    }
}
```

### 3.2 — What Lock Task Mode Disables (OS-Enforced)

When the app is in lock task mode as Device Owner, the **Android OS itself** enforces these restrictions — the student cannot work around them:

| Button / Feature | Behavior in Lock Task |
|-----------------|----------------------|
| Home button | Does nothing (no response) |
| Recents / Overview | Does nothing (no response) |
| Back button | Handled by `onBackPressed()` → blocked |
| Status bar pull-down | Blocked — cannot expand |
| Notifications | Hidden — not displayed |
| Navigation bar | Can be hidden entirely |
| Power button (short press) | Screen off/on only (no menu) |
| Power button (long press) | Shows power off only (no restart, no safe mode) |
| Volume buttons | Still work (no security concern) |
| USB debugging | Blocked if USB debugging is disabled in settings |

---

## 4. Capacitor Plugins

### 4.1 — LockTaskPlugin

Exposes lock task control to the Angular app via Capacitor bridge.

```java
// plugins/LockTaskPlugin.java
@CapacitorPlugin(name = "LockTask")
public class LockTaskPlugin extends Plugin {

    @PluginMethod
    public void isDeviceOwner(PluginCall call) {
        DevicePolicyManager dpm = (DevicePolicyManager)
            getContext().getSystemService(Context.DEVICE_POLICY_SERVICE);
        boolean isOwner = dpm.isDeviceOwnerApp(getContext().getPackageName());

        JSObject ret = new JSObject();
        ret.put("isDeviceOwner", isOwner);
        call.resolve(ret);
    }

    @PluginMethod
    public void isInLockTaskMode(PluginCall call) {
        ActivityManager am = (ActivityManager)
            getContext().getSystemService(Context.ACTIVITY_SERVICE);
        int state = am.getLockTaskModeState();

        JSObject ret = new JSObject();
        ret.put("isLocked", state != ActivityManager.LOCK_TASK_MODE_NONE);
        ret.put("mode", state);
        // 0 = NONE, 1 = PINNED (Level 1), 2 = LOCKED (Level 2 / Device Owner)
        call.resolve(ret);
    }

    @PluginMethod
    public void stopLockTask(PluginCall call) {
        String pin = call.getString("pin", "");
        String serverToken = call.getString("serverToken", "");

        // Validate exit authorization
        if (!isExitAuthorized(pin, serverToken)) {
            call.reject("Invalid PIN or token. Cannot exit kiosk mode.");
            return;
        }

        getActivity().stopLockTask();

        JSObject ret = new JSObject();
        ret.put("stopped", true);
        call.resolve(ret);
    }

    private boolean isExitAuthorized(String pin, String serverToken) {
        // Option A: Teacher enters a PIN on the device
        // The PIN is set by the teacher in the server session config
        // and passed to the app during session join.
        if (pin != null && !pin.isEmpty()) {
            return validatePinWithServer(pin);
        }

        // Option B: Server sends an exit token when session ends
        if (serverToken != null && !serverToken.isEmpty()) {
            return validateTokenWithServer(serverToken);
        }

        return false;
    }
}
```

### 4.2 — TypeScript Interface (Angular Side)

```typescript
// In Angular: capacitor-plugins.d.ts

interface LockTaskPlugin {
  isDeviceOwner(): Promise<{ isDeviceOwner: boolean }>;
  isInLockTaskMode(): Promise<{ isLocked: boolean; mode: number }>;
  stopLockTask(options: { pin?: string; serverToken?: string }): Promise<{ stopped: boolean }>;
}

interface DisplayPlugin {
  getConnectedDisplays(): Promise<{ count: number; displays: DisplayInfo[] }>;
  isScreenMirroring(): Promise<{ isMirroring: boolean }>;
  onDisplayChanged(callback: (data: { count: number }) => void): void;
}

interface SecurityPlugin {
  blockScreenCapture(): Promise<void>;
  isRooted(): Promise<{ isRooted: boolean }>;
  reportEvent(options: { type: string; data: string }): Promise<void>;
  getDeviceInfo(): Promise<DeviceInfo>;
}

interface ExitPlugin {
  requestExit(): Promise<void>;
  confirmExit(options: { pin?: string; serverToken?: string }): Promise<void>;
}
```

### 4.3 — DisplayPlugin

Detects external displays, screen mirroring, and Chromecast connections.

```java
// plugins/DisplayPlugin.java
@CapacitorPlugin(name = "Display")
public class DisplayPlugin extends Plugin {

    private DisplayManager displayManager;

    @Override
    public void load() {
        displayManager = (DisplayManager)
            getContext().getSystemService(Context.DISPLAY_SERVICE);

        // Listen for display changes (monitor connected/disconnected)
        displayManager.registerDisplayListener(new DisplayManager.DisplayListener() {
            @Override
            public void onDisplayAdded(int displayId) {
                reportDisplayChange();
            }

            @Override
            public void onDisplayRemoved(int displayId) {
                reportDisplayChange();
            }

            @Override
            public void onDisplayChanged(int displayId) {
                reportDisplayChange();
            }
        }, null);
    }

    @PluginMethod
    public void getConnectedDisplays(PluginCall call) {
        Display[] displays = displayManager.getDisplays();

        JSObject ret = new JSObject();
        ret.put("count", displays.length);

        JSArray arr = new JSArray();
        for (Display d : displays) {
            JSObject info = new JSObject();
            info.put("id", d.getDisplayId());
            info.put("name", d.getName());
            info.put("isDefault", d.getDisplayId() == Display.DEFAULT_DISPLAY);
            info.put("width", d.getMode().getPhysicalWidth());
            info.put("height", d.getMode().getPhysicalHeight());
            arr.put(info);
        }
        ret.put("displays", arr);
        call.resolve(ret);
    }

    @PluginMethod
    public void isScreenMirroring(PluginCall call) {
        Display[] displays = displayManager.getDisplays(
            DisplayManager.DISPLAY_CATEGORY_PRESENTATION);

        JSObject ret = new JSObject();
        ret.put("isMirroring", displays.length > 0);
        ret.put("presentationDisplayCount", displays.length);
        call.resolve(ret);
    }

    private void reportDisplayChange() {
        Display[] displays = displayManager.getDisplays();
        JSObject data = new JSObject();
        data.put("count", displays.length);
        data.put("timestamp", System.currentTimeMillis());
        notifyListeners("displayChanged", data);
    }
}
```

### 4.4 — SecurityPlugin

Handles screenshot blocking, root detection, and device info.

```java
// plugins/SecurityPlugin.java
@CapacitorPlugin(name = "Security")
public class SecurityPlugin extends Plugin {

    @PluginMethod
    public void blockScreenCapture(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            // FLAG_SECURE prevents screenshots and screen recording
            // Also blocks the app from appearing in Recents screenshots
            getActivity().getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE
            );
        });

        JSObject ret = new JSObject();
        ret.put("blocked", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void isRooted(PluginCall call) {
        boolean rooted = checkRootIndicators();

        JSObject ret = new JSObject();
        ret.put("isRooted", rooted);
        call.resolve(ret);
    }

    @PluginMethod
    public void getDeviceInfo(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("manufacturer", Build.MANUFACTURER);
        ret.put("model", Build.MODEL);
        ret.put("androidVersion", Build.VERSION.RELEASE);
        ret.put("apiLevel", Build.VERSION.SDK_INT);
        ret.put("serialHash", getDeviceHash());
        call.resolve(ret);
    }

    private boolean checkRootIndicators() {
        // Check 1: su binary exists
        String[] paths = {
            "/system/bin/su", "/system/xbin/su",
            "/sbin/su", "/data/local/xbin/su",
            "/data/local/bin/su", "/data/local/su"
        };
        for (String path : paths) {
            if (new File(path).exists()) return true;
        }

        // Check 2: Build tags contain "test-keys"
        if (Build.TAGS != null && Build.TAGS.contains("test-keys")) return true;

        // Check 3: Known root management apps
        String[] rootApps = {
            "com.topjohnwu.magisk",
            "eu.chainfire.supersu",
            "com.koushikdutta.superuser"
        };
        PackageManager pm = getContext().getPackageManager();
        for (String pkg : rootApps) {
            try {
                pm.getPackageInfo(pkg, 0);
                return true;
            } catch (PackageManager.NameNotFoundException e) {
                // Not installed — continue
            }
        }

        return false;
    }

    private String getDeviceHash() {
        String raw = Build.MANUFACTURER + Build.MODEL + Build.SERIAL;
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(raw.getBytes());
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) hex.append(String.format("%02x", b));
            return hex.toString().substring(0, 16);
        } catch (Exception e) {
            return "unknown";
        }
    }
}
```

---

## 5. Multi-Display & Screen Mirroring Detection

### 5.1 — Pre-Exam Display Check

Before the student can enter a session, the app validates the display environment.

```
Checks performed:
  1. displayManager.getDisplays().length must be 1
     → Blocks if HDMI, USB-C, or MHL display connected
  2. displayManager.getDisplays(DISPLAY_CATEGORY_PRESENTATION).length must be 0
     → Blocks if Chromecast, Miracast, or wireless display active
  3. MediaRouter check for active casting routes
     → Catches smart TV mirroring
```

### 5.2 — Continuous Monitoring

The `DisplayPlugin` registers a `DisplayListener` that fires whenever a display is connected, disconnected, or changed. On violation:

1. The Angular app receives a `displayChanged` event.
2. A full-screen blocking overlay appears (identical to the Electron version).
3. The event is logged to the server via SignalR.
4. The overlay clears automatically when the extra display is disconnected.

### 5.3 — Blocking Overlay

```
┌─────────────────────────────────────────────────┐
│                                                   │
│                    ⚠  WARNING                    │
│                                                   │
│     An external display or screen mirroring       │
│     has been detected.                            │
│                                                   │
│     Please disconnect the external display        │
│     or stop screen mirroring to continue.         │
│                                                   │
│     This event has been reported to your           │
│     instructor.                                   │
│                                                   │
│           [ Waiting... ]                           │
│                                                   │
└─────────────────────────────────────────────────┘
```

---

## 6. Screenshot & Screen Recording Block

### 6.1 — FLAG_SECURE

The `WindowManager.LayoutParams.FLAG_SECURE` flag is set on app launch. This is an OS-level protection:

| Threat | FLAG_SECURE Effect |
|--------|-------------------|
| Screenshot (Power + Volume Down) | Captured image is black / blocked |
| Screen recording (built-in or third-party) | Recorded frames are black |
| Recents / Overview thumbnail | App thumbnail is blank |
| Chromecast / Miracast mirroring | Mirrored content is black |
| ADB screen capture (`adb shell screencap`) | Captured image is black |
| Third-party casting apps | Cast content is black |

**This is enforced by the Android OS and cannot be bypassed without root.**

### 6.2 — Root Detection Response

If the device is detected as rooted during the pre-exam check:

```
┌─────────────────────────────────────────────────┐
│                                                   │
│                  ⛔  BLOCKED                      │
│                                                   │
│     This device appears to be rooted.             │
│                                                   │
│     Rooted devices cannot be used for exams       │
│     because security protections can be           │
│     bypassed.                                     │
│                                                   │
│     Please use a different device or contact      │
│     your instructor.                              │
│                                                   │
│     Device: Samsung Galaxy A54                    │
│     Status: ROOT DETECTED                         │
│                                                   │
└─────────────────────────────────────────────────┘
```

---

## 7. Pre-Exam Check Screen

All checks must pass before the student can join a session. The screen shows a live checklist.

### 7.1 — Check Sequence

```
┌─────────────────────────────────────────────────┐
│                                                   │
│              CodeFest — Exam Ready?               │
│                                                   │
│   ✅  Device is not rooted                        │
│   ✅  Lock Task Mode active (Device Owner)        │
│   ✅  Screenshot blocking enabled                 │
│   ✅  Single display (no mirroring)               │
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

### 7.2 — Checks Performed

| # | Check | Method | Failure Action |
|---|-------|--------|----------------|
| 1 | Not rooted | `SecurityPlugin.isRooted()` | Block permanently — cannot proceed |
| 2 | Lock Task Mode | `LockTaskPlugin.isInLockTaskMode()` | Warn if Level 1 (soft lock); OK if Level 2 |
| 3 | Device Owner | `LockTaskPlugin.isDeviceOwner()` | Warn teacher that device is not fully secured |
| 4 | Screenshot block | `FLAG_SECURE` set | Auto-applied — always passes |
| 5 | Single display | `DisplayPlugin.getConnectedDisplays()` | Block with message until extra display removed |
| 6 | No mirroring | `DisplayPlugin.isScreenMirroring()` | Block with message until mirroring stopped |
| 7 | Server reachable | HTTP GET to `/api/health` | Retry every 5s, show connection status |
| 8 | Session code valid | POST to `/api/sessions/validate` | Show "invalid code" message |

### 7.3 — Security Level Indicator

The pre-exam screen shows the security level to the teacher can verify:

```
Security Level: ██████████ MAXIMUM (Device Owner + Lock Task)
  or
Security Level: ██████░░░░ MODERATE (Lock Task, no Device Owner)
  or
Security Level: ███░░░░░░░ LOW (Screen Pinning only — not recommended)
```

---

## 8. Exit Exam Flow

### 8.1 — Student-Initiated Exit

The only exit path for the student is the in-app **Exit Exam** button.

```
Student taps "Exit Exam" button
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
    1. Disable editor (read-only mode)
    2. Show "Submitting your work..." spinner
    3. For each challenge (current + any incomplete):
       → POST current code as forced submission
       → Wait for server acknowledgment
    4. Send SignalR: LogActivity(type: 'StudentExited')
    5. Disconnect SignalR cleanly
    6. Call LockTaskPlugin.stopLockTask({ serverToken })
       → Server provides a one-time exit token during submission
    7. Lock Task Mode ends
    8. Show "Exam Complete" screen with score summary
    9. Student can now press Home to leave
```

### 8.2 — Teacher-Initiated Session End

When the teacher ends the session from the dashboard:

1. SignalR `SessionEnded` event arrives with final scores and an exit token.
2. The app shows the celebration screen (confetti, leaderboard, scores).
3. An **"Exit"** button appears. Tapping it calls `stopLockTask()` with the server-provided exit token.
4. Lock Task Mode ends. The student can leave the app normally.

### 8.3 — Teacher PIN Exit (Emergency)

If the server is unreachable (network failure), the teacher can physically unlock a device:

1. Teacher taps a hidden area (e.g., triple-tap the app logo on the pre-exam screen).
2. A PIN entry dialog appears.
3. Teacher enters the session PIN (configured when creating the session).
4. `stopLockTask({ pin })` validates against the locally cached PIN.
5. Lock Task Mode ends.

**The PIN is set by the teacher in the server session config and cached in the app when the student joins.**

---

## 9. Security Events Logged to Server

Every security event is sent to the server via SignalR `LogActivity`.

| Event | ActivityType | Data (JSON) |
|-------|-------------|-------------|
| App launched | `KioskStarted` | `{ clientType: "android", version: "1.0.0", device: "Samsung A54", apiLevel: 33, securityLevel: "MAXIMUM" }` |
| Pre-exam checks passed | `PreExamChecksPassed` | `{ isDeviceOwner: true, isRooted: false, displayCount: 1 }` |
| Lock Task entered | `LockTaskEntered` | `{ mode: 2 }` (2 = Device Owner) |
| External display connected | `MonitorConnected` | `{ displayCount: 2, displayName: "HDMI Display" }` |
| Screen mirroring detected | `ScreenMirroring` | `{ type: "chromecast", displayName: "Living Room TV" }` |
| Root detected | `RootDetected` | `{ indicators: ["su_binary", "magisk"] }` |
| Student exited via button | `StudentExited` | `{ allSubmitted: true, remainingTime: 1425 }` |
| App paused (should not happen) | `AppPaused` | `{ timestamp }` |
| Lock Task restored | `LockTaskRestored` | `{ timestamp }` |
| App crashed / killed | `Disconnected` | (automatic — SignalR detects connection drop) |

---

## 10. Auto-Save & Crash Recovery

### 10.1 — Auto-Save (Every 30 Seconds)

Identical to the web version. The Angular `ActivityTrackerService` sends `CodeChanged` events via SignalR every 30 seconds with the current code for the active challenge.

### 10.2 — Crash Recovery

If the app crashes or the device reboots:

1. **Lock Task Mode persists across reboots** when set as Device Owner. The app auto-launches on boot because it is whitelisted as the lock task app.
2. On relaunch, the pre-exam check screen appears.
3. The student re-enters their name and session code.
4. The server recognizes the returning student (same `DisplayName` + `SessionId`).
5. The server sends back the last code snapshot and challenge progress.
6. The student continues where they left off.

### 10.3 — Network Loss Handling

If the WebSocket disconnects during the exam:

1. The Angular app shows a "Reconnecting..." banner (not a blocking overlay — student can keep coding).
2. Code changes are queued locally in memory.
3. SignalR auto-reconnects (built-in retry with exponential backoff).
4. On reconnect, queued events are flushed to the server.
5. If disconnected for more than 60 seconds, a warning appears.
6. The student's code is safe — they can keep working offline.

---

## 11. Capacitor Configuration

```typescript
// capacitor.config.ts
const config: CapacitorConfig = {
  appId: 'com.codefest.app',
  appName: 'CodeFest Exam',
  webDir: 'dist/codefest-client/browser',
  server: {
    // Option A: Bundled (Angular compiled into APK)
    // No server config needed — loads from webDir

    // Option B: Remote (load from CodeFest server)
    // url: 'https://codefest.example.com',
    // cleartext: true,  // Allow HTTP for local classroom server
  },
  android: {
    allowMixedContent: true,     // Allow HTTP + HTTPS (classroom LAN)
    captureInput: true,           // Route all input through WebView
    webContentsDebuggingEnabled: false,  // No Chrome DevTools
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,      // Control splash manually after checks
    },
  },
};
```

---

## 12. Build & Distribution

### 12.1 — Build Commands

```bash
# === SETUP (one-time) ===
cd ~/codefest/codefest-client

# Add Capacitor (if not already)
npm install @capacitor/core @capacitor/cli
npx cap init "CodeFest Exam" "com.codefest.app" \
  --web-dir dist/codefest-client/browser

# Add Android platform
npm install @capacitor/android
npx cap add android

# === BUILD (each time) ===

# 1. Build Angular
npx ng build --configuration production

# 2. Sync to Android
npx cap sync android

# 3. Build APK
cd android
./gradlew assembleRelease

# APK location:
# android/app/build/outputs/apk/release/app-release.apk

# 4. (Optional) Build AAB for Play Store
./gradlew bundleRelease
```

### 12.2 — Distribution Options

| Method | Command / How | Best For |
|--------|--------------|----------|
| ADB install (USB) | `adb install app-release.apk` | Lab machines with USB access |
| ADB install (WiFi) | `adb connect <IP>:5555 && adb install app-release.apk` | Wireless deployment |
| Local HTTP server | `python3 -m http.server 8888` → students download APK | Student-owned devices on same WiFi |
| CodeFest server | Host at `https://codefest.example.com/download/android` | Any device with internet |
| MDM (enterprise) | Push via Google Workspace, Intune, etc. | School-managed devices |

### 12.3 — Device Setup Script

For classrooms with many devices, automate the Device Owner setup:

```bash
#!/bin/bash
# setup-device.sh — Run for each connected Android device

PACKAGE="com.codefest.app"
APK_PATH="./app-release.apk"
ADMIN_RECEIVER="$PACKAGE/.DeviceAdminReceiver"

echo "=== CodeFest Device Setup ==="

# Step 1: Install APK
echo "[1/3] Installing APK..."
adb install -r "$APK_PATH"

# Step 2: Set as Device Owner
echo "[2/3] Setting as Device Owner..."
adb shell dpm set-device-owner "$ADMIN_RECEIVER"

# Step 3: Verify
echo "[3/3] Verifying..."
adb shell dpm list-owners | grep -q "$PACKAGE"
if [ $? -eq 0 ]; then
    echo "✅ Device Owner set successfully!"
else
    echo "❌ Failed. Remove all accounts from the device first."
    echo "   Settings → Accounts → Remove all"
    exit 1
fi

echo "=== Setup complete. Device is exam-ready. ==="
```

---

## 13. Exam Day Checklist (for Teachers)

### Before the exam

- [ ] All devices have `CodeFest Exam` APK installed
- [ ] All devices are registered as Device Owner: `adb shell dpm list-owners`
- [ ] Verify server is running: `curl https://codefest.example.com/api/health`
- [ ] Create a session in the teacher dashboard, note the join code
- [ ] (Optional) Disable USB debugging on student devices
- [ ] Test from one device: launch app → pre-exam checks → enter code → verify
- [ ] Charge all devices or ensure they are plugged in
- [ ] Write session code on the board

### During the exam

- [ ] Students launch the app → pre-exam checks run automatically
- [ ] Students enter session code + name → join the session
- [ ] Monitor dashboard for red flags (display events, root warnings, disconnects)
- [ ] All code is auto-saved every 30 seconds — no work can be lost
- [ ] If a device freezes: the student's work is safe on the server

### After the exam

- [ ] End session from dashboard → all students see final scores
- [ ] Students tap "Exit" → Lock Task Mode ends → they can leave the app
- [ ] For devices that need manual unlock: use the teacher PIN
- [ ] Export activity logs from dashboard
- [ ] (Optional) Remove Device Owner: `adb shell dpm remove-active-admin com.codefest.app/.DeviceAdminReceiver`

---

## 14. Limitations & Known Constraints

| Constraint | Impact | Mitigation |
|-----------|--------|------------|
| Device Owner requires ADB setup | One-time per device — cannot be done remotely without MDM | Use the `setup-device.sh` script; batch setup before exam season |
| Accounts must be removed before DPC registration | Inconvenient if devices have student Google accounts | Use dedicated exam devices or remove accounts before setup |
| Rooted devices bypass FLAG_SECURE | Screenshots and screen recording work on rooted devices | Root detection blocks the exam entirely; logged to server |
| Device reboot during exam | Momentary interruption | Lock Task persists across reboots; app auto-restores; code is on server |
| Low battery during exam | Device shuts off | Auto-save ensures code is on server; charge devices beforehand |
| No keyboard on phone | Coding on a phone screen is painful | Recommend tablets (10"+) for coding exams; phones for short challenges only |
| WebView performance | Slower than native browser for heavy editors | CodeMirror 6 is lightweight; acceptable on devices from 2019+ |
| Without Device Owner (Level 1) | Student can unpin by holding Back + Overview | Show clear warning to teacher; log unpinning as security event |

---

## 15. Security Model Summary

```
LAYER 1 — ANDROID LOCK TASK (OS-ENFORCED)
  ✓ Home, Recents, Back buttons disabled by the OS
  ✓ Status bar pull-down blocked
  ✓ Notifications hidden
  ✓ Cannot switch to any other app
  ✓ Power menu shows only power off (no restart to safe mode)
  ✓ Persists across device reboots
  ✓ Only the app or ADB can unlock

LAYER 2 — DISPLAY ENFORCEMENT
  ✓ Pre-exam check: single display, no mirroring
  ✓ Continuous monitoring: blocks UI if display changes
  ✓ Chromecast / Miracast / HDMI all detected
  ✓ All events logged to server

LAYER 3 — SCREENSHOT & RECORDING BLOCK
  ✓ FLAG_SECURE set on window
  ✓ OS blocks screenshots, screen recording, casting content
  ✓ Recents thumbnail is blank
  ✓ ADB screencap returns black

LAYER 4 — ROOT DETECTION
  ✓ Checks for su binary, Magisk, SuperSU, test-keys
  ✓ Rooted devices blocked from starting exam
  ✓ Root status logged to server

LAYER 5 — DATA SAFETY
  ✓ Code auto-saved every 30 seconds via SignalR
  ✓ Crash recovery restores progress on reconnect
  ✓ Lock Task persists across reboots
  ✓ Exit button forces submission before unlocking
  ✓ Network loss: student keeps coding, events queue locally

LAYER 6 — AUDIT TRAIL
  ✓ Every security event logged with timestamp
  ✓ Teacher sees violations in real-time on dashboard
  ✓ Device info (model, OS, security level) recorded
  ✓ Full activity log exportable after session
```

---

## Appendix A: Security Level Comparison

| Feature | Web (Browser) | Android Level 1 | Android Level 2 (Device Owner) |
|---------|:------------:|:---------------:|:-----------------------------:|
| Fullscreen enforced | Soft (Escape exits) | Soft (can unpin) | **Hard (OS blocks exit)** |
| Home button blocked | ✗ | ✓ (pinned) | **✓ (disabled)** |
| Recents blocked | ✗ | ✓ (pinned) | **✓ (disabled)** |
| Status bar blocked | ✗ | ✗ | **✓ (disabled)** |
| Notifications hidden | ✗ | ✗ | **✓ (hidden)** |
| Screenshot blocked | ✗ | ✓ (FLAG_SECURE) | **✓ (FLAG_SECURE)** |
| Screen recording blocked | ✗ | ✓ (FLAG_SECURE) | **✓ (FLAG_SECURE)** |
| Multi-monitor detection | Partial (needs permission) | ✓ (native API) | **✓ (native API)** |
| Survives reboot | ✗ | ✗ | **✓ (auto-restarts)** |
| Teacher PIN to unlock | N/A | N/A | **✓** |
| Root detection | ✗ | ✓ | **✓** |
| Setup complexity | None | Low | Medium (ADB needed) |
