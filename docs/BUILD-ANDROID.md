# CodeFest — Android Kiosk App: Build & Deployment Guide

Build and deploy the CodeFest Android kiosk exam client using Capacitor.

---

## Prerequisites

### Development Machine

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| npm | 9+ | Comes with Node.js |
| Angular CLI | 17+ | `npm install -g @angular/cli` |
| Java JDK | 17 | `sudo apt install openjdk-17-jdk` or [Adoptium](https://adoptium.net) |
| Android Studio | Latest | [developer.android.com/studio](https://developer.android.com/studio) |
| Android SDK | API 28+ (target 34) | Via Android Studio SDK Manager |
| ADB | Latest | Comes with Android SDK Platform Tools |

### Android Studio SDK Setup

Open Android Studio → Settings → SDK Manager → SDK Platforms:
- Check **Android 14 (API 34)** (or latest)
- Check **Android 9 (API 28)** (minimum target)

SDK Tools tab:
- **Android SDK Build-Tools** (latest)
- **Android SDK Command-line Tools**
- **Android SDK Platform-Tools**

Set environment variables (add to `~/.bashrc` or `~/.zshrc`):
```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
```

---

## Project Setup (One-Time)

### 1. Install Dependencies

```bash
cd codefest-client
npm install
```

### 2. Verify Capacitor Is Configured

The project already includes Capacitor and the Android platform. Verify:

```bash
npx cap ls
# Should show: android
```

If Android platform is missing:
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
```

### 3. Configure Server URL

Edit `capacitor.config.ts` to set the server URL for your environment:

```typescript
// For bundled mode (Angular built into APK):
// Leave server.url commented out — the app loads from webDir

// For remote mode (load from CodeFest server):
server: {
  url: 'https://codefest.yourdomain.com',
  // or for LAN: url: 'http://192.168.1.100:4200',
  androidScheme: 'https',
}
```

---

## Build the APK

### Debug Build (Development & Testing)

```bash
cd codefest-client

# 1. Build the Angular app
npx ng build --configuration production

# 2. Sync Angular build output to Android project
npx cap sync android

# 3. Build the debug APK
cd android
./gradlew assembleDebug
```

**APK location:** `android/app/build/outputs/apk/debug/app-debug.apk`

### Release Build (Production / Exam Day)

#### Generate a Signing Key (One-Time)

```bash
keytool -genkey -v \
  -keystore codefest-release.keystore \
  -alias codefest \
  -keyalg RSA -keysize 2048 \
  -validity 10000

# Store the keystore file securely — you need it for every release build
```

#### Configure Signing in Gradle

Create `android/keystore.properties` (do NOT commit this file):

```properties
storeFile=../codefest-release.keystore
storePassword=your_keystore_password
keyAlias=codefest
keyPassword=your_key_password
```

Add to `android/app/build.gradle` (inside `android {}` block):

```groovy
signingConfigs {
    release {
        def keystoreProps = new Properties()
        def keystoreFile = rootProject.file("keystore.properties")
        if (keystoreFile.exists()) {
            keystoreProps.load(new FileInputStream(keystoreFile))
            storeFile file(keystoreProps['storeFile'])
            storePassword keystoreProps['storePassword']
            keyAlias keystoreProps['keyAlias']
            keyPassword keystoreProps['keyPassword']
        }
    }
}

buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

#### Build the Release APK

```bash
cd codefest-client

# 1. Build Angular
npx ng build --configuration production

# 2. Sync to Android
npx cap sync android

# 3. Build signed release APK
cd android
./gradlew assembleRelease
```

**APK location:** `android/app/build/outputs/apk/release/app-release.apk`

#### Build AAB (For Play Store Distribution)

```bash
cd android
./gradlew bundleRelease
```

**AAB location:** `android/app/build/outputs/bundle/release/app-release.aab`

---

## Device Setup

### Enable Developer Options & USB Debugging

On the Android device:
1. **Settings → About Phone → tap "Build Number" 7 times** to enable Developer Options.
2. **Settings → Developer Options → Enable USB Debugging.**
3. Connect the device via USB and accept the debugging prompt.

Verify connection:
```bash
adb devices
# Should show your device listed
```

### Install the APK

```bash
# Install (or reinstall)
adb install -r app-release.apk
```

### Register as Device Owner (Required for Full Kiosk Lockdown)

**Important:** All Google accounts must be removed from the device first.

```bash
# 1. Remove all accounts from device
#    Settings → Accounts → Remove all Google accounts

# 2. Set CodeFest as Device Owner
adb shell dpm set-device-owner com.codefest.app/.DeviceAdminReceiver

# 3. Verify
adb shell dpm list-owners
# Expected: Device owner: ComponentInfo{com.codefest.app/com.codefest.app.DeviceAdminReceiver}
```

Without Device Owner registration, the app runs in "Level 1" mode (screen pinning with user confirmation). This is less secure — the student can unpin by long-pressing Back + Overview.

### Batch Device Setup Script

For classrooms with many devices, use this script per device:

```bash
#!/bin/bash
# setup-device.sh — Run for each connected Android device

PACKAGE="com.codefest.app"
APK_PATH="./app-release.apk"
ADMIN_RECEIVER="$PACKAGE/.DeviceAdminReceiver"

echo "=== CodeFest Device Setup ==="

echo "[1/3] Installing APK..."
adb install -r "$APK_PATH"

echo "[2/3] Setting as Device Owner..."
adb shell dpm set-device-owner "$ADMIN_RECEIVER"

echo "[3/3] Verifying..."
if adb shell dpm list-owners | grep -q "$PACKAGE"; then
    echo "Device Owner set successfully!"
else
    echo "Failed. Remove all accounts from the device first."
    echo "  Settings → Accounts → Remove all"
    exit 1
fi

echo "=== Setup complete. Device is exam-ready. ==="
```

---

## Deployment Options

| Method | How | Best For |
|--------|-----|----------|
| **ADB install (USB)** | `adb install -r app-release.apk` | Lab devices with USB access |
| **ADB install (WiFi)** | `adb connect <IP>:5555 && adb install -r app-release.apk` | Wireless deployment in classroom |
| **Local HTTP server** | `python3 -m http.server 8888` then students download APK | Student-owned devices on same WiFi |
| **CodeFest server** | Host APK at `https://codefest.example.com/download/android` | Any device with internet |
| **MDM (enterprise)** | Push via Google Workspace, Intune, etc. | School-managed devices |

### Hosting APK on the CodeFest Server

To serve the APK from your production server, place it in the nginx static files:

```bash
# On the production server
mkdir -p ~/codefest/downloads
cp app-release.apk ~/codefest/downloads/codefest-exam.apk
```

Add to your nginx config:
```nginx
location /download/ {
    alias /home/user/codefest/downloads/;
    autoindex off;
}
```

Students navigate to `https://codefest.yourdomain.com/download/codefest-exam.apk` on their phone.

---

## Security Levels

| Level | Setup | Security | Recommended For |
|-------|-------|----------|-----------------|
| **Level 1 — Screen Pinning** | Install APK only | Soft lock — student can unpin | Casual classwork, trusted environments |
| **Level 2 — Device Owner** | Install APK + `adb shell dpm set-device-owner` | Hard lock — OS blocks all exits | Exams, graded assessments |

### Security Features by Level

| Feature | Level 1 | Level 2 (Device Owner) |
|---------|:-------:|:---------------------:|
| Fullscreen enforced | Soft (can unpin) | Hard (OS blocks exit) |
| Home button blocked | Pinned only | Fully disabled |
| Status bar blocked | No | Yes |
| Notifications hidden | No | Yes |
| Screenshot blocked (FLAG_SECURE) | Yes | Yes |
| Screen recording blocked | Yes | Yes |
| Multi-display detection | Yes | Yes |
| Survives reboot | No | Yes |
| Teacher PIN to unlock | N/A | Yes |
| Root detection | Yes | Yes |

---

## Exam Day Checklist

### Before the Exam

- [ ] All devices have the CodeFest Exam APK installed
- [ ] All devices are registered as Device Owner: `adb shell dpm list-owners`
- [ ] Server is running: `curl https://codefest.yourdomain.com/api/health`
- [ ] Session created in teacher dashboard — note the join code
- [ ] (Optional) Disable USB debugging on student devices
- [ ] Test from one device: launch → pre-exam checks → enter code → verify connection
- [ ] Charge all devices or plug them in
- [ ] Write session code on the board

### During the Exam

- [ ] Students launch the app → pre-exam checks run automatically
- [ ] Students enter session code + name → join the session
- [ ] Monitor the dashboard for security events (display violations, root warnings, disconnects)
- [ ] Code auto-saves every 30 seconds — no work is lost

### After the Exam

- [ ] End session from dashboard → students see final scores
- [ ] Students tap "Exit" → Lock Task Mode ends
- [ ] For frozen devices: use the teacher PIN (triple-tap app logo → enter PIN)
- [ ] Export activity logs from dashboard
- [ ] (Optional) Remove Device Owner:
  ```bash
  adb shell dpm remove-active-admin com.codefest.app/.DeviceAdminReceiver
  ```

---

## Opening in Android Studio

To debug or modify the native Android code:

```bash
cd codefest-client
npx cap open android
```

This opens the project in Android Studio where you can:
- Run on a connected device or emulator
- Debug native Java/Kotlin code
- Inspect the WebView with Chrome DevTools (dev builds only)
- Modify Gradle build settings

---

## Updating the App

When the CodeFest codebase is updated:

```bash
cd codefest-client
git pull
npm install
npx ng build --configuration production
npx cap sync android
cd android
./gradlew assembleRelease
```

Then reinstall on devices:
```bash
adb install -r app/build/outputs/apk/release/app-release.apk
```

Device Owner registration persists — no need to re-register after app updates.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `adb devices` shows nothing | Enable USB debugging on device; try a different USB cable |
| Device Owner registration fails | Remove ALL accounts from device first (Settings → Accounts) |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | Uninstall old version: `adb uninstall com.codefest.app` then reinstall |
| Gradle build fails with SDK error | Install required SDK version in Android Studio SDK Manager |
| App shows "Not Device Owner" warning | Run `adb shell dpm set-device-owner com.codefest.app/.DeviceAdminReceiver` |
| White screen on launch | Check `capacitor.config.ts` — verify `webDir` matches Angular output path |
| Cannot connect to server | Verify server URL in `capacitor.config.ts`; ensure device is on the same network |
| Build fails with Java error | Ensure JDK 17 is installed and `JAVA_HOME` is set |
