import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminLayoutComponent } from './shared/admin-layout.component';
import { AdminService } from '../../core/services/admin.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, AdminLayoutComponent],
  template: `
    <app-admin-layout>
      <h1 class="page-title">Dashboard</h1>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{ stats.userCount }}</div>
          <div class="stat-label">Users</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.courseCount }}</div>
          <div class="stat-label">Courses</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.activeSessionCount }}</div>
          <div class="stat-label">Active Sessions</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.pendingRequestCount }}</div>
          <div class="stat-label">Pending Requests</div>
        </div>
      </div>
    </app-admin-layout>
  `,
  styles: [`
    .page-title { font-size: 1.5rem; margin: 0 0 1.5rem; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; }
    .stat-card {
      background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 1rem; padding: 1.5rem; text-align: center;
    }
    .stat-value { font-size: 2rem; font-weight: 700; color: #818cf8; }
    .stat-label { font-size: 0.85rem; color: rgba(255,255,255,0.5); margin-top: 0.25rem; }
  `]
})
export class AdminDashboardComponent implements OnInit {
  stats = { userCount: 0, courseCount: 0, activeSessionCount: 0, pendingRequestCount: 0 };

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.adminService.getDashboardStats().subscribe({
      next: (stats) => this.stats = stats,
      error: () => {}
    });
  }
}
