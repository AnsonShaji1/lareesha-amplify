import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { client } from '../amplify-client';
import { errorMessage, formatDate } from '../admin-api';

@Component({
  standalone: true,
  selector: 'app-seed',
  imports: [CommonModule, FormsModule],
  template: `
    <h1>{{ live ? 'Seed catalog from live images' : 'Seed catalog from JSON' }}</h1>
    <section class="module">
      <p>
        Uploads are processed <strong>in the background</strong>. After you start a job, progress appears below.
        Large catalogs (100+ products) are supported.
      </p>
    </section>

    <section class="module">
      <form (ngSubmit)="start()">
        <label class="field">JSON file
          <input type="file" accept="application/json" (change)="onFile($event)" />
        </label>
        <p class="lede">{{ fileName || 'No file selected' }} · {{ productCount() }} named products</p>
        <label class="check">
          <input type="checkbox" [(ngModel)]="resetCatalog" name="resetCatalog" />
          Reset catalog — delete all categories and products before seeding
        </label>
        <label class="check">
          <input type="checkbox" [(ngModel)]="resetOrders" name="resetOrders" />
          Reset orders — delete orders and payment transactions before seeding
        </label>
        <div class="submit-row">
          <button type="submit" class="primary" [disabled]="!jsonText || busy()">Start seed job</button>
        </div>
      </form>
      @if (error()) { <p class="error">{{ error() }}</p> }
    </section>

    @if (job()) {
      <section class="module">
        <h2>Current job</h2>
        <p>Status: <strong>{{ job().status }}</strong></p>
        <p>Progress: {{ job().processedProducts || 0 }} / {{ job().totalProducts || 0 }}
          ({{ progress(job()) }}%)</p>
        <p>Created {{ job().createdProducts || 0 }} products, {{ job().createdCategories || 0 }} categories,
          {{ job().createdImages || 0 }} images</p>
        @if (job().errorMessage) { <p class="error">{{ job().errorMessage }}</p> }
        @if (itemErrors(job()).length) {
          <h3>Image errors</h3>
          <ul class="error-list">
            @for (item of itemErrors(job()); track $index) {
              <li>
                <strong>{{ item.product || 'Product' }}</strong>
                — <span class="mono">{{ item.image }}</span>
                — {{ item.message }}
              </li>
            }
          </ul>
        }
      </section>
    }

    <section class="module">
      <h2>Recent jobs</h2>
      <table>
        <thead>
          <tr><th>ID</th><th>Status</th><th>Progress</th><th>Created</th><th>When</th></tr>
        </thead>
        <tbody>
          @for (item of jobs(); track item.id) {
            <tr>
              <td class="mono">{{ item.id.slice(0, 8) }}</td>
              <td>{{ item.status }}</td>
              <td>{{ item.processedProducts || 0 }} / {{ item.totalProducts || 0 }}</td>
              <td>{{ item.createdProducts || 0 }} products, {{ item.createdImages || 0 }} images</td>
              <td>{{ formatDate(item.createdAtIso) }}</td>
            </tr>
          } @empty {
            <tr><td colspan="5">No seed jobs yet.</td></tr>
          }
        </tbody>
      </table>
    </section>

    <section class="module">
      <h2>JSON format</h2>
      <p class="lede">
        @if (live) {
          Image paths such as <span class="mono">/test/225_0.jpg</span> are read from
          <span class="mono">lareesha/products/225_0.jpg</span>. Product images are copied to
          <span class="mono">lareesha-v1/products/</span>. A new category is given a copy of
          the first image under <span class="mono">lareesha-v1/categories/</span>.
          Leave reset catalog off when uploading the next batch.
        } @else {
          Image paths such as <span class="mono">/test/33.jpg</span> are read from
          <span class="mono">lareesha-v1/test/</span>. Product images are copied to
          <span class="mono">lareesha-v1/products/</span>. A new category is given a copy of
          the first image under <span class="mono">lareesha-v1/categories/</span>.
          The JSON file is saved to <span class="mono">lareesha-v1/upload_file/</span>.
        }
      </p>
      <pre>[
  {{ '{' }}
    "name": "Product name",
    "description": "Description",
    "original_price": 369.00,
    "sale_price": 369.00,
    "tax_percentage": 0,
    "category": "Necklaces",
    "new_in": true,
    "no_of_stock": 10,
    "images": ["/test/1.jpg", "/test/2.jpg"]
  {{ '}' }}
]</pre>
    </section>
  `,
})
export class SeedPage {
  private route = inject(ActivatedRoute);
  live = this.route.snapshot.data['imageSource'] === 'live';
  resetCatalog = !this.live;
  resetOrders = false;
  jsonText = '';
  jsonFile: File | null = null;
  fileName = '';
  productCount = signal(0);
  busy = signal(false);
  error = signal('');
  job = signal<any>(null);
  jobs = signal<any[]>([]);
  formatDate = formatDate;
  private timer?: ReturnType<typeof setInterval>;

