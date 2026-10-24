import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { signOut } from 'aws-amplify/auth';
import { isAdminUser } from './auth.guard';

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    @if (isLogin()) {
      <router-outlet />
    } @else {
      <div class="admin-shell">
        <aside>
          <a routerLink="/" class="brand">Lareesha Admin</a>
          <nav>
            <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Dashboard</a>
            <p class="nav-label">Catalog</p>
            <a routerLink="/products" routerLinkActive="active">Products</a>
            <a routerLink="/categories" routerLinkActive="active">Categories</a>
            <p class="nav-label">Sales</p>
            <a routerLink="/orders" routerLinkActive="active">Orders</a>
            <a routerLink="/users" routerLinkActive="active">Users</a>
            <a routerLink="/carts" routerLinkActive="active">Carts</a>
            <a routerLink="/wishlists" routerLinkActive="active">Wishlist</a>
            <a routerLink="/addresses" routerLinkActive="active">Addresses</a>
            <a routerLink="/payments" routerLinkActive="active">Payments</a>
            <a routerLink="/reservations" routerLinkActive="active">Stock reservations</a>
            <p class="nav-label">Config</p>
            <a routerLink="/shipping" routerLinkActive="active">Shipping</a>
            <a routerLink="/seed" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Seed catalog</a>
            <a routerLink="/seed-live" routerLinkActive="active">Seed live images</a>
          </nav>
          <button type="button" class="ghost" (click)="logout()">Log out</button>
        </aside>
        <main>
          <router-outlet />
        </main>
      </div>
    }
  `,
})
export class App {
  private router = inject(Router);
  isLogin = signal(true);

  constructor() {
    this.isLogin.set(this.router.url.startsWith('/login'));
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event) => {
      this.isLogin.set((event as NavigationEnd).urlAfterRedirects.startsWith('/login'));
      void isAdminUser().then((ok) => {
        if (!ok && !this.router.url.startsWith('/login')) {
          void this.router.navigateByUrl('/login');
        }
      });
    });
  }

  async logout() {
    await signOut();
    await this.router.navigateByUrl('/login');
  }
}
