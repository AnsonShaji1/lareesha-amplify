import { client } from './amplify-client';

export function rupees(paise?: number | null): string {
  return `₹${((paise || 0) / 100).toFixed(2)}`;
}

export function toPaise(value: string | number): number {
  return Math.round(Number(value || 0) * 100);
}

export function fromPaise(paise?: number | null): string {
  return ((paise || 0) / 100).toString();
}

export function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'item';
}

export function errorMessage(error: any, fallback = 'Something went wrong'): string {
  return error?.errors?.[0]?.message || error?.message || fallback;
}

export interface ProductImage {
  url: string;
  order: number;
}

export function parseImages(raw: unknown): ProductImage[] {
  if (!raw) return [];
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      if (typeof item === 'string') return { url: item, order: index };
      return { url: item?.url || '', order: item?.order ?? index };
    })
    .filter((item) => !!item.url);
}

export function productImageKey(url: string): string {
  let path = (url || '').trim();
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      path = new URL(path).pathname;
    } catch {
      return '';
    }
  }
  path = path.replace(/^\/+/, '');
  if (path.startsWith('lareesha-v1/')) path = path.slice('lareesha-v1/'.length);
  return path.startsWith('products/') ? path : '';
}

export async function deleteProductImages(raw: unknown): Promise<void> {
  const keys = [...new Set(parseImages(raw).map((image) => productImageKey(image.url)).filter(Boolean))];
  for (const key of keys) {
    const result = await client.mutations.deleteMedia({ key });
    if (result.errors?.length) throw result;
  }
}

export function serializeImages(images: ProductImage[]): string | undefined {
  if (!images.length) return undefined;
  return JSON.stringify(images.map((image, order) => ({ url: image.url, order })));
}

export function parseItems(raw: unknown): any[] {
  if (!raw) return [];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(raw) ? raw : [];
}

export async function uploadFile(file: File, folder: string): Promise<string> {
  const upload = await client.mutations.getMediaUploadUrl({
    filename: file.name,
    contentType: file.type || 'application/octet-stream',
    folder,
  });
  if (!upload.data?.uploadUrl) {
    throw new Error(upload.errors?.[0]?.message || 'Could not get an upload URL. Check R2 SSM secrets.');
  }
  let response: Response;
  try {
    response = await fetch(upload.data.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
    });
  } catch {
    throw new Error('R2 blocked the browser upload (CORS). Run npm run r2:cors, then retry.');
  }
  if (!response.ok) {
    throw new Error(`Upload failed (${response.status})`);
  }
  return upload.data.publicUrl;
}

/** A payment hold is active while its epoch deadline is still ahead. */
export function holdIsActive(row: { expiresAtEpoch?: number | null; expiresAtIso?: string | null }): boolean {
  const epoch = Number(row?.expiresAtEpoch);
  if (Number.isFinite(epoch) && epoch > 0) {
    return epoch * 1000 > Date.now();
  }
  if (!row?.expiresAtIso) return false;
  const time = new Date(row.expiresAtIso).getTime();
  return !Number.isNaN(time) && time > Date.now();
}

export function holdExpiryIso(row: { expiresAtEpoch?: number | null; expiresAtIso?: string | null }): string | null {
  const epoch = Number(row?.expiresAtEpoch);
  if (Number.isFinite(epoch) && epoch > 0) {
    return new Date(epoch * 1000).toISOString();
  }
  return row?.expiresAtIso || null;
}

export async function listAll(
  list: (args: { limit: number; nextToken?: string }) => Promise<{ data?: any[] | null; nextToken?: string | null }>,
  limit = 200,
): Promise<any[]> {
  const items: any[] = [];
  let nextToken: string | undefined;
  do {
    const page = await list(nextToken ? { limit, nextToken } : { limit });
    items.push(...(page.data || []));
    nextToken = page.nextToken || undefined;
  } while (nextToken);
  return items;
}

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export type DateFilter = 'any' | 'today' | 'week' | 'month' | 'year';

export function itemCreated(item: { createdAtIso?: string | null; createdAt?: string | null }): string {
  return item.createdAtIso || item.createdAt || '';
}

export function matchesDate(iso: string, filter: DateFilter): boolean {
  if (filter === 'any') return true;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfItem = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (filter === 'today') return startOfItem.getTime() === startOfToday.getTime();
  if (filter === 'week') {
    const start = new Date(startOfToday);
    start.setDate(start.getDate() - 6);
    return startOfItem >= start && startOfItem <= startOfToday;
  }
  if (filter === 'month') {
    return startOfItem.getFullYear() === startOfToday.getFullYear() && startOfItem.getMonth() === startOfToday.getMonth();
  }
  return startOfItem.getFullYear() === startOfToday.getFullYear();
}
