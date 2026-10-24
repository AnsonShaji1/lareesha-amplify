import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { AuthService, User } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-account-settings-page',
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './account-settings-page.html',
  styleUrl: './account-settings-page.scss',
})
export class AccountSettingsPage implements OnInit {
  currentUser: User | null = null;
  isEditing = false;
  isSaving = false;
  formData = { first_name: '', last_name: '', email: '' };

  constructor(
    private authService: AuthService,
    private router: Router,
    private notificationService: NotificationService,
  ) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe((user: User | null) => {
      this.currentUser = user;
      if (user) {
        this.formData = {
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          email: user.email,
        };
      } else {
        this.router.navigate(['/']);
      }
    });
  }

  toggleEdit() {
    this.isEditing = !this.isEditing;
    if (!this.isEditing && this.currentUser) {
      this.formData = {
        first_name: this.currentUser.first_name || '',
        last_name: this.currentUser.last_name || '',
        email: this.currentUser.email,
      };
    }
  }

  saveChanges() {
    if (this.isSaving) return;
    this.isSaving = true;
    this.authService.updateUser(this.formData).subscribe({
      next: (updatedUser: User) => {
        this.currentUser = updatedUser;
        this.isEditing = false;
        this.isSaving = false;
        this.notificationService.success('Profile updated successfully');
      },
      error: () => {
        this.isSaving = false;
        this.notificationService.error('Error updating profile');
      },
    });
  }

  goBack() {
    this.router.navigate(['/']);
  }
}
