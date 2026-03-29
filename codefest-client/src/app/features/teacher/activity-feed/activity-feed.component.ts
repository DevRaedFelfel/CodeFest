import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  ViewChild,
  AfterViewChecked,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-activity-feed',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="feed-container" #feedContainer>
      <h3 class="feed-title">Activity Feed</h3>

      <!-- Filters -->
      <div class="feed-filters">
        <select
          class="filter-dropdown"
          [(ngModel)]="selectedStudentId"
          (ngModelChange)="applyFilters()"
        >
          <option [ngValue]="null">All Students</option>
          @for (student of uniqueStudents; track student.id) {
            <option [ngValue]="student.id">{{ student.name }}</option>
          }
        </select>

        <select
          class="filter-dropdown"
          [(ngModel)]="selectedType"
          (ngModelChange)="applyFilters()"
        >
          <option [ngValue]="null">All Types</option>
          <option value="Submissions">Submissions</option>
          <option value="Connections">Connections</option>
          <option value="Progress">Progress</option>
          <option value="Suspicious">Suspicious</option>
          <option value="CodeChanges">Code Changes</option>
        </select>
      </div>

      <div class="feed-list" #feedList>
        @for (activity of filteredActivities; track $index) {
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

      .feed-filters {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
        flex-wrap: wrap;
      }

      .filter-dropdown {
        flex: 1;
        min-width: 0;
        padding: 0.35rem 0.5rem;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 6px;
        color: #fff;
        font-size: 0.75rem;
        outline: none;
      }

      .filter-dropdown option {
        background: #1a1a2e;
        color: #fff;
      }

      .filter-dropdown:focus {
        border-color: #7b2ff7;
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
export class ActivityFeedComponent implements AfterViewChecked, OnChanges {
  @Input() activities: any[] = [];
  @Input() participants: { userId: number; displayName: string }[] = [];
  @Output() selectStudent = new EventEmitter<number>();
  @ViewChild('feedList') feedList!: ElementRef;

  selectedStudentId: number | null = null;
  selectedType: string | null = null;

  filteredActivities: any[] = [];

  private readonly typeGroups: Record<string, string[]> = {
    Submissions: ['SubmissionAttempt'],
    Connections: ['Joined', 'Disconnected', 'Reconnected'],
    Progress: ['TestPassed', 'TestFailed', 'ChallengeCompleted'],
    Suspicious: ['TabSwitched', 'TabReturned', 'CopyPaste', 'FullscreenExited', 'FullscreenResumed'],
    CodeChanges: ['CodeChanged'],
  };

  ngOnChanges(_changes: SimpleChanges): void {
    this.applyFilters();
  }

  get uniqueStudents(): { id: number; name: string }[] {
    // Prefer participants list if available, otherwise derive from activities
    if (this.participants.length > 0) {
      return this.participants.map((p) => ({ id: p.userId, name: p.displayName }));
    }

    const map = new Map<number, string>();
    for (const a of this.activities) {
      if (!map.has(a.studentId)) {
        map.set(a.studentId, a.displayName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }

  applyFilters(): void {
    let result = this.activities;

    if (this.selectedStudentId !== null) {
      result = result.filter((a) => a.studentId === this.selectedStudentId);
    }

    if (this.selectedType !== null) {
      const allowedTypes = this.typeGroups[this.selectedType] ?? [];
      result = result.filter((a) => allowedTypes.includes(a.activityType));
    }

    this.filteredActivities = result.slice(0, 100);
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
      TestFailed: 'failed a test',
      ChallengeCompleted: 'completed a challenge',
      CodeChanged: 'updated code',
      TabSwitched: 'switched tab',
      TabReturned: 'returned to tab',
      CopyPaste: 'paste detected',
      FullscreenExited: 'exited fullscreen',
      FullscreenResumed: 'resumed fullscreen',
      HintRequested: 'requested a hint',
      SubmissionAttempt: 'submitted code',
      InteractiveRun: 'started running code',
      InteractiveRunInput: 'sent input to program',
      InteractiveRunStop: 'stopped their run',
    };
    return descriptions[activity.activityType] ?? activity.activityType;
  }
}
