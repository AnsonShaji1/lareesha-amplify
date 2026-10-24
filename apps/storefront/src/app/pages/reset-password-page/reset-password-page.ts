import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../services/auth.service';
import { authErrorMessage } from '../../services/auth-errors';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-reset-password-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    MatIconModule,
  ],
  templateUrl: './reset-password-page.html',
  styleUrl: './reset-password-page.scss',
})
export class ResetPasswordPageComponent implements OnInit {
  form: FormGroup;
  isLoading = false;
  isValidating = true;
  isTokenValid = false;
  showPassword = false;
  showConfirmPassword = false;
  email: string = '';
  code: string = '';
  resetSuccessful = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private notificationService: NotificationService,
    private fb: FormBuilder,
  ) {
    this.form = this.fb.group(
      {
        email: ['', [Validators.required, Validators.email]],
        code: ['', [Validators.required]],
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: this.passwordMatchValidator },
    );
  }

  ngOnInit() {
    // Get uid and token from URL
    this.route.queryParams.subscribe((params) => {
      this.email = params['email'] || '';
      if (this.email) {
        this.form.patchValue({ email: this.email });
      }
      this.isValidating = false;
    });
  }

  onSubmit() {
    if (this.form.invalid) {
      this.notificationService.error('Please fill in all fields correctly');
      return;
    }

    if (this.form.get('password')?.value.length < 8) {
      this.notificationService.error('Password must be at least 8 characters');
      return;
    }

    this.isLoading = true;

    this.authService
      .resetPassword(
        this.form.get('email')?.value,
        this.form.get('code')?.value,
        this.form.get('password')?.value,
      )
      .subscribe({
        next: (response) => {
          this.isLoading = false;
          this.resetSuccessful = true;
          this.notificationService.success('Password reset successfully! Redirecting to login...');
          setTimeout(() => {
            this.router.navigate(['/']);
          }, 2000);
        },
        error: (error) => {
          this.isLoading = false;
          this.notificationService.error(
            authErrorMessage(error, 'Failed to reset password. Please try again.'),
          );
        },
      });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  private passwordMatchValidator(control: FormGroup): { [key: string]: boolean } | null {
    const passwordControl = control.get('password');
    const confirmPasswordControl = control.get('confirmPassword');

    if (!passwordControl || !confirmPasswordControl) {
      return null;
    }

    const mismatch = passwordControl.value !== confirmPasswordControl.value;

    // Angular Material shows <mat-error> only when the *field* is in error state.
    // So we mirror the group mismatch error onto the confirm control without
    // clobbering other validation errors like "required".
    const existingErrors = confirmPasswordControl.errors || {};

    if (mismatch) {
      if (!existingErrors['passwordMismatch']) {
        confirmPasswordControl.setErrors({ ...existingErrors, passwordMismatch: true });
      }
      return { passwordMismatch: true };
    }

    if (existingErrors['passwordMismatch']) {
      const { passwordMismatch, ...rest } = existingErrors;
      confirmPasswordControl.setErrors(Object.keys(rest).length ? rest : null);
    }

    return null;
  }
}
