import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import { SessionListService } from '../../../core/services/session-list.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  SessionFilters,
  SessionListItem,
  SessionParticipantDetail,
  SessionDetailResponse,
} from '../../../core/models/session-list.model';
import { Course } from '../../../core/models/user.model';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-sessions-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="sessions-page">
      <!-- Header -->
      <header class="page-header">
        <h1 class="logo">CodeFest <span class="subtitle">Sessions</span></h1>
        <div class="header-actions">
          <span class="user-info">{{ currentUserEmail }}</span>
          <button class="btn btn-create" (click)="navigateToCreate()">+ Create Session</button>
        </div>
      </header>

      <!-- Toolbar / Filters -->
      <div class="toolbar">
        <div class="filters">
          <select class="filter-select" [(ngModel)]="filters.courseId" (ngModelChange)="onFilterChange()">
            <option [ngValue]="undefined">All Courses</option>
            @for (course of courses; track course.id) {
              <option [ngValue]="course.id">{{ course.code }} — {{ course.name }}</option>
            }
          </select>

          <select class="filter-select" [(ngModel)]="filters.status" (ngModelChange)="onFilterChange()">
            <option [ngValue]="undefined">All Statuses</option>
            <option value="Lobby">Lobby</option>
            <option value="Active">Active</option>
            <option value="Paused">Paused</option>
            <option value="Ended">Ended</option>
          </select>

          <select class="filter-select" [(ngModel)]="filters.progress" (ngModelChange)="onFilterChange()">
            <option [ngValue]="undefined">All Progress</option>
            <option value="NotStarted">Not Started</option>
            <option value="InProgress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>

          <input
            class="filter-search"
            type="text"
            placeholder="Search sessions..."
            [(ngModel)]="searchText"
            (ngModelChange)="onSearchChange($event)"
          />
        </div>
      </div>

      <!-- Bulk Actions Bar -->
      @if (selectedCodes.size > 0) {
        <div class="bulk-bar">
          <span class="bulk-count">{{ selectedCodes.size }} selected</span>
          <button class="btn btn-bulk-end" (click)="bulkEnd()" [disabled]="bulkLoading">End Selected</button>
          <button class="btn btn-bulk-delete" (click)="bulkDelete()" [disabled]="bulkLoading">Delete Selected</button>
          <button class="btn btn-bulk-clear" (click)="clearSelection()">✕</button>
        </div>
      }

      <!-- Sessions Table (desktop) -->
      <div class="table-container" [class.hidden-mobile]="true">
        <table class="sessions-table">
          <thead>
            <tr>
              <th class="col-check">
                <input
                  type="checkbox"
                  [checked]="allChecked"
                  [indeterminate]="someChecked && !allChecked"
                  (change)="toggleAll($event)"
                  class="checkbox"
                />
              </th>
              <th class="col-expand"></th>
              <th class="col-name sortable" (click)="toggleSort('name')">
                Session Name {{ sortIcon('name') }}
              </th>
              <th class="col-course sortable" (click)="toggleSort('course')">
                Course {{ sortIcon('course') }}
              </th>
              <th class="col-code">Join Code</th>
              <th class="col-status sortable" (click)="toggleSort('status')">
                Status {{ sortIcon('status') }}
              </th>
              <th class="col-progress sortable" (click)="toggleSort('progress')">
                Progress
              </th>
              <th class="col-created sortable" (click)="toggleSort('createdAt')">
                Created {{ sortIcon('createdAt') }}
              </th>
              <th class="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            @for (session of sessions; track session.code) {
              <tr class="session-row" [class.selected]="selectedCodes.has(session.code)">
                <td class="col-check">
                  <input
                    type="checkbox"
                    [checked]="selectedCodes.has(session.code)"
                    (change)="toggleRow(session.code)"
                    class="checkbox"
                  />
                </td>
                <td class="col-expand">
                  <button class="expand-btn" (click)="toggleExpand(session)">
                    {{ expandedCode === session.code ? '▼' : '▶' }}
                  </button>
                </td>
                <td class="col-name">
                  <a class="session-link" (click)="openDashboard(session.code)">{{ session.name }}</a>
                </td>
                <td class="col-course">
                  <span class="course-badge" [title]="session.courseName ?? ''">{{ session.courseCode ?? '—' }}</span>
                </td>
                <td class="col-code">
                  <span class="join-code">{{ session.code }}</span>
                  <button class="copy-btn" (click)="copyCode(session.code)" title="Copy code">📋</button>
                </td>
                <td class="col-status">
                  <span class="status-badge" [class]="'st-' + session.status.toLowerCase()">
                    {{ session.status }}
                  </span>
                </td>
                <td class="col-progress">
                  {{ session.completedCount }}/{{ session.enrolledCount }}
                </td>
                <td class="col-created">{{ formatDate(session.createdAt) }}</td>
                <td class="col-actions">
                  <div class="actions-menu">
                    <button class="actions-btn" (click)="toggleMenu(session.code)">⋮</button>
                    @if (menuOpenCode === session.code) {
                      <div class="dropdown-menu">
                        @if (session.status === 'Lobby') {
                          <button (click)="changeStatus(session.code, 'start')">▶ Start</button>
                        }
                        @if (session.status === 'Active') {
                          <button (click)="changeStatus(session.code, 'pause')">⏸ Pause</button>
                        }
                        @if (session.status === 'Paused') {
                          <button (click)="changeStatus(session.code, 'resume')">▶ Resume</button>
                        }
                        @if (session.status === 'Active' || session.status === 'Paused') {
                          <button (click)="changeStatus(session.code, 'end')">⏹ End</button>
                        }
                        @if (session.status === 'Ended') {
                          <button (click)="changeStatus(session.code, 'reopen')">🔄 Reopen</button>
                        }
                        <button (click)="copyShareLink(session)">🔗 Share Link</button>
                        <button class="delete-action" (click)="deleteSingle(session)">🗑 Delete</button>
                      </div>
                    }
                  </div>
                </td>
              </tr>

              <!-- Expanded student details -->
              @if (expandedCode === session.code) {
                <tr class="expanded-row">
                  <td [attr.colspan]="9">
                    <div class="expanded-panel">
                      @if (expandedLoading) {
                        <div class="loading">Loading students...</div>
                      } @else if (expandedDetail) {
                        <table class="students-table">
                          <thead>
                            <tr>
                              <th>Student</th>
                              <th>Status</th>
                              <th>Challenge</th>
                              <th>Points</th>
                              <th>Submissions</th>
                            </tr>
                          </thead>
                          <tbody>
                            @for (p of expandedDetail.participants; track p.userId) {
                              <tr>
                                <td class="student-name">{{ p.displayName }}</td>
                                <td>
                                  <span class="conn-status" [class]="'conn-' + p.connectionStatus">
                                    {{ p.connectionStatus === 'online' ? '●' : p.connectionStatus === 'flagged' ? '⚠' : '○' }}
                                    {{ p.connectionStatus | titlecase }}
                                  </span>
                                </td>
                                <td>{{ p.currentChallengeIndex }}/{{ expandedDetail.challengeIds.length }}</td>
                                <td>{{ p.totalPoints }}</td>
                                <td>{{ p.submissionCount }}</td>
                              </tr>
                            }
                          </tbody>
                        </table>
                        @if (expandedDetail.enrolledNotJoinedCount > 0) {
                          <div class="not-joined">
                            Enrolled but not joined: {{ expandedDetail.enrolledNotJoinedCount }} students
                          </div>
                        }
                        <div class="expanded-actions">
                          <button class="btn btn-sm" (click)="openDashboard(session.code)">View Full Dashboard →</button>
                        </div>
                      }
                    </div>
                  </td>
                </tr>
              }
            }

            @if (sessions.length === 0 && !loading) {
              <tr>
                <td [attr.colspan]="9" class="empty-row">
                  No sessions found.
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Mobile Card View -->
      <div class="card-list" [class.hidden-desktop]="true">
        @for (session of sessions; track session.code) {
          <div
            class="session-card"
            [class.card-selected]="selectedCodes.has(session.code)"
            (click)="openDashboard(session.code)"
          >
            <div class="card-top">
              <span class="card-name">{{ session.name }}</span>
              <span class="status-badge" [class]="'st-' + session.status.toLowerCase()">
                {{ session.status }}
              </span>
            </div>
            <div class="card-mid">
              <span class="course-badge">{{ session.courseCode ?? '—' }}</span>
              <span class="join-code">{{ session.code }}</span>
            </div>
            <div class="card-bottom">
              <span class="progress-text">{{ session.completedCount }}/{{ session.enrolledCount }} completed</span>
              <span class="date-text">{{ formatDate(session.createdAt) }}</span>
            </div>
          </div>
        }
      </div>

      <!-- Pagination -->
      @if (totalCount > filters.pageSize) {
        <div class="pagination">
          <span class="page-info">
            Showing {{ (filters.page - 1) * filters.pageSize + 1 }}–{{ Math.min(filters.page * filters.pageSize, totalCount) }} of {{ totalCount }}
          </span>
          <div class="page-buttons">
            <button class="page-btn" [disabled]="filters.page <= 1" (click)="goToPage(filters.page - 1)">◀</button>
            @for (p of pageNumbers; track p) {
              <button class="page-btn" [class.active]="p === filters.page" (click)="goToPage(p)">{{ p }}</button>
            }
            <button class="page-btn" [disabled]="filters.page >= totalPages" (click)="goToPage(filters.page + 1)">▶</button>
          </div>
        </div>
      }

      @if (loading) {
        <div class="loading-overlay">Loading...</div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
        color: #fff;
        overflow-y: auto;
      }

      .sessions-page {
        max-width: 1400px;
        margin: 0 auto;
        padding: 1rem 1.5rem 3rem;
      }

      /* Header */
      .page-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 0;
        margin-bottom: 1rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        flex-wrap: wrap;
        gap: 0.75rem;
      }

      .logo {
        font-size: 1.5rem;
        font-weight: 800;
        background: linear-gradient(90deg, #00d2ff, #7b2ff7);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin: 0;
        white-space: nowrap;
      }

      .subtitle {
        font-weight: 400;
        font-size: 1.1rem;
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 1rem;
      }

      .user-info {
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.5);
      }

      /* Buttons */
      .btn {
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 8px;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        color: #fff;
        transition: opacity 0.2s, transform 0.1s;
        white-space: nowrap;
      }

      .btn:hover { opacity: 0.9; transform: translateY(-1px); }
      .btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

      .btn-create { background: linear-gradient(90deg, #7b2ff7, #00d2ff); }
      .btn-sm {
        padding: 0.35rem 0.75rem;
        font-size: 0.75rem;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 6px;
      }

      /* Toolbar */
      .toolbar {
        margin-bottom: 1rem;
      }

      .filters {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .filter-select, .filter-search {
        padding: 0.5rem 0.75rem;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 8px;
        color: #fff;
        font-size: 0.85rem;
        outline: none;
      }

      .filter-select option { background: #1a1a2e; color: #fff; }
      .filter-select:focus, .filter-search:focus { border-color: #7b2ff7; }
      .filter-search { flex: 1; min-width: 180px; }
      .filter-search::placeholder { color: rgba(255, 255, 255, 0.3); }

      /* Bulk actions bar */
      .bulk-bar {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.6rem 1rem;
        background: rgba(123, 47, 247, 0.15);
        border: 1px solid rgba(123, 47, 247, 0.3);
        border-radius: 8px;
        margin-bottom: 1rem;
      }

      .bulk-count {
        font-weight: 600;
        font-size: 0.85rem;
      }

      .btn-bulk-end {
        background: rgba(255, 165, 2, 0.3);
        border: 1px solid rgba(255, 165, 2, 0.5);
        color: #ffa502;
      }

      .btn-bulk-delete {
        background: rgba(255, 71, 87, 0.2);
        border: 1px solid rgba(255, 71, 87, 0.4);
        color: #ff4757;
      }

      .btn-bulk-clear {
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: rgba(255, 255, 255, 0.6);
        margin-left: auto;
      }

      /* Table */
      .table-container {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 12px;
        overflow-x: auto;
      }

      .sessions-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
      }

      .sessions-table th {
        padding: 0.75rem;
        text-align: left;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: rgba(255, 255, 255, 0.5);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        white-space: nowrap;
      }

      .sessions-table td {
        padding: 0.6rem 0.75rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        vertical-align: middle;
      }

      .sortable { cursor: pointer; user-select: none; }
      .sortable:hover { color: rgba(255, 255, 255, 0.8); }

      .col-check { width: 48px; text-align: center; }
      .col-expand { width: 40px; text-align: center; }
      .col-code { width: 120px; }
      .col-status { width: 100px; }
      .col-progress { width: 100px; }
      .col-created { width: 100px; }
      .col-actions { width: 50px; }

      .checkbox {
        width: 16px;
        height: 16px;
        cursor: pointer;
        accent-color: #7b2ff7;
      }

      .session-row:hover { background: rgba(255, 255, 255, 0.03); }
      .session-row.selected { background: rgba(123, 47, 247, 0.08); }

      .session-link {
        color: #00d2ff;
        cursor: pointer;
        font-weight: 600;
        text-decoration: none;
      }
      .session-link:hover { text-decoration: underline; }

      .course-badge {
        font-size: 0.75rem;
        padding: 0.15rem 0.5rem;
        background: rgba(255, 255, 255, 0.08);
        border-radius: 4px;
        letter-spacing: 0.5px;
      }

      .join-code {
        font-family: monospace;
        color: #00d2ff;
        letter-spacing: 2px;
        font-size: 0.85rem;
      }

      .copy-btn {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 0.7rem;
        padding: 0.1rem 0.3rem;
        opacity: 0.5;
        transition: opacity 0.2s;
      }
      .copy-btn:hover { opacity: 1; }

      .status-badge {
        font-size: 0.7rem;
        padding: 0.2rem 0.6rem;
        border-radius: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .st-lobby { background: rgba(158, 158, 158, 0.2); color: #9e9e9e; }
      .st-active { background: rgba(46, 213, 115, 0.15); color: #2ed573; }
      .st-paused { background: rgba(255, 165, 2, 0.15); color: #ffa502; }
      .st-ended { background: rgba(255, 71, 87, 0.15); color: #ff4757; }

      .expand-btn {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.4);
        cursor: pointer;
        font-size: 0.7rem;
        padding: 0.3rem;
        min-width: 44px;
        min-height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .expand-btn:hover { color: rgba(255, 255, 255, 0.8); }

      /* Actions menu */
      .actions-menu { position: relative; }

      .actions-btn {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.5);
        cursor: pointer;
        font-size: 1.2rem;
        padding: 0.3rem 0.5rem;
        min-width: 44px;
        min-height: 44px;
      }
      .actions-btn:hover { color: #fff; }

      .dropdown-menu {
        position: absolute;
        right: 0;
        top: 100%;
        background: #1a1a2e;
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 8px;
        padding: 0.25rem 0;
        min-width: 160px;
        z-index: 100;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      }

      .dropdown-menu button {
        display: block;
        width: 100%;
        padding: 0.5rem 0.75rem;
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.8);
        font-size: 0.8rem;
        text-align: left;
        cursor: pointer;
      }
      .dropdown-menu button:hover { background: rgba(255, 255, 255, 0.08); }
      .dropdown-menu .delete-action { color: #ff4757; }

      /* Expanded row */
      .expanded-row td {
        padding: 0;
        background: rgba(255, 255, 255, 0.02);
      }

      .expanded-panel {
        padding: 1rem 1.5rem;
      }

      .students-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.8rem;
        margin-bottom: 0.75rem;
      }

      .students-table th {
        padding: 0.4rem 0.6rem;
        text-align: left;
        font-size: 0.7rem;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.4);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      }

      .students-table td {
        padding: 0.4rem 0.6rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.03);
      }

      .student-name { font-weight: 600; }

      .conn-status { font-size: 0.75rem; }
      .conn-online { color: #2ed573; }
      .conn-offline { color: rgba(255, 255, 255, 0.35); }
      .conn-flagged { color: #ffa502; }

      .not-joined {
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.4);
        padding: 0.5rem 0;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
      }

      .expanded-actions {
        display: flex;
        gap: 0.5rem;
        padding-top: 0.5rem;
      }

      .empty-row {
        text-align: center;
        color: rgba(255, 255, 255, 0.35);
        padding: 3rem !important;
      }

      /* Mobile cards */
      .card-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .session-card {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 1rem 1.25rem;
        cursor: pointer;
        transition: border-color 0.2s, transform 0.15s;
      }

      .session-card:hover {
        border-color: rgba(123, 47, 247, 0.5);
        transform: translateY(-1px);
      }

      .card-selected { border-color: #7b2ff7; background: rgba(123, 47, 247, 0.1); }

      .card-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
      }

      .card-name { font-weight: 600; font-size: 1rem; }

      .card-mid {
        display: flex;
        gap: 1rem;
        margin-bottom: 0.5rem;
      }

      .card-bottom {
        display: flex;
        justify-content: space-between;
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.4);
      }

      .progress-text { color: rgba(255, 255, 255, 0.5); }

      /* Pagination */
      .pagination {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem 0;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      .page-info {
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.5);
      }

      .page-buttons {
        display: flex;
        gap: 0.25rem;
      }

      .page-btn {
        padding: 0.35rem 0.65rem;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        color: rgba(255, 255, 255, 0.7);
        cursor: pointer;
        font-size: 0.8rem;
        min-width: 36px;
        min-height: 36px;
      }
      .page-btn:hover { border-color: rgba(255, 255, 255, 0.3); }
      .page-btn:disabled { opacity: 0.3; cursor: not-allowed; }
      .page-btn.active { background: #7b2ff7; border-color: #7b2ff7; color: #fff; }

      .loading-overlay {
        text-align: center;
        padding: 2rem;
        color: rgba(255, 255, 255, 0.5);
      }

      .loading {
        text-align: center;
        padding: 1rem;
        color: rgba(255, 255, 255, 0.4);
        font-size: 0.85rem;
      }

      /* Responsive */
      .hidden-mobile { display: block; }
      .hidden-desktop { display: none; }

      @media (max-width: 768px) {
        .hidden-mobile { display: none; }
        .hidden-desktop { display: block; }

        .filters { flex-direction: column; }
        .filter-select, .filter-search { width: 100%; }

        .bulk-bar {
          flex-wrap: wrap;
          position: sticky;
          bottom: 0;
          z-index: 50;
        }

        .page-header { flex-direction: column; align-items: flex-start; }
      }

      @media (min-width: 769px) and (max-width: 1199px) {
        .col-created, .col-code { display: none; }
      }
    `,
  ],
})
export class SessionsListComponent implements OnInit, OnDestroy {
  Math = Math;

  sessions: SessionListItem[] = [];
  courses: Course[] = [];
  totalCount = 0;
  loading = false;
  bulkLoading = false;

  filters: SessionFilters = {
    page: 1,
    pageSize: 20,
    sortBy: 'createdAt',
    sortDir: 'desc',
  };

  searchText = '';
  selectedCodes = new Set<string>();
  expandedCode: string | null = null;
  expandedDetail: SessionDetailResponse | null = null;
  expandedLoading = false;
  menuOpenCode: string | null = null;
  currentUserEmail = '';

  private search$ = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(
    private sessionListService: SessionListService,
    private authService: AuthService,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.currentUserEmail = this.authService.currentUser?.email ?? '';
    this.loadCourses();
    this.loadSessions();

    this.search$
      .pipe(debounceTime(300), takeUntil(this.destroy$))
      .subscribe((term) => {
        this.filters.search = term || undefined;
        this.filters.page = 1;
        this.loadSessions();
      });

    document.addEventListener('click', this.closeMenu);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    document.removeEventListener('click', this.closeMenu);
  }

  private closeMenu = () => {
    this.menuOpenCode = null;
  };

  loadCourses(): void {
    this.http.get<Course[]>('/api/instructor/courses').subscribe({
      next: (courses) => (this.courses = courses),
      error: () => {},
    });
  }

  loadSessions(): void {
    this.loading = true;
    this.sessionListService.getSessions(this.filters).subscribe({
      next: (result) => {
        this.sessions = result.items;
        this.totalCount = result.totalCount;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  onFilterChange(): void {
    this.filters.page = 1;
    this.loadSessions();
  }

  onSearchChange(text: string): void {
    this.search$.next(text);
  }

  toggleSort(col: string): void {
    if (this.filters.sortBy === col) {
      this.filters.sortDir = this.filters.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.filters.sortBy = col;
      this.filters.sortDir = 'asc';
    }
    this.loadSessions();
  }

  sortIcon(col: string): string {
    if (this.filters.sortBy !== col) return '';
    return this.filters.sortDir === 'asc' ? '↑' : '↓';
  }

  // Selection
  get allChecked(): boolean {
    return this.sessions.length > 0 && this.sessions.every((s) => this.selectedCodes.has(s.code));
  }

  get someChecked(): boolean {
    return this.sessions.some((s) => this.selectedCodes.has(s.code));
  }

  toggleAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.sessions.forEach((s) => this.selectedCodes.add(s.code));
    } else {
      this.sessions.forEach((s) => this.selectedCodes.delete(s.code));
    }
  }

  toggleRow(code: string): void {
    if (this.selectedCodes.has(code)) {
      this.selectedCodes.delete(code);
    } else {
      this.selectedCodes.add(code);
    }
  }

  clearSelection(): void {
    this.selectedCodes.clear();
  }

  // Expand
  toggleExpand(session: SessionListItem): void {
    if (this.expandedCode === session.code) {
      this.expandedCode = null;
      this.expandedDetail = null;
      return;
    }

    this.expandedCode = session.code;
    this.expandedDetail = null;
    this.expandedLoading = true;

    this.sessionListService.getSessionDetail(session.code).subscribe({
      next: (detail) => {
        this.expandedDetail = detail;
        this.expandedLoading = false;
      },
      error: () => {
        this.expandedLoading = false;
      },
    });
  }

  // Actions
  toggleMenu(code: string): void {
    event?.stopPropagation();
    this.menuOpenCode = this.menuOpenCode === code ? null : code;
  }

  changeStatus(code: string, status: string): void {
    this.menuOpenCode = null;
    this.http.put(`/api/teacher/sessions/${code}/status`, { status }).subscribe({
      next: () => this.loadSessions(),
    });
  }

  deleteSingle(session: SessionListItem): void {
    this.menuOpenCode = null;
    if (!confirm(`Delete session "${session.name}"? This cannot be undone.`)) return;
    this.http.delete(`/api/teacher/sessions/${session.code}`).subscribe({
      next: () => {
        if (this.expandedCode === session.code) {
          this.expandedCode = null;
          this.expandedDetail = null;
        }
        this.loadSessions();
      },
    });
  }

  copyCode(code: string): void {
    navigator.clipboard.writeText(code);
  }

  copyShareLink(session: SessionListItem): void {
    this.menuOpenCode = null;
    const link = `${location.origin}/join/${session.code}`;
    navigator.clipboard.writeText(link);
  }

  bulkEnd(): void {
    const codes = Array.from(this.selectedCodes);
    if (!confirm(`End ${codes.length} session(s)?`)) return;
    this.bulkLoading = true;
    this.sessionListService.bulkEndSessions(codes).subscribe({
      next: () => {
        this.clearSelection();
        this.bulkLoading = false;
        this.loadSessions();
      },
      error: () => (this.bulkLoading = false),
    });
  }

  bulkDelete(): void {
    const codes = Array.from(this.selectedCodes);
    if (!confirm(`Delete ${codes.length} session(s)? Only Lobby and Ended sessions will be deleted.`)) return;
    this.bulkLoading = true;
    this.sessionListService.bulkDeleteSessions(codes).subscribe({
      next: () => {
        this.clearSelection();
        this.bulkLoading = false;
        this.loadSessions();
      },
      error: () => (this.bulkLoading = false),
    });
  }

  openDashboard(code: string): void {
    this.router.navigate(['/teacher/sessions', code]);
  }

  navigateToCreate(): void {
    this.router.navigate(['/teacher']);
  }

  // Pagination
  get totalPages(): number {
    return Math.ceil(this.totalCount / this.filters.pageSize);
  }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    const current = this.filters.page;
    const pages: number[] = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.filters.page = page;
    this.loadSessions();
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = diff / (1000 * 60 * 60);

    if (hours < 1) return `${Math.round(diff / 60000)}m ago`;
    if (hours < 24) return `${Math.round(hours)}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
