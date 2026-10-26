import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map, shareReplay, tap } from 'rxjs/operators';
import { Product } from '../models/product';
import { Category } from '../models/category';
import { HomepageData } from '../models/homepage';
import { dataClient, publicClient } from '../amplify-client';
import { AuthService } from './auth.service';

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
  nextToken?: string | null;
}

export interface ProductListParams {
  categories?: string[];
  minPrice?: number;
  maxPrice?: number;
  priceSort?: 'low-to-high' | 'high-to-low';
  search?: string;
  newIn?: boolean;
  page?: number;
  pageSize?: number;
  nextToken?: string | null;
}

export interface CartItemResponse {
  id: string;
  product: Product;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface WishlistItemResponse {
  id: string;
  product: Product;
  created_at: string;
}

export interface OrderItem {
  id?: string;
  product: string;
  product_name: string;
  product_price: number | string;
  product_url?: string;
  product_image?: string;
  quantity: number;
  line_total: number | string;
}

export interface Order {
  id: string;
  order_number: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  address?: string;
  apartment?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  phone?: string;
  subtotal: number | string;
  shipping: number | string;
  tax: number | string;
  total: number | string;
  status: string;
  payment_status: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  stock_reserved: boolean;
  reservation_expires_at?: string;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface CreateOrderResponse extends Order {
  razorpay_key: string;
  amount: number;
}

export interface PaymentVerificationRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface CreateOrderRequest {
  shipping_address_id: string;
}

export interface StockValidationItem {
  product_id: string;
  product_name: string;
  requested: number;
  available: number;
}

export interface StockValidationResponse {
  valid: boolean;
  error?: string;
  items?: StockValidationItem[];
}

export interface CalculateTotalsResponse {
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  shipping_pending_address?: boolean;
}

function paiseToRupees(paise?: number | null): number {
  return (paise || 0) / 100;
}

function productImages(raw: unknown): string[] {
  if (!raw) return [];
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return raw.startsWith('http') ? [raw] : [];
    }
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item : item?.url))
      .filter((url): url is string => typeof url === 'string' && url.length > 0);
  }
  return [];
}

function mapProduct(row: any): Product {
  return {
    id: row.id,
    productCode: row.productCode || '',
    name: row.name,
    description: row.description || '',
    originalPrice: paiseToRupees(row.originalPricePaise),
    salePrice: paiseToRupees(row.salePricePaise),
    images: productImages(row.images),
    category: {
      id: row.categoryId || '',
      name: row.categoryName || '',
      slug: row.categorySlug || '',
    },
    newIn: !!row.newIn,
    noOfStock: row.noOfStock ?? 0,
    availableStock: row.availableStock ?? row.noOfStock ?? 0,
    taxPercentageBps: row.taxPercentageBps ?? 0,
  };
}

async function applyAvailability(products: Product[]): Promise<Product[]> {
  const ids = [...new Set(products.map((product) => product.id).filter(Boolean))];
  if (!ids.length) return products;
  const query = publicClient.queries?.productAvailability;
  if (typeof query !== 'function') return products;
  try {
    const result = await query({ ids });
    if (result?.errors?.length || !Array.isArray(result?.data)) return products;
    const stock = new Map<string, number>(
      result.data
        .filter((row: { id?: string; availableStock?: number }) => row?.id && Number.isFinite(Number(row.availableStock)))
        .map((row: { id: string; availableStock: number }): [string, number] => [
          String(row.id),
          Math.max(0, Number(row.availableStock)),
        ]),
    );
    return products.map((product) => {
      const available = stock.get(product.id);
      if (available == null) return product;
      return { ...product, availableStock: available };
    });
  } catch {
    return products;
  }
}

function mapHomepageCategory(row: any): Category {
  return {
    id: row?.id || '',
    name: row?.name || '',
    slug: row?.slug || '',
    imageUrl: row?.imageUrl ?? null,
  };
}

