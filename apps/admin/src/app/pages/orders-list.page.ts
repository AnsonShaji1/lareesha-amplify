import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { client } from '../amplify-client';
import { formatDate, listAll, rupees } from '../admin-api';

@Component({
  standalone: true,
  selector: 'app-orders-list',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-head">
      <h1>Select order to change</h1>
    </div>

    <div class="changelist">
      <div class="changelist__main">
        <table>
          <thead>
            <tr>
              <th>Order number</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Payment</th>
              <th>Stock</th>
              <th>Total</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            @for (order of filtered(); track order.id) {
              <tr>
                <th><a [routerLink]="['/orders', order.id]">{{ order.orderNumber }}</a></th>
                <td>
                  {{ order.shippingFullName }}
                  <div class="quiet">{{ order.shippingEmail }}</div>
                </td>
                <td>{{ order.status }}</td>
                <td [class.ok]="order.paymentStatus === 'captured'" [class.bad]="order.paymentStatus === 'failed'">
                  {{ order.paymentStatus }}
                </td>
                <td>{{ stockLabel(order) }}</td>
                <td>{{ rupees(order.totalPaise) }}</td>
                <td>{{ formatDate(order.createdAtIso) }}</td>
              </tr>
            } @empty {
              <tr><td colspan="7">{{ orders().length ? 'No orders match this filter.' : 'No orders yet.' }}</td></tr>
            }
          </tbody>
          <tfoot>
            <tr><td colspan="7">{{ filtered().length }} order{{ filtered().length === 1 ? '' : 's' }}</td></tr>
          </tfoot>
        </table>
      </div>

      <div class="filter-panel">
        <h2>Filter</h2>
        <div class="filter-links">
          <label class="field">Search
            <input
              [ngModel]="search()"
              (ngModelChange)="search.set($event)"
              name="search"
              placeholder="Order number, name, email, city"
            />
          </label>
          <button type="button" class="link" (click)="showCounts.set(!showCounts())">
            {{ showCounts() ? 'Hide counts' : 'Show counts' }}
          </button>
          <button type="button" class="link" (click)="clearFilters()">Clear all filters</button>
          <h3>By order status</h3>
          <ul>
            @for (option of statusOptions; track option.id) {
              <li>
                <button
                  type="button"
                  class="link"
                  [class.is-selected]="status() === option.id"
                  (click)="status.set(option.id)"
                >
                  {{ option.label }}@if (showCounts()) { <span> ({{ count('status', option.id) }})</span> }
                </button>
              </li>
            }
          </ul>
          <h3>By payment status</h3>
          <ul>
            @for (option of paymentOptions; track option.id) {
              <li>
                <button
                  type="button"
                  class="link"
                  [class.is-selected]="payment() === option.id"
                  (click)="payment.set(option.id)"
                >
                  {{ option.label }}@if (showCounts()) { <span> ({{ count('payment', option.id) }})</span> }
                </button>
              </li>
            }
          </ul>
        </div>
      </div>
    </div>
  `,
})
export class OrdersListPage {
  orders = signal<any[]>([]);
  search = signal('');
  status = signal('');
  payment = signal('');
  showCounts = signal(false);
  rupees = rupees;
  formatDate = formatDate;
  statusOptions = [
    { id: '', label: 'All' },
    { id: 'pending', label: 'pending' },
    { id: 'on_the_way', label: 'on_the_way' },
    { id: 'shipped', label: 'shipped' },
    { id: 'delivered', label: 'delivered' },
    { id: 'cancelled', label: 'cancelled' },
  ];
  paymentOptions = [
    { id: '', label: 'All' },
    { id: 'pending', label: 'pending' },
    { id: 'captured', label: 'captured' },
    { id: 'failed', label: 'failed' },
  ];

  filtered = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.orders().filter((order) => {
      if (this.status() && order.status !== this.status()) return false;
      if (this.payment() && order.paymentStatus !== this.payment()) return false;
      if (!query) return true;
      return `${order.orderNumber} ${order.shippingFullName} ${order.shippingEmail} ${order.shippingCity}`
        .toLowerCase()
        .includes(query);
    });
  });

  constructor(route: ActivatedRoute) {
    this.payment.set(route.snapshot.queryParamMap.get('payment') || '');
    void this.load();
  }

  count(kind: 'status' | 'payment', value: string): number {
    if (!value) return this.orders().length;
    return this.orders().filter((order) => (kind === 'status' ? order.status : order.paymentStatus) === value).length;
  }

  clearFilters() {
    this.search.set('');
    this.status.set('');
    this.payment.set('');
  }

  stockLabel(order: any): string {
    if (!order.stockReserved) return 'Not reserved';
    const expires = new Date(order.reservationExpiresAt || '').getTime();
    if (!Number.isNaN(expires) && expires > Date.now()) return 'Reserved';
    const created = new Date(order.createdAtIso || '').getTime();
    if (!Number.isNaN(created) && created + 15 * 60 * 1000 > Date.now()) return 'Reserved';
    return 'Reserved — expired';
  }

  private async load() {
    const orders = await listAll((args) => client.models.Order.list(args), 200);
    this.orders.set(
      orders.sort((a: any, b: any) => String(b.createdAtIso).localeCompare(String(a.createdAtIso))),
    );
  }
}
