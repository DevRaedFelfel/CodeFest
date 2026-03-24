import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { ActivityTrackerService } from './activity-tracker.service';
import LockTask from '../plugins/lock-task.plugin';
import Display from '../plugins/display.plugin';
import Security, { DeviceInfo } from '../plugins/security.plugin';

export interface PreExamCheckResult {
  name: string;
  passed: boolean;
  message: string;
  severity: 'info' | 'warning' | 'blocking';
}

export type SecurityLevel = 'MAXIMUM' | 'MODERATE' | 'LOW';

interface CodefestKiosk {
  getDisplayCount(): Promise<number>;
  onMonitorWarning(cb: (show: boolean) => void): void;
  requestExit(): Promise<void>;
  confirmExit(): Promise<void>;
  cancelExit(): Promise<void>;
  submissionComplete(): Promise<void>;
  sessionEndedExit(): Promise<void>;
  onExitConfirmation(cb: () => void): void;
  onSubmitAndExit(cb: () => void): void;
  onSecurityViolation(cb: (data: unknown) => void): void;
  reportClientType(): string;
  getAppVersion(): Promise<string>;
  runPreExamChecks(): Promise<{ name: string; passed: boolean; message: string }[]>;
}

@Injectable({ providedIn: 'root' })
export class KioskService {
  private active = false;
  private nativeLocked = false;
  private keyHandler = this.onKeyDown.bind(this);
  private displayListenerRemove: (() => void) | null = null;
  private _displayViolation = false;

  /** Electron kiosk bridge (set by Electron preload script) */
  private electronKiosk: CodefestKiosk | null =
    (window as any).codefestKiosk ?? null;

  constructor(private activityTracker: ActivityTrackerService) {}

  /** True if running inside the Electron kiosk shell */
  get isElectron(): boolean {
    return this.electronKiosk !== null;
  }

