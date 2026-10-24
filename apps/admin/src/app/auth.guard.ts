import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { fetchAuthSession } from 'aws-amplify/auth';

export const adminGuard: CanActivateFn = async () => {
  const router = inject(Router);
  try {
    const session = await fetchAuthSession();
    const groups = (session.tokens?.idToken?.payload['cognito:groups'] as string[]) || [];
    if (groups.includes('admin')) {
      return true;
    }
  } catch {
    /* not signed in */
  }
  return router.parseUrl('/login');
};

export async function isAdminUser(): Promise<boolean> {
  try {
    const session = await fetchAuthSession();
    const groups = (session.tokens?.idToken?.payload['cognito:groups'] as string[]) || [];
    return groups.includes('admin');
  } catch {
    return false;
  }
}
