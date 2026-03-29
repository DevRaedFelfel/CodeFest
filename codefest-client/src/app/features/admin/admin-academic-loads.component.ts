import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminLayoutComponent } from './shared/admin-layout.component';
import { DataTableComponent } from './shared/data-table.component';
import { AdminService } from '../../core/services/admin.service';

@Component({
  selector: 'app-admin-academic-loads',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminLayoutComponent, DataTableComponent],
  template: `
    <app-admin-layout>
      <div class="page-header">
        <h1 class="page-title">Academic Loads</h1>
        <button class="btn-primary" (click)="showAddModal = true">Assign Instructor</button>
      </div>

      <app-data-table [columns]="columns" [data]="loads" [actions]="tableActions" />

      @if (showAddModal) {
        <div class="modal-backdrop" (click)="showAddModal = false">
          <div class="modal" (click)="$event.stopPropagation()">
            <h2>Assign Instructor to Course</h2>
            <div class="form-group">
              <label>Instructor ID</label>
              <input type="number" [(ngModel)]="newLoad.instructorId" class="input" />
            </div>
            <div class="form-group">
              <label>Course ID</label>
              <input type="number" [(ngModel)]="newLoad.courseId" class="input" />
            </div>
            <div class="form-group">
              <label>Term (optional)</label>
              <input type="text" [(ngModel)]="newLoad.term" class="input" placeholder="e.g. Fall 2025" />
            </div>
            @if (addError) { <p class="error">{{ addError }}</p> }
            <div class="modal-actions">
              <button class="btn-secondary" (click)="showAddModal = false">Cancel</button>
              <button class="btn-primary" (click)="addLoad()">Assign</button>
            </div>
          </div>
        </div>
      }
    </app-admin-layout>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .page-title { font-size: 1.5rem; margin: 0; }
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
export class AdminAcademicLoadsComponent implements OnInit {
  loads: any[] = [];
  showAddModal = false;
  addError = '';
  newLoad = { instructorId: 0, courseId: 0, term: '' };

  columns = [
    { key: 'instructorName', label: 'Instructor' },
    { key: 'courseCode', label: 'Course Code' },
    { key: 'courseName', label: 'Course Name' },
    { key: 'term', label: 'Term' },
    { key: 'isActive', label: 'Status', render: (row: any) => row.isActive ? '<span style="color:#4ade80">Active</span>' : '<span style="color:#f87171">Inactive</span>' },
  ];

  tableActions = [
    { label: 'Remove', type: 'danger', handler: (row: any) => this.remove(row) },
  ];

  constructor(private adminService: AdminService) {}

  ngOnInit(): void { this.loadAcademicLoads(); }

  loadAcademicLoads(): void {
    this.adminService.getAcademicLoads().subscribe({ next: (loads) => this.loads = loads });
  }

  addLoad(): void {
    this.addError = '';
    this.adminService.createAcademicLoad(this.newLoad).subscribe({
      next: () => { this.showAddModal = false; this.newLoad = { instructorId: 0, courseId: 0, term: '' }; this.loadAcademicLoads(); },
      error: (err) => this.addError = err.error?.error || 'Failed to assign'
    });
  }

  remove(row: any): void {
    this.adminService.deleteAcademicLoad(row.id).subscribe({ next: () => this.loadAcademicLoads() });
  }
}
