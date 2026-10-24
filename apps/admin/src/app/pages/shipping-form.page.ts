import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { client } from '../amplify-client';
import { errorMessage, listAll, slugify, toPaise } from '../admin-api';

@Component({
  standalone: true,
  selector: 'app-shipping-form',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <h1>{{ isNew() ? 'Add shipping zone' : 'Change shipping zone' }}</h1>
    @if (!isNew() && name) {
      <h2>Shipping zone: {{ name }}</h2>
    }
    @if (error()) { <p class="error">{{ error() }}</p> }

    <form class="module change-form" (ngSubmit)="save('list')">
      <div class="pair">
        <label class="field">Name
          <input [(ngModel)]="name" name="name" required />
        </label>
        <label class="field">Code
          <input [(ngModel)]="code" name="code" placeholder="kerala" />
        </label>
      </div>
      <div class="pair">
        <label class="field">Base fee (₹)
          <input type="number" min="0" [(ngModel)]="baseRupees" name="base" />
        </label>
        <label class="field">Free shipping min order (₹)
          <input type="number" min="0" [(ngModel)]="freeRupees" name="free" />
        </label>
      </div>
      <label class="field">Priority
        <input type="number" [(ngModel)]="priority" name="priority" />
      </label>
      <label class="check"><input type="checkbox" [(ngModel)]="isActive" name="active" /> Active</label>
      <label class="check"><input type="checkbox" [(ngModel)]="isFallback" name="fallback" /> Fallback</label>
      <p class="quiet">Lower priority wins. Keep one active fallback zone for unknown pincodes.</p>
      <div class="submit-row">
        <button type="submit" [disabled]="busy()">Save</button>
        <button type="button" [disabled]="busy()" (click)="save('add')">Save and add another</button>
        <button type="button" [disabled]="busy()" (click)="save('stay')">Save and continue editing</button>
      </div>
    </form>

    @if (!isNew()) {
      <section class="module">
        <h2>Pincode prefixes</h2>
        <p class="lede">Numeric prefixes of 3 to 6 digits. Checkout uses the longest match.</p>
        <form class="row" (ngSubmit)="savePrefix()">
          <label class="field">Prefix
            <input [(ngModel)]="prefix" name="prefix" placeholder="682" />
          </label>
          <button type="submit" [disabled]="busy()">Add prefix</button>
        </form>
        <table>
          <thead>
            <tr><th>Prefix</th><th></th></tr>
          </thead>
          <tbody>
            @for (item of prefixes(); track item.prefix) {
              <tr>
                <td>{{ item.prefix }}</td>
                <td><button type="button" class="danger" [disabled]="busy()" (click)="deletePrefix(item.prefix)">Delete</button></td>
              </tr>
            } @empty {
              <tr><td colspan="2">No prefixes for this zone.</td></tr>
            }
          </tbody>
        </table>
      </section>
      <p><button type="button" class="danger" [disabled]="busy()" (click)="remove()">Delete</button></p>
    } @else {
      <p class="quiet">Save the zone before adding pincode prefixes.</p>
    }
    <p><a routerLink="/shipping">Back to list</a></p>
  `,
})
export class ShippingFormPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  error = signal('');
  busy = signal(false);
  isNew = signal(true);
  prefixes = signal<any[]>([]);
  name = '';
  code = '';
  baseRupees = '60';
  freeRupees = '2500';
  priority = '10';
  isActive = true;
  isFallback = false;
  prefix = '';
  private id = '';

  constructor() {
    this.route.paramMap.subscribe(() => {
      void this.load();
    });
  }

  async save(next: 'list' | 'add' | 'stay') {
    const name = this.name.trim();
    if (!name) {
      this.error.set('Enter a name.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const payload = {
        name,
        code: this.code.trim() || slugify(name),
        baseFeePaise: toPaise(this.baseRupees),
        freeShippingMinOrderPaise: this.freeRupees === '' ? null : toPaise(this.freeRupees),
        priority: Number(this.priority),
        isActive: this.isActive,
        isFallback: this.isFallback,
      };
      if (this.isNew()) {
        const created = await client.models.ShippingZone.create({
          ...payload,
          createdAtIso: new Date().toISOString(),
        });
        if (created.errors?.length) throw created;
        const id = created.data?.id;
        if (next === 'stay' && id) {
          await this.router.navigate(['/shipping', id]);
          return;
        }
      } else {
        const updated = await client.models.ShippingZone.update({ id: this.id, ...payload });
        if (updated.errors?.length) throw updated;
        if (next === 'stay') return;
      }
      if (next === 'add') {
        await this.router.navigate(['/shipping/new']);
        this.reset();
        return;
      }
      await this.router.navigate(['/shipping']);
    } catch (err: any) {
      this.error.set(errorMessage(err, 'Could not save the zone'));
    } finally {
      this.busy.set(false);
    }
  }

  remove() {
    if (!this.id) return;
    void this.router.navigate(['/shipping/delete'], { state: { ids: [this.id] } });
  }

  async savePrefix() {
    const prefix = this.prefix.trim();
    if (!/^\d{3,6}$/.test(prefix)) {
      this.error.set('Prefix must be 3 to 6 digits.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const created = await client.models.ShippingPinPrefix.create({
        prefix,
        zoneId: this.id,
        zoneCode: this.code.trim() || slugify(this.name),
        createdAtIso: new Date().toISOString(),
      });
      if (created.errors?.length) throw created;
      this.prefix = '';
      await this.loadPrefixes();
    } catch (err: any) {
      this.error.set(errorMessage(err, 'Could not save the prefix'));
    } finally {
      this.busy.set(false);
    }
  }

  async deletePrefix(prefix: string) {
    if (!confirm(`Delete prefix ${prefix}?`)) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const deleted = await client.models.ShippingPinPrefix.delete({ prefix });
      if (deleted.errors?.length) throw deleted;
      await this.loadPrefixes();
    } catch (err: any) {
      this.error.set(errorMessage(err, 'Could not delete the prefix'));
    } finally {
      this.busy.set(false);
    }
  }

  private reset() {
    this.isNew.set(true);
    this.id = '';
    this.name = '';
    this.code = '';
    this.baseRupees = '60';
    this.freeRupees = '2500';
    this.priority = '10';
    this.isActive = true;
    this.isFallback = false;
    this.prefix = '';
    this.prefixes.set([]);
    this.error.set('');
  }

  private async load() {
    const id = this.route.snapshot.paramMap.get('id');
    this.isNew.set(!id);
    this.id = id || '';
    if (!id) {
      this.reset();
      return;
    }
    try {
      const result = await client.models.ShippingZone.get({ id });
      if (result.errors?.length) throw result;
      const row = result.data;
      if (!row) {
        this.error.set('Shipping zone not found');
        return;
      }
      this.name = row.name;
      this.code = row.code;
      this.baseRupees = String((row.baseFeePaise || 0) / 100);
      this.freeRupees = row.freeShippingMinOrderPaise != null ? String(row.freeShippingMinOrderPaise / 100) : '';
      this.priority = String(row.priority ?? 10);
      this.isActive = row.isActive !== false;
      this.isFallback = !!row.isFallback;
      await this.loadPrefixes();
    } catch (err: any) {
      this.error.set(errorMessage(err, 'Could not load the shipping zone'));
    }
  }

  private async loadPrefixes() {
    const prefixes = await listAll((args) => client.models.ShippingPinPrefix.list(args), 200);
    this.prefixes.set(
      prefixes
        .filter((item: any) => item.zoneId === this.id)
        .sort((a: any, b: any) => String(a.prefix).localeCompare(String(b.prefix))),
    );
  }
}
