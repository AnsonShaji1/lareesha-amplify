import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ApiService, Order } from '../../../services/api.service';
import { NotificationService } from '../../../services/notification.service';
import { OrderFiltersComponent, FilterOptions } from '../orders-filters/order-filters';

@Component({
  selector: 'app-account-orders',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatIconModule,
    OrderFiltersComponent,
  ],
  templateUrl: './account-orders.html',
  styleUrl: './account-orders.scss',
})
export class AccountOrdersComponent implements OnInit, OnDestroy {
  orders: Order[] = [];
  filteredOrders: Order[] = [];
  isLoading = false;
  isMobileFiltersOpen = false;
  searchQuery = '';
  activeFilters: FilterOptions = {
    orderStatuses: [],
    orderPeriods: [],
  };

  // Status map matching backend exactly
  statusMap: { [key: string]: { label: string; color: string } } = {
    pending: { label: 'Pending', color: 'warning' },
    on_the_way: { label: 'On the way', color: 'info' },
    shipped: { label: 'Shipped', color: 'info' },
    delivered: { label: 'Delivered', color: 'success' },
    cancelled: { label: 'Cancelled', color: 'danger' },
  };

  // Payment status map matching backend exactly
  paymentStatusMap: { [key: string]: { label: string; color: string } } = {
    pending: { label: 'Pending', color: 'warning' },
    authorized: { label: 'Authorized', color: 'info' },
    captured: { label: 'Paid', color: 'success' },
    failed: { label: 'Failed', color: 'danger' },
    refunded: { label: 'Refunded', color: 'warning' },
  };

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private requestId = 0;

  constructor(
    private apiService: ApiService,
    private notificationService: NotificationService,
  ) {}

  ngOnInit() {
    this.fetchOrders();
  }

  ngOnDestroy() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  private fetchOrders() {
    const requestId = ++this.requestId;
    const range = this.dateRange(this.activeFilters.orderPeriods);
    const search = this.searchQuery.trim();
    if (!search) this.isLoading = this.orders.length === 0;
    this.apiService
      .getOrders({
        statuses: this.activeFilters.orderStatuses,
        fromIso: range?.fromIso,
        toIso: range?.toIso,
        search,
      })
      .subscribe({
        next: (response) => {
          if (requestId !== this.requestId) return;
          this.orders = response;
          this.applyView();
          this.isLoading = false;
        },
        error: (error) => {
          if (requestId !== this.requestId) return;
          console.error('Error loading orders:', error);
          this.notificationService.error('Failed to load orders');
          this.isLoading = false;
        },
      });
  }

  private applyView() {
    const query = this.searchQuery.trim().toLowerCase();
    const rows = query
      ? this.orders.filter((order) => this.orderMatches(order, query))
      : this.orders;
    this.filteredOrders = [...rows].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }

  private orderMatches(order: Order, query: string): boolean {
    const fields = [
      order.order_number,
      ...order.items.flatMap((item) => [item.product_name, item.product]),
    ];
    return fields.some((value) => (value || '').toLowerCase().includes(query));
  }

  private dateRange(periods: string[]): { fromIso: string; toIso: string } | null {
    if (periods.length === 0) return null;
    const now = new Date();
    let start: Date | null = null;

    for (const period of periods) {
      const periodStart = new Date(now);
      if (period === 'last_30_days') periodStart.setDate(periodStart.getDate() - 30);
      else if (period === 'last_3_months') periodStart.setMonth(periodStart.getMonth() - 3);
      else if (period === 'last_12_months') periodStart.setMonth(periodStart.getMonth() - 12);
      else continue;
      if (!start || periodStart < start) start = periodStart;
    }

    if (!start) return null;
    return { fromIso: start.toISOString(), toIso: now.toISOString() };
  }

  onSearch(value: string) {
    this.searchQuery = value ?? '';
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.fetchOrders(), 300);
  }

  onFilterChange(filters: FilterOptions) {
    this.activeFilters = filters;
    this.closeMobileFilters();
    this.fetchOrders();
  }

  get filterCount(): number {
    return this.activeFilters.orderStatuses.length + this.activeFilters.orderPeriods.length;
  }

  previewItems(order: Order) {
    return order.items.slice(0, 3);
  }

  extraItemCount(order: Order): number {
    return Math.max(0, order.items.length - 3);
  }

  itemSummary(order: Order): string {
    const [first, ...rest] = order.items;
    if (!first) return 'No items';
    return rest.length === 0
      ? first.product_name
      : `${first.product_name} + ${rest.length} more ${rest.length === 1 ? 'item' : 'items'}`;
  }

  pieceLabel(order: Order): string {
    const count = order.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    return count === 1 ? '1 piece' : `${count} pieces`;
  }

  openMobileFilters() {
    this.isMobileFiltersOpen = true;
  }

  closeMobileFilters() {
    this.isMobileFiltersOpen = false;
  }

  getStatusInfo(status: string) {
    return this.statusMap[status] || { label: status, color: 'default' };
  }

  getPaymentStatusInfo(status: string) {
    return this.paymentStatusMap[status] || { label: status, color: 'default' };
  }

  formatRupees(value: number | string): string {
    const amount = typeof value === 'string' ? parseFloat(value) : Number(value);
    if (!Number.isFinite(amount)) return '₹0';
    return Number.isInteger(amount) ? `₹${amount}` : `₹${amount.toFixed(2)}`;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-IN', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(date);
  }

}
