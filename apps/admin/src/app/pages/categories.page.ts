import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { client } from '../amplify-client';
import { DateFilter, errorMessage, formatDate, itemCreated, listAll, matchesDate } from '../admin-api';

@Component({
  standalone: true,
  selector: 'app-categories',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-head">
      <h1>Select category to change</h1>
      <a routerLink="/categories/new" class="button add-item">Add category</a>
    </div>
    @if (error()) { <p class="error">{{ error() }}</p> }

    <div class="changelist">
      <div class="changelist__main">
        <div class="changelist__bar">
          <label>
            Action:
            <select [(ngModel)]="action" name="action">
              <option value="">---------</option>
              <option value="delete">Delete selected categories</option>
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
              <th>Name</th>
              <th>Slug</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            @for (category of filtered(); track category.id) {
              <tr [class.is-selected]="isSelected(category.id)">
                <td>
                  <input
                    type="checkbox"
                    [checked]="isSelected(category.id)"
                    (change)="toggle(category.id, $event)"
                    [attr.aria-label]="'Select ' + category.name"
                  />
                </td>
                <th>
                  <a [routerLink]="['/categories', category.id]">
                    @if (category.imageUrl) { <img class="thumb" [src]="category.imageUrl" alt="" /> }
                    {{ category.name }}
                  </a>
                </th>
                <td>{{ category.slug }}</td>
                <td>{{ formatDate(category.createdAtIso) }}</td>
              </tr>
            } @empty {
              <tr><td colspan="4">{{ categories().length ? 'No categories match this filter.' : 'No categories yet.' }}</td></tr>
            }
          </tbody>
          <tfoot>
            <tr><td colspan="4">{{ filtered().length }} categor{{ filtered().length === 1 ? 'y' : 'ies' }}</td></tr>
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
export class CategoriesPage {
  private router = inject(Router);
  categories = signal<any[]>([]);
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

  filtered = computed(() => this.categories().filter((category) => matchesDate(itemCreated(category), this.dateFilter())));
  selectedCount = computed(() => this.filtered().filter((category) => this.selected().has(category.id)).length);

  constructor() {
    void this.load();
  }

  count(filter: DateFilter): number {
    return this.categories().filter((category) => matchesDate(itemCreated(category), filter)).length;
  }

  isSelected(id: string): boolean {
    return this.selected().has(id);
  }

  allVisibleSelected(): boolean {
    const rows = this.filtered();
    return rows.length > 0 && rows.every((category) => this.selected().has(category.id));
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
    for (const category of this.filtered()) {
      if (checked) next.add(category.id);
      else next.delete(category.id);
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
    const ids = this.filtered().filter((category) => this.selected().has(category.id)).map((category) => category.id);
    if (!ids.length) return;
    void this.router.navigate(['/categories/delete'], { state: { ids } });
  }

  private async load() {
    try {
      const categories = await listAll((args) => client.models.Category.list(args), 200);
      this.categories.set(categories.sort((a: any, b: any) => String(a.name).localeCompare(String(b.name))));
    } catch (err: any) {
      this.error.set(errorMessage(err, 'Could not load categories'));
    }
  }
}
