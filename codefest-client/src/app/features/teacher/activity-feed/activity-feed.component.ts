import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  ViewChild,
  AfterViewChecked,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-activity-feed',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="feed-container" #feedContainer>
      <h3 class="feed-title">Activity Feed</h3>
      <div class="feed-list" #feedList>
        @for (activity of displayedActivities; track $index) {
          <div
            class="feed-item"
            [class]="'feed-item type-' + getTypeClass(activity.activityType)"
            (click)="selectStudent.emit(activity.studentId)"
          >
            <span class="timestamp">{{ formatTime(activity.timestamp) }}</span>
            <span class="student-name">{{ activity.displayName }}</span>
            <span class="event-desc">{{ describeActivity(activity) }}</span>
          </div>
        } @empty {
          <div class="empty">No activity yet</div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .feed-container {
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      .feed-title {
        margin: 0 0 0.75rem 0;
        font-size: 1rem;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.8);
      }

      .feed-list {
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .feed-list::-webkit-scrollbar {
        width: 4px;
      }

      .feed-list::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.15);
        border-radius: 2px;
      }

      .feed-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.4rem 0.6rem;
        border-radius: 6px;
        font-size: 0.78rem;
        cursor: pointer;
        transition: background 0.15s;
        border-left: 3px solid transparent;
      }

      .feed-item:hover {
        background: rgba(255, 255, 255, 0.05);
      }

      .type-success {
        border-left-color: #2ed573;
      }

      .type-info {
        border-left-color: #00d2ff;
      }

      .type-warning {
        border-left-color: #ff4757;
      }

      .timestamp {
        color: rgba(255, 255, 255, 0.35);
        font-family: monospace;
        font-size: 0.72rem;
        flex-shrink: 0;
      }

      .student-name {
        color: #00d2ff;
        font-weight: 600;
        flex-shrink: 0;
      }

      .event-desc {
        color: rgba(255, 255, 255, 0.6);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .empty {
        text-align: center;
        color: rgba(255, 255, 255, 0.35);
        padding: 2rem;
        font-size: 0.85rem;
      }
    `,
  ],
})
export class ActivityFeedComponent implements AfterViewChecked {
  @Input() activities: any[] = [];
  @Output() selectStudent = new EventEmitter<number>();
  @ViewChild('feedList') feedList!: ElementRef;

  get displayedActivities(): any[] {
    return this.activities.slice(0, 100);
  }

  ngAfterViewChecked(): void {
    if (this.feedList?.nativeElement) {
      const el = this.feedList.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }

  formatTime(timestamp: string): string {
    try {
      const d = new Date(timestamp);
      return d.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return '--:--:--';
    }
  }

  getTypeClass(type: string): string {
    const successTypes = ['TestPassed', 'ChallengeCompleted'];
    const warningTypes = [
      'TabSwitched',
      'CopyPaste',
      'FullscreenExited',
      'Disconnected',
    ];
    const runTypes = ['InteractiveRun', 'InteractiveRunInput', 'InteractiveRunStop'];
    if (successTypes.includes(type)) return 'success';
    if (warningTypes.includes(type)) return 'warning';
    if (runTypes.includes(type)) return 'info';
    return 'info';
  }

  describeActivity(activity: any): string {
    const descriptions: Record<string, string> = {
      Joined: 'joined the session',
      Disconnected: 'disconnected',
      Reconnected: 'reconnected',
      TestPassed: 'passed a test',
      ChallengeCompleted: 'completed a challenge',
      CodeChanged: 'updated code',
      TabSwitched: 'switched tab',
      CopyPaste: 'paste detected',
      FullscreenExited: 'exited fullscreen',
      InteractiveRun: 'started running code',
      InteractiveRunInput: 'sent input to program',
      InteractiveRunStop: 'stopped their run',
    };
    return descriptions[activity.activityType] ?? activity.activityType;
  }
}
