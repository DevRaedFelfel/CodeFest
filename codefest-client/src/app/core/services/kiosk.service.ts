import { Injectable } from '@angular/core';
import { ActivityTrackerService } from './activity-tracker.service';

@Injectable({ providedIn: 'root' })
export class KioskService {
  private active = false;
  private keyHandler = this.onKeyDown.bind(this);

  constructor(private activityTracker: ActivityTrackerService) {}

  async enterKioskMode(): Promise<void> {
    if (this.active) return;
    this.active = true;

    // Request fullscreen
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // Fullscreen may be denied by browser policy
    }

    // Block common escape shortcuts (best-effort)
    document.addEventListener('keydown', this.keyHandler);

    // Start activity tracking
    this.activityTracker.startTracking();
  }

  exitKioskMode(): void {
    this.active = false;
    document.removeEventListener('keydown', this.keyHandler);
    this.activityTracker.stopTracking();

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
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