  constructor() {
    void this.refreshJobs();
  }

  progress(job: any): number {
    if (!job?.totalProducts) return 0;
    return Math.round(((job.processedProducts || 0) / job.totalProducts) * 100);
  }

  itemErrors(job: any): { product?: string; image?: string; message?: string }[] {
    let raw = job?.itemErrors;
    if (!raw) return [];
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        return [];
      }
    }
    return Array.isArray(raw) ? raw : [];
  }

  onFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.jsonFile = file;
    this.fileName = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      this.jsonText = String(reader.result || '');
      try {
        const parsed = JSON.parse(this.jsonText);
        const list = Array.isArray(parsed) ? parsed : parsed.products || [];
        this.productCount.set(list.filter((item: any) => item?.name).length);
        this.error.set('');
      } catch {
        this.productCount.set(0);
        this.error.set('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  }

  async start() {
    this.busy.set(true);
    this.error.set('');
    try {
      if (!this.jsonFile) throw new Error('Choose a JSON file first.');
      if (!this.productCount()) throw new Error('JSON contains no products with a name.');
      const jsonKey = await this.uploadSeedFile(this.jsonFile);
      const input: Record<string, unknown> = {
        jsonKey,
        resetCatalog: this.resetCatalog,
        resetOrders: this.resetOrders,
      };
      if (this.live) input['imageSource'] = 'live';
      await client.mutations.catalogSeed(input);
      await new Promise((resolve) => setTimeout(resolve, 800));
      await this.refreshJobs();
      this.job.set(this.jobs()[0] || null);
      this.timer = setInterval(() => void this.poll(), 2000);
    } catch (err: any) {
      this.error.set(errorMessage(err, 'Could not start seed job'));
    } finally {
      this.busy.set(false);
    }
  }

  private async uploadSeedFile(file: File): Promise<string> {
    const upload = await client.mutations.getMediaUploadUrl({
      filename: file.name.toLowerCase().endsWith('.json') ? file.name : `${file.name}.json`,
      contentType: 'application/json',
      folder: 'upload_file',
    });
    if (!upload.data?.uploadUrl || !upload.data.key) {
      throw new Error(upload.errors?.[0]?.message || 'Could not get an upload URL for the JSON file.');
    }
    const response = await fetch(upload.data.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`JSON upload failed (${response.status})`);
    }
    return upload.data.key;
  }

  private async poll() {
    if (!this.job()?.id) return;
    const latest = await client.models.CatalogSeedJob.get({ id: this.job().id });
    this.job.set(latest.data);
    if (latest.data?.status === 'completed' || latest.data?.status === 'failed') {
      if (this.timer) clearInterval(this.timer);
      await this.refreshJobs();
    }
  }

  private async refreshJobs() {
    const result = await client.models.CatalogSeedJob.list({ limit: 20 });
    const rows = (result.data || []).sort((a: any, b: any) =>
      String(b.createdAtIso || '').localeCompare(String(a.createdAtIso || '')),
    );
    this.jobs.set(rows);
    if (!this.job() && rows[0]) this.job.set(rows[0]);
  }
}
