import { Component, HostListener, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ProductGridComponent } from '../../components/product-grid/product-grid';
import {
  FilterBarComponent,
  FilterOptions,
  CategoryOption,
} from '../../components/filter-bar/filter-bar';
import { ProductService } from '../../services/product';
import { Product } from '../../models/product';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-new-in-page',
  imports: [CommonModule, MatIconModule, FilterBarComponent, ProductGridComponent],
  templateUrl: './new-in-page.html',
  styleUrl: './new-in-page.scss',
})
export class NewInPage implements OnInit {
  readonly fallbackCategories: CategoryOption[] = [
    { name: 'Necklaces', slug: 'necklaces' },
    { name: 'Earrings', slug: 'earrings' },
    { name: 'Rings', slug: 'rings' },
    { name: 'Bracelets', slug: 'bracelets' },
  ];

  @ViewChild('filterBar') filterBar?: FilterBarComponent;

  products: Product[] = [];
  availableCategories: CategoryOption[] = [...this.fallbackCategories];
  private categoriesLoadedFromApi = false;
  totalCount = 0;
  hasMore = true;
  isLoading = false;
  isMobileLayout = false;

  private activeFilters: FilterOptions = {};

  constructor(
    private productService: ProductService,
    private api: ApiService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.updateMobileLayout();

    this.api.getCategories().subscribe({
      next: (cats) => {
        this.availableCategories = cats.map((c) => ({ name: c.name, slug: c.slug }));
        this.categoriesLoadedFromApi = true;
      },
      error: (err) => {
        console.error('NewInPage: failed to load categories', err);
        this.availableCategories = [...this.fallbackCategories];
        this.categoriesLoadedFromApi = false;
      },
    });

    this.productService.products$.subscribe((products) => {
      this.products = products;
      if (!this.categoriesLoadedFromApi) {
        const map = new Map<string, CategoryOption>();
        for (const p of products) {
          if (p.category?.slug) {
            map.set(p.category.slug, { name: p.category.name, slug: p.category.slug });
          }
        }
        const derived = Array.from(map.values());
        if (derived.length > 0) {
          this.availableCategories = derived;
        }
      }
    });
    this.productService.getTotalCount().subscribe((count) => {
      this.totalCount = count;
    });
    this.productService.getHasMore().subscribe((hasMore) => {
      this.hasMore = hasMore;
    });
    this.productService.getIsLoading().subscribe((isLoading) => {
      this.isLoading = isLoading;
    });
    this.productService.loadNewInProducts();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateMobileLayout();
  }

  openMobileFilters(): void {
    this.filterBar?.openFilterDrawer();
  }

  openProductDetail(product: Product) {
    this.router.navigate(['/product', product.id]);
  }

  onLoadMore() {
    this.productService.loadNextPage();
  }

  onFilterChange(filters: FilterOptions) {
    this.activeFilters.categories = filters.categories;
    this.activeFilters.priceRange = filters.priceRange;
    if (!this.isMobileLayout || filters.priceSort !== undefined) {
      this.activeFilters.priceSort = filters.priceSort;
    }
    this.applyActiveFilters();
  }

  onSortChange(filters: FilterOptions) {
    this.activeFilters.priceSort = filters.priceSort;
    this.applyActiveFilters();
  }

  onSortReset() {
    this.activeFilters.priceSort = undefined;
    this.applyActiveFilters();
  }

  onResetFilters() {
    this.activeFilters = {};
    this.productService.resetNewInFilters();
  }

  private applyActiveFilters(): void {
    this.productService.filterNewInProducts(
      this.activeFilters.categories,
      this.activeFilters.priceSort,
      this.activeFilters.priceRange,
    );
  }

  private updateMobileLayout(): void {
    if (typeof window !== 'undefined') {
      this.isMobileLayout = window.innerWidth <= 900;
    }
  }
}
