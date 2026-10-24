import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { client } from '../amplify-client';
import { errorMessage } from '../admin-api';
import { loadProducts, loadUsers } from './carts.page';

@Component({
  standalone: true,
  selector: 'app-cart-form',
  imports: [CommonModule, FormsModule],
  template: `
    <h1>{{ isNew() ? 'Add cart item' : 'Change cart item' }}</h1>
    @if (!isNew() && productName()) {
      <h2>Cart: {{ productName() }} x {{ quantity }}</h2>
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
      <label class="field">Quantity
        <input type="number" min="1" step="1" [(ngModel)]="quantity" name="quantity" required />
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
export class CartFormPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  users = signal<{ id: string; label: string }[]>([]);
  products = signal<any[]>([]);
  error = signal('');
  busy = signal(false);
  isNew = signal(true);
  userId = '';
  productId = '';
  quantity = 1;
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
    const quantity = Math.max(1, Math.floor(Number(this.quantity) || 1));
    this.quantity = quantity;
    if (!this.userId || !this.productId) {
      this.error.set('Choose a user and a product.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      if (this.isNew()) {
        const created = await client.models.CartItem.create({
          userId: this.userId,
          productId: this.productId,
          quantity,
          createdAtIso: new Date().toISOString(),
        });
        if (created.errors?.length) throw created;
        const id = created.data?.id;
        if (next === 'stay' && id) {
          await this.router.navigate(['/carts', id]);
          return;
        }
      } else {
        const updated = await client.models.CartItem.update({
          id: this.id,
          userId: this.userId,
          productId: this.productId,
          quantity,
        });
        if (updated.errors?.length) throw updated;
        if (next === 'stay') return;
      }
      if (next === 'add') {
        await this.router.navigate(['/carts/new']);
        this.reset();
        return;
      }
      await this.router.navigate(['/carts']);
    } catch (err: any) {
      this.error.set(errorMessage(err, 'Could not save the cart item'));
    } finally {
      this.busy.set(false);
    }
  }

  async remove() {
    const name = this.productName() || 'this item';
    if (!confirm(`Delete ${name} from the cart?`)) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const deleted = await client.models.CartItem.delete({ id: this.id });
      if (deleted.errors?.length) throw deleted;
      await this.router.navigate(['/carts']);
    } catch (err: any) {
      this.error.set(errorMessage(err, 'Could not delete the cart item'));
      this.busy.set(false);
    }
  }

  private reset() {
    this.isNew.set(true);
    this.id = '';
    this.userId = '';
    this.productId = '';
    this.quantity = 1;
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
        id ? client.models.CartItem.get({ id }) : Promise.resolve(null),
      ]);
      if (item?.errors?.length) throw item;
      const row = item?.data;
      if (id && !row) {
        this.error.set('Cart item not found');
        return;
      }
      if (row) {
        this.userId = row.userId;
        this.productId = row.productId;
        this.quantity = row.quantity || 1;
        if (row.userId && !users.has(row.userId)) users.set(row.userId, row.userId);
        if (row.productId && !products.some((product: any) => product.id === row.productId)) {
          products.push({ id: row.productId, name: row.productId });
        }
      }
      this.products.set(products);
      this.users.set([...users.entries()].map(([userId, label]) => ({ id: userId, label })).sort((a, b) => a.label.localeCompare(b.label)));
    } catch (err: any) {
      this.error.set(errorMessage(err, 'Could not load the cart item'));
    }
  }
}
