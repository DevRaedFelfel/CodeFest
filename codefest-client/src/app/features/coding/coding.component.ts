import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { SessionService, SessionState } from '../../core/services/session.service';
import { SignalrService } from '../../core/services/signalr.service';
import { ActivityTrackerService } from '../../core/services/activity-tracker.service';
import { KioskService } from '../../core/services/kiosk.service';
import { SessionStatus } from '../../core/models/session.model';
import { CodeEditorComponent } from './editor/code-editor.component';
import { ChallengePanelComponent } from './challenge-panel/challenge-panel.component';
import { TestResultsComponent } from './test-results/test-results.component';
import { TimerComponent } from './timer/timer.component';
import { LeaderboardComponent } from './leaderboard/leaderboard.component';
import { CelebrationComponent } from '../../shared/components/celebration.component';
import { TerminalComponent } from './terminal/terminal.component';
import { RunStateService } from '../../core/services/run-state.service';
import { RunState } from '../../core/models/run-state.model';

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
    TerminalComponent,
  ],
  template: `
    <!-- Multi-Monitor Warning Overlay (Electron) -->
    @if (showMonitorWarning) {
      <div class="overlay monitor-warning">
        <div class="overlay-card warning-card">
          <div class="warning-icon">&#9888;</div>
          <h2>WARNING</h2>
          <p>An additional monitor has been detected.</p>
          <p>Please disconnect all extra monitors to continue your exam.</p>
          <p class="warning-note">This event has been logged and reported to your instructor.</p>
          <div class="spinner"></div>
          <p class="waiting">Waiting for single monitor...</p>
        </div>
      </div>
    }

    <!-- Exit Confirmation Dialog (Electron) -->
    @if (showExitConfirm) {
      <div class="overlay">
        <div class="overlay-card">
          <h2>Are you sure?</h2>
          <p>Your current code will be submitted for all challenges. You cannot re-enter the exam after leaving.</p>
          <div class="exit-buttons">
            <button class="btn btn-secondary" (click)="cancelExit()">Cancel</button>
            <button class="btn btn-danger" (click)="confirmExit()">Submit &amp; Exit</button>
          </div>
        </div>
      </div>
    }

    <!-- Submitting Overlay (Electron exit flow) -->
    @if (exitSubmitting) {
      <div class="overlay">
        <div class="overlay-card">
          <h2>Submitting your work...</h2>
          <div class="spinner"></div>
        </div>
      </div>
    }

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
          @if (isElectron) {
            <button class="btn btn-primary exit-btn" (click)="electronSessionEndExit()">Exit</button>
          }
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
        @if (terminalVisible) {
          <button
            [class.active]="mobileTab === 'terminal'"
            (click)="switchToTerminalTab()"
            data-testid="terminal-tab"
          >
            Terminal
            @if (hasUnreadOutput && mobileTab !== 'terminal') {
              <span class="tab-badge"></span>
            }
          </button>
        }
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
        <div class="panel editor" [class.mobile-visible]="mobileTab === 'editor' || mobileTab === 'terminal'">
          <div class="editor-area" (keydown)="onEditorKeydown($event)">
            @if (state.currentChallenge) {
              <app-code-editor
                [initialCode]="state.currentChallenge.starterCode"
                [readOnly]="state.status !== SessionStatus.Active"
                (codeChange)="onCodeChange($event)"
              />
            }
          </div>
          <app-terminal (unreadOutput)="onTerminalUnreadOutput()" />
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
          @if (isElectron) {
            <button
              class="btn btn-exit"
              (click)="requestExit()"
              [disabled]="submitting || exitSubmitting"
            >
              Exit Exam
            </button>
          }
          <button
            class="btn btn-run"
            (click)="runCode()"
            [disabled]="isRunActive || state.status !== SessionStatus.Active"
            data-testid="run-button"
          >
            @if (runState.currentState === RunState.Compiling) {
              <span class="btn-spinner"></span> Compiling...
            } @else {
              &#9654; Run
            }
          </button>
          @if (isRunActive) {
            <button
              class="btn btn-stop"
              (click)="stopRun()"
              data-testid="stop-button"
            >
              &#9632; Stop
            </button>
          }
          <button
            class="btn btn-primary"
            (click)="runTests()"
            [disabled]="submitting || isRunActive || state.status !== SessionStatus.Active"
            data-testid="submit-button"
          >
            {{ submitting ? 'Submitting...' : '&#10003; Submit' }}
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

    <!-- Input waiting toast (phone, when not on terminal tab) -->
    @if (showInputToast) {
      <div class="input-toast" (click)="switchToTerminalTab()">
        Program is waiting for your input
      </div>
    }

    <!-- Screen reader live region -->
    <div id="sr-announcer"
         aria-live="assertive"
         aria-atomic="true"
         class="sr-only">
    </div>

    <app-celebration #celebration />
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100dvh;
        background: #0f0c29;
        color: #fff;
        overflow: hidden;
      }

      @supports not (height: 100dvh) {
        :host { height: 100vh; }
      }

      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
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

      .tab-badge {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #ff4757;
        margin-left: 4px;
        vertical-align: super;
        animation: pulse 1.2s ease-in-out infinite;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }

      .input-toast {
        position: fixed;
        bottom: 70px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(79, 195, 247, 0.15);
        border: 1px solid rgba(79, 195, 247, 0.3);
        border-radius: 8px;
        padding: 0.6rem 1rem;
        color: #4fc3f7;
        font-size: 0.85rem;
        cursor: pointer;
        z-index: 80;
        animation: fadeIn 0.3s ease-out;
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
        display: flex;
        flex-direction: column;
      }

      .editor-area {
        flex: 1;
        min-height: 0;
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

      .btn-run {
        background: rgba(46, 213, 115, 0.15);
        color: #2ed573;
        border: 1px solid rgba(46, 213, 115, 0.3);
        padding: 0.5rem 1rem;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        font-size: 0.9rem;
        transition: all 0.2s;
      }

      .btn-run:hover:not(:disabled) {
        background: rgba(46, 213, 115, 0.25);
      }

      .btn-run:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .btn-stop {
        background: rgba(255, 71, 87, 0.15);
        color: #ff4757;
        border: 1px solid rgba(255, 71, 87, 0.3);
        padding: 0.5rem 1rem;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        font-size: 0.9rem;
        transition: all 0.2s;
      }

      .btn-stop:hover {
        background: rgba(255, 71, 87, 0.25);
      }

      .btn-spinner {
        display: inline-block;
        width: 12px;
        height: 12px;
        border: 2px solid rgba(46, 213, 115, 0.3);
        border-top-color: #2ed573;
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
        vertical-align: middle;
        margin-right: 4px;
      }

      /* Results */
      .results-container {
        flex-shrink: 0;
      }

      /* Electron kiosk styles */
      .monitor-warning {
        background: rgba(180, 30, 30, 0.95);
      }

      .warning-card {
        border-color: rgba(255, 80, 80, 0.4);
      }

      .warning-icon {
        font-size: 3rem;
        margin-bottom: 0.5rem;
      }

      .warning-note {
        font-size: 0.85rem;
        color: rgba(255, 255, 255, 0.5);
        margin-top: 1rem;
      }

      .exit-buttons {
        display: flex;
        gap: 1rem;
        justify-content: center;
        margin-top: 1.5rem;
      }

      .btn-secondary {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
        border: 1px solid rgba(255, 255, 255, 0.2);
      }

      .btn-secondary:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.15);
      }

      .btn-danger {
        background: #ff4757;
        color: #fff;
      }

      .btn-danger:hover:not(:disabled) {
        background: #ff6b6b;
      }

      .btn-exit {
        background: rgba(255, 71, 87, 0.15);
        color: #ff4757;
        border: 1px solid rgba(255, 71, 87, 0.3);
        padding: 0.5rem 1rem;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        font-size: 0.9rem;
        transition: all 0.2s;
      }

      .btn-exit:hover:not(:disabled) {
        background: rgba(255, 71, 87, 0.25);
      }

      .exit-btn {
        margin-top: 1.5rem;
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

        .bottom-bar .btn,
        .bottom-bar .btn-run,
        .bottom-bar .btn-stop {
          min-height: 44px;
          min-width: 44px;
          font-size: 16px;
          padding: 10px 20px;
        }
      }

      /* Tablet breakpoint (600-1023px) */
      @media (min-width: 600px) and (max-width: 1023px) {
        .content {
          flex-direction: column;
        }

        .panel.challenge {
          width: 100%;
          max-height: 25vh;
          border-right: none;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .panel.editor {
          width: 100%;
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
  RunState = RunState;
  state!: SessionState;
  connected = false;
  submitting = false;
  showResults = false;
  showBroadcast = false;
  mobileTab: 'challenge' | 'editor' | 'leaderboard' | 'terminal' = 'editor';

  // Run state
  isRunActive = false;
  terminalVisible = false;
  hasUnreadOutput = false;
  showInputToast = false;

  // Electron kiosk state
  isElectron = false;
  showMonitorWarning = false;
  showExitConfirm = false;
  exitSubmitting = false;

  private currentCode = '';
  private initialCodeSet = false;
  private subs: Subscription[] = [];

  constructor(
    private sessionService: SessionService,
    private signalr: SignalrService,
    private activityTracker: ActivityTrackerService,
    private kiosk: KioskService,
    private router: Router,
    public runState: RunStateService
  ) {
    this.isElectron = this.kiosk.isElectron;
  }

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
        // Initialize currentCode with starter code so Run works before user types
        if (!this.initialCodeSet && s.currentChallenge?.starterCode) {
          this.currentCode = s.currentChallenge.starterCode;
          this.initialCodeSet = true;
        }
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
        this.currentCode = challenge.starterCode;
        this.initialCodeSet = true;
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

    // Electron kiosk listeners
    if (this.isElectron) {
      this.kiosk.onMonitorWarning((show) => {
        this.showMonitorWarning = show;
      });

      this.kiosk.onExitConfirmation(() => {
        this.showExitConfirm = true;
      });

      this.kiosk.onSubmitAndExit(async () => {
        this.exitSubmitting = true;
        try {
          // Submit current code for the active challenge
          if (this.state.currentChallenge) {
            await this.signalr.submitCode(
              this.state.sessionCode,
              this.state.currentChallenge.id,
              this.currentCode
            );
          }
        } catch (err) {
          console.error('Final submission failed:', err);
        }
        // Signal to Electron that submission is done
        await this.kiosk.submissionComplete();
      });

      this.kiosk.onSecurityViolation((data: any) => {
        // Forward security events to the server via SignalR
        if (data?.type && this.state?.sessionCode) {
          this.signalr.logActivity(this.state.sessionCode, data.type, JSON.stringify(data));
        }
      });
    }

    // Track run state for button management
    this.subs.push(
      this.runState.state$.subscribe((rs) => {
        this.isRunActive =
          rs === RunState.Running ||
          rs === RunState.WaitingForInput ||
          rs === RunState.Compiling;
        if (rs === RunState.Compiling) {
          this.terminalVisible = true;
          // Auto-switch to terminal tab on phone
          if (window.innerWidth < 600) {
            this.mobileTab = 'terminal';
          }
        }
        if (rs === RunState.WaitingForInput && this.mobileTab !== 'terminal' && window.innerWidth < 600) {
          this.showInputToast = true;
          setTimeout(() => (this.showInputToast = false), 5000);
        }
        if (rs === RunState.Finished || rs === RunState.Error || rs === RunState.Idle) {
          this.showInputToast = false;
        }
      })
    );

    // Reconnection handling — reconnect to active run
    this.subs.push(
      this.signalr.reconnected$.subscribe(() => {
        if (this.state?.sessionCode) {
          this.signalr.reconnectToRun(this.state.sessionCode);
        }
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

  async runCode(): Promise<void> {
    if (this.isRunActive || !this.state.currentChallenge) return;

    try {
      await this.signalr.runCode(
        this.state.sessionCode,
        this.state.currentChallenge.id,
        this.currentCode
      );
    } catch (err) {
      console.error('Run failed:', err);
    }
  }

  async stopRun(): Promise<void> {
    try {
      await this.signalr.stopRun(this.state.sessionCode);
    } catch (err) {
      console.error('Stop failed:', err);
    }
  }

  switchToTerminalTab(): void {
    this.mobileTab = 'terminal';
    this.hasUnreadOutput = false;
    this.showInputToast = false;
  }

  onTerminalUnreadOutput(): void {
    if (this.mobileTab !== 'terminal') {
      this.hasUnreadOutput = true;
    }
  }

  onEditorKeydown(event: KeyboardEvent): void {
    // Ctrl+Enter or Cmd+Enter → Run
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.runCode();
    }
    // Ctrl+Shift+Enter → Submit
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'Enter') {
      event.preventDefault();
      this.runTests();
    }
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

  // === Electron exit flow ===

  requestExit(): void {
    this.kiosk.exitKioskMode();
  }

  confirmExit(): void {
    this.showExitConfirm = false;
    this.kiosk.confirmExit();
  }

  cancelExit(): void {
    this.showExitConfirm = false;
    this.kiosk.cancelExit();
  }

  electronSessionEndExit(): void {
    this.kiosk.sessionEndedExit();
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }
}
