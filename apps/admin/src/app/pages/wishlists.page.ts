import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { client } from '../amplify-client';
import { DateFilter, errorMessage, formatDate, itemCreated, listAll, matchesDate } from '../admin-api';
import { loadProducts, loadUsers } from './carts.page';

@Component({
  standalone: true,
  selector: 'app-wishlists',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-head">
      <h1>Select wishlist item to change</h1>
      <a routerLink="/wishlists/new" class="button add-item">Add wishlist item</a>
    </div>
    @if (error()) { <p class="error">{{ error() }}</p> }

    <div class="changelist">
      <div class="changelist__main">
        <div class="changelist__bar">
          <label>
            Action:
            <select [(ngModel)]="action" name="action">
              <option value="">---------</option>
              <option value="delete">Delete selected wishlist items</option>
            </select>
          </label>
          <button type="button" class="go" [disabled]="busy()" (click)="go()">Go</button>
          <span>{{ selectedCount() }} of {{ filtered().length }} selected</span>
        </div>

        <table>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  [checked]="allVisibleSelected()"
                  (change)="toggleAll($event)"
                  aria-label="Select all"
                />
              </th>
              <th>Product</th>
              <th>User</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            @for (item of filtered(); track item.id) {
              <tr [class.is-selected]="isSelected(item.id)">
                <td>
                  <input
                    type="checkbox"
                    [checked]="isSelected(item.id)"
                    (change)="toggle(item.id, $event)"
                    [attr.aria-label]="'Select ' + productName(item.productId)"
                  />
                </td>
                <th><a [routerLink]="['/wishlists', item.id]">{{ productName(item.productId) }}</a></th>
                <td>{{ userLabel(item.userId) }}</td>
                <td>{{ formatDate(item.createdAtIso) }}</td>
              </tr>
            } @empty {
              <tr><td colspan="4">{{ items().length ? 'No wishlist items match this filter.' : 'No wishlist items yet.' }}</td></tr>
            }
          </tbody>
          <tfoot>
            <tr><td colspan="4">{{ filtered().length }} wishlist item{{ filtered().length === 1 ? '' : 's' }}</td></tr>
          </tfoot>
        </table>
      </div>

      <div class="filter-panel">
        <h2>Filter</h2>
        <div class="filter-links">
          <button type="button" class="link" (click)="showCounts.set(!showCounts())">
            {{ showCounts() ? 'Hide counts' : 'Show counts' }}
          </button>
          <button type="button" class="link" (click)="clearFilters()">Clear all filters</button>
          <h3>By created at</h3>
          <ul>
            @for (option of dateOptions; track option.id) {
              <li>
                <button
                  type="button"
                  class="link"
                  [class.is-selected]="dateFilter() === option.id"
                  (click)="setDateFilter(option.id)"
                >
                  {{ option.label }}@if (showCounts()) { <span> ({{ count(option.id) }})</span> }
                </button>
              </li>
            }
          </ul>
        </div>
      </div>
    </div>
  `,
})
export class WishlistsPage {
  private router = inject(Router);
  items = signal<any[]>([]);
  error = signal('');
  busy = signal(false);
  showCounts = signal(false);
  dateFilter = signal<DateFilter>('any');
  selected = signal<Set<string>>(new Set());
  action = '';
  formatDate = formatDate;
  dateOptions: { id: DateFilter; label: string }[] = [
    { id: 'any', label: 'Any date' },
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'Past 7 days' },
    { id: 'month', label: 'This month' },
    { id: 'year', label: 'This year' },
  ];

  filtered = computed(() => this.items().filter((item) => matchesDate(itemCreated(item), this.dateFilter())));
  selectedCount = computed(() => this.filtered().filter((item) => this.selected().has(item.id)).length);

  private products = new Map<string, any>();
  private users = new Map<string, string>();

  constructor() {
    void this.load();
  }

  productName(productId: string): string {
    return this.products.get(productId)?.name || productId;
  }

  userLabel(userId: string): string {
    return this.users.get(userId) || userId;
  }

  count(filter: DateFilter): number {
    return this.items().filter((item) => matchesDate(itemCreated(item), filter)).length;
  }

  isSelected(id: string): boolean {
    return this.selected().has(id);
  }

  allVisibleSelected(): boolean {
    const rows = this.filtered();
    return rows.length > 0 && rows.every((item) => this.selected().has(item.id));
  }

  toggle(id: string, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    const next = new Set(this.selected());
    if (checked) next.add(id);
    else next.delete(id);
    this.selected.set(next);
  }

  toggleAll(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    const next = new Set(this.selected());
    for (const item of this.filtered()) {
      if (checked) next.add(item.id);
      else next.delete(item.id);
    }
    this.selected.set(next);
  }

  clearFilters() {
    this.dateFilter.set('any');
  }

  setDateFilter(filter: DateFilter) {
    this.dateFilter.set(filter);
  }

  go() {
    if (this.action !== 'delete') return;
    const ids = this.filtered().filter((item) => this.selected().has(item.id)).map((item) => item.id);
    if (!ids.length) return;
    void this.router.navigate(['/wishlists/delete'], { state: { ids } });
  }

  private async load() {
    try {
      const [items, products, users] = await Promise.all([
        listAll((args) => client.models.WishlistItem.list(args), 200),
        loadProducts(),
        loadUsers(),
      ]);
      this.products = new Map(products.map((product: any) => [product.id, product]));
      this.users = users;
      this.items.set(items.sort((a: any, b: any) => String(b.createdAtIso).localeCompare(String(a.createdAtIso))));
    } catch (err: any) {
      this.error.set(errorMessage(err, 'Could not load wishlist items'));
    }
  }
}
