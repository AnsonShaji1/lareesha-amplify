import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { client } from '../amplify-client';
import { DateFilter, errorMessage, formatDate, itemCreated, listAll, matchesDate, rupees } from '../admin-api';

@Component({
  standalone: true,
  selector: 'app-shipping',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-head">
      <h1>Select shipping zone to change</h1>
      <a routerLink="/shipping/new" class="button add-item">Add shipping zone</a>
    </div>
    <p class="lede">Lower priority wins. Keep one active fallback zone for unknown pincodes.</p>
    @if (error()) { <p class="error">{{ error() }}</p> }

    <div class="changelist">
      <div class="changelist__main">
        <div class="changelist__bar">
          <label>
            Action:
            <select [(ngModel)]="action" name="action">
              <option value="">---------</option>
              <option value="delete">Delete selected shipping zones</option>
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
              <th>Zone</th>
              <th>Code</th>
              <th>Fee</th>
              <th>Free over</th>
              <th>Priority</th>
              <th>Fallback</th>
              <th>Active</th>
              <th>Prefixes</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            @for (zone of filtered(); track zone.id) {
              <tr [class.is-selected]="isSelected(zone.id)">
                <td>
                  <input
                    type="checkbox"
                    [checked]="isSelected(zone.id)"
                    (change)="toggle(zone.id, $event)"
                    [attr.aria-label]="'Select ' + zone.name"
                  />
                </td>
                <th><a [routerLink]="['/shipping', zone.id]">{{ zone.name }}</a></th>
                <td>{{ zone.code }}</td>
                <td>{{ rupees(zone.baseFeePaise) }}</td>
                <td>{{ zone.freeShippingMinOrderPaise ? rupees(zone.freeShippingMinOrderPaise) : '—' }}</td>
                <td>{{ zone.priority }}</td>
                <td>{{ zone.isFallback ? 'Yes' : 'No' }}</td>
                <td>{{ zone.isActive ? 'Yes' : 'No' }}</td>
                <td>{{ prefixCount(zone.id) }}</td>
                <td>{{ formatDate(zone.createdAtIso) }}</td>
              </tr>
            } @empty {
              <tr><td colspan="10">{{ zones().length ? 'No shipping zones match this filter.' : 'No shipping zones yet.' }}</td></tr>
            }
          </tbody>
          <tfoot>
            <tr><td colspan="10">{{ filtered().length }} shipping zone{{ filtered().length === 1 ? '' : 's' }}</td></tr>
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
              placeholder="Name or code"
            />
          </label>
          <button type="button" class="link" (click)="showCounts.set(!showCounts())">
            {{ showCounts() ? 'Hide counts' : 'Show counts' }}
          </button>
          <button type="button" class="link" (click)="clearFilters()">Clear all filters</button>
          <h3>By active</h3>
          <ul>
            @for (option of yesNoOptions; track option.id) {
              <li>
                <button
                  type="button"
                  class="link"
                  [class.is-selected]="activeFilter() === option.id"
                  (click)="activeFilter.set(option.id)"
                >
                  {{ option.label }}@if (showCounts()) { <span> ({{ flagCount('isActive', option.id) }})</span> }
                </button>
              </li>
            }
          </ul>
          <h3>By fallback</h3>
          <ul>
            @for (option of yesNoOptions; track option.id) {
              <li>
                <button
                  type="button"
                  class="link"
                  [class.is-selected]="fallbackFilter() === option.id"
                  (click)="fallbackFilter.set(option.id)"
                >
                  {{ option.label }}@if (showCounts()) { <span> ({{ flagCount('isFallback', option.id) }})</span> }
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
export class ShippingPage {
  private router = inject(Router);
  zones = signal<any[]>([]);
  prefixes = signal<any[]>([]);
  error = signal('');
  busy = signal(false);
  search = signal('');
  activeFilter = signal('');
  fallbackFilter = signal('');
  dateFilter = signal<DateFilter>('any');
  showCounts = signal(false);
  selected = signal<Set<string>>(new Set());
  action = '';
  rupees = rupees;
  formatDate = formatDate;
  yesNoOptions = [
    { id: '', label: 'All' },
    { id: 'yes', label: 'Yes' },
    { id: 'no', label: 'No' },
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
    return this.zones().filter((zone) => {
      if (!this.matchesFlag(zone.isActive, this.activeFilter())) return false;
      if (!this.matchesFlag(zone.isFallback, this.fallbackFilter())) return false;
      if (!matchesDate(itemCreated(zone), this.dateFilter())) return false;
      if (!query) return true;
      return `${zone.name} ${zone.code}`.toLowerCase().includes(query);
    });
  });
  selectedCount = computed(() => this.filtered().filter((zone) => this.selected().has(zone.id)).length);

  constructor() {
    void this.load();
  }

  prefixCount(zoneId: string): number {
    return this.prefixes().filter((item) => item.zoneId === zoneId).length;
  }

  flagCount(field: 'isActive' | 'isFallback', value: string): number {
    return this.zones().filter((zone) => this.matchesFlag(zone[field], value)).length;
  }

  dateCount(filter: DateFilter): number {
    return this.zones().filter((zone) => matchesDate(itemCreated(zone), filter)).length;
  }

  isSelected(id: string): boolean {
    return this.selected().has(id);
  }

  allVisibleSelected(): boolean {
    const rows = this.filtered();
    return rows.length > 0 && rows.every((zone) => this.selected().has(zone.id));
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
    for (const zone of this.filtered()) {
      if (checked) next.add(zone.id);
      else next.delete(zone.id);
    }
    this.selected.set(next);
  }

  clearFilters() {
    this.search.set('');
    this.activeFilter.set('');
    this.fallbackFilter.set('');
    this.dateFilter.set('any');
  }

  go() {
    if (this.action !== 'delete') return;
    const ids = this.filtered().filter((zone) => this.selected().has(zone.id)).map((zone) => zone.id);
    if (!ids.length) return;
    void this.router.navigate(['/shipping/delete'], { state: { ids } });
  }

  private matchesFlag(value: boolean, filter: string): boolean {
    if (filter === 'yes') return !!value;
    if (filter === 'no') return !value;
    return true;
  }

  private async load() {
    try {
      const [zones, prefixes] = await Promise.all([
        listAll((args) => client.models.ShippingZone.list(args), 50),
        listAll((args) => client.models.ShippingPinPrefix.list(args), 200),
      ]);
      this.zones.set(zones.sort((a: any, b: any) => (a.priority ?? 99) - (b.priority ?? 99)));
      this.prefixes.set(prefixes);
    } catch (err: any) {
      this.error.set(errorMessage(err, 'Could not load shipping zones'));
    }
  }
}
