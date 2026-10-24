import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { client } from '../amplify-client';
import {
  DateFilter,
  errorMessage,
  formatDate,
  holdExpiryIso,
  holdIsActive,
  itemCreated,
  listAll,
  matchesDate,
} from '../admin-api';

@Component({
  standalone: true,
  selector: 'app-reservations',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-head">
      <h1>Stock reservations</h1>
    </div>
    <p class="lede">Read-only list of stock held for unpaid orders. Reservations cannot be added or deleted here.</p>
    @if (error()) { <p class="error">{{ error() }}</p> }

    <div class="changelist">
      <div class="changelist__main">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Order</th>
              <th>Quantity</th>
              <th>Status</th>
              <th>Expires</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            @for (row of filtered(); track row.id) {
              <tr>
                <th><a [routerLink]="['/reservations', row.id]">{{ productName(row.productId) }}</a></th>
                <td>
                  @if (row.orderId) {
                    <a [routerLink]="['/orders', row.orderId]">{{ orderNumber(row.orderId) }}</a>
                  } @else {
                    —
                  }
                </td>
                <td>{{ row.quantity }}</td>
                <td [class.ok]="holdIsActive(row)" [class.bad]="!holdIsActive(row)">
                  {{ holdIsActive(row) ? 'Active' : 'Expired' }}
                </td>
                <td>{{ formatDate(holdExpiryIso(row)) }}</td>
                <td>{{ formatDate(row.createdAtIso) }}</td>
              </tr>
            } @empty {
              <tr><td colspan="6">{{ reservations().length ? 'No stock reservations match this filter.' : 'No stock reservations yet.' }}</td></tr>
            }
          </tbody>
          <tfoot>
            <tr><td colspan="6">{{ filtered().length }} stock reservation{{ filtered().length === 1 ? '' : 's' }}</td></tr>
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
              placeholder="Product, order number"
            />
          </label>
          <button type="button" class="link" (click)="showCounts.set(!showCounts())">
            {{ showCounts() ? 'Hide counts' : 'Show counts' }}
          </button>
          <button type="button" class="link" (click)="clearFilters()">Clear all filters</button>
          <h3>By status</h3>
          <ul>
            @for (option of statusOptions; track option.id) {
              <li>
                <button
                  type="button"
                  class="link"
                  [class.is-selected]="status() === option.id"
                  (click)="status.set(option.id)"
                >
                  {{ option.label }}@if (showCounts()) { <span> ({{ statusCount(option.id) }})</span> }
                </button>
              </li>
            }
          </ul>
          <h3>By created at</h3>
          <ul>
            @for (option of dateOptions; track option.id) {
              <li>
                <button
                  type="button"
                  class="link"
                  [class.is-selected]="dateFilter() === option.id"
                  (click)="dateFilter.set(option.id)"
                >
                  {{ option.label }}@if (showCounts()) { <span> ({{ dateCount(option.id) }})</span> }
                </button>
              </li>
            }
          </ul>
        </div>
      </div>
    </div>
  `,
})
export class ReservationsPage {
  reservations = signal<any[]>([]);
  products = signal<Map<string, string>>(new Map());
  orders = signal<Map<string, string>>(new Map());
  search = signal('');
  status = signal('');
  dateFilter = signal<DateFilter>('any');
  showCounts = signal(false);
  error = signal('');
  formatDate = formatDate;
  holdIsActive = holdIsActive;
  holdExpiryIso = holdExpiryIso;
  statusOptions = [
    { id: '', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'expired', label: 'Expired' },
  ];
  dateOptions: { id: DateFilter; label: string }[] = [
    { id: 'any', label: 'Any date' },
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'Past 7 days' },
    { id: 'month', label: 'This month' },
    { id: 'year', label: 'This year' },
  ];

  filtered = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.reservations().filter((row) => {
      const active = holdIsActive(row);
      if (this.status() === 'active' && !active) return false;
      if (this.status() === 'expired' && active) return false;
      if (!matchesDate(itemCreated(row), this.dateFilter())) return false;
      if (!query) return true;
      return `${this.productName(row.productId)} ${this.orderNumber(row.orderId)} ${row.productId} ${row.orderId}`
        .toLowerCase()
        .includes(query);
    });
  });

  constructor() {
    void this.load();
  }

  productName(id?: string): string {
    if (!id) return '—';
    return this.products().get(id) || id;
  }

  orderNumber(id?: string): string {
    if (!id) return '—';
    return this.orders().get(id) || id;
  }

  statusCount(value: string): number {
    if (!value) return this.reservations().length;
    return this.reservations().filter((row) => (value === 'active' ? holdIsActive(row) : !holdIsActive(row))).length;
  }

  dateCount(filter: DateFilter): number {
    return this.reservations().filter((row) => matchesDate(itemCreated(row), filter)).length;
  }

  clearFilters() {
    this.search.set('');
    this.status.set('');
    this.dateFilter.set('any');
  }

  private async load() {
    this.error.set('');
    try {
      const [reservations, products, orders] = await Promise.all([
        listAll((args) => client.models.StockReservation.list(args), 200),
        listAll((args) => client.models.Product.list(args), 200),
        listAll((args) => client.models.Order.list(args), 200),
      ]);
      this.products.set(new Map(products.map((product: any) => [product.id, product.name || product.id])));
      this.orders.set(new Map(orders.map((order: any) => [order.id, order.orderNumber || order.id])));
      this.reservations.set(
        reservations.sort((a: any, b: any) => String(b.createdAtIso).localeCompare(String(a.createdAtIso))),
      );
    } catch (err: any) {
      this.reservations.set([]);
      this.error.set(errorMessage(err, 'Could not load stock reservations'));
    }
  }
}
