import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { client } from '../amplify-client';
import { errorMessage, formatDate, holdExpiryIso, listAll, parseItems, rupees } from '../admin-api';

@Component({
  standalone: true,
  selector: 'app-order-detail',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="page-head">
      <h1>Order {{ order()?.orderNumber || '' }}</h1>
      <a routerLink="/orders">Back to list</a>
    </div>
    @if (order(); as row) {
      <form class="change-form" (ngSubmit)="save('list')">
        <fieldset class="module">
          <h2>Order information</h2>
          <dl class="details">
            <dt>Order number</dt><dd>{{ row.orderNumber }}</dd>
          </dl>
          <div class="pair">
            <label class="field">Status
              <select [(ngModel)]="status" name="status">
                <option value="pending">pending</option>
                <option value="on_the_way">on_the_way</option>
                <option value="shipped">shipped</option>
                <option value="delivered">delivered</option>
                <option value="cancelled">cancelled</option>
              </select>
            </label>
            <label class="field">Payment status
              <select [(ngModel)]="paymentStatus" name="paymentStatus">
                <option value="pending">pending</option>
                <option value="captured">captured</option>
                <option value="failed">failed</option>
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset class="module">
          <h2>Shipping address</h2>
        <div class="pair">
          <label class="field">Full name
            <input [(ngModel)]="shippingFullName" name="shippingFullName" required />
          </label>
          <label class="field">Phone
            <input [(ngModel)]="shippingPhone" name="shippingPhone" required />
          </label>
        </div>
        <label class="field">Email
          <input type="email" [(ngModel)]="shippingEmail" name="shippingEmail" required />
        </label>
        <label class="field">Address line 1
          <input [(ngModel)]="shippingAddressLine1" name="shippingAddressLine1" required />
        </label>
        <label class="field">Address line 2
          <input [(ngModel)]="shippingAddressLine2" name="shippingAddressLine2" />
        </label>
        <div class="pair">
          <label class="field">City
            <input [(ngModel)]="shippingCity" name="shippingCity" required />
          </label>
          <label class="field">State
            <input [(ngModel)]="shippingState" name="shippingState" required />
          </label>
        </div>
        <div class="pair">
          <label class="field">ZIP code
            <input [(ngModel)]="shippingZipCode" name="shippingZipCode" required />
          </label>
          <label class="field">Country
            <input [(ngModel)]="shippingCountry" name="shippingCountry" required />
          </label>
        </div>
        </fieldset>
        <div class="submit-row">
          <button type="submit" [disabled]="busy()">Save</button>
          <button type="button" [disabled]="busy()" (click)="save('stay')">Save and continue editing</button>
        </div>
      </form>

      <fieldset class="module">
        <h2>Pricing</h2>
        <dl class="details">
          <dt>Subtotal</dt><dd>{{ rupees(row.subtotalPaise) }}</dd>
          <dt>Shipping</dt><dd>{{ rupees(row.shippingPaise) }}</dd>
          <dt>Tax</dt><dd>{{ rupees(row.taxPaise) }}</dd>
          <dt>Total</dt><dd><strong>{{ rupees(row.totalPaise) }}</strong></dd>
        </dl>
      </fieldset>

      <fieldset class="module">
        <h2>Stock reservation</h2>
        <p>Reserved: {{ row.stockReserved ? 'Yes' : 'No' }}</p>
        <p>Expires: {{ formatDate(reservationExpiry()) }}</p>
        @if (reservations().length) {
          <ul>
            @for (item of reservations(); track item.id) {
              <li>{{ item.productId }} × {{ item.quantity }} — expires {{ formatDate(holdExpiryIso(item)) }}</li>
            }
          </ul>
        }
      </fieldset>

      <fieldset class="module">
        <h2>Payment information</h2>
        <dl class="details">
          <dt>Payment status</dt><dd>{{ row.paymentStatus }}</dd>
          <dt>Razorpay order</dt><dd>{{ row.razorpayOrderId || '—' }}</dd>
          <dt>Razorpay payment</dt><dd>{{ row.razorpayPaymentId || '—' }}</dd>
        </dl>
      </fieldset>

      <fieldset class="module">
        <h2>Line items</h2>
        <table>
          <thead>
            <tr><th>Product</th><th>Price</th><th>Qty</th><th>Line total</th></tr>
          </thead>
          <tbody>
            @for (item of items(); track $index) {
              <tr>
                <td>
                  <span class="with-thumb">
                    @if (itemImage(item); as src) {
                      <img class="thumb" [src]="src" alt="" />
                    }
                    {{ item.productName || item.product_name }}
                  </span>
                </td>
                <td>{{ rupees(item.productPricePaise ?? item.product_price) }}</td>
                <td>{{ item.quantity }}</td>
                <td>{{ rupees(item.lineTotalPaise ?? item.line_total) }}</td>
              </tr>
            } @empty {
              <tr><td colspan="4">No line items stored on this order.</td></tr>
            }
          </tbody>
        </table>
      </fieldset>
      <p class="quiet">Created {{ formatDate(row.createdAtIso) }}</p>
    }
    @if (error()) { <p class="error">{{ error() }}</p> }
  `,
})
export class OrderDetailPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  order = signal<any>(null);
  items = signal<any[]>([]);
  reservations = signal<any[]>([]);
  status = 'pending';
  paymentStatus = 'pending';
  shippingFullName = '';
  shippingPhone = '';
  shippingEmail = '';
  shippingAddressLine1 = '';
  shippingAddressLine2 = '';
  shippingCity = '';
  shippingState = '';
  shippingZipCode = '';
  shippingCountry = '';
  error = signal('');
  busy = signal(false);
  rupees = rupees;
  formatDate = formatDate;
  holdExpiryIso = holdExpiryIso;

  constructor() {
    void this.load();
  }

  itemImage(item: any): string {
    const image = item?.productImage || item?.product_image;
    if (!image) return '';
    if (typeof image === 'string') return image;
    return image.url || '';
  }

  reservationExpiry(): string | null {
    const active = this.reservations().filter((item) => Number(item.expiresAtEpoch) > 0);
    if (active.length) {
      const latest = Math.max(...active.map((item) => Number(item.expiresAtEpoch)));
      return new Date(latest * 1000).toISOString();
    }
    return this.order()?.reservationExpiresAt || null;
  }

  async save(next: 'list' | 'stay') {
    const row = this.order();
    if (!row) return;
    this.busy.set(true);
    this.error.set('');
    try {
      let releasedStock = false;
      if (
        this.status === 'cancelled' &&
        row.stockReserved &&
        row.paymentStatus !== 'captured' &&
        row.razorpayOrderId
      ) {
        const released = await client.mutations.paymentFailed({
          razorpayOrderId: row.razorpayOrderId,
        });
        if (released.errors?.length) throw released;
        this.paymentStatus = 'failed';
        this.reservations.set([]);
        releasedStock = true;
      }
      const shipping = this.shippingPayload();
      const updated = await client.models.Order.update({
        id: row.id,
        status: this.status,
        paymentStatus: this.paymentStatus,
        ...shipping,
      });
      if (updated.errors?.length) throw updated;
      this.order.set({
        ...row,
        ...shipping,
        status: this.status,
        paymentStatus: this.paymentStatus,
        stockReserved: releasedStock ? false : row.stockReserved,
      });
      if (next === 'list') await this.router.navigate(['/orders']);
    } catch (err: any) {
      this.error.set(errorMessage(err, 'Could not update the order'));
    } finally {
      this.busy.set(false);
    }
  }

  private shippingPayload() {
    return {
      shippingFullName: this.shippingFullName.trim(),
      shippingPhone: this.shippingPhone.trim(),
      shippingEmail: this.shippingEmail.trim(),
      shippingAddressLine1: this.shippingAddressLine1.trim(),
      shippingAddressLine2: this.shippingAddressLine2.trim(),
      shippingCity: this.shippingCity.trim(),
      shippingState: this.shippingState.trim(),
      shippingZipCode: this.shippingZipCode.trim(),
      shippingCountry: this.shippingCountry.trim(),
    };
  }

  private async load() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    const result = await client.models.Order.get({ id });
    const row = result.data;
    this.order.set(row);
    this.status = row?.status || 'pending';
    this.paymentStatus = row?.paymentStatus || 'pending';
    this.shippingFullName = row?.shippingFullName || '';
    this.shippingPhone = row?.shippingPhone || '';
    this.shippingEmail = row?.shippingEmail || '';
    this.shippingAddressLine1 = row?.shippingAddressLine1 || '';
    this.shippingAddressLine2 = row?.shippingAddressLine2 || '';
    this.shippingCity = row?.shippingCity || '';
    this.shippingState = row?.shippingState || '';
    this.shippingZipCode = row?.shippingZipCode || '';
    this.shippingCountry = row?.shippingCountry || '';
    this.items.set(parseItems(row?.items));
    const reservations = await listAll(
      (args) => client.models.StockReservation.listReservationsByOrder({ orderId: id }, args),
      100,
    );
    this.reservations.set(reservations);
  }
}
