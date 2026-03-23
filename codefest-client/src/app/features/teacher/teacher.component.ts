import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { SignalrService } from '../../core/services/signalr.service';
import { TeacherService } from '../../core/services/teacher.service';
import {
  Session,
  StudentInfo,
  LeaderboardEntry,
  ActivityLog,
  SessionStatus,
} from '../../core/models/session.model';
import { SessionControlComponent } from './session-control/session-control.component';
import { StudentGridComponent } from './student-grid/student-grid.component';
import { ActivityFeedComponent } from './activity-feed/activity-feed.component';
import { LiveCodeViewerComponent } from './live-code-viewer/live-code-viewer.component';
import { LeaderboardPanelComponent } from './leaderboard-panel/leaderboard-panel.component';
import { BroadcastPanelComponent } from './broadcast-panel/broadcast-panel.component';
import { SessionCreatorComponent } from './session-creator/session-creator.component';

@Component({
  selector: 'app-teacher',
  standalone: true,
  imports: [
    CommonModule,
    SessionControlComponent,
    StudentGridComponent,
    ActivityFeedComponent,
    LiveCodeViewerComponent,
    LeaderboardPanelComponent,
    BroadcastPanelComponent,
    SessionCreatorComponent,
  ],
  template: `
    <div class="dashboard-container">
      <!-- Header -->
      <header class="header">
        <h1 class="logo">CodeFest <span class="subtitle">Dashboard</span></h1>
        @if (currentSession) {
          <app-session-control
            [sessionCode]="currentSession.code"
            [sessionStatus]="currentSession.status"
            (start)="onStart()"
            (pause)="onPause()"
            (resume)="onResume()"
            (end)="onEnd()"
            (reopen)="onReopen()"
          />
          <button class="btn-back" (click)="backToList()">&#8592; Sessions</button>
        }
      </header>

      <!-- Session List View -->
      @if (!currentSession && !showCreator) {
        <div class="session-list-view">
          <div class="list-header">
            <h2>Your Sessions</h2>
            <button class="btn-create" (click)="showCreator = true">+ Create Session</button>
          </div>

          @if (sessions.length > 0) {
            <div class="session-cards">
              @for (session of sessions; track session.id) {
                <div class="session-card" (click)="selectSession(session)">
                  <div class="session-card-header">
                    <span class="session-name">{{ session.name }}</span>
                    <div class="session-card-actions">
                      <span class="session-status" [class]="'st-' + statusLabel(session.status).toLowerCase()">
                        {{ statusLabel(session.status) }}
                      </span>
                      <button class="btn-delete-session" (click)="onDeleteSession(session, $event)" title="Delete session">&#10005;</button>
                    </div>
                  </div>
                  <div class="session-card-body">
                    <span class="session-code-small">{{ session.code }}</span>
                    <span class="session-date">{{ session.createdAt | date: 'short' }}</span>
                  </div>
                </div>
              }
            </div>
          } @else {
            <div class="empty-sessions">
              <p>No sessions found.</p>
              <p class="hint">Create your first session to get started.</p>
            </div>
          }
        </div>
      }

      <!-- Session Creator -->
      @if (showCreator && !currentSession) {
        <app-session-creator
          (sessionCreated)="onSessionCreated($event)"
          (cancelled)="showCreator = false"
        />
      }

      <!-- Dashboard View -->
      @if (currentSession) {
        <div class="dashboard-grid">
          <div class="main-area">
            <app-student-grid
              [students]="students"
              [totalChallenges]="currentSession.challengeIds.length"
              (selectStudent)="onSelectStudent($event)"
            />
          </div>

          <div class="side-area">
            <app-activity-feed
              [activities]="activities"
              (selectStudent)="onSelectStudent($event)"
            />
          </div>
        </div>

        <div class="bottom-panels">
          <div class="leaderboard-area">
            <app-leaderboard-panel [entries]="leaderboard" />
          </div>
          <div class="broadcast-area">
            <app-broadcast-panel [sessionCode]="currentSession.code" />
          </div>
        </div>
      }

      <!-- Live Code Viewer Modal -->
      @if (selectedStudentName) {
        <app-live-code-viewer
          [studentName]="selectedStudentName"
          [code]="selectedStudentCode"
          [submissions]="selectedStudentSubmissions"
          (close)="closeViewer()"
        />
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
        color: #fff;
        overflow-y: auto;
      }

      .dashboard-container {
        max-width: 1400px;
        margin: 0 auto;
        padding: 1rem 1.5rem;
        padding-bottom: 3rem;
      }

      .header {
        display: flex;
        align-items: center;
        gap: 1.5rem;
        padding: 0.75rem 0;
        margin-bottom: 1rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        flex-wrap: wrap;
      }

      .logo {
        font-size: 1.5rem;
        font-weight: 800;
        background: linear-gradient(90deg, #00d2ff, #7b2ff7);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin: 0;
        white-space: nowrap;
      }

      .subtitle {
        font-weight: 400;
        font-size: 1.1rem;
      }

      .btn-back {
        margin-left: auto;
        padding: 0.4rem 0.8rem;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 8px;
        color: rgba(255, 255, 255, 0.7);
        font-size: 0.8rem;
        cursor: pointer;
        transition: border-color 0.2s;
      }

      .btn-back:hover {
        border-color: rgba(255, 255, 255, 0.3);
      }

      /* Session List */
      .session-list-view {
        max-width: 800px;
        margin: 2rem auto;
        padding-bottom: 2rem;
      }

      .list-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
      }

      .list-header h2 {
        margin: 0;
        font-size: 1.25rem;
        color: #fff;
      }

      .btn-create {
        padding: 0.5rem 1.25rem;
        background: linear-gradient(90deg, #7b2ff7, #00d2ff);
        border: none;
        border-radius: 8px;
        color: #fff;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.2s, transform 0.1s;
      }

      .btn-create:hover {
        opacity: 0.9;
        transform: translateY(-1px);
      }

      .session-cards {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .session-card {
        background: rgba(255, 255, 255, 0.05);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 1rem 1.25rem;
        cursor: pointer;
        transition: border-color 0.2s, transform 0.15s;
      }

      .session-card:hover {
        border-color: rgba(123, 47, 247, 0.5);
        transform: translateY(-1px);
      }

      .session-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
      }

      .session-name {
        font-weight: 600;
        font-size: 1rem;
      }

      .session-card-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .btn-delete-session {
        background: rgba(255, 71, 87, 0.15);
        border: 1px solid rgba(255, 71, 87, 0.3);
        color: #ff4757;
        border-radius: 6px;
        padding: 0.15rem 0.45rem;
        cursor: pointer;
        font-size: 0.75rem;
        transition: background 0.2s;
        line-height: 1;
      }

      .btn-delete-session:hover {
        background: rgba(255, 71, 87, 0.4);
      }

      .session-status {
        font-size: 0.7rem;
        padding: 0.2rem 0.6rem;
        border-radius: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .st-lobby {
        background: rgba(255, 165, 2, 0.15);
        color: #ffa502;
      }

      .st-active {
        background: rgba(46, 213, 115, 0.15);
        color: #2ed573;
      }

      .st-paused {
        background: rgba(255, 165, 2, 0.15);
        color: #ffa502;
      }

      .st-ended {
        background: rgba(255, 71, 87, 0.15);
        color: #ff4757;
      }

      .session-card-body {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .session-code-small {
        font-family: monospace;
        font-size: 0.85rem;
        color: #00d2ff;
        letter-spacing: 2px;
      }

      .session-date {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.35);
      }

      .empty-sessions {
        text-align: center;
        padding: 3rem;
        color: rgba(255, 255, 255, 0.5);
      }

      .empty-sessions .hint {
        color: rgba(255, 255, 255, 0.3);
        font-size: 0.85rem;
      }

      /* Dashboard Grid */
      .dashboard-grid {
        display: grid;
        grid-template-columns: 1fr 340px;
        gap: 1rem;
        margin-bottom: 1rem;
      }

      .main-area {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 12px;
        padding: 1rem;
        min-height: 400px;
      }

      .side-area {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 12px;
        padding: 1rem;
        max-height: 500px;
        overflow-y: auto;
      }

      .bottom-panels {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }

      .leaderboard-area,
      .broadcast-area {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 12px;
        padding: 1rem;
      }

      @media (max-width: 900px) {
        .dashboard-grid {
          grid-template-columns: 1fr;
        }

        .bottom-panels {
          grid-template-columns: 1fr;
        }

        .side-area {
          max-height: 300px;
        }
      }
    `,
  ],
})
export class TeacherComponent implements OnInit, OnDestroy {
  sessions: Session[] = [];
  currentSession: Session | null = null;
  students: StudentInfo[] = [];
  activities: ActivityLog[] = [];
  leaderboard: LeaderboardEntry[] = [];

