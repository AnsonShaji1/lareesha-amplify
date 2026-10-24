import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatSliderModule } from '@angular/material/slider';
import { FilterOptions, CategoryOption } from '../filter-bar/filter-bar';

@Component({
  selector: 'app-category-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, MatSliderModule],
  templateUrl: './category-sidebar.html',
  styleUrl: './category-sidebar.scss',
})
export class CategorySidebarComponent {
  @Input() categories: CategoryOption[] = [];
  @Input() activeSlug = '';
  /** `inline` = desktop sidebar; `panel` = mobile bottom sheet */
  @Input() layout: 'inline' | 'panel' = 'inline';
  @Output() filterChange = new EventEmitter<FilterOptions>();
  @Output() resetFilters = new EventEmitter<void>();
  @Output() closePanel = new EventEmitter<void>();

  readonly MIN_PRICE = 0;
  readonly MAX_PRICE = 5000;

  minPriceInput = 0;
  maxPriceInput = 5000;
  minPrice = 0;
  maxPrice = 5000;

  onMinSliderChange(value: number): void {
    this.minPriceInput = value;
    if (this.minPriceInput > this.maxPriceInput) {
      this.maxPriceInput = this.minPriceInput;
    }
  }

  onMaxSliderChange(value: number): void {
    this.maxPriceInput = value;
    if (this.maxPriceInput < this.minPriceInput) {
      this.minPriceInput = this.maxPriceInput;
    }
  }

  onCategoryLinkClick(): void {
    if (this.layout === 'panel') {
      this.closePanel.emit();
    }
  }

  applyPriceFilter(): void {
    this.minPrice = this.minPriceInput;
    this.maxPrice = this.maxPriceInput;
    this.emitPriceFilter();
    if (this.layout === 'panel') {
      this.closePanel.emit();
    }
  }

  resetPriceFilter(): void {
    this.minPrice = this.MIN_PRICE;
    this.maxPrice = this.MAX_PRICE;
    this.minPriceInput = this.MIN_PRICE;
    this.maxPriceInput = this.MAX_PRICE;
    this.resetFilters.emit();
  }

  private emitPriceFilter(): void {
    this.filterChange.emit({
      priceRange:
        this.minPrice > this.MIN_PRICE || this.maxPrice < this.MAX_PRICE
          ? { min: this.minPrice, max: this.maxPrice }
          : undefined,
    });
  }
}
