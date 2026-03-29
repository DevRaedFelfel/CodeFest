import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-not-enrolled',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="not-enrolled-container">
      <div class="card">
        <div class="warning-icon">!</div>
        <h1>Not Enrolled</h1>

        <p class="course-info">
          This session belongs to:<br />
          <strong>{{ courseCode }} — {{ courseName }}</strong><br />
          Instructor: {{ instructorName }}
        </p>

        <p class="message">You are not enrolled in this course.</p>

        @if (!requested) {
          <button class="btn-request" (click)="requestEnrollment()">
            Request Enrollment
          </button>
        } @else {
          <div class="success-message">
            Enrollment request sent!<br />
            You'll be able to join once your instructor approves your request.
          </div>
        }

        @if (error) {
          <div class="error-message">{{ error }}</div>
        }

        <a routerLink="/student" class="back-link">Back to Home</a>
      </div>
    </div>
  `,
  styles: [`
    .not-enrolled-container {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #0f0c29, #302b63, #24243e); padding: 1rem;
    }
    .card {
      background: rgba(255,255,255,0.05); backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.1); border-radius: 1.5rem;
      padding: 2.5rem; max-width: 450px; width: 100%; text-align: center; color: white;
    }
    .warning-icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 3rem; height: 3rem; background: rgba(251,191,36,0.2);
      border: 2px solid rgba(251,191,36,0.4); border-radius: 50%;
      font-size: 1.5rem; font-weight: bold; color: #fbbf24; margin-bottom: 1rem;
    }
    h1 { font-size: 1.5rem; margin: 0 0 1rem; }
    .course-info { color: rgba(255,255,255,0.7); line-height: 1.6; margin-bottom: 1rem; }
    .message { color: rgba(255,255,255,0.5); margin-bottom: 1.5rem; }
    .btn-request {
      background: linear-gradient(135deg, #667eea, #764ba2); border: none; color: white;
      padding: 0.75rem 2rem; border-radius: 0.75rem; cursor: pointer;
      font-size: 1rem; font-weight: 600; width: 100%;
    }
    .success-message {
      background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.3);
      color: #4ade80; padding: 1rem; border-radius: 0.75rem; line-height: 1.5;
    }
    .error-message {
      background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3);
      color: #fca5a5; padding: 0.75rem; border-radius: 0.75rem; margin-top: 1rem;
    }
    .back-link {
      display: inline-block; margin-top: 1.5rem; color: #818cf8;
      text-decoration: none; font-size: 0.9rem;
    }
  `]
})
export class NotEnrolledComponent implements OnInit {
  courseId = 0;
  courseCode = '';
  courseName = '';
  instructorName = '';
  requested = false;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    const state = history.state;
    if (state) {
      this.courseId = state.courseId || 0;
      this.courseCode = state.courseCode || '';
      this.courseName = state.courseName || '';
      this.instructorName = state.instructorName || '';
    }
  }

  requestEnrollment(): void {
    this.error = '';
    this.http.post('/api/student/enrollment-requests', { courseId: this.courseId }).subscribe({
      next: () => this.requested = true,
      error: (err) => this.error = err.error?.error || 'Failed to send request'
    });
  }
}
