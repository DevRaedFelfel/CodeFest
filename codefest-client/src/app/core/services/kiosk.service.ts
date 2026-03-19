import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { ActivityTrackerService } from './activity-tracker.service';
import LockTask from '../plugins/lock-task.plugin';

@Injectable({ providedIn: 'root' })
export class KioskService {
  private active = false;
  private nativeLocked = false;
  private keyHandler = this.onKeyDown.bind(this);

  constructor(private activityTracker: ActivityTrackerService) {}

  async enterKioskMode(): Promise<void> {
    if (this.active) return;
    this.active = true;

    // Native Android kiosk mode (Capacitor)
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await LockTask.startLockTask();
        this.nativeLocked = result.success;
        console.log(`Lock task started (level ${result.level})`);
      } catch (e) {
        console.warn('Native lock task not available, using web fallback');
      }
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
    document.removeEventListener('keydown', this.keyHandler);
    this.activityTracker.stopTracking();

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    return true;
  }

  async isNativeLocked(): Promise<boolean> {
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
