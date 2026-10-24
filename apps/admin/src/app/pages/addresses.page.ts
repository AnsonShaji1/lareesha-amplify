import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { client } from '../amplify-client';
import { DateFilter, formatDate, itemCreated, listAll, matchesDate } from '../admin-api';

@Component({
  standalone: true,
  selector: 'app-addresses',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-head">
      <h1>Addresses</h1>
    </div>
    <p class="lede">Read-only list of addresses saved in the shop. Addresses cannot be added or deleted here.</p>

    <div class="changelist">
      <div class="changelist__main">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Address</th>
              <th>Default</th>
              <th>User</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            @for (address of filtered(); track address.id) {
              <tr>
                <th><a [routerLink]="['/addresses', address.id]">{{ address.fullName }}</a></th>
                <td>{{ address.phone }}</td>
                <td>{{ address.email }}</td>
                <td>
                  {{ address.addressLine1 }}
                  @if (address.addressLine2) { , {{ address.addressLine2 }} }
                  <div class="quiet">{{ address.city }}, {{ address.state }} {{ address.zipCode }}</div>
                  <div class="quiet">{{ address.country }}</div>
                </td>
                <td>{{ address.isDefault ? 'Yes' : 'No' }}</td>
                <td class="mono">{{ address.userId }}</td>
                <td>{{ formatDate(address.createdAtIso) }}</td>
              </tr>
            } @empty {
              <tr><td colspan="7">{{ addresses().length ? 'No addresses match this filter.' : 'No addresses yet.' }}</td></tr>
            }
          </tbody>
          <tfoot>
            <tr><td colspan="7">{{ filtered().length }} address{{ filtered().length === 1 ? '' : 'es' }}</td></tr>
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
              placeholder="Name, email, phone, city"
            />
          </label>
          <button type="button" class="link" (click)="showCounts.set(!showCounts())">
            {{ showCounts() ? 'Hide counts' : 'Show counts' }}
          </button>
          <button type="button" class="link" (click)="clearFilters()">Clear all filters</button>
          <h3>By default</h3>
          <ul>
            @for (option of defaultOptions; track option.id) {
              <li>
                <button
                  type="button"
                  class="link"
                  [class.is-selected]="defaultFilter() === option.id"
                  (click)="defaultFilter.set(option.id)"
                >
                  {{ option.label }}@if (showCounts()) { <span> ({{ defaultCount(option.id) }})</span> }
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
export class AddressesPage {
  addresses = signal<any[]>([]);
  search = signal('');
  defaultFilter = signal('');
  dateFilter = signal<DateFilter>('any');
  showCounts = signal(false);
  formatDate = formatDate;
  defaultOptions = [
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
    return this.addresses().filter((address) => {
      if (this.defaultFilter() === 'yes' && !address.isDefault) return false;
      if (this.defaultFilter() === 'no' && address.isDefault) return false;
      if (!matchesDate(itemCreated(address), this.dateFilter())) return false;
      if (!query) return true;
      return `${address.fullName} ${address.email} ${address.phone} ${address.city} ${address.state} ${address.zipCode}`
        .toLowerCase()
        .includes(query);
    });
  });

  constructor() {
    void this.load();
  }

  defaultCount(value: string): number {
    if (!value) return this.addresses().length;
    const isDefault = value === 'yes';
    return this.addresses().filter((address) => !!address.isDefault === isDefault).length;
  }

  dateCount(filter: DateFilter): number {
    return this.addresses().filter((address) => matchesDate(itemCreated(address), filter)).length;
  }

  clearFilters() {
    this.search.set('');
    this.defaultFilter.set('');
    this.dateFilter.set('any');
  }

  private async load() {
    const addresses = await listAll((args) => client.models.Address.list(args), 200);
    this.addresses.set(
      addresses.sort((a: any, b: any) => String(b.createdAtIso).localeCompare(String(a.createdAtIso))),
    );
  }
}
