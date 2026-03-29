import { Routes } from '@angular/router';
import { sessionGuard } from './core/guards/session.guard';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  // --- Public ---
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login.component').then(
        (m) => m.LoginComponent
      ),
  },

  // --- Student ---
  {
    path: 'student',
    loadComponent: () =>
      import('./features/student-home/student-home.component').then(
        (m) => m.StudentHomeComponent
      ),
    canActivate: [authGuard, roleGuard('Student')],
  },
  {
    path: 'join/:code',
    loadComponent: () =>
      import('./features/join/join.component').then((m) => m.JoinComponent),
    canActivate: [authGuard],
  },
  {
    path: 'join',
    loadComponent: () =>
      import('./features/join/join.component').then((m) => m.JoinComponent),
  },
  {
    path: 'code',
    loadComponent: () =>
      import('./features/coding/coding.component').then(
        (m) => m.CodingComponent
      ),
    canActivate: [sessionGuard],
  },

  // --- Instructor / Teacher ---
  {
    path: 'teacher/sessions',
    loadComponent: () =>
      import(
        './features/teacher/sessions-list/sessions-list.component'
      ).then((m) => m.SessionsListComponent),
    canActivate: [authGuard, roleGuard('Instructor')],
  },
  {
    path: 'teacher/sessions/:code',
    loadComponent: () =>
      import('./features/teacher/teacher.component').then(
        (m) => m.TeacherComponent
      ),
    canActivate: [authGuard, roleGuard('Instructor')],
  },
  {
    path: 'teacher',
    loadComponent: () =>
      import('./features/teacher/teacher.component').then(
        (m) => m.TeacherComponent
      ),
    canActivate: [authGuard, roleGuard('Instructor')],
  },
  {
    path: 'teacher/courses/:id/sessions',
    loadComponent: () =>
      import(
        './features/teacher/session-history/session-history.component'
      ).then((m) => m.SessionHistoryComponent),
    canActivate: [authGuard, roleGuard('Instructor')],
  },
  {
    path: 'teacher/courses/:id/students',
    loadComponent: () =>
      import(
        './features/teacher/course-students/course-students.component'
      ).then((m) => m.CourseStudentsComponent),
    canActivate: [authGuard, roleGuard('Instructor')],
  },

  // --- Super Admin ---
  {
    path: 'admin',
    loadComponent: () =>
      import('./features/admin/admin-dashboard.component').then(
        (m) => m.AdminDashboardComponent
      ),
    canActivate: [authGuard, roleGuard('SuperAdmin')],
  },
  {
    path: 'admin/users',
    loadComponent: () =>
      import('./features/admin/admin-users.component').then(
        (m) => m.AdminUsersComponent
      ),
    canActivate: [authGuard, roleGuard('SuperAdmin')],
  },
  {
    path: 'admin/courses',
    loadComponent: () =>
      import('./features/admin/admin-courses.component').then(
        (m) => m.AdminCoursesComponent
      ),
    canActivate: [authGuard, roleGuard('SuperAdmin')],
  },
  {
    path: 'admin/enrollments',
    loadComponent: () =>
      import('./features/admin/admin-enrollments.component').then(
        (m) => m.AdminEnrollmentsComponent
      ),
    canActivate: [authGuard, roleGuard('SuperAdmin')],
  },
  {
    path: 'admin/enrollment-requests',
    loadComponent: () =>
      import('./features/admin/admin-requests.component').then(
        (m) => m.AdminRequestsComponent
      ),
    canActivate: [authGuard, roleGuard('SuperAdmin')],
  },
  {
    path: 'admin/academic-loads',
    loadComponent: () =>
      import('./features/admin/admin-academic-loads.component').then(
        (m) => m.AdminAcademicLoadsComponent
      ),
    canActivate: [authGuard, roleGuard('SuperAdmin')],
  },

  // --- Not Enrolled ---
  {
    path: 'not-enrolled',
    loadComponent: () =>
      import('./features/not-enrolled/not-enrolled.component').then(
        (m) => m.NotEnrolledComponent
      ),
    canActivate: [authGuard],
  },

  // --- Redirects ---
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' },
];
