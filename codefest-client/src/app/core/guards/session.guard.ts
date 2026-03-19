import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '../services/session.service';

export const sessionGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);

  if (session.snapshot.studentId > 0) {
    return true;
  }

  return router.createUrlTree(['/join']);
};
