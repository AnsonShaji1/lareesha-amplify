import { Component, EventEmitter, Input, NgZone, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService, User } from '../../services/auth.service';
import { authErrorMessage } from '../../services/auth-errors';
import { NotificationService } from '../../services/notification.service';

declare var google: any;

const GOOGLE_GSI_SCRIPT = 'https://accounts.google.com/gsi/client';

@Component({
  selector: 'app-auth-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatIconModule,
  ],
  templateUrl: './auth-form.html',
  styleUrl: './auth-form.scss',
})
export class AuthFormComponent implements OnChanges {
  @Input({ required: true }) mode!: 'signin' | 'signup';

  @Output() authenticated = new EventEmitter<User>();

  signInForm = {
    email: '',
    password: '',
  };

  signUpForm = {
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  };

  isLoading = false;
  pendingEmail = '';
  pendingPassword = '';
  confirmationCode = '';
  awaitingConfirmation = false;
  awaitingNewPassword = false;
  newPassword = '';
  newPasswordGivenName = '';
  showSignInPassword = false;
  showSignUpPassword = false;
  showSignUpConfirmPassword = false;
  googleClientId = '41053520171-fue6151ivhr37aoq33t6lmmdg9b2cpai.apps.googleusercontent.com';

  constructor(
    private authService: AuthService,
    private notificationService: NotificationService,
    private ngZone: NgZone,
  ) {
    this.ensureGoogleScript();
  }

