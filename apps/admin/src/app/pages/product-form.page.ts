import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { client } from '../amplify-client';
import {
  deleteProductImages,
  errorMessage,
  fromPaise,
  holdIsActive,
  listAll,
  parseImages,
  ProductImage,
  serializeImages,
  slugify,
  toPaise,
  uploadFile,
} from '../admin-api';

@Component({
  standalone: true,
  selector: 'app-product-form',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-head">
      <h1>{{ isNew() ? 'Add product' : 'Change product' }}</h1>
      <a routerLink="/products">Back to list</a>
    </div>

    <form (ngSubmit)="save()">
      <fieldset class="module">
        <h2>Basic information</h2>
        @if (!isNew()) {
          <p>Product code: <strong>{{ productCode() || '—' }}</strong></p>
        }
        <label class="field">Name
          <input [(ngModel)]="form.name" name="name" required />
        </label>
        <label class="field">Description
          <textarea [(ngModel)]="form.description" name="description" rows="5"></textarea>
        </label>
        <label class="field">Category
          <select [(ngModel)]="form.categoryId" name="categoryId" required>
            <option value="">Select a category</option>
            @for (category of categories(); track category.id) {
              <option [value]="category.id">{{ category.name }}</option>
            }
          </select>
        </label>
        <label class="check"><input type="checkbox" [(ngModel)]="form.newIn" name="newIn" /> New in — show in New Arrivals</label>
      </fieldset>

      <fieldset class="module">
        <h2>Pricing</h2>
        <div class="grid">
          <label class="field">Original price (₹)
            <input type="number" min="0" step="0.01" [(ngModel)]="form.originalRupees" name="original" />
          </label>
          <label class="field">Sale price (₹)
            <input type="number" min="0" step="0.01" [(ngModel)]="form.saleRupees" name="sale" />
          </label>
        </div>
      </fieldset>

      <fieldset class="module">
        <h2>Inventory</h2>
        <p class="lede">Available stock = total stock − reserved stock from unpaid orders.</p>
        <label class="field">Total stock
          <input type="number" min="0" [(ngModel)]="form.stock" name="stock" />
        </label>
        @if (!isNew()) {
          <p>Reserved: <strong>{{ reserved() }}</strong> · Available:
            <strong [class.bad]="available() === 0" [class.warn]="available() > 0 && available() <= 5">{{ available() }}</strong>
          </p>
        }
      </fieldset>

      <fieldset class="module">
        <h2>Tax</h2>
        <label class="field">Tax percentage
          <input type="number" min="0" step="0.01" [(ngModel)]="form.taxPercent" name="tax" />
        </label>
        <p class="quiet">Store shipping is set under Shipping, not per product.</p>
      </fieldset>

      <fieldset class="module">
        <h2>Product images</h2>
        <p class="lede">The thumbnail is the photo shoppers see on product cards. The other photos appear in the gallery in this order.</p>
        <label class="field">Add images
          <input type="file" accept="image/*" multiple (change)="onFiles($event)" />
        </label>
        <div class="image-grid">
          @for (image of images(); track image.url; let i = $index) {
            <figure [class.is-thumb]="i === 0">
              <img [src]="image.url" [alt]="i === 0 ? 'Thumbnail' : 'Gallery photo ' + (i + 1)" />
              <figcaption>{{ i === 0 ? 'Thumbnail' : 'Photo ' + (i + 1) }}</figcaption>
              <div class="image-actions">
                @if (i > 0) {
                  <button type="button" class="link" (click)="moveImage(i, -1)">Move earlier</button>
                }
                @if (i < images().length - 1) {
                  <button type="button" class="link" (click)="moveImage(i, 1)">Move later</button>
                }
                <button type="button" class="danger" (click)="removeImage(i)">Remove</button>
              </div>
            </figure>
          }
        </div>
      </fieldset>

      @if (error()) { <p class="error">{{ error() }}</p> }
      <div class="submit-row">
        <button type="submit" class="primary" [disabled]="busy()">{{ busy() ? 'Saving…' : 'Save' }}</button>
        @if (!isNew()) {
          <button type="button" class="danger" (click)="remove()" [disabled]="busy()">Delete</button>
        }
      </div>
    </form>
  `,
})
export class ProductFormPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  categories = signal<any[]>([]);
  images = signal<ProductImage[]>([]);
  reserved = signal(0);
  busy = signal(false);
  error = signal('');
  isNew = signal(true);
  productId = '';
  productCode = signal('');
  form = {
    name: '',
    description: '',
    categoryId: '',
    newIn: false,
    originalRupees: '0',
    saleRupees: '0',
    stock: '0',
    taxPercent: '0',
  };

  constructor() {
    void this.load();
  }

  available(): number {
    return Math.max(0, Number(this.form.stock || 0) - this.reserved());
  }

  async onFiles(event: Event) {
    const files = Array.from((event.target as HTMLInputElement).files || []);
    this.error.set('');
    try {
      const uploaded: ProductImage[] = [];
      for (const [index, file] of files.entries()) {
        const url = await uploadFile(file, 'products');
        uploaded.push({ url, order: this.images().length + index });
      }
      this.images.update((current) => [...current, ...uploaded]);
    } catch (err: any) {
      this.error.set(errorMessage(err, 'Image upload failed'));
    }
  }

  removeImage(index: number) {
    this.images.update((current) => current.filter((_, i) => i !== index));
  }

  moveImage(index: number, direction: -1 | 1) {
    this.images.update((current) => {
      const next = current.slice();
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      const [image] = next.splice(index, 1);
      next.splice(target, 0, image);
      return next;
    });
  }

  async save() {
    this.busy.set(true);
    this.error.set('');
    try {
      const category = this.categories().find((item) => item.id === this.form.categoryId);
      if (!category) throw new Error('Select a category');
      const payload: Record<string, unknown> = {
        name: this.form.name.trim(),
        description: this.form.description,
        originalPricePaise: toPaise(this.form.originalRupees),
        salePricePaise: toPaise(this.form.saleRupees || this.form.originalRupees),
        categoryId: category.id,
        categoryName: category.name,
        categorySlug: category.slug || slugify(category.name),
        newIn: this.form.newIn,
        newInKey: this.form.newIn ? 'NEW' : null,
        listingKey: 'ALL',
        priceKey: 'ALL',
        noOfStock: Number(this.form.stock || 0),
        taxPercentageBps: Math.round(Number(this.form.taxPercent || 0) * 100),
      };
      const images = serializeImages(this.images());
      if (images) payload['images'] = images;
      else if (!this.isNew()) payload['images'] = JSON.stringify([]);

      if (this.isNew()) {
        const allocated = await client.mutations.allocateProductCode();
        if (allocated.errors?.length) throw allocated;
        const productCode = allocated.data;
        if (!productCode) throw new Error('Could not allocate a product code');
        payload['productCode'] = productCode;
        payload['createdAtIso'] = new Date().toISOString();
        const created = await client.models.Product.create(payload);
        if (created.errors?.length) throw created;
        this.productId = created.data.id;
      } else {
        payload['id'] = this.productId;
        const updated = await client.models.Product.update(payload);
        if (updated.errors?.length) throw updated;
      }
      await this.router.navigateByUrl('/products');
    } catch (err: any) {
      this.error.set(errorMessage(err, 'Could not save the product'));
    } finally {
      this.busy.set(false);
    }
  }

  async remove() {
    if (!confirm('Delete this product?')) return;
    this.busy.set(true);
    try {
      const current = await client.models.Product.get({ id: this.productId });
      await deleteProductImages(current.data?.images);
      await deleteProductImages(this.images());
      await client.models.Product.delete({ id: this.productId });
      await this.router.navigateByUrl('/products');
    } catch (err: any) {
      this.error.set(errorMessage(err, 'Could not delete the product'));
      this.busy.set(false);
    }
  }

  private async load() {
    const categories = await listAll((args) => client.models.Category.list(args), 200);
    this.categories.set(categories.sort((a: any, b: any) => a.name.localeCompare(b.name)));
    const id = this.route.snapshot.paramMap.get('id');
    if (!id || id === 'new') {
      this.isNew.set(true);
      return;
    }
    this.isNew.set(false);
    this.productId = id;
    const product = await client.models.Product.get({ id });
    const row = product.data;
    if (!row) {
      this.error.set('Product not found');
      return;
    }
    this.form = {
      name: row.name,
      description: row.description || '',
      categoryId: row.categoryId,
      newIn: !!row.newIn,
      originalRupees: fromPaise(row.originalPricePaise),
      saleRupees: fromPaise(row.salePricePaise),
      stock: String(row.noOfStock ?? 0),
      taxPercent: String((row.taxPercentageBps || 0) / 100),
    };
    this.productCode.set(row.productCode || '');
    this.images.set(parseImages(row.images));
    const reservations = await listAll(
      (args) => client.models.StockReservation.listReservationsByProduct({ productId: id }, args),
      100,
    );
    this.reserved.set(
      reservations.reduce((sum: number, item: any) => {
        return holdIsActive(item) ? sum + (item.quantity || 0) : sum;
      }, 0),
    );
  }
}
