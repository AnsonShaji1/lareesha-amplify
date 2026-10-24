import {
  Component,
  OnInit,
  EventEmitter,
  Output,
  Input,
  HostListener,
  PLATFORM_ID,
  Inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface FilterOptions {
  categories?: string[];
  priceSort?: 'low-to-high' | 'high-to-low';
  priceRange?: { min?: number; max?: number };
}

export interface CategoryOption {
  name: string;
  slug: string;
}

@Component({
  selector: 'app-filter-bar',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    FormsModule,
    MatSliderModule,
  ],
  templateUrl: './filter-bar.html',
  styleUrl: './filter-bar.scss',
})
export class FilterBarComponent implements OnInit {
  @Input() hideCategory = false;
  /** When true, only the sort dropdown is shown (used on category pages). */
  @Input() sortOnly = false;
  /** Put sort choices in the filter popup instead of the bar. */
  @Input() sortInDrawer = false;
  @Input() categories: CategoryOption[] = [];
  @Output() filterChange = new EventEmitter<FilterOptions>();
  @Output() resetFilters = new EventEmitter<void>();
  priceOptions: Array<{ label: string; value: 'low-to-high' | 'high-to-low' }> = [
    { label: 'Price: Low to High', value: 'low-to-high' },
    { label: 'Price: High to Low', value: 'high-to-low' },
  ];

  selectedCategories: string[] = []; // slugs
  appliedCategories: string[] = []; // slugs
  selectedPriceSort?: 'low-to-high' | 'high-to-low';
  sortInput: '' | 'low-to-high' | 'high-to-low' = '';
  minPrice: number = 0;
  maxPrice: number = 5000;

  // Range slider properties
  minPriceInput: number = 0;
  maxPriceInput: number = 5000;
  readonly MIN_PRICE = 0;
  readonly MAX_PRICE = 5000;

  showFilterDrawer = false;
  sortMenuOpen = false;
  isMobile = false;
  isCategoryExpanded = true;
  isPriceExpanded = true;

  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  @HostListener('window:resize')
  onResize() {
    this.checkIfMobile();
  }

  ngOnInit() {
    this.checkIfMobile();
  }

  checkIfMobile() {
    if (this.isBrowser) {
      this.isMobile = window.innerWidth <= 1024;
    }
  }

  openFilterDrawer() {
    this.selectedCategories = [...this.appliedCategories];
    this.sortInput = this.selectedPriceSort ?? '';
    this.showFilterDrawer = true;
    if (this.isBrowser) {
      document.body.style.overflow = 'hidden';
    }
  }

  closeFilterDrawer() {
    this.showFilterDrawer = false;
    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
  }

  /** Clear the controls without emitting, so a new category page can start fresh. */
  resetControls(): void {
    this.selectedCategories = [];
    this.appliedCategories = [];
    this.selectedPriceSort = undefined;
    this.sortInput = '';
    this.minPrice = this.MIN_PRICE;
    this.maxPrice = this.MAX_PRICE;
    this.minPriceInput = this.MIN_PRICE;
    this.maxPriceInput = this.MAX_PRICE;
    this.closeFilterDrawer();
  }

  toggleCategorySection() {
    this.isCategoryExpanded = !this.isCategoryExpanded;
  }

  togglePriceSection() {
    this.isPriceExpanded = !this.isPriceExpanded;
  }

  onCategorySelect(categorySlug: string) {
    const index = this.selectedCategories.indexOf(categorySlug);
    if (index > -1) {
      this.selectedCategories.splice(index, 1);
    } else {
      this.selectedCategories.push(categorySlug);
    }
  }

  isCategorySelected(categorySlug: string): boolean {
    return this.selectedCategories.includes(categorySlug);
  }

  onPriceSelect(priceSort: 'low-to-high' | 'high-to-low' | null) {
    this.selectedPriceSort = priceSort ?? undefined;
    this.sortMenuOpen = false;
    this.emitFilter();
  }

  toggleSortMenu(): void {
    this.sortMenuOpen = !this.sortMenuOpen;
  }

  selectSort(priceSort: 'low-to-high' | 'high-to-low' | null): void {
    this.onPriceSelect(priceSort);
  }

  @HostListener('document:click', ['$event'])
  closeSortMenu(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.sort-menu')) {
      this.sortMenuOpen = false;
    }
  }

  onMinSliderChange(value: number) {
    this.minPriceInput = value;
    if (this.minPriceInput > this.maxPriceInput) {
      this.maxPriceInput = this.minPriceInput;
    }
  }

  onMaxSliderChange(value: number) {
    this.maxPriceInput = value;
    if (this.maxPriceInput < this.minPriceInput) {
      this.minPriceInput = this.maxPriceInput;
    }
  }

  applyFilters() {
    this.appliedCategories = [...this.selectedCategories];
    if (this.sortInDrawer) {
      this.selectedPriceSort = this.sortInput || undefined;
    }
    this.minPrice = this.minPriceInput;
    this.maxPrice = this.maxPriceInput;
    this.emitFilter();
    this.closeFilterDrawer();
  }

  onReset() {
    this.selectedCategories = [];
    this.appliedCategories = [];
    this.selectedPriceSort = undefined;
    this.sortInput = '';
    this.minPrice = this.MIN_PRICE;
    this.maxPrice = this.MAX_PRICE;
    this.minPriceInput = this.MIN_PRICE;
    this.maxPriceInput = this.MAX_PRICE;
    this.resetFilters.emit();
  }

  removeCategory(category: string) {
    this.appliedCategories = this.appliedCategories.filter((c) => c !== category);
    this.selectedCategories = [...this.appliedCategories];
    this.emitFilter();
  }

  getCategoryLabel(categorySlug: string): string {
    return this.categories.find((c) => c.slug === categorySlug)?.name ?? categorySlug;
  }

  removePriceFilter() {
    this.minPrice = this.MIN_PRICE;
    this.maxPrice = this.MAX_PRICE;
    this.minPriceInput = this.MIN_PRICE;
    this.maxPriceInput = this.MAX_PRICE;
    this.emitFilter();
  }

  removeSortFilter() {
    this.selectedPriceSort = undefined;
    this.sortInput = '';
    this.emitFilter();
  }

  clearAllFilters() {
    this.onReset();
  }

  hasActiveFilters(): boolean {
    if (this.sortOnly) {
      return !!this.selectedPriceSort;
    }
    return (
      (!this.hideCategory && this.appliedCategories.length > 0) ||
      !!this.selectedPriceSort ||
      this.minPrice > this.MIN_PRICE ||
      this.maxPrice < this.MAX_PRICE
    );
  }

  getSortLabel(): string {
    return this.priceOptions.find((option) => option.value === this.selectedPriceSort)?.label ?? 'Default';
  }

  getPriceRangeLabel(): string {
    return `₹${this.minPrice} – ₹${this.maxPrice}`;
  }

  private emitFilter() {
    const filterOptions: FilterOptions = {
      categories: this.appliedCategories.length > 0 ? this.appliedCategories : undefined,
      priceSort: this.selectedPriceSort,
      priceRange:
        this.minPrice > this.MIN_PRICE || this.maxPrice < this.MAX_PRICE
          ? { min: this.minPrice, max: this.maxPrice }
          : undefined,
    };
    this.filterChange.emit(filterOptions);
  }
}
