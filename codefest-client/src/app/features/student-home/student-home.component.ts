import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-student-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="student-home">
      <header class="header">
        <h1 class="logo">CodeFest</h1>
        <div class="user-info">
          <span>Welcome, {{ auth.currentUser?.name }}!</span>
          <button class="btn-signout" (click)="auth.logout()">Sign Out</button>
        </div>
      </header>

      <main class="content">
        <section class="courses-section">
          <h2>Your Courses</h2>
          @if (courses.length === 0) {
            <p class="empty">You are not enrolled in any courses yet.</p>
          }
          @for (course of courses; track course.id) {
            <div class="course-card">
              <div class="course-info">
                <h3>{{ course.code }} — {{ course.name }}</h3>
                <p class="instructor">Instructor: {{ course.instructorName }}</p>
                @if (course.hasActiveSession) {
                  <span class="active-badge">Active session available</span>
                }
              </div>
              @if (course.hasActiveSession) {
                <button
                  class="btn-join"
                  [routerLink]="['/join', course.activeSessionCode]"
                >
                  Join Session
                </button>
              }
            </div>
          }
        </section>

        <section class="join-section">
          <div class="divider">OR</div>
          <div class="code-join">
            <input
              type="text"
              [(value)]="sessionCode"
              placeholder="Enter session code"
              class="input-code"
              (input)="sessionCode = $any($event.target).value"
            />
            <button
              class="btn-join"
              [routerLink]="['/join', sessionCode]"
              [disabled]="!sessionCode"
            >
              Join
            </button>
          </div>
        </section>

        @if (history.length > 0) {
          <section class="history-section">
            <h2>Past Sessions</h2>
            @for (item of history; track item.sessionName) {
              <div class="history-item">
                {{ item.courseCode }} Session "{{ item.sessionName }}" — {{ item.totalPoints }} pts
              </div>
            }
          </section>
        }
      </main>
    </div>
  `,
  styles: [
    `
      .student-home {
        min-height: 100vh;
        background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
        color: white;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 2rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }
      .logo {
        font-size: 1.5rem;
        font-weight: 800;
        background: linear-gradient(135deg, #667eea, #764ba2);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin: 0;
      }
      .user-info {
        display: flex;
        align-items: center;
        gap: 1rem;
        color: rgba(255, 255, 255, 0.7);
      }
      .btn-signout {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        padding: 0.5rem 1rem;
        border-radius: 0.5rem;
        cursor: pointer;
      }
      .content {
        max-width: 700px;
        margin: 2rem auto;
        padding: 0 1rem;
      }
      h2 {
        font-size: 1.25rem;
        margin-bottom: 1rem;
        color: rgba(255, 255, 255, 0.9);
      }
      .course-card {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 1rem;
        padding: 1.25rem;
        margin-bottom: 0.75rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .course-info h3 {
        margin: 0 0 0.25rem;
        font-size: 1rem;
      }
      .instructor {
        color: rgba(255, 255, 255, 0.5);
        font-size: 0.85rem;
        margin: 0;
      }
      .active-badge {
        display: inline-block;
        margin-top: 0.5rem;
        padding: 0.2rem 0.6rem;
        background: rgba(34, 197, 94, 0.2);
        border: 1px solid rgba(34, 197, 94, 0.3);
        border-radius: 1rem;
        font-size: 0.75rem;
        color: #4ade80;
      }
      .btn-join {
        background: linear-gradient(135deg, #667eea, #764ba2);
        border: none;
        color: white;
        padding: 0.6rem 1.25rem;
        border-radius: 0.5rem;
        cursor: pointer;
        font-weight: 600;
        white-space: nowrap;
      }
      .btn-join:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .divider {
        text-align: center;
        color: rgba(255, 255, 255, 0.3);
        margin: 2rem 0;
        font-size: 0.85rem;
      }
      .code-join {
        display: flex;
        gap: 0.75rem;
        justify-content: center;
      }
      .input-code {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        padding: 0.6rem 1rem;
        border-radius: 0.5rem;
        font-size: 1rem;
        width: 200px;
        text-align: center;
      }
      .history-section {
        margin-top: 2rem;
      }
      .history-item {
        padding: 0.75rem 1rem;
        background: rgba(255, 255, 255, 0.03);
        border-radius: 0.5rem;
        margin-bottom: 0.5rem;
        font-size: 0.9rem;
        color: rgba(255, 255, 255, 0.6);
      }
      .empty {
        color: rgba(255, 255, 255, 0.4);
        font-size: 0.9rem;
      }
    `,
  ],
})
export class StudentHomeComponent implements OnInit {
  courses: any[] = [];
  history: any[] = [];
  sessionCode = '';

  constructor(
    public auth: AuthService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.http.get<any[]>('/api/student/courses').subscribe({
      next: (courses) => (this.courses = courses),
      error: () => {},
    });

    this.http.get<any[]>('/api/student/history').subscribe({
      next: (history) => (this.history = history),
      error: () => {},
    });
  }
}
