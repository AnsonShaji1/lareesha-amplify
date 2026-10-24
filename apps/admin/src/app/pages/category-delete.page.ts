import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { client } from '../amplify-client';
import { errorMessage, listAll } from '../admin-api';

@Component({
  standalone: true,
  selector: 'app-category-delete',
  imports: [CommonModule, RouterLink],
  template: `
    @if (error()) { <p class="error">{{ error() }}</p> }
    @if (ready() && products().length) {
      <div class="delete-confirm">
        <h1>Cannot delete Categories</h1>
        <p>Deleting the selected Categories would require deleting the following protected related objects:</p>
        <ul>
          @for (product of products(); track product.id) {
            <li>
              Product:
              <a [routerLink]="['/products', product.id]">{{ product.name }}</a>
            </li>
          }
        </ul>
      </div>
    } @else if (ready()) {
      <div class="delete-confirm">
        <h1>Delete multiple objects</h1>
        <p>Are you sure you want to delete the selected categories? All of the following objects and their related items will be deleted:</p>
        <h2>Summary</h2>
        <ul>
          <li>Categories: {{ rows().length }}</li>
        </ul>
        <h2>Objects</h2>
        <ul>
          @for (row of rows(); track row.id) {
            <li>
              Category:
              <a [routerLink]="['/categories', row.id]">Category: {{ row.name }}</a>
            </li>
          }
        </ul>
        <div class="delete-confirm__actions">
          <button type="button" class="danger" [disabled]="busy()" (click)="confirm()">Yes, I'm sure</button>
          <button type="button" class="cancel" [disabled]="busy()" (click)="back()">No, take me back</button>
        </div>
      </div>
    }
  `,
})
export class CategoryDeletePage {
  private router = inject(Router);
  rows = signal<{ id: string; name: string }[]>([]);
  products = signal<{ id: string; name: string }[]>([]);
  error = signal('');
  busy = signal(false);
  ready = signal(false);
  private ids: string[] = [];

  constructor() {
    const ids = (history.state as { ids?: unknown })?.ids;
    this.ids = Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string' && !!id) : [];
    if (!this.ids.length) {
      void this.router.navigate(['/categories']);
      return;
    }
    void this.load();
  }

  back() {
    void this.router.navigate(['/categories']);
  }

  async confirm() {
    if (this.products().length) return;
    const ids = this.rows().map((row) => row.id);
    if (!ids.length) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const linked = await this.linkedProducts(ids);
      if (linked.length) {
        this.products.set(linked);
        this.busy.set(false);
        return;
      }
      const results = await Promise.all(ids.map((id) => client.models.Category.delete({ id })));
      const failed = results.find((result) => result.errors?.length);
      if (failed) throw failed;
      await this.router.navigate(['/categories']);
    } catch (err: any) {
      this.error.set(errorMessage(err, 'Could not delete the selected categories'));
      this.busy.set(false);
    }
  }

  private async load() {
    try {
      const categories = await listAll((args) => client.models.Category.list(args), 200);
      const byId = new Map(categories.map((category: any) => [category.id, category]));
      const rows = this.ids
        .map((id) => byId.get(id))
        .filter((category): category is { id: string; name: string } => !!category)
        .map((category) => ({ id: category.id, name: category.name }));
      if (!rows.length) {
        await this.router.navigate(['/categories']);
        return;
      }
      this.rows.set(rows);
      this.products.set(await this.linkedProducts(rows.map((row) => row.id)));
      this.ready.set(true);
    } catch (err: any) {
      this.error.set(errorMessage(err, 'Could not load the selected categories'));
    }
  }

  private async linkedProducts(categoryIds: string[]): Promise<{ id: string; name: string }[]> {
    const selected = new Set(categoryIds);
    const products = await listAll((args) => client.models.Product.list(args), 200);
    return products
      .filter((product: any) => selected.has(product.categoryId))
      .map((product: any) => ({ id: product.id, name: product.name || product.id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}
