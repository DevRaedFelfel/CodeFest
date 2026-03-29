import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-course-students',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="course-students">
      <header class="header">
        <a routerLink="/teacher" class="back-link">Back to Dashboard</a>
        <h1>Enrolled Students</h1>
      </header>
      <div class="students-list">
        @for (student of students; track student.id) {
          <div class="student-card">
            <span class="student-name">{{ student.displayName }}</span>
            <span class="student-email">{{ student.email }}</span>
            <span class="student-status">{{ student.status }}</span>
          </div>
        }
        @if (students.length === 0) {
          <p class="empty">No students enrolled in this course.</p>
        }
      </div>
    </div>
  `,
  styles: [`
    .course-students { min-height: 100vh; background: #111827; color: white; padding: 2rem; }
    .header { margin-bottom: 2rem; }
    .back-link { color: #818cf8; text-decoration: none; font-size: 0.9rem; }
    h1 { font-size: 1.5rem; margin: 0.5rem 0 0; }
    .student-card {
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 0.75rem; padding: 0.75rem 1.25rem; margin-bottom: 0.5rem;
      display: flex; align-items: center; gap: 1rem;
    }
    .student-name { font-weight: 500; }
    .student-email { color: rgba(255,255,255,0.4); font-size: 0.85rem; flex: 1; }
    .student-status { font-size: 0.8rem; color: rgba(255,255,255,0.5); }
    .empty { color: rgba(255,255,255,0.4); }
  `]
})
export class CourseStudentsComponent implements OnInit {
  students: any[] = [];
  courseId = 0;

  constructor(private route: ActivatedRoute, private http: HttpClient) {}

  ngOnInit(): void {
    this.courseId = Number(this.route.snapshot.paramMap.get('id'));
    this.http.get<any[]>(`/api/instructor/courses/${this.courseId}/students`).subscribe({
      next: (students) => this.students = students,
      error: () => {}
    });
  }
}
