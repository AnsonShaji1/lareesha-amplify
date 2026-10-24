import { Injectable } from '@angular/core';
import { NotificationService } from './notification.service';
import { BehaviorSubject, Observable, from, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import {
  confirmResetPassword,
  confirmSignIn,
  confirmSignUp,
  fetchAuthSession,
  resendSignUpCode,
  fetchUserAttributes,
  getCurrentUser,
  resetPassword,
  signIn,
  signInWithRedirect,
  signOut,
  signUp,
  updateUserAttributes,
} from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';

function toCognitoPhone(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const compact = trimmed.replace(/[\s()-]/g, '');
  if (compact.startsWith('+')) {
    return /^\+[1-9]\d{7,14}$/.test(compact) ? compact : null;
  }
  const digits = compact.replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith('0') && /^[6-9]/.test(digits.slice(1))) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) return `+${digits}`;
  return null;
}

function fromCognitoPhone(value: string): string {
  const trimmed = value.trim();
  if (/^\+91\d{10}$/.test(trimmed)) return trimmed.slice(3);
  return trimmed;
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  date_joined: string;
  pk?: string;
  username?: string;
  gender?: string;
  phone?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password1: string;
  password2: string;
  first_name?: string;
  last_name?: string;
}

export interface AuthResponse {
  user?: User;
  nextStep?: string;
}

