import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { confirmSignIn, fetchAuthSession, signIn, signOut } from 'aws-amplify/auth';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  template: `
    <section class="login-wrap">
      <div class="card login-card">
        <p class="eyebrow">Lareesha Luxe</p>
        <h1>Administration</h1>
        <p class="lede">Sign in with a Cognito user in the <strong>admin</strong> group.</p>
        @if (!needsNewPassword()) {
          <label class="field">Email
            <input [(ngModel)]="email" type="email" autocomplete="username" />
          </label>
          <label class="field">Password
            <input [(ngModel)]="password" type="password" autocomplete="current-password" />
          </label>
          <button class="primary" (click)="login()" [disabled]="busy()">{{ busy() ? 'Signing in…' : 'Log in' }}</button>
        } @else {
          <p class="hint">Console-created users must set a permanent password once.</p>
          <label class="field">First name
            <input [(ngModel)]="givenName" type="text" />
          </label>
          <label class="field">New password
            <input [(ngModel)]="newPassword" type="password" autocomplete="new-password" />
          </label>
          <button class="primary" (click)="finishNewPassword()" [disabled]="busy()">Save password and continue</button>
        }
        @if (error()) { <p class="error">{{ error() }}</p> }
      </div>
    </section>
  `,
})
export class LoginPage {
  private router = inject(Router);
  email = '';
  password = '';
  givenName = '';
  newPassword = '';
  busy = signal(false);
  error = signal('');
  needsNewPassword = signal(false);

  async login() {
    this.busy.set(true);
    this.error.set('');
    try {
      const result = await this.signInWithRetry();
      if (result.nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        this.needsNewPassword.set(true);
        return;
      }
      if (result.nextStep.signInStep !== 'DONE') {
        this.error.set(`Sign-in needs another step: ${result.nextStep.signInStep}`);
        return;
      }
      await this.enterAdmin();
    } catch (err: any) {
      this.error.set(err?.message || 'Sign-in failed');
    } finally {
      this.busy.set(false);
    }
  }

  async finishNewPassword() {
    this.busy.set(true);
    this.error.set('');
    try {
      const result = await confirmSignIn({
        challengeResponse: this.newPassword,
        options: this.givenName ? { userAttributes: { given_name: this.givenName } } : undefined,
      });
      if (result.nextStep.signInStep !== 'DONE') {
        this.error.set(`Sign-in needs another step: ${result.nextStep.signInStep}`);
        return;
      }
      this.needsNewPassword.set(false);
      await this.enterAdmin();
    } catch (err: any) {
      this.error.set(err?.message || 'Could not save the new password');
    } finally {
      this.busy.set(false);
    }
  }

  private async signInWithRetry() {
    try {
      return await signIn({ username: this.email, password: this.password });
    } catch (error: any) {
      if (error?.name === 'UserAlreadyAuthenticatedException') {
        await signOut();
        return signIn({ username: this.email, password: this.password });
      }
      throw error;
    }
  }

  private async enterAdmin() {
    const session = await fetchAuthSession({ forceRefresh: true });
    const groups = (session.tokens?.idToken?.payload['cognito:groups'] as string[]) || [];
    if (!groups.includes('admin')) {
      await signOut();
      this.error.set('Signed in, but this account is not in the Cognito admin group.');
      return;
    }
    await this.router.navigateByUrl('/');
  }
}
