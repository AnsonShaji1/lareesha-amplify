import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { firstValueFrom } from 'rxjs';

/** Redirect authenticated users away from sign-in / sign-up pages */
export const guestAuthGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  try {
    const isAuthenticated = await firstValueFrom(authService.isAuthenticated$);
    if (isAuthenticated) {
      await router.navigate(['/']);
      return false;
    }
    return true;
  } catch {
    return true;
  }
};
