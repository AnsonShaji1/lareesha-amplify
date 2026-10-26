import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { client } from '../amplify-client';
import { errorMessage, fromPaise, toPaise } from '../admin-api';

const SHIPPING_ID = 'default';

@Component({
  standalone: true,
  selector: 'app-shipping',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-head">
      <h1>Shipping</h1>
    </div>
    <p class="lede">
      One setting for the whole store. Turn on free shipping for promotions, or set a flat fee for every order.
    </p>
    @if (error()) {
      <p class="error">{{ error() }}</p>
    }
    @if (saved()) {
      <p class="ok">Shipping settings saved.</p>
    }

    <form class="module change-form" (ngSubmit)="save()">
      <label class="check">
        <input type="checkbox" [(ngModel)]="isFreeShipping" name="free" />
        Free shipping
      </label>
      <label class="field">
        Shipping fee (₹)
        <input
          type="number"
          min="0"
          step="0.01"
          [(ngModel)]="feeRupees"
          name="fee"
          [disabled]="isFreeShipping"
        />
      </label>
      <p class="quiet">
        @if (isFreeShipping) {
          Checkout will charge ₹0 for shipping while free shipping is on.
        } @else {
          This amount is added to every order as shipping.
        }
      </p>
      <div class="submit-row">
        <button type="submit" [disabled]="busy()">Save</button>
      </div>
    </form>
  `,
  styles: `
    .ok {
      color: #1b5c36;
      margin: 0 0 16px;
    }
  `,
})
export class ShippingPage {
  private exists = false;
  isFreeShipping = false;
  feeRupees = '0';
  busy = signal(false);
  error = signal('');
  saved = signal(false);

  constructor() {
    void this.load();
  }

  async save() {
    this.busy.set(true);
    this.error.set('');
    this.saved.set(false);
    try {
      const feePaise = this.isFreeShipping ? 0 : Math.max(0, toPaise(this.feeRupees));
      const payload = {
        id: SHIPPING_ID,
        isFreeShipping: this.isFreeShipping,
        feePaise,
        updatedAtIso: new Date().toISOString(),
      };
      const result = this.exists
        ? await client.models.Shipping.update(payload)
        : await client.models.Shipping.create(payload);
      if (result.errors?.length) throw result;
      this.exists = true;
      this.feeRupees = fromPaise(feePaise);
      this.saved.set(true);
    } catch (err: any) {
      this.error.set(errorMessage(err, 'Could not save shipping settings'));
    } finally {
      this.busy.set(false);
    }
  }

  private async load() {
    this.error.set('');
    try {
      const result = await client.models.Shipping.get({ id: SHIPPING_ID });
      const row = result.data;
      if (!row) {
        this.exists = false;
        this.isFreeShipping = false;
        this.feeRupees = '0';
        return;
      }
      this.exists = true;
      this.isFreeShipping = !!row.isFreeShipping;
      this.feeRupees = fromPaise(row.feePaise);
    } catch (err: any) {
      this.error.set(errorMessage(err, 'Could not load shipping settings'));
    }
  }
}
