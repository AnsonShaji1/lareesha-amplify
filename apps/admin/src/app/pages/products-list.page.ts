import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { client } from '../amplify-client';
import { formatDate, holdIsActive, listAll, parseImages, rupees } from '../admin-api';

@Component({
  standalone: true,
  selector: 'app-products-list',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-head">
      <h1>Products</h1>
      <a routerLink="/products/new" class="button">Add product</a>
    </div>

    <section class="module filters">
      <label class="field">Search
        <input [(ngModel)]="search" (ngModelChange)="apply()" placeholder="Name, code, or description" />
      </label>
      <label class="field">Category
        <select [(ngModel)]="categoryId" (ngModelChange)="apply()">
          <option value="">All</option>
          @for (category of categories(); track category.id) {
            <option [value]="category.id">{{ category.name }}</option>
          }
        </select>
      </label>
      <label class="field">New in
        <select [(ngModel)]="newIn" (ngModelChange)="apply()">
          <option value="">All</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </label>
    </section>

    <section class="module">
      <p class="lede">{{ filtered().length }} product(s)</p>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Code</th>
            <th>Name</th>
            <th>Category</th>
            <th>New in</th>
            <th>Original</th>
            <th>Sale</th>
            <th>Stock</th>
            <th>Reserved</th>
            <th>Available</th>
            <th>Tax</th>
            <th>Shipping</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          @for (product of filtered(); track product.id) {
            <tr>
              <td>
                @if (thumb(product); as url) {
                  <img class="thumb" [src]="url" alt="" />
                }
              </td>
              <td>{{ product.productCode || '—' }}</td>
              <th><a [routerLink]="['/products', product.id]">{{ product.name }}</a></th>
              <td>{{ product.categoryName }}</td>
              <td>{{ product.newIn ? 'Yes' : 'No' }}</td>
              <td>{{ rupees(product.originalPricePaise) }}</td>
              <td>{{ rupees(product.salePricePaise) }}</td>
              <td>{{ product.noOfStock }}</td>
              <td>{{ reserved(product.id) }}</td>
              <td [class.warn]="available(product) <= 5 && available(product) > 0" [class.bad]="available(product) === 0">
                {{ available(product) === 0 ? 'OUT OF STOCK' : available(product) }}
              </td>
              <td>{{ (product.taxPercentageBps || 0) / 100 }}%</td>
              <td>{{ product.isFreeShippingEligible ? 'FREE' : rupees(product.shippingCostPaise) }}</td>
              <td>{{ formatDate(product.createdAtIso) }}</td>
            </tr>
          } @empty {
            <tr><td colspan="13">No products match these filters.</td></tr>
          }
        </tbody>
      </table>
    </section>
  `,
})
export class ProductsListPage {
  products = signal<any[]>([]);
  categories = signal<any[]>([]);
  reservations = signal<Record<string, number>>({});
  search = '';
  categoryId = '';
  newIn = '';
  rupees = rupees;
  formatDate = formatDate;

  filtered = computed(() => {
    const query = this.search.trim().toLowerCase();
    return this.products().filter((product) => {
      if (this.categoryId && product.categoryId !== this.categoryId) return false;
      if (this.newIn === 'yes' && !product.newIn) return false;
      if (this.newIn === 'no' && product.newIn) return false;
      if (!query) return true;
      return `${product.productCode || ''} ${product.name} ${product.description || ''}`
        .toLowerCase()
        .includes(query);
    });
  });

  constructor() {
    void this.load();
  }

  apply() {
    this.products.update((items) => [...items]);
  }

  thumb(product: any): string {
    return parseImages(product.images)[0]?.url || '';
  }

  reserved(productId: string): number {
    return this.reservations()[productId] || 0;
  }

  available(product: any): number {
    return Math.max(0, (product.noOfStock || 0) - this.reserved(product.id));
  }

  private async load() {
    const [products, categories, reservations] = await Promise.all([
      listAll((args) => client.models.Product.list(args), 200),
      listAll((args) => client.models.Category.list(args), 200),
      listAll((args) => client.models.StockReservation.list(args), 200),
    ]);
    this.products.set(
      products.sort((a: any, b: any) => String(b.createdAtIso).localeCompare(String(a.createdAtIso))),
    );
    this.categories.set(categories.sort((a: any, b: any) => a.name.localeCompare(b.name)));
    const reserved: Record<string, number> = {};
    for (const row of reservations) {
      if (holdIsActive(row)) {
        reserved[row.productId] = (reserved[row.productId] || 0) + (row.quantity || 0);
      }
    }
    this.reservations.set(reserved);
  }
}
