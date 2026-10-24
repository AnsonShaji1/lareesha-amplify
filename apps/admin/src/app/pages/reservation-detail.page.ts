import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { client } from '../amplify-client';
import { errorMessage, formatDate, holdExpiryIso, holdIsActive } from '../admin-api';

@Component({
  standalone: true,
  selector: 'app-reservation-detail',
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page-head">
      <h1>{{ productName() }}</h1>
      <a routerLink="/reservations">Back to list</a>
    </div>
    @if (error()) { <p class="error">{{ error() }}</p> }
    @if (reservation(); as row) {
      <section class="module">
        <h2>Reservation</h2>
        <dl class="details">
          <dt>Quantity</dt><dd>{{ row.quantity }}</dd>
          <dt>Status</dt>
          <dd [class.ok]="holdIsActive(row)" [class.bad]="!holdIsActive(row)">
            {{ holdIsActive(row) ? 'Active' : 'Expired' }}
          </dd>
          <dt>Expires</dt><dd>{{ formatDate(holdExpiryIso(row)) }}</dd>
          <dt>Created</dt><dd>{{ formatDate(row.createdAtIso) }}</dd>
          <dt>Reservation id</dt><dd class="mono">{{ row.id }}</dd>
        </dl>
      </section>

      <section class="module">
        <h2>Product</h2>
        <dl class="details">
          <dt>Name</dt>
          <dd>
            @if (row.productId) {
              <a [routerLink]="['/products', row.productId]">{{ productName() }}</a>
            } @else {
              —
            }
          </dd>
          <dt>Product id</dt><dd class="mono">{{ row.productId }}</dd>
        </dl>
      </section>

      <section class="module">
        <h2>Order</h2>
        <dl class="details">
          <dt>Order number</dt>
          <dd>
            @if (row.orderId) {
              <a [routerLink]="['/orders', row.orderId]">{{ orderNumber() }}</a>
            } @else {
              —
            }
          </dd>
          <dt>Order id</dt><dd class="mono">{{ row.orderId }}</dd>
        </dl>
      </section>
    }
  `,
})
export class ReservationDetailPage {
  private route = inject(ActivatedRoute);
  reservation = signal<any>(null);
  productName = signal('Stock reservation');
  orderNumber = signal('—');
  error = signal('');
  formatDate = formatDate;
  holdIsActive = holdIsActive;
  holdExpiryIso = holdExpiryIso;

  constructor() {
    void this.load();
  }

  private async load() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    try {
      const result = await client.models.StockReservation.get({ id });
      if (result.errors?.length) throw result;
      if (!result.data) {
        this.error.set('Stock reservation not found');
        return;
      }
      const row = result.data;
      this.reservation.set(row);
      const [product, order] = await Promise.all([
        row.productId ? client.models.Product.get({ id: row.productId }) : Promise.resolve(null),
        row.orderId ? client.models.Order.get({ id: row.orderId }) : Promise.resolve(null),
      ]);
      this.productName.set(product?.data?.name || row.productId || 'Stock reservation');
      this.orderNumber.set(order?.data?.orderNumber || row.orderId || '—');
    } catch (err: any) {
      this.error.set(errorMessage(err, 'Could not load the stock reservation'));
    }
  }
}
