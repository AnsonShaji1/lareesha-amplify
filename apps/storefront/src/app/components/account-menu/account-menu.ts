import { Component, EventEmitter, HostListener, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { AuthService, User } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-account-menu',
  imports: [CommonModule, MatIconModule],
  templateUrl: './account-menu.html',
  styleUrl: './account-menu.scss',
})
export class AccountMenu implements OnInit {
  @Input() isOpen = false;
  @Output() closeMenu = new EventEmitter<void>();
  @Output() signOut = new EventEmitter<void>();

  currentUser: User | null = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private notificationService: NotificationService,
  ) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe((user) => {
      this.currentUser = user;
    });
  }

  get userEmail(): string {
    return this.currentUser?.email || '';
  }

  get userName(): string {
    if (this.currentUser?.first_name) {
      return `${this.currentUser.first_name} ${this.currentUser.last_name || ''}`.trim();
    }
    return this.currentUser?.email || '';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const dropdown = document.querySelector('.account-dropdown');
    const accountButton = document.querySelector('[aria-label="Account"]');

    if (this.isOpen && dropdown && !dropdown.contains(target) && !accountButton?.contains(target)) {
      this.close();
    }
  }

  close() {
    this.closeMenu.emit();
  }

  onSignOut(event: Event) {
    event.preventDefault();
    console.log('Sign Out clicked');
    this.authService.logout().subscribe(
      () => {
        console.log('Logged out successfully');
        this.signOut.emit();
        this.close();
        this.router.navigate(['/']);
      },
      (error) => {
        console.error('Logout error:', error);
        this.signOut.emit();
        this.close();
        this.router.navigate(['/']);
      },
    );
  }

  onMyOrders(event: Event) {
    event.preventDefault();
    console.log('My Orders clicked');
    this.router.navigate(['/account/orders']);
    this.close();
  }

  onWishlist(event: Event) {
    event.preventDefault();
    this.close();
    this.router.navigate(['/wishlist']);
  }

  onAccountSettings(event: Event) {
    event.preventDefault();
    console.log('Account Settings clicked');
    this.router.navigate(['/account']);
    this.close();
  }

  onHelpSupport(event: Event) {
    event.preventDefault();
    console.log('Help & Support clicked');
    this.router.navigate(['/help']);
    this.close();
  }

  onTrackOrder(event: Event) {
    event.preventDefault();
    console.log('Track Order clicked');
    this.router.navigate(['/orders']);
    this.close();
  }
}
