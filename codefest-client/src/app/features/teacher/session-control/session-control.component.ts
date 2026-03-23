import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-session-control',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="session-control">
      <div class="code-display">
        <span class="label">Session Code</span>
        <span class="code" (click)="copyCode()">{{ sessionCode }}</span>
        <span class="copy-hint">{{ copied ? 'Copied!' : 'Click to copy' }}</span>
      </div>

      <div class="status-badge" [class]="'status-' + statusLabel.toLowerCase()">
        {{ statusLabel }}
      </div>

      <div class="actions">
        @if (sessionStatus === 0) {
          <button class="btn btn-start" (click)="start.emit()">Start Session</button>
        }
        @if (sessionStatus === 1) {
          <button class="btn btn-pause" (click)="pause.emit()">Pause</button>
          <button class="btn btn-end" (click)="end.emit()">End Session</button>
        }
        @if (sessionStatus === 2) {
          <button class="btn btn-resume" (click)="resume.emit()">Resume</button>
          <button class="btn btn-end" (click)="end.emit()">End Session</button>
        }
        @if (sessionStatus === 3) {
          <button class="btn btn-reopen" (click)="reopen.emit()">Reopen Session</button>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .session-control {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        flex-wrap: wrap;
      }

      .code-display {
        display: flex;
        flex-direction: column;
        align-items: center;
        cursor: pointer;
      }

      .code-display .label {
        font-size: 0.7rem;
        color: rgba(255, 255, 255, 0.5);
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .code-display .code {
        font-size: 2rem;
        font-weight: 800;
        letter-spacing: 6px;
        background: linear-gradient(90deg, #7b2ff7, #00d2ff);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .copy-hint {
        font-size: 0.65rem;
        color: rgba(255, 255, 255, 0.35);
      }

      .status-badge {
        padding: 0.35rem 1rem;
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .status-lobby {
        background: rgba(255, 165, 2, 0.15);
        border: 1px solid rgba(255, 165, 2, 0.4);
        color: #ffa502;
      }

      .status-active {
        background: rgba(46, 213, 115, 0.15);
        border: 1px solid rgba(46, 213, 115, 0.4);
        color: #2ed573;
      }

      .status-paused {
        background: rgba(255, 165, 2, 0.15);
        border: 1px solid rgba(255, 165, 2, 0.4);
        color: #ffa502;
      }

      .status-ended {
        background: rgba(255, 71, 87, 0.15);
        border: 1px solid rgba(255, 71, 87, 0.4);
        color: #ff4757;
      }

      .actions {
        display: flex;
        gap: 0.5rem;
        margin-left: auto;
      }

      .btn {
        padding: 0.5rem 1.25rem;
        border: none;
        border-radius: 8px;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.2s, transform 0.1s;
        color: #fff;
      }

      .btn:hover {
        opacity: 0.85;
        transform: translateY(-1px);
      }

      .btn-start {
        background: linear-gradient(90deg, #7b2ff7, #00d2ff);
      }

      .btn-pause {
        background: rgba(255, 165, 2, 0.3);
        border: 1px solid rgba(255, 165, 2, 0.5);
        color: #ffa502;
      }

      .btn-resume {
        background: rgba(46, 213, 115, 0.3);
        border: 1px solid rgba(46, 213, 115, 0.5);
        color: #2ed573;
      }

      .btn-end {
        background: rgba(255, 71, 87, 0.3);
        border: 1px solid rgba(255, 71, 87, 0.5);
        color: #ff4757;
      }

      .btn-reopen {
        background: rgba(0, 210, 255, 0.3);
        border: 1px solid rgba(0, 210, 255, 0.5);
        color: #00d2ff;
      }
    `,
  ],
})
export class SessionControlComponent {
  @Input() sessionCode = '';
  @Input() sessionStatus = 0;
  @Output() start = new EventEmitter<void>();
  @Output() pause = new EventEmitter<void>();
  @Output() resume = new EventEmitter<void>();
  @Output() end = new EventEmitter<void>();
  @Output() reopen = new EventEmitter<void>();

  copied = false;

  get statusLabel(): string {
    const labels: Record<number, string> = {
      0: 'Lobby',
      1: 'Active',
      2: 'Paused',
      3: 'Ended',
    };
    return labels[this.sessionStatus] ?? 'Unknown';
  }

  copyCode(): void {
    navigator.clipboard.writeText(this.sessionCode);
    this.copied = true;
    setTimeout(() => (this.copied = false), 2000);
  }
}
