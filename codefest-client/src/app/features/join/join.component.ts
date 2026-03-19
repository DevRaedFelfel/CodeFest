import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SignalrService } from '../../core/services/signalr.service';
import { SessionService } from '../../core/services/session.service';
import { KioskService } from '../../core/services/kiosk.service';
import { SessionStatus } from '../../core/models/session.model';

@Component({
  selector: 'app-join',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="join-container">
      <div class="join-card">
        <div class="logo">
          <h1>CodeFest</h1>
          <p class="tagline">Real-time Coding Challenge Platform</p>
        </div>

        <div class="form-group">
          <label for="sessionCode">Session Code</label>
          <input
            id="sessionCode"
            type="text"
            [(ngModel)]="sessionCode"
            placeholder="Enter 6-character code"
            maxlength="6"
            (input)="sessionCode = sessionCode.toUpperCase()"
            [disabled]="joining"
            autocomplete="off"
          />
        </div>

        <div class="form-group">
          <label for="displayName">Your Name</label>
          <input
            id="displayName"
            type="text"
            [(ngModel)]="displayName"
            placeholder="Enter your display name"
            maxlength="30"
            [disabled]="joining"
            (keydown.enter)="join()"
            autocomplete="off"
          />
        </div>

        @if (errorMessage) {
          <div class="error">{{ errorMessage }}</div>
        }

        <button
          class="join-btn"
          (click)="join()"
          [disabled]="!canJoin || joining"
        >
          {{ joining ? 'Joining...' : 'Join Session' }}
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .join-container {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
        padding: 1rem;
      }

      .join-card {
        background: rgba(255, 255, 255, 0.05);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        padding: 2.5rem;
        width: 100%;
        max-width: 420px;
      }

      .logo {
        text-align: center;
        margin-bottom: 2rem;
      }

      .logo h1 {
        font-size: 2.5rem;
        font-weight: 800;
        background: linear-gradient(90deg, #00d2ff, #7b2ff7);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin: 0;
      }

      .tagline {
        color: rgba(255, 255, 255, 0.5);
        font-size: 0.9rem;
        margin-top: 0.5rem;
      }

      .form-group {
        margin-bottom: 1.25rem;
      }

      label {
        display: block;
        color: rgba(255, 255, 255, 0.7);
        font-size: 0.85rem;
        margin-bottom: 0.5rem;
        font-weight: 500;
      }

      input {
        width: 100%;
        padding: 0.75rem 1rem;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 8px;
        color: #fff;
        font-size: 1rem;
        outline: none;
        transition: border-color 0.2s;
        box-sizing: border-box;
      }

      input:focus {
        border-color: #7b2ff7;
      }

      input::placeholder {
        color: rgba(255, 255, 255, 0.3);
      }

      .join-btn {
        width: 100%;
        padding: 0.85rem;
        background: linear-gradient(90deg, #7b2ff7, #00d2ff);
        border: none;
        border-radius: 8px;
        color: #fff;
        font-size: 1.05rem;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.2s, transform 0.1s;
        margin-top: 0.5rem;
      }

      .join-btn:hover:not(:disabled) {
        opacity: 0.9;
        transform: translateY(-1px);
      }

      .join-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .error {
        background: rgba(255, 71, 87, 0.15);
        border: 1px solid rgba(255, 71, 87, 0.3);
        color: #ff4757;
        padding: 0.65rem 1rem;
        border-radius: 8px;
        font-size: 0.85rem;
        margin-bottom: 1rem;
      }
    `,
  ],
})
export class JoinComponent {
  sessionCode = '';
  displayName = '';
  joining = false;
  errorMessage = '';

  constructor(
    private signalr: SignalrService,
    private session: SessionService,
    private kiosk: KioskService,
    private router: Router
  ) {}

  get canJoin(): boolean {
    return this.sessionCode.length >= 3 && this.displayName.trim().length >= 1;
  }

  async join(): Promise<void> {
    if (!this.canJoin || this.joining) return;

    this.joining = true;
    this.errorMessage = '';

    try {
      // Connect to SignalR if not already connected
      if (!this.signalr.isConnected) {
        await this.signalr.connect();
      }

      // Join the session
      const result = await this.signalr.joinSession(
        this.sessionCode,
        this.displayName.trim()
      );

      console.log('JoinSession result:', JSON.stringify(result, null, 2));

      // Map session status string to enum
      const statusMap: Record<string, SessionStatus> = {
        Lobby: SessionStatus.Lobby,
        Active: SessionStatus.Active,
        Paused: SessionStatus.Paused,
        Ended: SessionStatus.Ended,
      };
      const status =
        statusMap[result.sessionStatus] ?? SessionStatus.Lobby;

      // Store session info
      this.session.setJoinInfo({
        sessionCode: this.sessionCode,
        sessionName: result.sessionName ?? '',
        studentId: result.studentId,
        displayName: this.displayName.trim(),
        totalChallenges: result.totalChallenges ?? 0,
        status,
        currentChallenge: result.currentChallenge ?? undefined,
      });

      // Enter kiosk mode
      await this.kiosk.enterKioskMode();

      // Navigate to coding view
      this.router.navigate(['/code']);
    } catch (err: any) {
      this.errorMessage =
        err?.message ?? 'Failed to join session. Check the code and try again.';
    } finally {
      this.joining = false;
    }
  }
}
