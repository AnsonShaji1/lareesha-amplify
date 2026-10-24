import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { client } from '../amplify-client';
import { errorMessage, listAll } from '../admin-api';
import { loadProducts } from './carts.page';

@Component({
  standalone: true,
  selector: 'app-wishlist-delete',
  imports: [CommonModule, RouterLink],
  template: `
    <div class="delete-confirm">
      <h1>Delete multiple objects</h1>
      @if (error()) { <p class="error">{{ error() }}</p> }
      <p>Are you sure you want to delete the selected wishlist items? All of the following objects and their related items will be deleted:</p>
      <h2>Summary</h2>
      <ul>
        <li>Wishlist items: {{ rows().length }}</li>
      </ul>
      <h2>Objects</h2>
      <ul>
        @for (row of rows(); track row.id) {
          <li>
            Wishlist item:
            <a [routerLink]="['/wishlists', row.id]">Wishlist: {{ row.name }}</a>
          </li>
        }
      </ul>
      <div class="delete-confirm__actions">
        <button type="button" class="danger" [disabled]="busy()" (click)="confirm()">Yes, I'm sure</button>
        <button type="button" class="cancel" [disabled]="busy()" (click)="back()">No, take me back</button>
      </div>
    </div>
  `,
})
export class WishlistDeletePage {
  private router = inject(Router);
  rows = signal<{ id: string; name: string }[]>([]);
  error = signal('');
  busy = signal(false);
  private ids: string[] = [];

  constructor() {
    const ids = (history.state as { ids?: unknown })?.ids;
    this.ids = Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string' && !!id) : [];
    if (!this.ids.length) {
      void this.router.navigate(['/wishlists']);
      return;
    }
    void this.load();
  }

  back() {
    void this.router.navigate(['/wishlists']);
  }

  async confirm() {
    const ids = this.rows().map((row) => row.id);
    if (!ids.length) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const results = await Promise.all(ids.map((id) => client.models.WishlistItem.delete({ id })));
      const failed = results.find((result) => result.errors?.length);
      if (failed) throw failed;
      await this.router.navigate(['/wishlists']);
    } catch (err: any) {
      this.error.set(errorMessage(err, 'Could not delete the selected wishlist items'));
      this.busy.set(false);
    }
  }

  private async load() {
    try {
      const [items, products] = await Promise.all([
        listAll((args) => client.models.WishlistItem.list(args), 200),
        loadProducts(),
      ]);
      const byId = new Map(items.map((item: any) => [item.id, item]));
      const names = new Map(products.map((product: any) => [product.id, product.name]));
      const rows = this.ids
        .map((id) => byId.get(id))
        .filter((item): item is { id: string; productId: string } => !!item)
        .map((item) => ({
          id: item.id,
          name: names.get(item.productId) || item.productId,
        }));
      if (!rows.length) {
        await this.router.navigate(['/wishlists']);
        return;
      }
      this.rows.set(rows);
    } catch (err: any) {
      this.error.set(errorMessage(err, 'Could not load the selected wishlist items'));
    }
  }
}
