import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminLayoutComponent } from './shared/admin-layout.component';
import { DataTableComponent } from './shared/data-table.component';
import { FileUploadComponent } from './shared/file-upload.component';
import { AdminService } from '../../core/services/admin.service';

@Component({
  selector: 'app-admin-enrollments',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminLayoutComponent, DataTableComponent, FileUploadComponent],
  template: `
    <app-admin-layout>
      <div class="page-header">
        <h1 class="page-title">Enrollments</h1>
        <div class="header-actions">
          <app-file-upload buttonText="Upload Enrollments" (upload)="onUpload($event)" #uploader />
          <button class="btn-primary" (click)="showAddModal = true">Enroll Student</button>
        </div>
      </div>

      <div class="filters">
        <select [(ngModel)]="statusFilter" (change)="loadEnrollments()" class="input-select">
          <option value="">All Status</option>
          <option value="Active">Active</option>
          <option value="Pending">Pending</option>
          <option value="Dropped">Dropped</option>
        </select>
      </div>

      <app-data-table [columns]="columns" [data]="enrollments" [actions]="tableActions" />

      <div class="pagination">
        <span>{{ totalCount }} total</span>
        <button [disabled]="page <= 1" (click)="page = page - 1; loadEnrollments()">Prev</button>
        <span>Page {{ page }}</span>
        <button [disabled]="enrollments.length < pageSize" (click)="page = page + 1; loadEnrollments()">Next</button>
      </div>

      @if (showAddModal) {
        <div class="modal-backdrop" (click)="showAddModal = false">
          <div class="modal" (click)="$event.stopPropagation()">
            <h2>Enroll Student</h2>
            <div class="form-group">
              <label>Student ID</label>
              <input type="number" [(ngModel)]="newEnrollment.studentId" class="input" />
            </div>
            <div class="form-group">
              <label>Course ID</label>
              <input type="number" [(ngModel)]="newEnrollment.courseId" class="input" />
            </div>
            @if (addError) { <p class="error">{{ addError }}</p> }
            <div class="modal-actions">
              <button class="btn-secondary" (click)="showAddModal = false">Cancel</button>
              <button class="btn-primary" (click)="addEnrollment()">Enroll</button>
            </div>
          </div>
        </div>
      }
    </app-admin-layout>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem; }
    .page-title { font-size: 1.5rem; margin: 0; }
    .header-actions { display: flex; gap: 0.75rem; align-items: center; }
    .filters { display: flex; gap: 0.75rem; margin-bottom: 1rem; }
    .input-select { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); color: white; padding: 0.5rem 0.75rem; border-radius: 0.5rem; }
    .btn-primary { background: linear-gradient(135deg, #667eea, #764ba2); border: none; color: white; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer; font-weight: 600; }
    .btn-secondary { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.7); padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer; }
    .pagination { display: flex; align-items: center; gap: 1rem; margin-top: 1rem; color: rgba(255,255,255,0.5); }
    .pagination button { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); color: white; padding: 0.3rem 0.75rem; border-radius: 0.4rem; cursor: pointer; }
    .pagination button:disabled { opacity: 0.3; cursor: not-allowed; }
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal { background: #1f2937; border: 1px solid rgba(255,255,255,0.1); border-radius: 1rem; padding: 2rem; width: 400px; max-width: 90vw; }
    .modal h2 { margin: 0 0 1.5rem; font-size: 1.25rem; }
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; font-size: 0.85rem; color: rgba(255,255,255,0.6); margin-bottom: 0.25rem; }
    .input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); color: white; padding: 0.5rem 0.75rem; border-radius: 0.5rem; font-size: 0.9rem; box-sizing: border-box; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; }
    .error { color: #f87171; font-size: 0.85rem; }
  `]
})
export class AdminEnrollmentsComponent implements OnInit {
  @ViewChild('uploader') uploader!: FileUploadComponent;

  enrollments: any[] = [];
  totalCount = 0;
  page = 1;
  pageSize = 20;
  statusFilter = '';
  showAddModal = false;
  addError = '';
  newEnrollment = { studentId: 0, courseId: 0 };

  columns = [
    { key: 'studentName', label: 'Student' },
    { key: 'studentEmail', label: 'Email' },
    { key: 'courseCode', label: 'Course' },
    { key: 'courseName', label: 'Course Name' },
    { key: 'status', label: 'Status' },
    { key: 'enrolledAt', label: 'Enrolled', render: (row: any) => new Date(row.enrolledAt).toLocaleDateString() },
  ];

  tableActions = [
    { label: 'Drop', type: 'danger', handler: (row: any) => this.drop(row) },
  ];

  constructor(private adminService: AdminService) {}

  ngOnInit(): void { this.loadEnrollments(); }

  loadEnrollments(): void {
    this.adminService.getEnrollments(undefined, this.statusFilter || undefined, this.page, this.pageSize).subscribe({
      next: (res) => { this.enrollments = res.items; this.totalCount = res.totalCount; }
    });
  }

  addEnrollment(): void {
    this.addError = '';
    this.adminService.createEnrollment(this.newEnrollment).subscribe({
      next: () => { this.showAddModal = false; this.newEnrollment = { studentId: 0, courseId: 0 }; this.loadEnrollments(); },
      error: (err) => this.addError = err.error?.error || 'Failed to enroll student'
    });
  }

  drop(row: any): void {
    this.adminService.deleteEnrollment(row.id).subscribe({ next: () => this.loadEnrollments() });
  }

  onUpload(file: File): void {
    this.adminService.uploadEnrollments(file).subscribe({
      next: (result) => { this.uploader.setResult(result); this.loadEnrollments(); }
    });
  }
}
