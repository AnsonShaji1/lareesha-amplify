import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { client } from '../amplify-client';
import { formatDate, listAll, rupees } from '../admin-api';

@Component({
  standalone: true,
  selector: 'app-dashboard',
  imports: [CommonModule, RouterLink],
  template: `
    <h1>Site administration</h1>
    <section class="module">
      <h2>Recent paid orders</h2>
      <p class="lede">Orders with successful payment (payment captured). Newest first.</p>
      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Total</th>
            <th>Status</th>
            <th>Placed</th>
          </tr>
        </thead>
        <tbody>
          @for (order of paidOrders(); track order.id) {
            <tr>
              <th><a [routerLink]="['/orders', order.id]">{{ order.orderNumber }}</a></th>
              <td>
                {{ order.shippingFullName }}
                <div class="quiet">{{ order.shippingEmail }}</div>
              </td>
              <td>{{ rupees(order.totalPaise) }}</td>
              <td>
                <span class="ok">{{ order.paymentStatus }}</span>
                <div class="quiet">{{ order.status }}</div>
              </td>
              <td>{{ formatDate(order.createdAtIso) }}</td>
            </tr>
          } @empty {
            <tr><td colspan="5">No paid orders yet.</td></tr>
          }
        </tbody>
      </table>
      <p><a routerLink="/orders" [queryParams]="{ payment: 'captured' }">View all orders</a></p>
    </section>

    <section class="module">
      <h2>Data tools</h2>
      <p><a routerLink="/seed" class="addlink">Seed catalog from JSON</a></p>
      <p class="lede">Upload a JSON file to create products and categories. Optional reset of catalog or orders.</p>
    </section>
  `,
})
export class DashboardPage {
  paidOrders = signal<any[]>([]);
  rupees = rupees;
  formatDate = formatDate;

  constructor() {
    void this.load();
  }

  private async load() {
    const orders = await listAll((args) => client.models.Order.list(args), 100);
    const paid = orders
      .filter((order: any) => order.paymentStatus === 'captured')
      .sort((a: any, b: any) => String(b.createdAtIso).localeCompare(String(a.createdAtIso)))
      .slice(0, 20);
    this.paidOrders.set(paid);
  }
}
