import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { client } from '../amplify-client';
import { errorMessage, formatDate, rupees } from '../admin-api';

@Component({
  standalone: true,
  selector: 'app-payment-detail',
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page-head">
      <h1>Payment {{ payment()?.razorpayPaymentId || '' }}</h1>
      <a routerLink="/payments">Back to list</a>
    </div>
    @if (error()) { <p class="error">{{ error() }}</p> }
    @if (payment(); as row) {
      <section class="module">
        <h2>Transaction</h2>
        <dl class="details">
          <dt>Payment id</dt><dd class="mono">{{ row.razorpayPaymentId }}</dd>
          <dt>Status</dt>
          <dd [class.ok]="row.status === 'completed' || row.status === 'captured'" [class.bad]="row.status === 'failed'">
            {{ row.status }}
          </dd>
          <dt>Method</dt><dd>{{ row.paymentMethod }}</dd>
          <dt>Created</dt><dd>{{ formatDate(row.createdAtIso) }}</dd>
        </dl>
      </section>

      <section class="module">
        <h2>Order</h2>
        <dl class="details">
          <dt>Order number</dt><dd><a [routerLink]="['/orders', row.orderId]">{{ row.orderNumber }}</a></dd>
          <dt>User</dt><dd class="mono">{{ row.userId }}</dd>
        </dl>
      </section>

      <section class="module">
        <h2>Razorpay</h2>
        <dl class="details">
          <dt>Razorpay order</dt><dd class="mono">{{ row.razorpayOrderId }}</dd>
          <dt>Razorpay payment</dt><dd class="mono">{{ row.razorpayPaymentId }}</dd>
          <dt>Signature</dt><dd class="mono">{{ row.razorpaySignature || '—' }}</dd>
        </dl>
      </section>

      <section class="module">
        <h2>Amounts</h2>
        <dl class="details">
          <dt>Subtotal</dt><dd>{{ rupees(row.subtotalPaise) }}</dd>
          <dt>Shipping</dt><dd>{{ rupees(row.shippingPaise) }}</dd>
          <dt>Tax</dt><dd>{{ rupees(row.taxPaise) }}</dd>
          <dt>Total</dt><dd><strong>{{ rupees(row.totalPaise) }}</strong></dd>
        </dl>
      </section>
    }
  `,
})
export class PaymentDetailPage {
  private route = inject(ActivatedRoute);
  payment = signal<any>(null);
  error = signal('');
  rupees = rupees;
  formatDate = formatDate;

  constructor() {
    void this.load();
  }

  private async load() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    try {
      const result = await client.models.PaymentTransaction.get({ id });
      if (result.errors?.length) throw result;
      if (!result.data) {
        this.error.set('Payment not found');
        return;
      }
      this.payment.set(result.data);
    } catch (err: any) {
      this.error.set(errorMessage(err, 'Could not load the payment'));
    }
  }
}
