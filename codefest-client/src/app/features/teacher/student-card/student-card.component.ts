import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-student-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="card"
      [class.offline]="!student.isConnected"
      (click)="clicked.emit()"
    >
      <div class="card-header">
        <div class="name-row">
          @if (rank === 1) {
            <span class="rank-badge star">&#9733;</span>
          } @else if (rank <= 3) {
            <span class="rank-badge">#{{ rank }}</span>
          }
          <span class="name">{{ student.displayName }}</span>
        </div>
        <span
          class="status-dot"
          [class.online]="student.isConnected"
          [class.disconnected]="!student.isConnected"
        ></span>
      </div>

      <div class="card-body">
        <div class="progress-info">
          Challenge {{ student.currentChallengeIndex + 1 }} of {{ totalChallenges }}
        </div>
        <div class="points">{{ student.totalPoints }} pts</div>
      </div>

      <div class="card-footer">
        <span class="client-type">{{ student.clientType }}</span>
        <div class="warnings">
          @if (student.warnings?.tabSwitched) {
            <span class="warning-icon tab" title="Tab switched">&#8644;</span>
          }
          @if (student.warnings?.pasteDetected) {
            <span class="warning-icon paste" title="Paste detected">&#128203;</span>
          }
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .card {
        background: rgba(255, 255, 255, 0.05);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 1rem;
        cursor: pointer;
        transition: border-color 0.2s, transform 0.15s;
      }

      .card:hover {
        border-color: rgba(123, 47, 247, 0.5);
        transform: translateY(-2px);
      }

      .card.offline {
        opacity: 0.5;
      }

      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.75rem;
      }

      .name-row {
        display: flex;
        align-items: center;
        gap: 0.4rem;
      }

      .name {
        font-weight: 600;
        font-size: 0.95rem;
        color: #fff;
      }

      .rank-badge {
        font-size: 0.7rem;
        padding: 0.15rem 0.4rem;
        border-radius: 10px;
        background: rgba(123, 47, 247, 0.3);
        color: #c4a0ff;
        font-weight: 700;
      }

      .rank-badge.star {
        background: rgba(255, 215, 0, 0.25);
        color: #ffd700;
        font-size: 0.9rem;
      }

      .status-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
      }

      .status-dot.online {
        background: #2ed573;
        box-shadow: 0 0 6px rgba(46, 213, 115, 0.6);
      }

      .status-dot.disconnected {
        background: #ff4757;
      }

      .card-body {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
      }

      .progress-info {
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.6);
      }

      .points {
        font-size: 0.9rem;
        font-weight: 700;
        background: linear-gradient(90deg, #7b2ff7, #00d2ff);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .card-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .client-type {
        font-size: 0.7rem;
        color: rgba(255, 255, 255, 0.35);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .warnings {
        display: flex;
        gap: 0.3rem;
      }

      .warning-icon {
        font-size: 0.85rem;
        padding: 0.1rem 0.3rem;
        border-radius: 4px;
      }

      .warning-icon.tab {
        background: rgba(255, 165, 2, 0.2);
        color: #ffa502;
      }

      .warning-icon.paste {
        background: rgba(255, 71, 87, 0.2);
        color: #ff4757;
      }
    `,
  ],
})
export class StudentCardComponent {
  @Input() student: any = {};
  @Input() rank = 0;
  @Input() totalChallenges = 5;
  @Output() clicked = new EventEmitter<void>();
}
