import { Component, OnInit, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FilterBarComponent, FilterOptions } from '../../components/filter-bar/filter-bar';
import { ProductGridComponent } from '../../components/product-grid/product-grid';
import { ProductService } from '../../services/product';
import { Product } from '../../models/product';
import { ApiService } from '../../services/api.service';
import { toTitleCase } from '../../utils/text';

@Component({
  selector: 'app-category-page',
  standalone: true,
  imports: [CommonModule, FilterBarComponent, ProductGridComponent, MatIconModule],
  templateUrl: './category-page.html',
  styleUrl: './category-page.scss',
})
export class CategoryPage implements OnInit {
  @ViewChild('filterBar') filterBar?: FilterBarComponent;
  @ViewChildren(FilterBarComponent) filterBars?: QueryList<FilterBarComponent>;

  products: Product[] = [];
  categorySlug = '';
  pageTitle = '';
  totalCount = 0;
  hasMore = true;
  isLoading = false;

  private activeFilters: FilterOptions = {};

  constructor(
    private productService: ProductService,
    private api: ApiService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.productService.products$.subscribe((products: Product[]) => {
      this.products = products;
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

    this.route.params.subscribe((params) => {
      this.categorySlug = params['slug'];
      this.pageTitle = toTitleCase(String(this.categorySlug || '').replace(/-/g, ' '));
      this.activeFilters = {};
      this.filterBars?.forEach((bar) => bar.resetControls());

      this.api.getCategory(this.categorySlug).subscribe({
        next: (cat) => {
          this.pageTitle = toTitleCase(cat.name);
        },
        error: () => {
          this.pageTitle = toTitleCase(String(this.categorySlug || '').replace(/-/g, ' '));
        },
      });

      this.applyProductFilters();
    });
  }

  openFilters(): void {
    this.filterBar?.openFilterDrawer();
  }

  openProductDetail(product: Product) {
    this.router.navigate(['/product', product.id]);
  }

  onLoadMore() {
    this.productService.loadNextPage();
  }

  onFilterChange(filters: FilterOptions) {
    this.activeFilters.priceRange = filters.priceRange;
    this.activeFilters.priceSort = filters.priceSort;
    this.applyProductFilters();
  }

  onResetFilters() {
    this.activeFilters = {};
    this.applyProductFilters();
  }

  private applyProductFilters(): void {
    if (!this.categorySlug) {
      return;
    }
    this.productService.filterProducts(
      [this.categorySlug],
      this.activeFilters.priceSort,
      this.activeFilters.priceRange,
    );
  }

}
