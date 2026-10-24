import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
import { authErrorMessage } from '../../services/auth-errors';

@Component({
  selector: 'app-forgot-password-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
  ],
  templateUrl: './forgot-password-page.html',
  styleUrl: './forgot-password-page.scss',
})
export class ForgotPasswordPage {
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  email = '';
  emailSent = false;
  isLoading = false;

  onSubmit(): void {
    if (!this.email || !this.isValidEmail(this.email)) {
      this.notificationService.error('Please enter a valid email address');
      return;
    }

    this.isLoading = true;
    this.authService.forgotPassword(this.email).subscribe({
      next: () => {
        this.isLoading = false;
        this.emailSent = true;
        this.notificationService.success('Reset code has been sent to your email!');
        void this.router.navigate(['/reset-password'], { queryParams: { email: this.email } });
      },
      error: (error) => {
        this.isLoading = false;
        this.notificationService.error(
          authErrorMessage(error, 'Failed to send reset code. Please try again.'),
        );
      },
    });
  }

  resendEmail(event: Event): void {
    event.preventDefault();

    if (!this.email) {
      this.notificationService.error('Email is not set');
      return;
    }

    this.isLoading = true;
    this.authService.forgotPassword(this.email).subscribe({
      next: () => {
        this.isLoading = false;
        this.notificationService.success('Reset link has been resent!');
      },
      error: (error) => {
        this.isLoading = false;
        this.notificationService.error(
          authErrorMessage(error, 'Failed to resend reset code. Please try again.'),
        );
      },
    });
  }

  backToSignIn(): void {
    const qp = { ...this.route.snapshot.queryParams };
    void this.router.navigate(['/sign-in'], { queryParams: qp });
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

