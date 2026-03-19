import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SignalrService } from '../../../core/services/signalr.service';

@Component({
  selector: 'app-broadcast-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="broadcast-panel">
      <h3 class="title">Broadcast</h3>

      <div class="broadcast-section">
        <textarea
          class="message-input"
          [(ngModel)]="message"
          placeholder="Type a message to broadcast to all students..."
          rows="2"
        ></textarea>
        <button
          class="btn btn-broadcast"
          (click)="broadcast()"
          [disabled]="!message.trim() || sending"
        >
          {{ sending ? 'Sending...' : 'Broadcast' }}
        </button>
      </div>

      <div class="hint-section">
        <h4>Send Hint</h4>
        <div class="hint-row">
          <input
            type="number"
            class="challenge-input"
            [(ngModel)]="challengeId"
            placeholder="Challenge ID"
            min="1"
          />
          <input
            class="hint-input"
            [(ngModel)]="hint"
            placeholder="Enter hint text..."
          />
          <button
            class="btn btn-hint"
            (click)="sendHint()"
            [disabled]="!hint.trim() || !challengeId || sendingHint"
          >
            {{ sendingHint ? 'Sending...' : 'Send Hint' }}
          </button>
        </div>
      </div>

      @if (successMessage) {
        <div class="success">{{ successMessage }}</div>
      }
    </div>
  `,
  styles: [
    `
      .broadcast-panel {
        padding: 0.5rem 0;
      }

      .title {
        margin: 0 0 0.75rem 0;
        font-size: 0.85rem;
        color: rgba(255, 255, 255, 0.6);
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .broadcast-section {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1rem;
        align-items: flex-end;
      }

      .message-input {
        flex: 1;
        padding: 0.6rem 0.8rem;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 8px;
        color: #fff;
        font-size: 0.85rem;
        resize: none;
        outline: none;
        font-family: inherit;
      }

      .message-input:focus {
        border-color: #7b2ff7;
      }

      .message-input::placeholder {
        color: rgba(255, 255, 255, 0.3);
      }

      .hint-section h4 {
        margin: 0 0 0.5rem 0;
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.5);
      }

      .hint-row {
        display: flex;
        gap: 0.5rem;
        align-items: center;
      }

      .challenge-input {
        width: 100px;
        padding: 0.5rem 0.6rem;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 8px;
        color: #fff;
        font-size: 0.85rem;
        outline: none;
      }

      .challenge-input:focus {
        border-color: #7b2ff7;
      }

      .hint-input {
        flex: 1;
        padding: 0.5rem 0.6rem;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 8px;
        color: #fff;
        font-size: 0.85rem;
        outline: none;
      }

      .hint-input:focus {
        border-color: #7b2ff7;
      }

      .hint-input::placeholder,
      .challenge-input::placeholder {
        color: rgba(255, 255, 255, 0.3);
      }

      .btn {
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 8px;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.2s;
        color: #fff;
        white-space: nowrap;
      }

      .btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .btn-broadcast {
        background: linear-gradient(90deg, #7b2ff7, #00d2ff);
      }

      .btn-hint {
        background: rgba(255, 165, 2, 0.4);
        border: 1px solid rgba(255, 165, 2, 0.5);
        color: #ffa502;
      }

      .success {
        margin-top: 0.5rem;
        padding: 0.4rem 0.75rem;
        background: rgba(46, 213, 115, 0.15);
        border: 1px solid rgba(46, 213, 115, 0.3);
        color: #2ed573;
        border-radius: 6px;
        font-size: 0.8rem;
      }
    `,
  ],
})
export class BroadcastPanelComponent {
  @Input() sessionCode = '';

  message = '';
  hint = '';
  challengeId: number | null = null;
  sending = false;
  sendingHint = false;
  successMessage = '';

  constructor(private signalr: SignalrService) {}

  async broadcast(): Promise<void> {
    if (!this.message.trim() || !this.sessionCode) return;
    this.sending = true;
    try {
      await this.signalr.broadcastMessage(this.sessionCode, this.message.trim());
      this.showSuccess('Message broadcast sent!');
      this.message = '';
    } catch (err) {
      console.error('Broadcast failed', err);
    } finally {
      this.sending = false;
    }
  }

  async sendHint(): Promise<void> {
    if (!this.hint.trim() || !this.challengeId || !this.sessionCode) return;
    this.sendingHint = true;
    try {
      await this.signalr.pushHint(
        this.sessionCode,
        this.challengeId,
        this.hint.trim()
      );
      this.showSuccess('Hint sent!');
      this.hint = '';
    } catch (err) {
      console.error('Send hint failed', err);
    } finally {
      this.sendingHint = false;
    }
  }

  private showSuccess(msg: string): void {
    this.successMessage = msg;
    setTimeout(() => (this.successMessage = ''), 3000);
  }
}