  showCreator = false;

  selectedStudentName = '';
  selectedStudentCode = '';
  selectedStudentSubmissions: any[] = [];

  private subs: Subscription[] = [];

  constructor(
    private teacherService: TeacherService,
    private signalr: SignalrService
  ) {}

  ngOnInit(): void {
    this.teacherService.loadSessions();

    this.subs.push(
      this.teacherService.sessions$.subscribe((s) => (this.sessions = s)),
      this.teacherService.currentSession$.subscribe(
        (s) => (this.currentSession = s)
      ),
      this.teacherService.students$.subscribe((s) => (this.students = s)),
      this.teacherService.activityFeed$.subscribe(
        (a) => (this.activities = a)
      ),
      this.teacherService.leaderboard$.subscribe(
        (l) => (this.leaderboard = l)
      )
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  statusLabel(status: SessionStatus): string {
    const labels: Record<number, string> = {
      0: 'Lobby',
      1: 'Active',
      2: 'Paused',
      3: 'Ended',
    };
    return labels[status] ?? 'Unknown';
  }

  async selectSession(session: Session): Promise<void> {
    this.teacherService.selectSession(session);
    await this.connectSignalR(session.code);
  }

  async connectSignalR(sessionCode?: string): Promise<void> {
    if (!this.signalr.isConnected) {
      try {
        await this.signalr.connect();
      } catch (err) {
        console.error('Failed to connect SignalR', err);
        return;
      }
    }
    if (sessionCode) {
      try {
        await this.signalr.joinAsTeacher(sessionCode);
      } catch (err) {
        console.error('Failed to join teacher group', err);
      }
    }
  }

  async onSessionCreated(data: {
    name: string;
    challengeIds: number[];
  }): Promise<void> {
    const session = await this.teacherService.createSession(data.name, data.challengeIds);
    this.showCreator = false;
    await this.connectSignalR(session.code);
  }

  async onStart(): Promise<void> {
    if (!this.currentSession) return;
    try {
      await this.signalr.startSession(this.currentSession.code);
    } catch (err) {
      console.error('Failed to start session', err);
    }
  }

  async onPause(): Promise<void> {
    if (!this.currentSession) return;
    try {
      await this.signalr.pauseSession(this.currentSession.code);
    } catch (err) {
      console.error('Failed to pause session', err);
    }
  }

  async onResume(): Promise<void> {
    if (!this.currentSession) return;
    try {
      await this.signalr.resumeSession(this.currentSession.code);
    } catch (err) {
      console.error('Failed to resume session', err);
    }
  }

  async onEnd(): Promise<void> {
    if (!this.currentSession) return;
    try {
      await this.signalr.endSession(this.currentSession.code);
    } catch (err) {
      console.error('Failed to end session', err);
    }
  }

  async onReopen(): Promise<void> {
    if (!this.currentSession) return;
    try {
      await this.signalr.reopenSession(this.currentSession.code);
    } catch (err) {
      console.error('Failed to reopen session', err);
    }
  }

  async onDeleteSession(session: Session, event: Event): Promise<void> {
    event.stopPropagation();
    if (!confirm(`Delete session "${session.name}"? This cannot be undone.`)) return;
    try {
      await this.teacherService.deleteSession(session.code);
    } catch (err) {
      console.error('Failed to delete session', err);
    }
  }

  async onSelectStudent(studentId: number): Promise<void> {
    if (!this.currentSession) return;
    const student = this.students.find((s) => s.id === studentId);
    if (!student) return;

    this.selectedStudentName = student.displayName;

    try {
      const codeResult = await this.teacherService.getStudentCode(
        this.currentSession.code,
        studentId
      );
      this.selectedStudentCode = codeResult.code;
    } catch {
      this.selectedStudentCode = '// Unable to load code';
    }

    try {
      this.selectedStudentSubmissions =
        await this.teacherService.getStudentSubmissions(
          this.currentSession.code,
          studentId
        );
    } catch {
      this.selectedStudentSubmissions = [];
    }
  }

  closeViewer(): void {
    this.selectedStudentName = '';
    this.selectedStudentCode = '';
    this.selectedStudentSubmissions = [];
  }

  backToList(): void {
    this.teacherService.clearSession();
    this.closeViewer();
  }
}
