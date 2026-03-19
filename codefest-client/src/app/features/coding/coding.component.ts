import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { SessionService, SessionState } from '../../core/services/session.service';
import { SignalrService } from '../../core/services/signalr.service';
import { ActivityTrackerService } from '../../core/services/activity-tracker.service';
import { SessionStatus } from '../../core/models/session.model';
import { CodeEditorComponent } from './editor/code-editor.component';
import { ChallengePanelComponent } from './challenge-panel/challenge-panel.component';
import { TestResultsComponent } from './test-results/test-results.component';
import { TimerComponent } from './timer/timer.component';
import { LeaderboardComponent } from './leaderboard/leaderboard.component';
import { CelebrationComponent } from '../../shared/components/celebration.component';

@Component({
  selector: 'app-coding',
  standalone: true,
  imports: [
    CommonModule,
    CodeEditorComponent,
    ChallengePanelComponent,
    TestResultsComponent,
    TimerComponent,
    LeaderboardComponent,
    CelebrationComponent,
  ],
  template: `
    <!-- Session Ended Overlay -->
    @if (state.status === SessionStatus.Ended) {
      <div class="overlay">
        <div class="overlay-card">
          <h1>Session Complete!</h1>
          <p>Final Score: {{ state.totalPoints }} points</p>
          <app-leaderboard
            [entries]="state.leaderboard"
            [currentStudentId]="state.studentId"
          />
        </div>
      </div>
    }

    <!-- Paused Overlay -->
    @if (state.status === SessionStatus.Paused) {
      <div class="overlay">
        <div class="overlay-card">
          <h2>Session Paused</h2>
          <p>Please wait for the teacher to resume...</p>
        </div>
      </div>
    }

    <!-- Waiting for Start -->
    @if (state.status === SessionStatus.Lobby) {
      <div class="overlay">
        <div class="overlay-card">
          <h2>Welcome, {{ state.displayName }}!</h2>
          <p>Session: {{ state.sessionName || state.sessionCode }}</p>
          <p class="waiting">Waiting for the teacher to start the session...</p>
          <div class="spinner"></div>
        </div>
      </div>
    }

    <!-- Broadcast Messages -->
    @if (state.broadcasts.length > 0 && showBroadcast) {
      <div class="broadcast-toast" (click)="showBroadcast = false">
        <div class="broadcast-icon">&#128227;</div>
        <div class="broadcast-text">{{ state.broadcasts[state.broadcasts.length - 1] }}</div>
      </div>
    }

    <!-- Main Layout -->
    <div class="coding-layout" [class.has-results]="showResults">
      <!-- Top Bar -->
      <header class="top-bar">
        <div class="top-left">
          <span class="logo-sm">CodeFest</span>
          @if (state.currentChallenge) {
            <span class="challenge-title">{{ state.currentChallenge.title }}</span>
          }
        </div>
        <div class="top-center">
          <!-- Progress dots -->
          <div class="progress-dots">
            @for (i of challengeIndices; track i) {
              <span
                class="dot"
                [class.completed]="i < state.currentChallengeIndex"
                [class.active]="i === state.currentChallengeIndex"
              ></span>
            }
          </div>
        </div>
        <div class="top-right">
          @if (state.currentChallenge) {
            <app-timer
              [totalSeconds]="state.currentChallenge.timeLimitSeconds"
              [paused]="state.status !== SessionStatus.Active"
            />
          }
          <span class="points-badge">{{ state.totalPoints }} pts</span>
          <span
            class="connection-dot"
            [class.connected]="connected"
            [title]="connected ? 'Connected' : 'Reconnecting...'"
          ></span>
        </div>
      </header>

      <!-- Mobile Tab Switcher -->
      <div class="mobile-tabs">
        <button
          [class.active]="mobileTab === 'challenge'"
          (click)="mobileTab = 'challenge'"
        >
          Challenge
        </button>
        <button
          [class.active]="mobileTab === 'editor'"
          (click)="mobileTab = 'editor'"
        >
          Code
        </button>
        <button
          [class.active]="mobileTab === 'leaderboard'"
          (click)="mobileTab = 'leaderboard'"
        >
          Ranks
        </button>
      </div>

      <!-- Content Area -->
      <div class="content">
        <!-- Challenge Panel (left) -->
        <div class="panel challenge" [class.mobile-visible]="mobileTab === 'challenge'">
          <app-challenge-panel
            [challenge]="state.currentChallenge"
            [hints]="challengeHints"
          />
        </div>

        <!-- Editor Panel (right) -->
        <div class="panel editor" [class.mobile-visible]="mobileTab === 'editor'">
          @if (state.currentChallenge) {
            <app-code-editor
              [initialCode]="state.currentChallenge.starterCode"
              [readOnly]="state.status !== SessionStatus.Active"
              (codeChange)="onCodeChange($event)"
            />
          }
        </div>

        <!-- Leaderboard (mobile only) -->
        <div class="panel leaderboard-mobile" [class.mobile-visible]="mobileTab === 'leaderboard'">
          <app-leaderboard
            [entries]="state.leaderboard"
            [currentStudentId]="state.studentId"
          />
        </div>
      </div>

      <!-- Bottom Bar -->
      <footer class="bottom-bar">
        <div class="bottom-left">
          @if (state.leaderboard.length > 0) {
            <div class="mini-leaderboard">
              @for (entry of state.leaderboard.slice(0, 3); track entry.studentId) {
                <span class="mini-entry" [class.me]="entry.studentId === state.studentId">
                  {{ entry.rank }}. {{ entry.displayName }} ({{ entry.totalPoints }})
                </span>
              }
            </div>
          }
        </div>
        <div class="bottom-right">
          <button
            class="btn btn-primary"
            (click)="runTests()"
            [disabled]="submitting || state.status !== SessionStatus.Active"
          >
            {{ submitting ? 'Running...' : 'Run Tests' }}
          </button>
        </div>
      </footer>

      <!-- Test Results Panel -->
      @if (showResults && state.lastResult) {
        <div class="results-container">
          <app-test-results
            [result]="state.lastResult"
            [visible]="showResults"
            (close)="showResults = false"
          />
        </div>
      }
    </div>

    <app-celebration #celebration />
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100vh;
        background: #0f0c29;
        color: #fff;
        overflow: hidden;
      }

      .overlay {
        position: fixed;
        inset: 0;
        background: rgba(15, 12, 41, 0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
      }

      .overlay-card {
        text-align: center;
        padding: 2.5rem;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        max-width: 500px;
        width: 90%;
      }

      .overlay-card h1 {
        background: linear-gradient(90deg, #7b2ff7, #00d2ff);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-size: 2rem;
        margin: 0 0 0.5rem;
      }

      .overlay-card h2 {
        color: #fff;
        margin: 0 0 0.5rem;
      }

      .overlay-card p {
        color: rgba(255, 255, 255, 0.6);
      }

      .waiting {
        font-style: italic;
      }

      .spinner {
        width: 32px;
        height: 32px;
        border: 3px solid rgba(255, 255, 255, 0.1);
        border-top-color: #7b2ff7;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin: 1rem auto 0;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .broadcast-toast {
        position: fixed;
        top: 4rem;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 210, 255, 0.12);
        border: 1px solid rgba(0, 210, 255, 0.3);
        border-radius: 10px;
        padding: 0.75rem 1.25rem;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        z-index: 90;
        cursor: pointer;
        animation: fadeIn 0.3s ease-out;
        max-width: 90%;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(-10px);
        }
      }

      .broadcast-icon {
        font-size: 1.25rem;
      }
      .broadcast-text {
        color: rgba(255, 255, 255, 0.9);
        font-size: 0.9rem;
      }

      .coding-layout {
        display: flex;
        flex-direction: column;
        height: 100vh;
      }

      /* Top Bar */
      .top-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.5rem 1rem;
        background: rgba(255, 255, 255, 0.03);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        flex-shrink: 0;
        height: 48px;
      }

      .top-left {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .logo-sm {
        font-weight: 800;
        font-size: 1rem;
        background: linear-gradient(90deg, #7b2ff7, #00d2ff);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .challenge-title {
        font-size: 0.85rem;
        color: rgba(255, 255, 255, 0.6);
      }

      .top-center {
        display: flex;
        align-items: center;
      }

      .progress-dots {
        display: flex;
        gap: 0.4rem;
      }

      .dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.15);
        transition: all 0.3s;
      }

      .dot.completed {
        background: #2ed573;
      }

      .dot.active {
        background: #7b2ff7;
        box-shadow: 0 0 6px rgba(123, 47, 247, 0.5);
      }

      .top-right {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .points-badge {
        font-family: 'Fira Code', monospace;
        font-size: 0.85rem;
        color: #ffd700;
        padding: 0.2rem 0.5rem;
        background: rgba(255, 215, 0, 0.08);
        border-radius: 6px;
      }

      .connection-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #ff4757;
      }

      .connection-dot.connected {
        background: #2ed573;
      }

      /* Mobile Tabs */
      .mobile-tabs {
        display: none;
        flex-shrink: 0;
      }

      /* Content Area */
      .content {
        display: flex;
        flex: 1;
        min-height: 0;
      }

      .panel.challenge {
        width: 40%;
        border-right: 1px solid rgba(255, 255, 255, 0.08);
        overflow-y: auto;
      }

      .panel.editor {
        width: 60%;
        overflow: hidden;
      }

      .panel.leaderboard-mobile {
        display: none;
      }

      /* Bottom Bar */
      .bottom-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.5rem 1rem;
        background: rgba(255, 255, 255, 0.03);
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        flex-shrink: 0;
        height: 52px;
      }

      .mini-leaderboard {
        display: flex;
        gap: 1rem;
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.5);
      }

      .mini-entry.me {
        color: #7b2ff7;
        font-weight: 600;
      }

      .btn {
        padding: 0.5rem 1.5rem;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        font-size: 0.9rem;
        transition: all 0.2s;
      }

      .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .btn-primary {
        background: linear-gradient(90deg, #7b2ff7, #00d2ff);
        color: #fff;
      }

      .btn-primary:hover:not(:disabled) {
        opacity: 0.9;
        transform: translateY(-1px);
      }

      /* Results */
      .results-container {
        flex-shrink: 0;
      }

      /* Mobile responsive */
      @media (max-width: 768px) {
        .mobile-tabs {
          display: flex;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .mobile-tabs button {
          flex: 1;
          padding: 0.6rem;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: rgba(255, 255, 255, 0.4);
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
        }

        .mobile-tabs button.active {
          color: #7b2ff7;
          border-bottom-color: #7b2ff7;
        }

        .content {
          position: relative;
        }

        .panel {
          display: none !important;
          position: absolute;
          inset: 0;
        }

        .panel.mobile-visible {
          display: block !important;
          width: 100% !important;
        }

        .challenge-title {
          display: none;
        }

        .mini-leaderboard {
          display: none;
        }
      }
    `,
  ],
})
export class CodingComponent implements OnInit, OnDestroy {
  @ViewChild('celebration') celebration!: CelebrationComponent;
  @ViewChild(TimerComponent) timer!: TimerComponent;
  @ViewChild(CodeEditorComponent) editor!: CodeEditorComponent;

