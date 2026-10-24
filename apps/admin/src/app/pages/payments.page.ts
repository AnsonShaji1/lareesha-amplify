import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { client } from '../amplify-client';
import { DateFilter, formatDate, itemCreated, listAll, matchesDate, rupees } from '../admin-api';

@Component({
  standalone: true,
  selector: 'app-payments',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-head">
      <h1>Payment transactions</h1>
    </div>
    <p class="lede">Read-only audit log. Payments cannot be added or deleted here.</p>

    <div class="changelist">
      <div class="changelist__main">
        <table>
          <thead>
            <tr>
              <th>Transaction</th>
              <th>Order</th>
              <th>User</th>
              <th>Total</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            @for (payment of filtered(); track payment.id) {
              <tr>
                <td class="mono"><a [routerLink]="['/payments', payment.id]">{{ shortId(payment.razorpayPaymentId) }}</a></td>
                <th><a [routerLink]="['/orders', payment.orderId]">{{ payment.orderNumber }}</a></th>
                <td>{{ payment.userId }}</td>
                <td>{{ rupees(payment.totalPaise) }}</td>
                <td [class.ok]="payment.status === 'completed' || payment.status === 'captured'" [class.bad]="payment.status === 'failed'">
                  {{ payment.status }}
                </td>
                <td>{{ formatDate(payment.createdAtIso) }}</td>
              </tr>
            } @empty {
              <tr><td colspan="6">{{ payments().length ? 'No payments match this filter.' : 'No payment transactions yet.' }}</td></tr>
            }
          </tbody>
          <tfoot>
            <tr><td colspan="6">{{ filtered().length }} payment{{ filtered().length === 1 ? '' : 's' }}</td></tr>
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
              placeholder="Order number, payment id, user"
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
export class PaymentsPage {
  payments = signal<any[]>([]);
  search = signal('');
  status = signal('');
  dateFilter = signal<DateFilter>('any');
  showCounts = signal(false);
  rupees = rupees;
  formatDate = formatDate;
  statusOptions = [
    { id: '', label: 'All' },
    { id: 'completed', label: 'completed' },
    { id: 'captured', label: 'captured' },
    { id: 'failed', label: 'failed' },
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
    return this.payments().filter((payment) => {
      if (this.status() && payment.status !== this.status()) return false;
      if (!matchesDate(itemCreated(payment), this.dateFilter())) return false;
      if (!query) return true;
      return `${payment.orderNumber} ${payment.razorpayPaymentId} ${payment.userId}`.toLowerCase().includes(query);
    });
  });

  constructor() {
    void this.load();
  }

  shortId(value?: string): string {
    if (!value) return '—';
    return value.length > 16 ? `${value.slice(0, 16)}…` : value;
  }

  statusCount(value: string): number {
    if (!value) return this.payments().length;
    return this.payments().filter((payment) => payment.status === value).length;
  }

  dateCount(filter: DateFilter): number {
    return this.payments().filter((payment) => matchesDate(itemCreated(payment), filter)).length;
  }

  clearFilters() {
    this.search.set('');
    this.status.set('');
    this.dateFilter.set('any');
  }

  private async load() {
    const payments = await listAll((args) => client.models.PaymentTransaction.list(args), 200);
    this.payments.set(
      payments.sort((a: any, b: any) => String(b.createdAtIso).localeCompare(String(a.createdAtIso))),
    );
  }
}
