import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { ApiService, Order } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-orders-page',
  imports: [CommonModule, MatIconModule],
  templateUrl: './orders-page.html',
  styleUrl: './orders-page.scss',
})
export class OrdersPage implements OnInit {
  orders: Order[] = [];
  isLoading = true;
  isLoggedIn = false;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private router: Router,
    private notificationService: NotificationService,
  ) {}

  ngOnInit() {
    this.authService.isAuthenticated$.subscribe((isAuth: boolean) => {
      this.isLoggedIn = isAuth;
      if (!isAuth) {
        this.notificationService.info('Please sign in to view your orders');
        this.router.navigate(['/']);
      } else {
        this.loadOrders();
      }
    });
  }

  loadOrders() {
    this.isLoading = true;
    this.apiService.getOrders().subscribe({
      next: (orders: Order[]) => {
        this.orders = orders;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading orders:', error);
        this.notificationService.error('Failed to load orders');
        this.isLoading = false;
      },
    });
  }

  viewOrderDetails(orderId: string) {
    this.router.navigate(['/orders', orderId]);
  }

  getStatusClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      pending: 'status-pending',
      processing: 'status-processing',
      shipped: 'status-shipped',
      delivered: 'status-delivered',
      cancelled: 'status-cancelled',
    };
    return statusMap[status.toLowerCase()] || 'status-pending';
  }

  getPaymentStatusClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      pending: 'payment-pending',
      paid: 'payment-paid',
      failed: 'payment-failed',
    };
    return statusMap[status.toLowerCase()] || 'payment-pending';
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  goBack() {
    this.router.navigate(['/']);
  }

  formatCurrency(value: number | string): string {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numValue);
  }
}
