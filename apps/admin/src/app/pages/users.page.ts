import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { client } from '../amplify-client';
import { errorMessage, formatDate } from '../admin-api';

@Component({
  standalone: true,
  selector: 'app-users',
  imports: [CommonModule, RouterLink],
  template: `
    <h1>Users</h1>
    <p class="lede">Read-only list of shop accounts. Users cannot be added or changed here.</p>
    @if (loading()) {
      <p class="lede">Loading…</p>
    } @else if (error()) {
      <p class="error">{{ error() }}</p>
    } @else {
      <section class="module">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Group</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            @for (user of users(); track user.username) {
              <tr>
                <th><a [routerLink]="['/users', user.username]">{{ user.name }}</a></th>
                <td>{{ user.email || '—' }}</td>
                <td>{{ user.phone || '—' }}</td>
                <td>{{ user.status }}</td>
                <td>{{ user.group }}</td>
                <td>{{ formatDate(user.createdAtIso) }}</td>
              </tr>
            } @empty {
              <tr><td colspan="6">No users yet.</td></tr>
            }
          </tbody>
        </table>
      </section>
    }
  `,
})
export class UsersPage {
  users = signal<any[]>([]);
  error = signal('');
  loading = signal(true);
  formatDate = formatDate;

  constructor() {
    void this.load();
  }

  private async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.users.set(await loadUsers());
    } catch (err: any) {
      this.users.set([]);
      this.error.set(errorMessage(err, 'Could not load users'));
    } finally {
      this.loading.set(false);
    }
  }
}

export async function loadUsers(): Promise<any[]> {
  const listUsers = client.queries?.listUsers;
  if (typeof listUsers !== 'function') {
    throw new Error('The users query is not in the admin client yet. Restart the admin app after the Amplify config is updated.');
  }
  const result = await listUsers();
  if (result.errors?.length) throw result;
  const rows = Array.isArray(result.data) ? result.data : [];
  return rows.sort((a: any, b: any) => String(b.createdAtIso).localeCompare(String(a.createdAtIso)));
}
