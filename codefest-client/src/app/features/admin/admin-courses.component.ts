import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminLayoutComponent } from './shared/admin-layout.component';
import { DataTableComponent } from './shared/data-table.component';
import { FileUploadComponent } from './shared/file-upload.component';
import { AdminService } from '../../core/services/admin.service';
import { Course } from '../../core/models/user.model';

@Component({
  selector: 'app-admin-courses',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminLayoutComponent, DataTableComponent, FileUploadComponent],
  template: `
    <app-admin-layout>
      <div class="page-header">
        <h1 class="page-title">Courses</h1>
        <div class="header-actions">
          <app-file-upload buttonText="Upload Courses" (upload)="onUpload($event)" #uploader />
          <button class="btn-primary" (click)="showAddModal = true">Add Course</button>
        </div>
      </div>

      <app-data-table [columns]="columns" [data]="courses" [actions]="tableActions" />

      @if (showAddModal) {
        <div class="modal-backdrop" (click)="showAddModal = false">
          <div class="modal" (click)="$event.stopPropagation()">
            <h2>Add Course</h2>
            <div class="form-group">
              <label>Code</label>
              <input type="text" [(ngModel)]="newCourse.code" class="input" placeholder="e.g. CS101" />
            </div>
            <div class="form-group">
              <label>Name</label>
              <input type="text" [(ngModel)]="newCourse.name" class="input" />
            </div>
            <div class="form-group">
              <label>Description</label>
              <input type="text" [(ngModel)]="newCourse.description" class="input" />
            </div>
            <div class="form-group">
              <label>Instructor ID</label>
              <input type="number" [(ngModel)]="newCourse.instructorId" class="input" />
            </div>
            @if (addError) { <p class="error">{{ addError }}</p> }
            <div class="modal-actions">
              <button class="btn-secondary" (click)="showAddModal = false">Cancel</button>
              <button class="btn-primary" (click)="addCourse()">Create</button>
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
    .btn-primary { background: linear-gradient(135deg, #667eea, #764ba2); border: none; color: white; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer; font-weight: 600; }
    .btn-secondary { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.7); padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer; }
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
export class AdminCoursesComponent implements OnInit {
  @ViewChild('uploader') uploader!: FileUploadComponent;

  courses: Course[] = [];
  showAddModal = false;
  addError = '';
  newCourse = { code: '', name: '', description: '', instructorId: 0 };

  columns = [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Name' },
    { key: 'instructorName', label: 'Instructor' },
    { key: 'studentCount', label: 'Students' },
    { key: 'sessionCount', label: 'Sessions' },
    { key: 'isActive', label: 'Status', render: (row: any) => row.isActive ? '<span style="color:#4ade80">Active</span>' : '<span style="color:#f87171">Inactive</span>' },
  ];

  tableActions = [
    { label: 'Deactivate', type: 'danger', handler: (row: any) => this.deactivate(row) },
  ];

  constructor(private adminService: AdminService) {}

  ngOnInit(): void { this.loadCourses(); }

  loadCourses(): void {
    this.adminService.getCourses().subscribe({ next: (c) => this.courses = c });
  }

  addCourse(): void {
    this.addError = '';
    this.adminService.createCourse(this.newCourse).subscribe({
      next: () => { this.showAddModal = false; this.newCourse = { code: '', name: '', description: '', instructorId: 0 }; this.loadCourses(); },
      error: (err) => this.addError = err.error?.error || 'Failed to create course'
    });
  }

  deactivate(row: any): void {
    this.adminService.deactivateCourse(row.id).subscribe({ next: () => this.loadCourses() });
  }

  onUpload(file: File): void {
    this.adminService.uploadCourses(file).subscribe({
      next: (result) => { this.uploader.setResult(result); this.loadCourses(); }
    });
  }
}
