import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeaderboardEntry } from '../../../core/models/session.model';

@Component({
  selector: 'app-leaderboard-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="leaderboard">
      <h3 class="title">Leaderboard</h3>
      <div class="entries">
        @for (entry of entries; track entry.studentId) {
          <div class="entry" [class.top]="entry.rank <= 3">
            <span class="rank">{{ entry.rank }}.</span>
            <span class="name">{{ entry.displayName }}</span>
            <span class="score">{{ entry.totalPoints }} pts</span>
            <span class="challenges">{{ entry.challengesCompleted }} solved</span>
          </div>
        } @empty {
          <div class="empty">No leaderboard data yet</div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .leaderboard {
        padding: 0.5rem 0;
      }

      .title {
        margin: 0 0 0.5rem 0;
        font-size: 0.85rem;
        color: rgba(255, 255, 255, 0.6);
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .entries {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      .entry {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.35rem 0.75rem;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 20px;
        font-size: 0.8rem;
      }

      .entry.top {
        border-color: rgba(123, 47, 247, 0.4);
        background: rgba(123, 47, 247, 0.1);
      }

      .rank {
        font-weight: 700;
        color: rgba(255, 255, 255, 0.5);
      }

      .entry.top .rank {
        color: #c4a0ff;
      }

      .name {
        font-weight: 600;
        color: #fff;
      }

      .score {
        background: linear-gradient(90deg, #7b2ff7, #00d2ff);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-weight: 700;
      }

      .challenges {
        color: rgba(255, 255, 255, 0.35);
        font-size: 0.72rem;
      }

      .empty {
        color: rgba(255, 255, 255, 0.35);
        font-size: 0.85rem;
        padding: 0.5rem;
      }
    `,
  ],
})
export class LeaderboardPanelComponent {
  @Input() entries: LeaderboardEntry[] = [];
}
