import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="admin-layout">
      <aside class="sidebar">
        <h2 class="sidebar-title" routerLink="/admin">CodeFest Admin</h2>
        <nav class="sidebar-nav">
          <a routerLink="/admin" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">Home</a>
          <a routerLink="/admin/users" routerLinkActive="active">Users</a>
          <a routerLink="/admin/courses" routerLinkActive="active">Courses</a>
          <a routerLink="/admin/enrollments" routerLinkActive="active">Enrollments</a>
          <a routerLink="/admin/enrollment-requests" routerLinkActive="active">Requests</a>
          <a routerLink="/admin/academic-loads" routerLinkActive="active">Academic Loads</a>
        </nav>
        <div class="sidebar-footer">
          <span class="user-email">{{ auth.currentUser?.email }}</span>
          <button class="btn-logout" (click)="auth.logout()">Sign Out</button>
        </div>
      </aside>
      <main class="main-content">
        <ng-content></ng-content>
      </main>
    </div>
  `,
  styles: [`
    .admin-layout { display: flex; min-height: 100vh; background: #111827; color: white; }
    .sidebar {
      width: 240px; background: #1f2937; padding: 1.5rem 1rem; display: flex;
      flex-direction: column; border-right: 1px solid rgba(255,255,255,0.05);
    }
    .sidebar-title {
      font-size: 1.1rem; font-weight: 700; margin: 0 0 1.5rem; cursor: pointer;
      background: linear-gradient(135deg, #667eea, #764ba2);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .sidebar-nav { display: flex; flex-direction: column; gap: 0.25rem; flex: 1; }
    .sidebar-nav a {
      padding: 0.6rem 0.75rem; border-radius: 0.5rem; color: rgba(255,255,255,0.6);
      text-decoration: none; font-size: 0.9rem; transition: all 0.15s;
    }
    .sidebar-nav a:hover { background: rgba(255,255,255,0.05); color: white; }
    .sidebar-nav a.active { background: rgba(102,126,234,0.15); color: #818cf8; }
    .sidebar-footer { border-top: 1px solid rgba(255,255,255,0.05); padding-top: 1rem; }
    .user-email { display: block; font-size: 0.75rem; color: rgba(255,255,255,0.4); margin-bottom: 0.5rem; overflow: hidden; text-overflow: ellipsis; }
    .btn-logout {
      width: 100%; padding: 0.5rem; border: 1px solid rgba(255,255,255,0.1);
      background: transparent; color: rgba(255,255,255,0.6); border-radius: 0.5rem;
      cursor: pointer; font-size: 0.8rem;
    }
    .btn-logout:hover { background: rgba(255,255,255,0.05); color: white; }
    .main-content { flex: 1; padding: 2rem; overflow-y: auto; }
  `]
})
export class AdminLayoutComponent {
  constructor(public auth: AuthService) {}
}
