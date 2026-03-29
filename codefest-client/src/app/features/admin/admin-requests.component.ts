import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminLayoutComponent } from './shared/admin-layout.component';
import { DataTableComponent } from './shared/data-table.component';
import { AdminService } from '../../core/services/admin.service';

@Component({
  selector: 'app-admin-requests',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminLayoutComponent, DataTableComponent],
  template: `
    <app-admin-layout>
      <div class="page-header">
        <h1 class="page-title">Enrollment Requests</h1>
        <select [(ngModel)]="statusFilter" (change)="loadRequests()" class="input-select">
          <option value="">All</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>
      </div>

      <app-data-table [columns]="columns" [data]="requests" [actions]="tableActions" />
    </app-admin-layout>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .page-title { font-size: 1.5rem; margin: 0; }
    .input-select { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); color: white; padding: 0.5rem 0.75rem; border-radius: 0.5rem; }
  `]
})
export class AdminRequestsComponent implements OnInit {
  requests: any[] = [];
  statusFilter = 'Pending';

  columns = [
    { key: 'studentName', label: 'Student' },
    { key: 'studentEmail', label: 'Email' },
    { key: 'courseCode', label: 'Course' },
    { key: 'courseName', label: 'Course Name' },
    { key: 'status', label: 'Status' },
    { key: 'requestedAt', label: 'Requested', render: (row: any) => new Date(row.requestedAt).toLocaleDateString() },
  ];

  tableActions = [
    { label: 'Approve', type: 'success', handler: (row: any) => this.review(row, 'Approved') },
    { label: 'Reject', type: 'danger', handler: (row: any) => this.review(row, 'Rejected') },
  ];

  constructor(private adminService: AdminService) {}

  ngOnInit(): void { this.loadRequests(); }

  loadRequests(): void {
    this.adminService.getEnrollmentRequests(undefined, this.statusFilter || undefined).subscribe({
      next: (res) => this.requests = res.items
    });
  }

  review(row: any, status: string): void {
    this.adminService.reviewEnrollmentRequest(row.id, status).subscribe({
      next: () => this.loadRequests()
    });
  }
}
