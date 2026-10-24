import { Injectable } from '@angular/core';
import { Product } from '../models/product';
import { BehaviorSubject, Observable } from 'rxjs';
import { ApiService, ProductListParams } from './api.service';
@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly PAGE_SIZE = 25;

  private products: Product[] = [];
  private productsSubject = new BehaviorSubject<Product[]>([]);
  products$ = this.productsSubject.asObservable();

  private totalCountSubject = new BehaviorSubject<number>(0);
  totalCount$ = this.totalCountSubject.asObservable();

  private hasMoreSubject = new BehaviorSubject<boolean>(true);
  hasMore$ = this.hasMoreSubject.asObservable();

  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoadingSubject.asObservable();

  private currentPage = 1;
  private currentNextToken: string | null = null;
  private currentQuery: ProductListParams = {};
  private requestToken = 0;

  constructor(private apiService: ApiService) {}

  private loadProducts(reset: boolean): void {
    if (this.isLoadingSubject.value && !reset) {
      return;
    }
    if (!reset && !this.hasMoreSubject.value) {
      return;
    }

    const page = reset ? 1 : this.currentPage + 1;
    this.isLoadingSubject.next(true);
    const token = ++this.requestToken;

    this.apiService
      .getProductsPage({
        ...this.currentQuery,
        page,
        pageSize: this.PAGE_SIZE,
        nextToken: reset ? null : this.currentNextToken,
      })
      .subscribe({
        next: (response) => {
          if (token !== this.requestToken) {
            return;
          }
          this.currentPage = page;
          this.currentNextToken = response.nextToken || response.next;
          this.hasMoreSubject.next(!!(response.nextToken || response.next));
          this.products = reset ? response.results : [...this.products, ...response.results];
          this.totalCountSubject.next(this.products.length);
          this.productsSubject.next(this.products);
          this.isLoadingSubject.next(false);
        },
        error: (error) => {
          if (token !== this.requestToken) {
            return;
          }
          this.isLoadingSubject.next(false);
          console.error('ProductService: Error loading products:', error);
        },
      });
  }

  private resetAndLoad(query: ProductListParams): void {
    this.currentQuery = query;
    this.requestToken += 1;
    this.currentPage = 0;
    this.currentNextToken = null;
    this.products = [];
    this.productsSubject.next([]);
    this.totalCountSubject.next(0);
    this.hasMoreSubject.next(true);
    this.loadProducts(true);
  }

  loadNextPage(): void {
    this.loadProducts(false);
  }

  loadAllProducts(): void {
    this.resetAndLoad({});
  }

  loadNewInProducts(): void {
    this.resetAndLoad({ newIn: true });
  }

  filterNewInProducts(
    categories?: string[],
    priceSort?: 'low-to-high' | 'high-to-low',
    priceRange?: { min?: number; max?: number },
  ): void {
    this.resetAndLoad({
      newIn: true,
      categories,
      minPrice: priceRange?.min,
      maxPrice: priceRange?.max,
      priceSort,
    });
  }

  resetNewInFilters(): void {
    this.loadNewInProducts();
  }

  getProducts(): Observable<Product[]> {
    return this.products$;
  }

  getTotalCount(): Observable<number> {
    return this.totalCount$;
  }

  getHasMore(): Observable<boolean> {
    return this.hasMore$;
  }

  getIsLoading(): Observable<boolean> {
    return this.isLoading$;
  }

  filterProducts(
    categories?: string[],
    priceSort?: 'low-to-high' | 'high-to-low',
    priceRange?: { min?: number; max?: number },
  ): void {
    this.resetAndLoad({
      categories,
      minPrice: priceRange?.min,
      maxPrice: priceRange?.max,
      priceSort,
    });
  }

  resetFilters(): void {
    this.loadAllProducts();
  }

  refreshProducts(): void {
    this.loadProducts(true);
  }

  getProductById(id: string): Observable<Product> {
    return this.apiService.getProduct(id);
  }
}