function mapHomepage(payload: any): HomepageData {
  const categories = (payload?.categories || []).map(mapHomepageCategory);
  const newArrivals = (payload?.newArrivals || []).map(mapHomepageProduct);
  const categorySections = (payload?.categorySections || [])
    .map((section: any) => ({
      category: mapHomepageCategory(section?.category),
      products: (section?.products || []).map(mapHomepageProduct),
      productCount: section?.productCount ?? (section?.products || []).length,
    }))
    .filter((section: { products: Product[] }) => section.products.length > 0);

  return {
    categories,
    newArrivals,
    newArrivalsCount: payload?.newArrivalsCount ?? newArrivals.length,
    categorySections,
  };
}

function mapHomepageProduct(row: any): Product {
  return {
    id: row.id,
    productCode: row.productCode || '',
    name: row.name,
    description: row.description || '',
    originalPrice: paiseToRupees(row.originalPricePaise),
    salePrice: paiseToRupees(row.salePricePaise),
    images: row.images || [],
    category: {
      id: row.categoryId || '',
      name: row.categoryName || '',
      slug: row.categorySlug || '',
    },
    newIn: !!row.newIn,
    noOfStock: row.noOfStock ?? 0,
    availableStock: row.availableStock ?? 0,
    taxPercentageBps: row.taxPercentageBps ?? 0,
  };
}

