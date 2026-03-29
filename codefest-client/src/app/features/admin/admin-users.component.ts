import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminLayoutComponent } from './shared/admin-layout.component';
import { DataTableComponent } from './shared/data-table.component';
import { FileUploadComponent } from './shared/file-upload.component';
import { AdminService } from '../../core/services/admin.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminLayoutComponent, DataTableComponent, FileUploadComponent],
  template: `
    <app-admin-layout>
      <div class="page-header">
        <h1 class="page-title">Users</h1>
        <div class="header-actions">
          <app-file-upload buttonText="Upload Users" (upload)="onUpload($event)" #uploader />
          <button class="btn-primary" (click)="showAddModal = true">Add User</button>
        </div>
      </div>

      <div class="filters">
        <input type="text" placeholder="Search by name or email..." [(ngModel)]="search" (input)="loadUsers()" class="input-search" />
        <select [(ngModel)]="roleFilter" (change)="loadUsers()" class="input-select">
          <option value="">All Roles</option>
          <option value="Student">Student</option>
          <option value="Instructor">Instructor</option>
          <option value="SuperAdmin">Super Admin</option>
        </select>
      </div>

      <app-data-table
        [columns]="columns"
        [data]="users"
        [actions]="tableActions"
      />

      <div class="pagination">
        <span>{{ totalCount }} total</span>
        <button [disabled]="page <= 1" (click)="page = page - 1; loadUsers()">Prev</button>
        <span>Page {{ page }}</span>
        <button [disabled]="users.length < pageSize" (click)="page = page + 1; loadUsers()">Next</button>
      </div>

      @if (showAddModal) {
        <div class="modal-backdrop" (click)="showAddModal = false">
          <div class="modal" (click)="$event.stopPropagation()">
            <h2>Add User</h2>
            <div class="form-group">
              <label>Email</label>
              <input type="email" [(ngModel)]="newUser.email" class="input" />
            </div>
            <div class="form-group">
              <label>Display Name</label>
              <input type="text" [(ngModel)]="newUser.displayName" class="input" />
            </div>
            <div class="form-group">
              <label>Role</label>
              <select [(ngModel)]="newUser.role" class="input">
                <option value="Student">Student</option>
                <option value="Instructor">Instructor</option>
              </select>
            </div>
            @if (addError) {
              <p class="error">{{ addError }}</p>
            }
            <div class="modal-actions">
              <button class="btn-secondary" (click)="showAddModal = false">Cancel</button>
              <button class="btn-primary" (click)="addUser()">Create</button>
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
    .input-search, .input-select {
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15);
      color: white; padding: 0.5rem 0.75rem; border-radius: 0.5rem; font-size: 0.9rem;
    }
    .input-search { flex: 1; min-width: 200px; }
    .btn-primary {
      background: linear-gradient(135deg, #667eea, #764ba2); border: none; color: white;
      padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer; font-weight: 600;
    }
    .btn-secondary {
      background: transparent; border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.7);
      padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer;
    }
    .pagination {
      display: flex; align-items: center; gap: 1rem; margin-top: 1rem; color: rgba(255,255,255,0.5);
    }
    .pagination button {
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); color: white;
      padding: 0.3rem 0.75rem; border-radius: 0.4rem; cursor: pointer;
    }
    .pagination button:disabled { opacity: 0.3; cursor: not-allowed; }
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex;
      align-items: center; justify-content: center; z-index: 1000;
    }
    .modal {
      background: #1f2937; border: 1px solid rgba(255,255,255,0.1); border-radius: 1rem;
      padding: 2rem; width: 400px; max-width: 90vw;
    }
    .modal h2 { margin: 0 0 1.5rem; font-size: 1.25rem; }
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; font-size: 0.85rem; color: rgba(255,255,255,0.6); margin-bottom: 0.25rem; }
    .input {
      width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15);
      color: white; padding: 0.5rem 0.75rem; border-radius: 0.5rem; font-size: 0.9rem;
      box-sizing: border-box;
    }
    .modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; }
    .error { color: #f87171; font-size: 0.85rem; }
  `]
})
export class AdminUsersComponent implements OnInit {
  @ViewChild('uploader') uploader!: FileUploadComponent;

  users: any[] = [];
  totalCount = 0;
  page = 1;
  pageSize = 20;
  search = '';
  roleFilter = '';
  showAddModal = false;
  addError = '';
  newUser = { email: '', displayName: '', role: 'Student' };

  columns = [
    { key: 'displayName', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role' },
    { key: 'isActive', label: 'Status', render: (row: any) => row.isActive ? '<span style="color:#4ade80">Active</span>' : '<span style="color:#f87171">Inactive</span>' },
    { key: 'lastLoginAt', label: 'Last Login', render: (row: any) => row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleDateString() : 'Never' },
  ];

  tableActions = [
    { label: 'Deactivate', type: 'danger', handler: (row: any) => this.deactivate(row) },
  ];

  constructor(private adminService: AdminService) {}

  ngOnInit(): void { this.loadUsers(); }

  loadUsers(): void {
    this.adminService.getUsers(this.roleFilter || undefined, this.search || undefined, this.page, this.pageSize).subscribe({
      next: (res) => { this.users = res.items; this.totalCount = res.totalCount; },
      error: () => {}
    });
  }

  addUser(): void {
    this.addError = '';
    this.adminService.createUser(this.newUser).subscribe({
      next: () => { this.showAddModal = false; this.newUser = { email: '', displayName: '', role: 'Student' }; this.loadUsers(); },
      error: (err) => this.addError = err.error?.error || 'Failed to create user'
    });
  }

  deactivate(row: any): void {
    this.adminService.deactivateUser(row.id).subscribe({ next: () => this.loadUsers() });
  }

  onUpload(file: File): void {
    this.adminService.uploadUsers(file).subscribe({
      next: (result) => { this.uploader.setResult(result); this.loadUsers(); },
      error: () => {}
    });
  }
}
