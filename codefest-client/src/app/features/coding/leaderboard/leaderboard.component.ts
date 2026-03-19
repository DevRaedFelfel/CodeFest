import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeaderboardEntry } from '../../../core/models/session.model';

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (entries.length > 0) {
      <div class="leaderboard">
        @for (entry of entries; track entry.studentId) {
          <div class="entry" [class.me]="entry.studentId === currentStudentId">
            <span class="rank">{{ entry.rank }}</span>
            <span class="name">{{ entry.displayName }}</span>
            <span class="points">{{ entry.totalPoints }} pts</span>
          </div>
        }
      </div>
    }
  `,
  styles: [
    `
      .leaderboard {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        padding: 0.5rem;
      }

      .entry {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.4rem 0.65rem;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.03);
        font-size: 0.85rem;
      }

      .entry.me {
        background: rgba(123, 47, 247, 0.12);
        border: 1px solid rgba(123, 47, 247, 0.25);
      }

      .rank {
        font-weight: 700;
        color: rgba(255, 255, 255, 0.5);
        width: 1.5rem;
        text-align: center;
      }

      .entry:first-child .rank {
        color: #ffd700;
      }

      .name {
        flex: 1;
        color: rgba(255, 255, 255, 0.85);
      }

      .points {
        color: rgba(255, 255, 255, 0.5);
        font-family: 'Fira Code', monospace;
        font-size: 0.8rem;
      }
    `,
  ],
})
export class LeaderboardComponent {
  @Input() entries: LeaderboardEntry[] = [];
  @Input() currentStudentId = 0;
}
