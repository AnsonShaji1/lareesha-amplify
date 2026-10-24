import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { client } from '../amplify-client';
import { errorMessage, slugify, uploadFile } from '../admin-api';

@Component({
  standalone: true,
  selector: 'app-category-form',
  imports: [CommonModule, FormsModule],
  template: `
    <h1>{{ isNew() ? 'Add category' : 'Change category' }}</h1>
    @if (!isNew() && name) {
      <h2>Category: {{ name }}</h2>
    }
    @if (error()) { <p class="error">{{ error() }}</p> }

    <form class="module change-form" (ngSubmit)="save('list')">
      <div class="pair">
        <label class="field">Name
          <input [(ngModel)]="name" name="name" required />
        </label>
        <label class="field">Slug
          <input [value]="slugify(name)" name="slug" disabled />
        </label>
      </div>
      <label class="field">Image
        <input type="file" accept="image/*" (change)="onFile($event)" />
      </label>
      @if (imageUrl) {
        <img class="preview" [src]="imageUrl" alt="" />
      }
      <div class="submit-row">
        <button type="submit" [disabled]="busy()">Save</button>
        <button type="button" [disabled]="busy()" (click)="save('add')">Save and add another</button>
        <button type="button" [disabled]="busy()" (click)="save('stay')">Save and continue editing</button>
      </div>
    </form>
    @if (!isNew()) {
      <p><button type="button" class="danger" [disabled]="busy()" (click)="remove()">Delete</button></p>
    }
  `,
})
export class CategoryFormPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  error = signal('');
  busy = signal(false);
  isNew = signal(true);
  name = '';
  imageUrl = '';
  slugify = slugify;
  private id = '';

  constructor() {
    this.route.paramMap.subscribe(() => {
      void this.load();
    });
  }

  async onFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      this.imageUrl = await uploadFile(file, 'categories');
    } catch (err: any) {
      this.error.set(errorMessage(err, 'Image upload failed'));
    }
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
      const slug = slugify(name);
      if (this.isNew()) {
        const created = await client.models.Category.create({
          name,
          slug,
          imageUrl: this.imageUrl || null,
          createdAtIso: new Date().toISOString(),
        });
        if (created.errors?.length) throw created;
        const id = created.data?.id;
        if (next === 'stay' && id) {
          await this.router.navigate(['/categories', id]);
          return;
        }
      } else {
        const updated = await client.models.Category.update({
          id: this.id,
          name,
          slug,
          imageUrl: this.imageUrl || null,
        });
        if (updated.errors?.length) throw updated;
        if (next === 'stay') return;
      }
      if (next === 'add') {
        await this.router.navigate(['/categories/new']);
        this.reset();
        return;
      }
      await this.router.navigate(['/categories']);
    } catch (err: any) {
      this.error.set(errorMessage(err, 'Could not save the category'));
    } finally {
      this.busy.set(false);
    }
  }

  remove() {
    if (!this.id) return;
    void this.router.navigate(['/categories/delete'], { state: { ids: [this.id] } });
  }

  private reset() {
    this.isNew.set(true);
    this.id = '';
    this.name = '';
    this.imageUrl = '';
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
      const result = await client.models.Category.get({ id });
      if (result.errors?.length) throw result;
      const row = result.data;
      if (!row) {
        this.error.set('Category not found');
        return;
      }
      this.name = row.name;
      this.imageUrl = row.imageUrl || '';
    } catch (err: any) {
      this.error.set(errorMessage(err, 'Could not load the category'));
    }
  }
}
