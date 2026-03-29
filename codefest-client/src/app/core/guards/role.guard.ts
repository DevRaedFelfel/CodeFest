import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export function roleGuard(requiredRole: string): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isAuthenticated) {
      return router.createUrlTree(['/login']);
    }

    if (auth.hasRole(requiredRole)) {
      return true;
    }

    // Redirect based on actual role
    const user = auth.currentUser;
    if (user?.role === 'Student') return router.createUrlTree(['/student']);
    if (user?.role === 'Instructor') return router.createUrlTree(['/teacher/sessions']);
    return router.createUrlTree(['/login']);
  };
}
