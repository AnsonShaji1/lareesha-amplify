import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { client } from '../amplify-client';
import { errorMessage } from '../admin-api';
import { loadProducts, loadUsers } from './carts.page';

@Component({
  standalone: true,
  selector: 'app-wishlist-form',
  imports: [CommonModule, FormsModule],
  template: `
    <h1>{{ isNew() ? 'Add wishlist item' : 'Change wishlist item' }}</h1>
    @if (!isNew() && productName()) {
      <h2>Wishlist: {{ productName() }}</h2>
    }
    @if (error()) { <p class="error">{{ error() }}</p> }

    <form class="module change-form" (ngSubmit)="save('list')">
      <label class="field">User
        <select [(ngModel)]="userId" name="userId" required>
          <option value="">Select a user</option>
          @for (user of users(); track user.id) {
            <option [value]="user.id">{{ user.label }}</option>
          }
        </select>
      </label>
      <label class="field">Product
        <select [(ngModel)]="productId" name="productId" required>
          <option value="">Select a product</option>
          @for (product of products(); track product.id) {
            <option [value]="product.id">{{ product.name }}</option>
          }
        </select>
      </label>
      <div class="submit-row">
        <button type="submit" [disabled]="busy()">Save</button>
        <button type="button" [disabled]="busy()" (click)="save('add')">Save and add another</button>
        <button type="button" [disabled]="busy()" (click)="save('stay')">Save and continue editing</button>
      </div>
    </form>
    @if (!isNew()) {
      <p><button type="button" class="danger" [disabled]="busy()" (click)="remove()">Delete</button></p>
    }
  `,
})
export class WishlistFormPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  users = signal<{ id: string; label: string }[]>([]);
  products = signal<any[]>([]);
  error = signal('');
  busy = signal(false);
  isNew = signal(true);
  userId = '';
  productId = '';
  private id = '';

  constructor() {
    this.route.paramMap.subscribe(() => {
      void this.load();
    });
  }

  productName(): string {
    return this.products().find((product) => product.id === this.productId)?.name || '';
  }

  async save(next: 'list' | 'add' | 'stay') {
    if (!this.userId || !this.productId) {
      this.error.set('Choose a user and a product.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      if (this.isNew()) {
        const created = await client.models.WishlistItem.create({
          userId: this.userId,
          productId: this.productId,
          createdAtIso: new Date().toISOString(),
        });
        if (created.errors?.length) throw created;
        const id = created.data?.id;
        if (next === 'stay' && id) {
          await this.router.navigate(['/wishlists', id]);
          return;
        }
      } else {
        const updated = await client.models.WishlistItem.update({
          id: this.id,
          userId: this.userId,
          productId: this.productId,
        });
        if (updated.errors?.length) throw updated;
        if (next === 'stay') return;
      }
      if (next === 'add') {
        await this.router.navigate(['/wishlists/new']);
        this.reset();
        return;
      }
      await this.router.navigate(['/wishlists']);
    } catch (err: any) {
      this.error.set(errorMessage(err, 'Could not save the wishlist item'));
    } finally {
      this.busy.set(false);
    }
  }

  remove() {
    if (!this.id) return;
    void this.router.navigate(['/wishlists/delete'], { state: { ids: [this.id] } });
  }

  private reset() {
    this.isNew.set(true);
    this.id = '';
    this.userId = '';
    this.productId = '';
    this.error.set('');
  }

  private async load() {
    const id = this.route.snapshot.paramMap.get('id');
    this.isNew.set(!id);
    this.id = id || '';
    try {
      const [products, users, item] = await Promise.all([
        loadProducts(),
        loadUsers(),
        id ? client.models.WishlistItem.get({ id }) : Promise.resolve(null),
      ]);
      if (item?.errors?.length) throw item;
      const row = item?.data;
      if (id && !row) {
        this.error.set('Wishlist item not found');
        return;
      }
      if (row) {
        this.userId = row.userId;
        this.productId = row.productId;
        if (row.userId && !users.has(row.userId)) users.set(row.userId, row.userId);
        if (row.productId && !products.some((product: any) => product.id === row.productId)) {
          products.push({ id: row.productId, name: row.productId });
        }
      }
      this.products.set(products);
      this.users.set([...users.entries()].map(([userId, label]) => ({ id: userId, label })).sort((a, b) => a.label.localeCompare(b.label)));
    } catch (err: any) {
      this.error.set(errorMessage(err, 'Could not load the wishlist item'));
    }
  }
}
