import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-session-history',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="session-history">
      <header class="header">
        <a routerLink="/teacher" class="back-link">Back to Dashboard</a>
        <h1>Session History</h1>
      </header>
      <div class="sessions-list">
        @for (session of sessions; track session.id) {
          <div class="session-card">
            <div class="session-info">
              <h3>{{ session.name }}</h3>
              <span class="session-date">{{ session.createdAt | date }}</span>
              <span class="session-status" [class]="'status-' + session.status.toLowerCase()">{{ session.status }}</span>
            </div>
          </div>
        }
        @if (sessions.length === 0) {
          <p class="empty">No sessions found for this course.</p>
        }
      </div>
    </div>
  `,
  styles: [`
    .session-history { min-height: 100vh; background: #111827; color: white; padding: 2rem; }
    .header { margin-bottom: 2rem; }
    .back-link { color: #818cf8; text-decoration: none; font-size: 0.9rem; }
    h1 { font-size: 1.5rem; margin: 0.5rem 0 0; }
    .session-card {
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 0.75rem; padding: 1rem 1.25rem; margin-bottom: 0.5rem;
    }
    .session-info h3 { margin: 0 0 0.25rem; font-size: 1rem; }
    .session-date { font-size: 0.8rem; color: rgba(255,255,255,0.4); margin-right: 0.75rem; }
    .session-status { font-size: 0.75rem; padding: 0.15rem 0.5rem; border-radius: 1rem; }
    .status-active { background: rgba(34,197,94,0.2); color: #4ade80; }
    .status-ended { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.4); }
    .empty { color: rgba(255,255,255,0.4); }
  `]
})
export class SessionHistoryComponent implements OnInit {
  sessions: any[] = [];
  courseId = 0;

  constructor(private route: ActivatedRoute, private http: HttpClient) {}

  ngOnInit(): void {
    this.courseId = Number(this.route.snapshot.paramMap.get('id'));
    this.http.get<any[]>(`/api/instructor/courses/${this.courseId}/sessions`).subscribe({
      next: (sessions) => this.sessions = sessions,
      error: () => {}
    });
  }
}