function orderLineItems(raw: unknown): any[] {
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

function mapOrder(row: any): Order {
  const items = orderLineItems(row.items).map((item: any, index: number) => ({
    id: `${row.id}-${index}`,
    product: item.productId,
    product_name: item.productName || item.product_name || item.name || '',
    product_price: paiseToRupees(item.productPricePaise),
    product_url: item.productUrl,
    product_image: item.productImage,
    quantity: item.quantity,
    line_total: paiseToRupees(item.lineTotalPaise),
  }));
  const names = (row.shippingFullName || '').split(' ');
  return {
    id: row.id,
    order_number: row.orderNumber,
    email: row.shippingEmail,
    first_name: names[0] || '',
    last_name: names.slice(1).join(' '),
    address: row.shippingAddressLine1,
    apartment: row.shippingAddressLine2,
    city: row.shippingCity,
    state: row.shippingState,
    zip_code: row.shippingZipCode,
    country: row.shippingCountry,
    phone: row.shippingPhone,
    subtotal: paiseToRupees(row.subtotalPaise),
    shipping: paiseToRupees(row.shippingPaise),
    tax: paiseToRupees(row.taxPaise),
    total: paiseToRupees(row.totalPaise),
    status: row.status,
    payment_status: row.paymentStatus,
    razorpay_order_id: row.razorpayOrderId,
    razorpay_payment_id: row.razorpayPaymentId,
    stock_reserved: !!row.stockReserved,
    reservation_expires_at: row.reservationExpiresAt,
    items,
    created_at: row.createdAtIso || row.createdAt,
    updated_at: row.updatedAt,
  };
}

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private categoriesRequest: Observable<Category[]> | null = null;
  private readonly productCache = new Map<string, Product>();
  private readonly productInflight = new Map<string, Promise<Product | null>>();
  private cartRequest: Promise<CartItemResponse[]> | null = null;
  private wishlistRequest: Promise<WishlistItemResponse[]> | null = null;

  constructor(private auth: AuthService) {}
  getHomepage(): Observable<HomepageData> {
    return from(publicClient.queries.getHomepage({ sectionLimit: 8 })).pipe(
      map((result: any) => {
        if (result.errors?.length) {
          throw new Error(result.errors[0].message || 'Failed to load homepage');
        }
        return mapHomepage(result.data);
      }),
    );
  }

  getCategories(): Observable<Category[]> {
    if (!this.categoriesRequest) {
      this.categoriesRequest = from(publicClient.models.Category.list({ limit: 200 })).pipe(
        map((result: any) =>
          (result.data || [])
            .map((c: any) => ({
              id: c.id,
              name: c.name,
              slug: c.slug,
              imageUrl: c.imageUrl ?? null,
            }))
            .sort((a: Category, b: Category) => a.name.localeCompare(b.name)),
        ),
        tap({ error: () => (this.categoriesRequest = null) }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }
    return this.categoriesRequest;
  }

  getCategory(slug: string): Observable<Category> {
    return this.getCategories().pipe(
      map((categories) => {
        const match = categories.find((category) => category.slug === slug);
        if (!match) throw new Error('Category not found');
        return match;
      }),
    );
  }

  getProducts(paramsInput: ProductListParams = {}): Observable<Product[]> {
    return this.getProductsPage(paramsInput).pipe(map((response) => response.results));
  }

  getProductsPage(paramsInput: ProductListParams = {}): Observable<PaginatedResponse<Product>> {
    return from(this.queryProducts(paramsInput)).pipe(
      map(({ items, nextToken }) => ({
        count: items.length,
        next: nextToken,
        previous: null,
        results: items,
        nextToken,
      })),
    );
  }

  private async queryProducts(params: ProductListParams): Promise<{
    items: Product[];
    nextToken: string | null;
  }> {
    const limit = params.pageSize || 25;
    const token = params.nextToken || undefined;
    let result: { data: any[]; nextToken?: string | null } = { data: [] };

    if (params.search) {
      const term = params.search.trim();
      result = await publicClient.models.Product.list({
        limit,
        nextToken: token,
        filter: {
          or: [{ name: { contains: term } }, { productCode: { contains: term.toUpperCase() } }],
        },
      });
    } else if (params.priceSort === 'low-to-high' || params.priceSort === 'high-to-low') {
      result = await this.listByPrice(params, limit, token);
    } else if (params.newIn) {
      const filter = this.attributeFilter(params);
      result = await publicClient.models.Product.listProductsByNewIn(
        { newInKey: 'NEW' },
        {
          limit,
          nextToken: token,
          sortDirection: 'DESC',
          ...(filter ? { filter } : {}),
        },
      );
    } else if (params.categories?.length === 1) {
      const category = await this.resolveCategoryId(params.categories[0]);
      const filter = this.pricePaiseFilter(params);
      result = await publicClient.models.Product.listProductsByCategory(
        { categoryId: category },
        {
          limit,
          nextToken: token,
          sortDirection: 'DESC',
          ...(filter ? { filter } : {}),
        },
      );
    } else {
      const filter = this.attributeFilter(params);
      result = await publicClient.models.Product.listProductsByRecent(
        { listingKey: 'ALL' },
        {
          limit,
          nextToken: token,
          sortDirection: 'DESC',
          ...(filter ? { filter } : {}),
        },
      );
    }

    return {
      items: await applyAvailability((result.data || []).map(mapProduct)),
      nextToken: result.nextToken || null,
    };
  }

  private async listByPrice(
    params: ProductListParams,
    limit: number,
    nextToken?: string,
  ): Promise<{ data: any[]; nextToken?: string | null }> {
    const sortDirection = params.priceSort === 'low-to-high' ? 'ASC' : 'DESC';
    const price = this.pricePaiseFilter(params);
    const filter = this.scopeFilter(params);
    return publicClient.models.Product.listProductsByPrice(
      {
        priceKey: 'ALL',
        ...(price ? { salePricePaise: price.salePricePaise } : {}),
      },
      {
        limit,
        nextToken,
        sortDirection,
        ...(filter ? { filter } : {}),
      },
    );
  }

  private pricePaiseFilter(params: ProductListParams) {
    const hasMin = params.minPrice !== undefined;
    const hasMax = params.maxPrice !== undefined;
    if (!hasMin && !hasMax) return undefined;
    const min = Math.round((params.minPrice ?? 0) * 100);
    const max = Math.round((params.maxPrice ?? 0) * 100);
    if (hasMin && hasMax) return { salePricePaise: { between: [min, max] } };
    if (hasMin) return { salePricePaise: { ge: min } };
    return { salePricePaise: { le: max } };
  }

  private attributeFilter(params: ProductListParams) {
    return this.mergeFilters(this.pricePaiseFilter(params), this.categoryClause(params));
  }

  private categoryClause(params: ProductListParams) {
    const slugs = params.categories ?? [];
    if (slugs.length === 0) return undefined;
    if (slugs.length === 1) return { categorySlug: { eq: slugs[0] } };
    return { or: slugs.map((slug) => ({ categorySlug: { eq: slug } })) };
  }

  private mergeFilters(...filters: Array<Record<string, unknown> | undefined>) {
    const parts = filters.filter((filter): filter is Record<string, unknown> => !!filter);
    if (parts.length === 0) return undefined;
    if (parts.length === 1) return parts[0];
    return { and: parts };
  }

  private scopeFilter(params: ProductListParams) {
    const parts: Record<string, unknown>[] = [];
    if (params.newIn) {
      parts.push({ newInKey: { eq: 'NEW' } });
    }
    const categories = this.categoryClause(params);
    if (categories) parts.push(categories);
    return this.mergeFilters(...parts);
  }

  private async resolveCategoryId(slugOrId: string): Promise<string> {
    const bySlug = await publicClient.models.Category.listCategoriesBySlug({ slug: slugOrId });
    return bySlug.data?.[0]?.id || slugOrId;
  }

  getProduct(id: string): Observable<Product> {
    return from(
      this.fetchProduct(id, true).then((product) => {
        if (!product) throw new Error('Product not found');
        return product;
      }),
    );
  }

  private fetchProduct(id: string, fresh = false): Promise<Product | null> {
    if (!fresh) {
      const cached = this.productCache.get(id);
      if (cached) return Promise.resolve(cached);
    }
    const pending = this.productInflight.get(id);
    if (pending) return pending;
    const request = publicClient.models.Product.get({ id })
      .then(async (result: any) => {
        if (!result.data) return null;
        const [product] = await applyAvailability([mapProduct(result.data)]);
        this.productCache.set(id, product);
        return product;
      })
      .finally(() => this.productInflight.delete(id));
    this.productInflight.set(id, request);
    return request;
  }

  getCart(): Observable<CartItemResponse[]> {
    if (!this.cartRequest) {
      this.cartRequest = this.loadCartItems().finally(() => {
        this.cartRequest = null;
      });
    }
    return from(this.cartRequest);
  }

  private async loadCartItems(): Promise<CartItemResponse[]> {
    const result: any = await dataClient.models.CartItem.list({});
    const rows = result.data || [];
    const products = await Promise.all(rows.map((item: any) => this.fetchProduct(item.productId)));
    return rows.flatMap((item: any, index: number) => {
      const product = products[index];
      if (!product) return [];
      return [
        {
          id: item.id,
          product,
          quantity: item.quantity,
          created_at: item.createdAtIso,
          updated_at: item.updatedAt || item.createdAtIso,
        },
      ];
    });
  }

  addToCart(productId: string, quantity: number = 1): Observable<CartItemResponse> {
    return from(this.upsertCart(productId, quantity));
  }

  private async upsertCart(productId: string, quantity: number): Promise<CartItemResponse> {
    const saved = (
      await dataClient.models.CartItem.create({
        productId,
        quantity,
        userId: this.auth.currentUserValue?.id || '',
        createdAtIso: new Date().toISOString(),
      })
    ).data;
    const product = await this.fetchProduct(productId);
    if (!product) throw new Error('Product not found');
    return {
      id: saved!.id,
      product,
      quantity: saved!.quantity,
      created_at: saved!.createdAtIso,
      updated_at: saved!.updatedAt || saved!.createdAtIso,
    };
  }

  updateCartItem(itemId: string, quantity: number): Observable<{ id: string; quantity: number }> {
    const saved: Promise<{ id: string; quantity: number }> = dataClient.models.CartItem.update({
      id: itemId,
      quantity,
    }).then((result: any) => ({
      id: String(result.data!.id),
      quantity: Number(result.data!.quantity),
    }));
    return from(saved);
  }

  removeFromCart(itemId: string): Observable<void> {
    return from(dataClient.models.CartItem.delete({ id: itemId })).pipe(map(() => undefined));
  }

  clearCart(): Observable<void> {
    return from(
      dataClient.models.CartItem.list({}).then(async (result: any) => {
        await Promise.all(
          (result.data || []).map((item: any) => dataClient.models.CartItem.delete({ id: item.id })),
        );
      }),
    ) as Observable<void>;
  }

  getCartTotal(): Observable<{ total: number }> {
    return this.getCart().pipe(
      map((items) => ({
        total: items.reduce((sum, item) => sum + Number(item.product.salePrice) * item.quantity, 0),
      })),
    );
  }

  validateCartStock(): Observable<StockValidationResponse> {
    return from(
      this.getCart()
        .toPromise()
        .then((items) => {
          const insufficient = (items || []).filter(
            (item) => item.product.availableStock < item.quantity,
          );
          if (insufficient.length) {
            return {
              valid: false,
              error: 'Insufficient stock for some items',
              items: insufficient.map((item) => ({
                product_id: item.product.id,
                product_name: item.product.name,
                requested: item.quantity,
                available: item.product.availableStock,
              })),
            };
          }
          return { valid: true };
        }),
    ) as Observable<StockValidationResponse>;
  }

  getWishlist(): Observable<WishlistItemResponse[]> {
    if (!this.wishlistRequest) {
      this.wishlistRequest = this.loadWishlistItems().finally(() => {
        this.wishlistRequest = null;
      });
    }
    return from(this.wishlistRequest);
  }

  private async loadWishlistItems(): Promise<WishlistItemResponse[]> {
    const result: any = await dataClient.models.WishlistItem.list({});
    const rows = result.data || [];
    const products = await Promise.all(rows.map((item: any) => this.fetchProduct(item.productId)));
    return rows.flatMap((item: any, index: number) => {
      const product = products[index];
      if (!product) return [];
      return [{ id: item.id, product, created_at: item.createdAtIso }];
    });
  }

  addToWishlist(productId: string): Observable<{ id: string }> {
    const saved: Promise<{ id: string }> = dataClient.models.WishlistItem.create({
      productId,
      userId: this.auth.currentUserValue?.id || '',
      createdAtIso: new Date().toISOString(),
    }).then((result: any) => ({ id: String(result.data!.id) }));
    return from(saved);
  }

  removeFromWishlist(itemId: string): Observable<void> {
    return from(dataClient.models.WishlistItem.delete({ id: itemId })).pipe(map(() => undefined));
  }

  toggleWishlist(productId: string): Observable<{ in_wishlist: boolean }> {
    return this.addToWishlist(productId).pipe(map(() => ({ in_wishlist: true })));
  }

  checkWishlist(productId: string): Observable<{ in_wishlist: boolean }> {
    return this.getWishlist().pipe(
      map((items) => ({ in_wishlist: items.some((item) => item.product.id === productId) })),
    );
  }

  clearWishlist(): Observable<void> {
    return from(
      dataClient.models.WishlistItem.list({}).then(async (result: any) => {
        await Promise.all(
          (result.data || []).map((item: any) =>
            dataClient.models.WishlistItem.delete({ id: item.id }),
          ),
        );
      }),
    ) as Observable<void>;
  }

  createOrder(orderData: CreateOrderRequest): Observable<CreateOrderResponse> {
    return from(
      dataClient.mutations.placeOrder({ shippingAddressId: orderData.shipping_address_id }),
    ).pipe(
      map((result: any) => {
        const row = result.data;
        if (!row) throw new Error(result.errors?.[0]?.message || 'Failed to create order');
        return {
          id: row.id,
          order_number: row.orderNumber,
          subtotal: paiseToRupees(row.subtotalPaise),
          shipping: paiseToRupees(row.shippingPaise),
          tax: paiseToRupees(row.taxPaise),
          total: paiseToRupees(row.totalPaise),
          status: row.status || 'pending',
          payment_status: row.paymentStatus || 'pending',
          razorpay_order_id: row.razorpayOrderId || undefined,
          stock_reserved: true,
          reservation_expires_at: row.reservationExpiresAt || undefined,
          items: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          razorpay_key: row.razorpayKey || '',
          amount: row.amountPaise || 0,
        };
      }),
    );
  }

  verifyPayment(paymentData: PaymentVerificationRequest): Observable<Order> {
    return from(
      dataClient.mutations.verifyPayment({
        razorpayOrderId: paymentData.razorpay_order_id,
        razorpayPaymentId: paymentData.razorpay_payment_id,
        razorpaySignature: paymentData.razorpay_signature,
      }),
    ).pipe(map((result: any) => mapOrder(result.data)));
  }

  paymentFailed(razorpayOrderId: string): Observable<unknown> {
    return from(dataClient.mutations.paymentFailed({ razorpayOrderId }));
  }

  getOrders(filters?: {
    statuses?: string[];
    fromIso?: string;
    toIso?: string;
    search?: string;
  }): Observable<Order[]> {
    return from(this.loadOrders(filters));
  }

  private async loadOrders(filters?: {
    statuses?: string[];
    fromIso?: string;
    toIso?: string;
    search?: string;
  }): Promise<Order[]> {
    const search = filters?.search?.trim() ?? '';
    const scoped = this.orderListArgs(filters, search);
    const result: any = await dataClient.models.Order.list(scoped);
    const rows = ((result.data || []) as any[]).map(mapOrder);
    if (search && rows.length === 0) {
      const all: any = await dataClient.models.Order.list(this.orderListArgs(filters));
      return ((all.data || []) as any[]).map(mapOrder);
    }
    return rows;
  }

  private orderListArgs(
    filters?: { statuses?: string[]; fromIso?: string; toIso?: string },
    search = '',
  ): any {
    const parts: any[] = [];
    if (filters?.fromIso && filters?.toIso) {
      parts.push({ createdAtIso: { between: [filters.fromIso, filters.toIso] } });
    }
    const statuses = filters?.statuses?.filter(Boolean) ?? [];
    if (statuses.length === 1) {
      parts.push({ status: { eq: statuses[0] } });
    } else if (statuses.length > 1) {
      parts.push({ or: statuses.map((status) => ({ status: { eq: status } })) });
    }
    if (search) {
      parts.push({ orderNumber: { contains: search } });
    }

    if (parts.length === 1) return { filter: parts[0] };
    if (parts.length > 1) return { filter: { and: parts } };
    return {};
  }

  getOrder(orderId: string): Observable<Order> {
    return from(dataClient.models.Order.get({ id: orderId })).pipe(
      map((result: any) => {
        if (!result.data) throw new Error('Order not found');
        return mapOrder(result.data);
      }),
    );
  }

  calculateTotals(shippingAddressId?: string): Observable<CalculateTotalsResponse> {
    return from(
      dataClient.mutations.calculateCheckoutTotals({
        shippingAddressId: shippingAddressId || undefined,
      }),
    ).pipe(
      map((result: any) => {
        const row = result.data;
        if (!row) throw new Error(result.errors?.[0]?.message || 'Unable to calculate totals');
        return {
          subtotal: paiseToRupees(row.subtotalPaise),
          shipping: paiseToRupees(row.shippingPaise),
          tax: paiseToRupees(row.taxPaise),
          total: paiseToRupees(row.totalPaise),
          shipping_pending_address: !!row.shippingPendingAddress,
        };
      }),
    );
  }

  updateUserProfile(_profileData: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    gender?: string;
  }): Observable<unknown> {
    return from(Promise.resolve({}));
  }
}