const WELCOME_TOAST_KEY = 'll_auth_welcome';
let welcomeToastQueued = false;

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(private notifications: NotificationService) {
    Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signInWithRedirect') {
        // Google Hosted UI returns here after a full redirect — show welcome once session loads.
        void this.refreshUser().then((ok) => {
          if (ok) this.consumeWelcomeToast();
        });
        return;
      }
      if (payload.event === 'signedIn') {
        void this.refreshUser();
      }
      if (payload.event === 'signInWithRedirect_failure') {
        this.clearWelcomeToastFlag();
        const message = (payload as { data?: { error?: { message?: string } } }).data?.error?.message;
        this.notifications.error(message || 'Google sign-in failed');
      }
      if (payload.event === 'signedOut') {
        this.clearWelcomeToastFlag();
        this.currentUserSubject.next(null);
        this.isAuthenticatedSubject.next(false);
      }
    });
  }

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  private refreshInFlight: Promise<boolean> | null = null;

  public initializeAuth(): Promise<boolean> {
    return this.refreshUser().then((ok) => {
      // Backup if Hub event raced ahead of snackbar bootstrap after Google redirect.
      if (ok) this.consumeWelcomeToast();
      return ok;
    });
  }

  private refreshUser(): Promise<boolean> {
    if (this.refreshInFlight) return this.refreshInFlight;
    this.refreshInFlight = this.loadSession().finally(() => {
      this.refreshInFlight = null;
    });
    return this.refreshInFlight;
  }

  private async loadSession(): Promise<boolean> {
    try {
      const session = await fetchAuthSession();
      if (!session.tokens?.idToken) {
        if (this.currentUserSubject.value) this.currentUserSubject.next(null);
        if (this.isAuthenticatedSubject.value) this.isAuthenticatedSubject.next(false);
        return false;
      }
      this.publishSession(await this.loadUser());
      return true;
    } catch {
      if (this.currentUserSubject.value) this.currentUserSubject.next(null);
      if (this.isAuthenticatedSubject.value) this.isAuthenticatedSubject.next(false);
      return false;
    }
  }

  /** Mark that the next successful session should show a welcome toast (Google redirect). */
  private markWelcomeToastPending(): void {
    try {
      sessionStorage.setItem(WELCOME_TOAST_KEY, '1');
    } catch {
      /* private mode / blocked storage */
    }
  }

  private clearWelcomeToastFlag(): void {
    try {
      sessionStorage.removeItem(WELCOME_TOAST_KEY);
    } catch {
      /* ignore */
    }
  }

  private consumeWelcomeToast(): void {
    let pending = false;
    try {
      pending = sessionStorage.getItem(WELCOME_TOAST_KEY) === '1';
      if (pending) sessionStorage.removeItem(WELCOME_TOAST_KEY);
    } catch {
      return;
    }
    if (!pending || welcomeToastQueued) return;
    welcomeToastQueued = true;
    // Defer until overlays/snackbar are ready after redirect bootstrap.
    setTimeout(() => this.notifications.success('Welcome back!'), 0);
  }

  private publishSession(user: User): void {
    if (this.currentUserSubject.value?.id !== user.id) {
      this.currentUserSubject.next(user);
    }
    if (!this.isAuthenticatedSubject.value) {
      this.isAuthenticatedSubject.next(true);
    }
  }

  private async loadUser(): Promise<User> {
    const current = await getCurrentUser();
    const attrs = await this.readAttributes();
    return {
      id: current.userId,
      email: attrs.email || current.username,
      first_name: attrs.given_name || '',
      last_name: attrs.family_name || '',
      date_joined: '',
      username: current.username,
      gender: attrs.gender || '',
      phone: fromCognitoPhone(attrs.phone_number || ''),
    };
  }

  private async readAttributes(): Promise<{
    email?: string;
    given_name?: string;
    family_name?: string;
    gender?: string;
    phone_number?: string;
  }> {
    try {
      return await fetchUserAttributes();
    } catch {
      const session = await fetchAuthSession();
      const payload = session.tokens?.idToken?.payload ?? {};
      const claim = (key: string) => (typeof payload[key] === 'string' ? payload[key] : undefined);
      return {
        email: claim('email'),
        given_name: claim('given_name'),
        family_name: claim('family_name'),
        gender: claim('gender'),
        phone_number: claim('phone_number'),
      };
    }
  }

  login(credentials: LoginCredentials): Observable<AuthResponse> {
    // Password sign-in uses its own toast; drop any leftover Google-redirect flag.
    this.clearWelcomeToastFlag();
    return from(this.signInWithRetry(credentials.email, credentials.password)).pipe(
      switchMap(async (result) => {
        if (result.nextStep.signInStep !== 'DONE') {
          return { nextStep: result.nextStep.signInStep };
        }
        const user = await this.loadUser();
        this.publishSession(user);
        return { user };
      }),
    );
  }

  private async signInWithRetry(username: string, password: string) {
    try {
      return await signIn({ username, password });
    } catch (error: any) {
      if (error?.name === 'UserAlreadyAuthenticatedException') {
        await signOut();
        return signIn({ username, password });
      }
      throw error;
    }
  }

  completeNewPassword(newPassword: string, givenName?: string): Observable<AuthResponse> {
    const userAttributes: Record<string, string> = {};
    if (givenName) {
      userAttributes['given_name'] = givenName;
    }
    return from(
      confirmSignIn({
        challengeResponse: newPassword,
        options: Object.keys(userAttributes).length ? { userAttributes } : undefined,
      }),
    ).pipe(
      switchMap(async (result) => {
        if (result.nextStep.signInStep !== 'DONE') {
          return { nextStep: result.nextStep.signInStep };
        }
        const user = await this.loadUser();
        this.publishSession(user);
        return { user };
      }),
    );
  }

  register(data: RegisterData): Observable<AuthResponse> {
    return from(
      signUp({
        username: data.email,
        password: data.password1,
        options: {
          userAttributes: {
            email: data.email,
            given_name: data.first_name || '',
            family_name: data.last_name || '',
          },
        },
      }),
    ).pipe(
      map((result) => ({
        nextStep: result.nextStep.signUpStep,
        user: {
          id: result.userId || '',
          email: data.email,
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          date_joined: '',
        },
      })),
    );
  }

  resendConfirmationCode(email: string): Observable<void> {
    return from(resendSignUpCode({ username: email })).pipe(map(() => undefined));
  }

  confirmSignUp(email: string, code: string, password?: string): Observable<AuthResponse> {
    return from(confirmSignUp({ username: email, confirmationCode: code })).pipe(
      switchMap(async () => {
        if (password) {
          await signIn({ username: email, password });
          const user = await this.loadUser();
          this.publishSession(user);
          return { user };
        }
        return {};
      }),
    );
  }

  logout(): Observable<unknown> {
    return from(signOut()).pipe(
      tap(() => {
        this.currentUserSubject.next(null);
        this.isAuthenticatedSubject.next(false);
      }),
    );
  }

  googleLogin(_accessToken?: string): Observable<AuthResponse> {
    return from(this.startGoogleSignIn());
  }

  private async startGoogleSignIn(): Promise<AuthResponse> {
    this.markWelcomeToastPending();
    try {
      await signInWithRedirect({ provider: 'Google' });
      return {};
    } catch (error: unknown) {
      if ((error as { name?: string })?.name !== 'UserAlreadyAuthenticatedException') {
        this.clearWelcomeToastFlag();
        throw error;
      }
      await signOut();
      this.markWelcomeToastPending();
      await signInWithRedirect({ provider: 'Google' });
      return {};
    }
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return from(resetPassword({ username: email })).pipe(
      map(() => ({ message: 'If an account exists with this email, a reset code has been sent.' })),
    );
  }

  resetPassword(email: string, code: string, newPassword: string): Observable<{ message: string }> {
    return from(
      confirmResetPassword({
        username: email,
        confirmationCode: code,
        newPassword,
      }),
    ).pipe(map(() => ({ message: 'Password has been reset successfully' })));
  }

  getCurrentUser(): Observable<User> {
    return from(this.loadUser());
  }

  updateUser(userData: Partial<User>): Observable<User> {
    const attrs: Record<string, string> = {};
    if (userData.first_name !== undefined) attrs['given_name'] = userData.first_name;
    if (userData.last_name !== undefined) attrs['family_name'] = userData.last_name;
    if (userData.phone !== undefined && userData.phone.trim()) {
      const phone = toCognitoPhone(userData.phone);
      if (!phone) {
        return throwError(() => new Error('Enter a 10-digit mobile number.'));
      }
      attrs['phone_number'] = phone;
    }
    if (userData.gender !== undefined && userData.gender.trim()) {
      attrs['gender'] = userData.gender;
    }
    return from(updateUserAttributes({ userAttributes: attrs })).pipe(
      switchMap(() => from(this.loadUser())),
      tap((user) => this.currentUserSubject.next(user)),
    );
  }

  get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  get isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  get token(): string | null {
    return null;
  }

  isAdmin(): Observable<boolean> {
    return from(fetchAuthSession()).pipe(
      map((session) => {
        const groups = (session.tokens?.idToken?.payload['cognito:groups'] as string[]) || [];
        return groups.includes('admin');
      }),
      catchError(() => of(false)),
    );
  }
}