  /** Show toast then navigate so the snackbar is not torn down mid-open. */
  private finishAuth(user: User | undefined, message: string): void {
    this.notificationService.success(message);
    // Let MatSnackBar attach to the overlay before the auth page navigates away.
    setTimeout(() => {
      if (user) this.authenticated.emit(user);
      this.isLoading = false;
    }, 50);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['mode'] && !changes['mode'].firstChange) {
      this.signInForm = { email: '', password: '' };
      this.signUpForm = {
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
      };
      this.showSignInPassword = false;
      this.showSignUpPassword = false;
      this.showSignUpConfirmPassword = false;
    }
  }

  toggleSignInPasswordVisibility(): void {
    this.showSignInPassword = !this.showSignInPassword;
  }

  toggleSignUpPasswordVisibility(): void {
    this.showSignUpPassword = !this.showSignUpPassword;
  }

  toggleSignUpConfirmPasswordVisibility(): void {
    this.showSignUpConfirmPassword = !this.showSignUpConfirmPassword;
  }

  private ensureGoogleScript(): void {
    if (document.querySelector(`script[src="${GOOGLE_GSI_SCRIPT}"]`)) {
      this.tryInitGoogle();
      return;
    }
    const script = document.createElement('script');
    script.src = GOOGLE_GSI_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => this.tryInitGoogle();
    document.head.appendChild(script);
  }

  private tryInitGoogle(): void {
    if (typeof google === 'undefined' || !google.accounts) {
      return;
    }
    google.accounts.id.initialize({
      client_id: this.googleClientId,
      callback: (response: any) => this.handleGoogleLogin(response),
    });
  }

  onSignInSubmit(): void {
    if (!this.signInForm.email || !this.signInForm.password) {
      this.notificationService.error('Please fill in all fields');
      return;
    }

    this.isLoading = true;
    this.authService
      .login({
        email: this.signInForm.email,
        password: this.signInForm.password,
      })
      .subscribe({
        next: (response) => {
          if (response.nextStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
            this.awaitingNewPassword = true;
            this.notificationService.info('Create a permanent password to finish signing in.');
            this.isLoading = false;
            return;
          }
          if (response.nextStep === 'CONFIRM_SIGN_UP') {
            this.pendingEmail = this.signInForm.email;
            this.pendingPassword = this.signInForm.password;
            this.awaitingConfirmation = true;
            this.notificationService.info('Enter the confirmation code sent to your email.');
            this.isLoading = false;
            return;
          }
          if (response.nextStep && response.nextStep !== 'DONE') {
            this.notificationService.error(`Sign-in needs another step: ${response.nextStep}`);
            this.isLoading = false;
            return;
          }
          this.finishAuth(response.user, 'Welcome back!');
        },
        error: (error) => {
          this.isLoading = false;
          this.notificationService.error(authErrorMessage(error, 'Invalid email or password'));
        },
      });
  }

  completeNewPassword(): void {
    if (!this.newPassword || this.newPassword.length < 8) {
      this.notificationService.error('Password must be at least 8 characters.');
      return;
    }
    this.isLoading = true;
    this.authService.completeNewPassword(this.newPassword, this.newPasswordGivenName).subscribe({
      next: (response) => {
        this.awaitingNewPassword = false;
        this.finishAuth(response.user, 'Password saved. Welcome!');
      },
      error: (error) => {
        this.isLoading = false;
        this.notificationService.error(authErrorMessage(error, 'Invalid email or password'));
      },
    });
  }

  onSignupSubmit(): void {
    if (
      !this.signUpForm.firstName ||
      !this.signUpForm.lastName ||
      !this.signUpForm.email ||
      !this.signUpForm.password
    ) {
      this.notificationService.error('Please fill in all required fields');
      return;
    }

    if (this.signUpForm.password.length < 8) {
      this.notificationService.error('Password must be at least 8 characters long');
      return;
    }

    if (this.signUpForm.password !== this.signUpForm.confirmPassword) {
      this.notificationService.error('Passwords do not match');
      return;
    }

    this.isLoading = true;
    this.authService
      .register({
        first_name: this.signUpForm.firstName,
        last_name: this.signUpForm.lastName,
        email: this.signUpForm.email,
        password1: this.signUpForm.password,
        password2: this.signUpForm.confirmPassword,
      })
      .subscribe({
        next: (response) => {
          if (response.nextStep && response.nextStep !== 'DONE') {
            this.pendingEmail = this.signUpForm.email;
            this.pendingPassword = this.signUpForm.password;
            this.awaitingConfirmation = true;
            this.notificationService.success('Check your email for a confirmation code.');
            this.isLoading = false;
            return;
          }
          this.finishAuth(response.user, 'Account created successfully! Welcome!');
        },
        error: (error) => {
          this.isLoading = false;
          this.notificationService.error(
            authErrorMessage(error, 'Registration failed. Please try again.'),
          );
        },
      });
  }

  private handleGoogleLogin(response: any): void {
    // GSI callbacks run outside Angular; toast + redirect must re-enter the zone.
    this.ngZone.run(() => {
      if (!response?.credential) return;
      this.isLoading = true;
      this.authService.googleLogin(response.credential).subscribe({
        next: () => {
          // Redirect leaves the page; welcome toast is shown on return via AuthService.
          this.isLoading = false;
        },
        error: (_error) => {
          this.isLoading = false;
          this.notificationService.error('Google login failed. Please try again.');
        },
      });
    });
  }

  resendConfirmation(event: Event): void {
    event.preventDefault();
    if (!this.pendingEmail || this.isLoading) return;
    this.isLoading = true;
    this.authService.resendConfirmationCode(this.pendingEmail).subscribe({
      next: () => {
        this.isLoading = false;
        this.notificationService.success('A new code was sent. Check inbox and spam.');
      },
      error: (error) => {
        this.isLoading = false;
        this.notificationService.error(authErrorMessage(error, 'Could not resend the code.'));
      },
    });
  }

  confirmCode(): void {
    if (!this.confirmationCode) {
      this.notificationService.error('Enter the confirmation code from your email');
      return;
    }
    this.isLoading = true;
    this.authService
      .confirmSignUp(this.pendingEmail, this.confirmationCode, this.pendingPassword)
      .subscribe({
        next: (response) => {
          this.finishAuth(response.user, 'Email confirmed. Welcome!');
        },
        error: (error) => {
          this.isLoading = false;
          this.notificationService.error(authErrorMessage(error, 'Invalid confirmation code'));
        },
      });
  }

  initiateGoogleSignIn(event: Event): void {
    event.preventDefault();
    this.authService.googleLogin().subscribe({
      error: (error) => {
        this.notificationService.error(
          error?.message || 'Google sign-in failed to start. The Cognito user pool does not have Google configured yet.',
        );
      },
    });
  }

  // forgot-password is now a dedicated page (see template routerLink)
}
