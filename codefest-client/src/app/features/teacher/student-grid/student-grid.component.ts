import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StudentCardComponent } from '../student-card/student-card.component';

@Component({
  selector: 'app-student-grid',
  standalone: true,
  imports: [CommonModule, StudentCardComponent],
  template: `
    <div class="grid">
      @for (student of students; track student.id) {
        <app-student-card
          [student]="student"
          [rank]="getRank(student)"
          [totalChallenges]="totalChallenges"
          (clicked)="selectStudent.emit(student.id)"
        />
      } @empty {
        <div class="empty-state">
          <p>No students have joined yet.</p>
          <p class="hint">Share the session code with your students to get started.</p>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 1rem;
      }

      .empty-state {
        grid-column: 1 / -1;
        text-align: center;
        padding: 3rem 1rem;
        color: rgba(255, 255, 255, 0.5);
      }

      .empty-state p {
        margin: 0.25rem 0;
      }

      .empty-state .hint {
        font-size: 0.85rem;
        color: rgba(255, 255, 255, 0.35);
      }
    `,
  ],
})
export class StudentGridComponent {
  @Input() students: any[] = [];
  @Input() totalChallenges = 5;
  @Output() selectStudent = new EventEmitter<number>();

  getRank(student: any): number {
    const sorted = [...this.students].sort(
      (a, b) => b.totalPoints - a.totalPoints
    );
    return sorted.findIndex((s) => s.id === student.id) + 1;
  }
}
