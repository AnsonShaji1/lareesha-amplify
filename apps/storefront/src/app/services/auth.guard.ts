import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { firstValueFrom } from 'rxjs';

export const authGuard: CanActivateFn = async (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  try {
    const isAuthenticated = await firstValueFrom(authService.isAuthenticated$);

    if (isAuthenticated) {
      return true;
    }
  } catch {
    // Error getting auth status
  }

  await router.navigate(['/sign-in'], { queryParams: { returnUrl: state.url } });
  return false;
};