  SessionStatus = SessionStatus;
  state!: SessionState;
  connected = false;
  submitting = false;
  showResults = false;
  showBroadcast = false;
  mobileTab: 'challenge' | 'editor' | 'leaderboard' = 'editor';

  private currentCode = '';
  private subs: Subscription[] = [];

  constructor(
    private sessionService: SessionService,
    private signalr: SignalrService,
    private activityTracker: ActivityTrackerService,
    private router: Router
  ) {}

  get challengeIndices(): number[] {
    return Array.from({ length: this.state.totalChallenges }, (_, i) => i);
  }

  get challengeHints(): string[] {
    if (!this.state.currentChallenge) return [];
    return this.state.hints
      .filter((h) => h.challengeId === this.state.currentChallenge!.id)
      .map((h) => h.hint);
  }

  ngOnInit(): void {
    this.subs.push(
      this.sessionService.state.subscribe((s) => {
        this.state = s;
      })
    );

    this.subs.push(
      this.signalr.connected$.subscribe((c) => (this.connected = c))
    );

    // Handle celebration on all tests pass
    this.subs.push(
      this.signalr.celebration$.subscribe(() => {
        this.celebration?.fire();
      })
    );

    // Show results when test results arrive
    this.subs.push(
      this.signalr.testResults$.subscribe(() => {
        this.showResults = true;
      })
    );

    // Reset editor when next challenge arrives
    this.subs.push(
      this.signalr.nextChallenge$.subscribe((challenge) => {
        this.showResults = false;
        this.timer?.reset(challenge.timeLimitSeconds);
        setTimeout(() => {
          this.editor?.setCode(challenge.starterCode);
        });
      })
    );

    // Show broadcast messages
    this.subs.push(
      this.signalr.broadcastReceived$.subscribe(() => {
        this.showBroadcast = true;
        setTimeout(() => (this.showBroadcast = false), 8000);
      })
    );

    // If no student session, redirect to join
    if (!this.state || this.state.studentId === 0) {
      this.router.navigate(['/join']);
    }
  }

  onCodeChange(code: string): void {
    this.currentCode = code;
    this.activityTracker.updateCode(code);
  }

  async runTests(): Promise<void> {
    if (this.submitting || !this.state.currentChallenge) return;

    this.submitting = true;
    this.sessionService.clearLastResult();

    try {
      await this.signalr.submitCode(
        this.state.sessionCode,
        this.state.currentChallenge.id,
        this.currentCode
      );
    } catch (err) {
      console.error('Submit failed:', err);
    } finally {
      this.submitting = false;
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }
}
