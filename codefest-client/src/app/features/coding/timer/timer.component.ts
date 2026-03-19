import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-timer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="timer" [class.warning]="remainingSeconds <= 60" [class.danger]="remainingSeconds <= 30">
      {{ display }}
    </div>
  `,
  styles: [
    `
      .timer {
        font-family: 'Fira Code', monospace;
        font-size: 1.1rem;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.8);
        padding: 0.3rem 0.75rem;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.06);
      }

      .warning {
        color: #ffa502;
        background: rgba(255, 165, 2, 0.1);
      }

      .danger {
        color: #ff4757;
        background: rgba(255, 71, 87, 0.1);
        animation: pulse 1s infinite;
      }

      @keyframes pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.6;
        }
      }
    `,
  ],
})
export class TimerComponent implements OnInit, OnDestroy {
  @Input() totalSeconds = 300;
  @Input() paused = false;

  remainingSeconds = 0;
  private interval: any;

  ngOnInit(): void {
    this.remainingSeconds = this.totalSeconds;
    this.interval = setInterval(() => {
      if (!this.paused && this.remainingSeconds > 0) {
        this.remainingSeconds--;
      }
    }, 1000);
  }

  get display(): string {
    const m = Math.floor(this.remainingSeconds / 60);
    const s = this.remainingSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  reset(seconds: number): void {
    this.remainingSeconds = seconds;
  }

  ngOnDestroy(): void {
    clearInterval(this.interval);
  }
}
