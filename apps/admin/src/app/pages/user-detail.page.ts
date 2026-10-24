import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { errorMessage, formatDate } from '../admin-api';
import { loadUsers } from './users.page';

@Component({
  standalone: true,
  selector: 'app-user-detail',
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page-head">
      <h1>{{ user()?.name || 'User' }}</h1>
      <a routerLink="/users">Back to list</a>
    </div>
    <p class="lede">Read-only account. Users cannot be changed here.</p>
    @if (error()) { <p class="error">{{ error() }}</p> }
    @if (user(); as row) {
      <section class="module">
        <h2>Account</h2>
        <dl class="details">
          <dt>Name</dt><dd>{{ row.name }}</dd>
          <dt>Username</dt><dd>{{ row.username }}</dd>
          <dt>User id</dt><dd class="mono">{{ row.sub || '—' }}</dd>
          <dt>Email</dt><dd>{{ row.email || '—' }}</dd>
          <dt>Phone</dt><dd>{{ row.phone || '—' }}</dd>
          <dt>Status</dt><dd>{{ row.status }}</dd>
          <dt>Group</dt><dd>{{ row.group }}</dd>
          <dt>Created</dt><dd>{{ formatDate(row.createdAtIso) }}</dd>
        </dl>
      </section>
    }
  `,
})
export class UserDetailPage {
  private route = inject(ActivatedRoute);
  user = signal<any>(null);
  error = signal('');
  formatDate = formatDate;

  constructor() {
    void this.load();
  }

  private async load() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    try {
      const users = await loadUsers();
      const user = users.find((row) => row.username === id || row.sub === id);
      if (!user) {
        this.error.set('User not found');
        return;
      }
      this.user.set(user);
    } catch (err: any) {
      this.error.set(errorMessage(err, 'Could not load the user'));
    }
  }
}
