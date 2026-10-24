import { Component, DestroyRef, HostListener, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { ApiService } from '../../services/api.service';
import { ProductService } from '../../services/product';
import { Category } from '../../models/category';
import { Product } from '../../models/product';
import { ProductGridComponent } from '../../components/product-grid/product-grid';
import { toTitleCase } from '../../utils/text';

type ShopSort = 'newest' | 'low-to-high' | 'high-to-low';

@Component({
  selector: 'app-shop-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatSliderModule, ProductGridComponent],
  templateUrl: './shop-page.html',
  styleUrl: './shop-page.scss',
})
export class ShopPage implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly MIN_PRICE = 0;
  readonly MAX_PRICE = 5000;

  categories: Category[] = [];
  products: Product[] = [];
  totalCount = 0;
  hasMore = false;
  isLoading = false;
  filtersOpen = false;
  isMobileLayout = false;

  selectedSlug: string | null = null;
  sort: ShopSort = 'newest';
  minPrice = this.MIN_PRICE;
  maxPrice = this.MAX_PRICE;

  constructor(
    private api: ApiService,
    private productService: ProductService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.updateMobileLayout();
    this.api
      .getCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories) => {
          this.categories = categories;
        },
        error: (err) => console.error('ShopPage: failed to load categories', err),
      });

    this.productService.products$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((products) => {
        this.products = products;
      });
    this.productService
      .getTotalCount()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((count) => {
        this.totalCount = count;
      });
    this.productService
      .getHasMore()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((hasMore) => {
        this.hasMore = hasMore;
      });
    this.productService
      .getIsLoading()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((isLoading) => {
        this.isLoading = isLoading;
      });

    this.productService.loadAllProducts();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateMobileLayout();
    if (!this.isMobileLayout) {
      this.filtersOpen = false;
    }
  }

  categoryLabel(name: string): string {
    return toTitleCase(name);
  }

  selectCategory(slug: string | null): void {
    this.selectedSlug = slug;
    this.applyFilters();
    if (this.isMobileLayout) {
      this.filtersOpen = false;
    }
  }

  setSort(sort: ShopSort): void {
    this.sort = sort;
    this.applyFilters();
  }

  onPriceSettled(): void {
    if (this.minPrice > this.maxPrice) {
      this.maxPrice = this.minPrice;
    }
    this.applyFilters();
  }

  toggleFilters(): void {
    this.filtersOpen = !this.filtersOpen;
  }

  closeFilters(): void {
    this.filtersOpen = false;
  }

  loadMore(): void {
    this.productService.loadNextPage();
  }

  openProduct(product: Product): void {
    void this.router.navigate(['/product', product.id]);
  }

  showingLabel(): string {
    if (!this.products.length) {
      return '';
    }
    const shown = `Showing 1–${this.products.length}`;
    return this.hasMore ? shown : `${shown} of ${this.totalCount}`;
  }

  private applyFilters(): void {
    const priceActive = this.minPrice > this.MIN_PRICE || this.maxPrice < this.MAX_PRICE;
    this.productService.filterProducts(
      this.selectedSlug ? [this.selectedSlug] : undefined,
      this.sort === 'newest' ? undefined : this.sort,
      priceActive ? { min: this.minPrice, max: this.maxPrice } : undefined,
    );
  }

  private updateMobileLayout(): void {
    if (typeof window !== 'undefined') {
      this.isMobileLayout = window.innerWidth <= 900;
    }
  }
}
