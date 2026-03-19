import { Injectable, OnDestroy } from '@angular/core';
import { SignalrService } from './signalr.service';
import { SessionService } from './session.service';

@Injectable({ providedIn: 'root' })
export class ActivityTrackerService implements OnDestroy {
  private codeSnapshotInterval: any;
  private currentCode = '';
  private listening = false;

  private boundVisibilityHandler = this.onVisibilityChange.bind(this);
  private boundFullscreenHandler = this.onFullscreenChange.bind(this);
  private boundPasteHandler = this.onPaste.bind(this);
  private boundContextMenuHandler = (e: Event) => e.preventDefault();

  constructor(
    private signalr: SignalrService,
    private session: SessionService
  ) {}

  startTracking(): void {
    if (this.listening) return;
    this.listening = true;

    document.addEventListener('visibilitychange', this.boundVisibilityHandler);
    document.addEventListener(
      'fullscreenchange',
      this.boundFullscreenHandler
    );
    document.addEventListener('paste', this.boundPasteHandler);
    document.addEventListener('contextmenu', this.boundContextMenuHandler);

    // Code snapshot every 30 seconds
    this.codeSnapshotInterval = setInterval(() => {
      if (this.currentCode) {
        this.log('CodeChanged', this.currentCode);
      }
    }, 30000);
  }

  stopTracking(): void {
    this.listening = false;
    document.removeEventListener(
      'visibilitychange',
      this.boundVisibilityHandler
    );
    document.removeEventListener(
      'fullscreenchange',
      this.boundFullscreenHandler
    );
    document.removeEventListener('paste', this.boundPasteHandler);
    document.removeEventListener('contextmenu', this.boundContextMenuHandler);

    if (this.codeSnapshotInterval) {
      clearInterval(this.codeSnapshotInterval);
      this.codeSnapshotInterval = null;
    }
  }

  updateCode(code: string): void {
    this.currentCode = code;
  }

  private onVisibilityChange(): void {
    if (document.hidden) {
      this.log('TabSwitched');
    } else {
      this.log('TabReturned');
    }
  }

  private onFullscreenChange(): void {
    if (!document.fullscreenElement) {
      this.log('FullscreenExited');
    } else {
      this.log('FullscreenResumed');
    }
  }

  private onPaste(event: Event): void {
    const clipboardEvent = event as ClipboardEvent;
    const text = clipboardEvent.clipboardData?.getData('text') ?? '';
    this.log('CopyPaste', JSON.stringify({ length: text.length }));
  }

  private log(activityType: string, data?: string): void {
    const code = this.session.snapshot.sessionCode;
    if (code) {
      this.signalr.logActivity(code, activityType, data).catch(() => {});
    }
  }

  ngOnDestroy(): void {
    this.stopTracking();
  }
}
