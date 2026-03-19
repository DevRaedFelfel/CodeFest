import { Routes } from '@angular/router';
import { sessionGuard } from './core/guards/session.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'join', pathMatch: 'full' },
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
  {
    path: 'teacher',
    loadComponent: () =>
      import('./features/teacher/teacher.component').then(
        (m) => m.TeacherComponent
      ),
  },
  { path: '**', redirectTo: 'join' },
];
