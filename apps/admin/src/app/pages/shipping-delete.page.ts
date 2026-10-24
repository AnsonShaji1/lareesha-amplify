import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { client } from '../amplify-client';
import { errorMessage, listAll } from '../admin-api';

@Component({
  standalone: true,
  selector: 'app-shipping-delete',
  imports: [CommonModule, RouterLink],
  template: `
    @if (error()) { <p class="error">{{ error() }}</p> }
    @if (ready() && prefixes().length) {
      <div class="delete-confirm">
        <h1>Cannot delete Shipping zones</h1>
        <p>Deleting the selected shipping zones would require deleting the following protected related objects:</p>
        <ul>
          @for (item of prefixes(); track item.prefix) {
            <li>
              Pincode prefix:
              <a [routerLink]="['/shipping', item.zoneId]">{{ item.prefix }}</a>
            </li>
          }
        </ul>
      </div>
    } @else if (ready()) {
      <div class="delete-confirm">
        <h1>Delete multiple objects</h1>
        <p>Are you sure you want to delete the selected shipping zones? All of the following objects and their related items will be deleted:</p>
        <h2>Summary</h2>
        <ul>
          <li>Shipping zones: {{ rows().length }}</li>
        </ul>
        <h2>Objects</h2>
        <ul>
          @for (row of rows(); track row.id) {
            <li>
              Shipping zone:
              <a [routerLink]="['/shipping', row.id]">Shipping zone: {{ row.name }}</a>
            </li>
          }
        </ul>
        <div class="delete-confirm__actions">
          <button type="button" class="danger" [disabled]="busy()" (click)="confirm()">Yes, I'm sure</button>
          <button type="button" class="cancel" [disabled]="busy()" (click)="back()">No, take me back</button>
        </div>
      </div>
    }
  `,
})
export class ShippingDeletePage {
  private router = inject(Router);
  rows = signal<{ id: string; name: string }[]>([]);
  prefixes = signal<{ prefix: string; zoneId: string }[]>([]);
  error = signal('');
  busy = signal(false);
  ready = signal(false);
  private ids: string[] = [];

  constructor() {
    const ids = (history.state as { ids?: unknown })?.ids;
    this.ids = Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string' && !!id) : [];
    if (!this.ids.length) {
      void this.router.navigate(['/shipping']);
      return;
    }
    void this.load();
  }

  back() {
    void this.router.navigate(['/shipping']);
  }

  async confirm() {
    if (this.prefixes().length) return;
    const ids = this.rows().map((row) => row.id);
    if (!ids.length) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const linked = await this.linkedPrefixes(ids);
      if (linked.length) {
        this.prefixes.set(linked);
        this.busy.set(false);
        return;
      }
      const results = await Promise.all(ids.map((id) => client.models.ShippingZone.delete({ id })));
      const failed = results.find((result) => result.errors?.length);
      if (failed) throw failed;
      await this.router.navigate(['/shipping']);
    } catch (err: any) {
      this.error.set(errorMessage(err, 'Could not delete the selected shipping zones'));
      this.busy.set(false);
    }
  }

  private async load() {
    try {
      const zones = await listAll((args) => client.models.ShippingZone.list(args), 50);
      const byId = new Map(zones.map((zone: any) => [zone.id, zone]));
      const rows = this.ids
        .map((id) => byId.get(id))
        .filter((zone): zone is { id: string; name: string } => !!zone)
        .map((zone) => ({ id: zone.id, name: zone.name }));
      if (!rows.length) {
        await this.router.navigate(['/shipping']);
        return;
      }
      this.rows.set(rows);
      this.prefixes.set(await this.linkedPrefixes(rows.map((row) => row.id)));
      this.ready.set(true);
    } catch (err: any) {
      this.error.set(errorMessage(err, 'Could not load the selected shipping zones'));
    }
  }

  private async linkedPrefixes(zoneIds: string[]): Promise<{ prefix: string; zoneId: string }[]> {
    const selected = new Set(zoneIds);
    const prefixes = await listAll((args) => client.models.ShippingPinPrefix.list(args), 200);
    return prefixes
      .filter((item: any) => selected.has(item.zoneId))
      .map((item: any) => ({ prefix: String(item.prefix), zoneId: item.zoneId }))
      .sort((a, b) => a.prefix.localeCompare(b.prefix));
  }
}