  async enterKioskMode(): Promise<void> {
    if (this.active) return;
    this.active = true;

    // Electron kiosk — main process already handles kiosk mode
    if (this.isElectron) {
      this.activityTracker.startTracking();
      return;
    }

    // Native Android kiosk mode (Capacitor)
    if (Capacitor.isNativePlatform()) {
      // Block screenshots/recording first
      try {
        await Security.blockScreenCapture();
      } catch (e) {
        console.warn('Could not block screen capture:', e);
      }

      // Start lock task
      try {
        const result = await LockTask.startLockTask();
        this.nativeLocked = result.success;
        console.log(`Lock task started (level ${result.level})`);
      } catch (e) {
        console.warn('Native lock task not available, using web fallback');
      }

      // Start monitoring display changes
      this.startDisplayMonitoring();
    }

    // Web fallback: request fullscreen
    if (!this.nativeLocked) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        // Fullscreen may be denied by browser policy
      }
    }

    // Block common escape shortcuts (best-effort)
    document.addEventListener('keydown', this.keyHandler);

    // Start activity tracking
    this.activityTracker.startTracking();
  }

  async exitKioskMode(pin?: string): Promise<boolean> {
    // Electron exit — delegate to main process
    if (this.isElectron) {
      await this.electronKiosk!.requestExit();
      return true;
    }

    // Native unlock requires PIN
    if (this.nativeLocked && Capacitor.isNativePlatform()) {
      if (!pin) return false;
      try {
        await LockTask.stopLockTask({ pin });
        this.nativeLocked = false;
      } catch {
        return false; // Invalid PIN
      }
    }

    this.active = false;
    this.stopDisplayMonitoring();
    document.removeEventListener('keydown', this.keyHandler);
    this.activityTracker.stopTracking();

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    return true;
  }

  async isNativeLocked(): Promise<boolean> {
    if (this.isElectron) return true;
    if (!Capacitor.isNativePlatform()) return false;
    try {
      const result = await LockTask.isInLockTaskMode();
      return result.isLocked;
    } catch {
      return false;
    }
  }

  async isDeviceOwner(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      const result = await LockTask.isDeviceOwner();
      return result.isDeviceOwner;
    } catch {
      return false;
    }
  }

  get isNativePlatform(): boolean {
    return Capacitor.isNativePlatform();
  }

  /** Returns the client type string for server logging */
  getClientType(): string {
    if (this.isElectron) return this.electronKiosk!.reportClientType();
    if (Capacitor.isNativePlatform()) return 'android';
    return 'web';
  }

  /** Run pre-exam environment checks (Electron + Android) */
  async runPreExamChecks(): Promise<PreExamCheckResult[]> {
    if (this.isElectron) {
      const results = await this.electronKiosk!.runPreExamChecks();
      return results.map(r => ({ ...r, severity: r.passed ? 'info' as const : 'warning' as const }));
    }

    if (Capacitor.isNativePlatform()) {
      return this.runAndroidPreExamChecks();
    }

    return [];
  }

  private async runAndroidPreExamChecks(): Promise<PreExamCheckResult[]> {
    const results: PreExamCheckResult[] = [];

    // Check 1: Root detection
    try {
      const rootResult = await Security.isRooted();
      results.push({
        name: 'Root Detection',
        passed: !rootResult.isRooted,
        message: rootResult.isRooted
          ? `Rooted device detected (${rootResult.indicators})`
          : 'Device is not rooted',
        severity: rootResult.isRooted ? 'blocking' : 'info',
      });
    } catch {
      results.push({ name: 'Root Detection', passed: true, message: 'Could not check root status', severity: 'warning' });
    }

    // Check 2: Lock Task Mode
    try {
      const lockResult = await LockTask.isInLockTaskMode();
      results.push({
        name: 'Lock Task Mode',
        passed: lockResult.isLocked,
        message: lockResult.isLocked ? 'Lock Task Mode is active' : 'Lock Task Mode not active — will activate on session join',
        severity: lockResult.isLocked ? 'info' : 'warning',
      });
    } catch {
      results.push({ name: 'Lock Task Mode', passed: false, message: 'Could not check Lock Task status', severity: 'warning' });
    }

    // Check 3: Device Owner
    try {
      const ownerResult = await LockTask.isDeviceOwner();
      results.push({
        name: 'Device Owner',
        passed: ownerResult.isDeviceOwner,
        message: ownerResult.isDeviceOwner
          ? 'Device Owner registered (Level 2 security)'
          : 'Not Device Owner — using Level 1 (screen pinning)',
        severity: ownerResult.isDeviceOwner ? 'info' : 'warning',
      });
    } catch {
      results.push({ name: 'Device Owner', passed: false, message: 'Could not check Device Owner status', severity: 'warning' });
    }

    // Check 4: Screenshot blocking (always passes — FLAG_SECURE set on launch)
    results.push({
      name: 'Screenshot Blocking',
      passed: true,
      message: 'FLAG_SECURE enabled — screenshots and recording blocked',
      severity: 'info',
    });

    // Check 5: Single display
    try {
      const displayResult = await Display.getConnectedDisplays();
      const singleDisplay = displayResult.count <= 1;
      results.push({
        name: 'Display Check',
        passed: singleDisplay,
        message: singleDisplay
          ? 'Single display detected'
          : `${displayResult.count} displays detected — disconnect external displays`,
        severity: singleDisplay ? 'info' : 'blocking',
      });
    } catch {
      results.push({ name: 'Display Check', passed: true, message: 'Could not check display status', severity: 'warning' });
    }

    // Check 6: No screen mirroring
    try {
      const mirrorResult = await Display.isScreenMirroring();
      results.push({
        name: 'Screen Mirroring',
        passed: !mirrorResult.isMirroring,
        message: mirrorResult.isMirroring
          ? 'Screen mirroring detected — stop mirroring to continue'
          : 'No screen mirroring detected',
        severity: mirrorResult.isMirroring ? 'blocking' : 'info',
      });
    } catch {
      results.push({ name: 'Screen Mirroring', passed: true, message: 'Could not check mirroring status', severity: 'warning' });
    }

    return results;
  }

  /** Returns the security level based on device owner status and lock task mode. */
  async getSecurityLevel(): Promise<SecurityLevel> {
    if (!Capacitor.isNativePlatform()) return 'LOW';
    try {
      const owner = await LockTask.isDeviceOwner();
      if (owner.isDeviceOwner) {
        const locked = await LockTask.isInLockTaskMode();
        return locked.isLocked ? 'MAXIMUM' : 'MODERATE';
      }
      return 'LOW';
    } catch {
      return 'LOW';
    }
  }

  /** Get device info for audit logging. */
  async getDeviceInfo(): Promise<DeviceInfo | null> {
    if (!Capacitor.isNativePlatform()) return null;
    try {
      return await Security.getDeviceInfo();
    } catch {
      return null;
    }
  }

  get hasDisplayViolation(): boolean {
    return this._displayViolation;
  }

  /** Listen for multi-monitor warnings (Electron only) */
  onMonitorWarning(cb: (show: boolean) => void): void {
    if (this.isElectron) {
      this.electronKiosk!.onMonitorWarning(cb);
    }
  }

  /** Listen for security violation events (Electron only) */
  onSecurityViolation(cb: (data: unknown) => void): void {
    if (this.isElectron) {
      this.electronKiosk!.onSecurityViolation(cb);
    }
  }

  /** Listen for the exit confirmation prompt from main process */
  onExitConfirmation(cb: () => void): void {
    if (this.isElectron) {
      this.electronKiosk!.onExitConfirmation(cb);
    }
  }

  /** Listen for the submit-and-exit command from main process */
  onSubmitAndExit(cb: () => void): void {
    if (this.isElectron) {
      this.electronKiosk!.onSubmitAndExit(cb);
    }
  }

  /** Confirm the exit (student clicked "Submit & Exit") */
  async confirmExit(): Promise<void> {
    if (this.isElectron) {
      await this.electronKiosk!.confirmExit();
    }
  }

  /** Cancel the exit dialog */
  async cancelExit(): Promise<void> {
    if (this.isElectron) {
      await this.electronKiosk!.cancelExit();
    }
  }

  /** Signal to Electron that all submissions are complete */
  async submissionComplete(): Promise<void> {
    if (this.isElectron) {
      await this.electronKiosk!.submissionComplete();
    }
  }

  /** Clean exit after teacher-ended session */
  async sessionEndedExit(): Promise<void> {
    if (this.isElectron) {
      await this.electronKiosk!.sessionEndedExit();
    }
  }

  private async startDisplayMonitoring(): Promise<void> {
    try {
      const handle = await Display.addListener('displayChanged', (data) => {
        this._displayViolation = data.count > 1 || data.isMirroring;
        if (this._displayViolation) {
          console.warn('Display violation detected:', data);
        }
      });
      this.displayListenerRemove = handle.remove;
    } catch (e) {
      console.warn('Could not start display monitoring:', e);
    }
  }

  private stopDisplayMonitoring(): void {
    if (this.displayListenerRemove) {
      this.displayListenerRemove();
      this.displayListenerRemove = null;
    }
    this._displayViolation = false;
  }

  private onKeyDown(e: KeyboardEvent): void {
    // Block Ctrl+T (new tab), Ctrl+N (new window), Ctrl+W (close tab)
    if (e.ctrlKey && ['t', 'n', 'w'].includes(e.key.toLowerCase())) {
      e.preventDefault();
    }
    // Block F11 (fullscreen toggle)
    if (e.key === 'F11') {
      e.preventDefault();
    }
  }

  get isActive(): boolean {
    return this.active;
  }
}
