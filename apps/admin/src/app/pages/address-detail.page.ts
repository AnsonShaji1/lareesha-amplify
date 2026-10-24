import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { client } from '../amplify-client';
import { errorMessage, formatDate } from '../admin-api';

@Component({
  standalone: true,
  selector: 'app-address-detail',
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page-head">
      <h1>{{ address()?.fullName || 'Address' }}</h1>
      <a routerLink="/addresses">Back to list</a>
    </div>
    @if (error()) { <p class="error">{{ error() }}</p> }
    @if (address(); as row) {
      <section class="module">
        <h2>Contact</h2>
        <dl class="details">
          <dt>Name</dt><dd>{{ row.fullName }}</dd>
          <dt>Phone</dt><dd>{{ row.phone }}</dd>
          <dt>Email</dt><dd>{{ row.email }}</dd>
          <dt>Default</dt><dd>{{ row.isDefault ? 'Yes' : 'No' }}</dd>
          <dt>User</dt><dd class="mono">{{ row.userId }}</dd>
          <dt>Created</dt><dd>{{ formatDate(row.createdAtIso) }}</dd>
        </dl>
      </section>

      <section class="module">
        <h2>Address</h2>
        <dl class="details">
          <dt>Line 1</dt><dd>{{ row.addressLine1 }}</dd>
          <dt>Line 2</dt><dd>{{ row.addressLine2 || '—' }}</dd>
          <dt>City</dt><dd>{{ row.city }}</dd>
          <dt>State</dt><dd>{{ row.state }}</dd>
          <dt>ZIP code</dt><dd>{{ row.zipCode }}</dd>
          <dt>Country</dt><dd>{{ row.country }}</dd>
        </dl>
      </section>
    }
  `,
})
export class AddressDetailPage {
  private route = inject(ActivatedRoute);
  address = signal<any>(null);
  error = signal('');
  formatDate = formatDate;

  constructor() {
    void this.load();
  }

  private async load() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    try {
      const result = await client.models.Address.get({ id });
      if (result.errors?.length) throw result;
      if (!result.data) {
        this.error.set('Address not found');
        return;
      }
      this.address.set(result.data);
    } catch (err: any) {
      this.error.set(errorMessage(err, 'Could not load the address'));
    }
  }
}
