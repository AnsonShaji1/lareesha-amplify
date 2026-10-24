import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ApiService, Order } from '../../services/api.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './order-detail.html',
  styleUrl: './order-detail.scss',
})
export class OrderDetailComponent implements OnInit {
  order: Order | null = null;
  isLoading = true;

  statusMap: { [key: string]: { label: string; color: string } } = {
    pending: { label: 'Pending', color: 'warning' },
    on_the_way: { label: 'On the way', color: 'info' },
    shipped: { label: 'Shipped', color: 'info' },
    delivered: { label: 'Delivered', color: 'success' },
    cancelled: { label: 'Cancelled', color: 'danger' },
  };

  paymentStatusMap: { [key: string]: { label: string; color: string } } = {
    pending: { label: 'Pending', color: 'warning' },
    authorized: { label: 'Authorized', color: 'info' },
    captured: { label: 'Paid', color: 'success' },
    failed: { label: 'Failed', color: 'danger' },
    refunded: { label: 'Refunded', color: 'warning' },
  };

  constructor(
    private apiService: ApiService,
    private route: ActivatedRoute,
    private router: Router,
    private notificationService: NotificationService,
  ) {}

  ngOnInit() {
    const orderId = this.route.snapshot.paramMap.get('id');
    if (orderId) {
      this.loadOrderDetails(orderId);
    } else {
      this.router.navigate(['/account/orders']);
    }
  }

  loadOrderDetails(orderId: string) {
    this.isLoading = true;
    this.apiService.getOrder(orderId).subscribe({
      next: (order: Order) => {
        this.order = order;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading order:', error);
        this.notificationService.error('Failed to load order details');
        this.isLoading = false;
        this.router.navigate(['/account/orders']);
      },
    });
  }

  getStatusInfo(status: string) {
    return this.statusMap[status] || { label: status, color: 'default' };
  }

  getPaymentStatusInfo(status: string) {
    return this.paymentStatusMap[status] || { label: status, color: 'default' };
  }

  formatRupees(value: number | string): string {
    const amount = this.amount(value);
    return Number.isInteger(amount) ? `₹${amount}` : `₹${amount.toFixed(2)}`;
  }

  formatShipping(value: number | string): string {
    return this.amount(value) === 0 ? 'Free' : this.formatRupees(value);
  }

  private amount(value: number | string): number {
    const amount = typeof value === 'string' ? parseFloat(value) : Number(value);
    return Number.isFinite(amount) ? amount : 0;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  getOrderMessage(order: Order): string {
    const statusMessages: { [key: string]: string } = {
      pending: 'Waiting for your payment confirmation',
      on_the_way: 'Your order has been placed successfully',
      shipped: 'Your order has been shipped',
      delivered: 'Your order has been delivered successfully',
      cancelled: 'Your order has been cancelled as payment was not confirmed by the bank',
    };

    return statusMessages[order.status] || 'View order details';
  }
}
