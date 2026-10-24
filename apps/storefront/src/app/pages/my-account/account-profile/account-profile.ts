import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { NotificationService } from '../../../services/notification.service';
import { User } from '../../../models/user.model';

@Component({
  selector: 'app-account-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './account-profile.html',
  styleUrl: './account-profile.scss',
})
export class AccountProfileComponent implements OnInit {
  user: User | null = null;
  isEditing = false;
  isSaving = false;
  phoneError = '';
  genderMenuOpen = false;

  formData = {
    first_name: '',
    last_name: '',
    email: '',
    gender: '',
    phone: '',
  };

  genderOptions = [
    { label: 'Male', value: 'male' },
    { label: 'Female', value: 'female' },
    { label: 'Other', value: 'other' },
    { label: 'Prefer not to say', value: 'prefer_not_to_say' },
  ];

  constructor(
    private authService: AuthService,
    private notificationService: NotificationService,
  ) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe((user: User | null) => {
      if (user) {
        this.user = user;
        this.formData.first_name = user.first_name;
        this.formData.last_name = user.last_name;
        this.formData.email = user.email;
        this.formData.gender = user.gender || '';
        this.formData.phone = user.phone || '';
      }
    });
  }

  toggleEdit() {
    this.isEditing = !this.isEditing;
    this.genderMenuOpen = false;
  }

  get genderLabel(): string {
    return this.genderOptions.find((option) => option.value === this.formData.gender)?.label || 'Select gender';
  }

  toggleGenderMenu(): void {
    if (!this.isEditing || this.isSaving) return;
    this.genderMenuOpen = !this.genderMenuOpen;
  }

  selectGender(value: string): void {
    this.formData.gender = value;
    this.genderMenuOpen = false;
  }

  @HostListener('document:click', ['$event'])
  closeGenderMenu(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.gender-menu')) {
      this.genderMenuOpen = false;
    }
  }

  onPhoneChange() {
    if (this.phoneError) this.phoneError = '';
  }

  saveProfile() {
    const phone = this.formData.phone.trim();
    if (phone && !this.isIndianMobile(phone)) {
      this.phoneError = 'Enter a valid 10-digit mobile number.';
      return;
    }

    this.phoneError = '';
    this.isSaving = true;
    const profileData = {
      first_name: this.formData.first_name,
      last_name: this.formData.last_name,
      phone,
      gender: this.formData.gender,
    };

    this.authService.updateUser(profileData).subscribe({
      next: (response) => {
        this.isSaving = false;
        this.isEditing = false;
        this.notificationService.success('Profile updated successfully!');
        if (response) {
          this.user = response;
        }
      },
      error: (error) => {
        this.isSaving = false;
        console.error('Error updating profile:', error);
        const message = error?.message || 'Failed to update profile. Please try again.';
        this.notificationService.error(message);
      },
    });
  }

  cancel() {
    if (this.user) {
      this.formData.first_name = this.user.first_name;
      this.formData.last_name = this.user.last_name;
      this.formData.email = this.user.email;
      this.formData.gender = this.user.gender || '';
      this.formData.phone = this.user.phone || '';
    }
    this.phoneError = '';
    this.genderMenuOpen = false;
    this.isEditing = false;
  }

  private isIndianMobile(value: string): boolean {
    const digits = value.replace(/\D/g, '');
    const local =
      digits.length === 12 && digits.startsWith('91')
        ? digits.slice(2)
        : digits.length === 11 && digits.startsWith('0')
          ? digits.slice(1)
          : digits;
    return /^[6-9]\d{9}$/.test(local);
  }
}
