import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  OnChanges,
  SimpleChanges,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Product } from '../../models/product';
import { ApiService } from '../../services/api.service';
import { Subject, Subscription, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, switchMap } from 'rxjs/operators';
import { Router } from '@angular/router';

@Component({
  selector: 'app-search-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './search-modal.html',
  styleUrl: './search-modal.scss',
})
export class SearchModalComponent implements OnChanges, OnDestroy {
  @Input() isOpen = false;
  @Output() closeModal = new EventEmitter<void>();
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  searchQuery = '';
  filteredProducts: Product[] = [];
  isLoading = false;
  hasSearched = false;
  private readonly searchInputSubject = new Subject<string>();
  private searchSubscription: Subscription;

  constructor(
    private apiService: ApiService,
    private router: Router,
  ) {
    this.searchSubscription = this.searchInputSubject
      .pipe(
        debounceTime(400),
        map((query) => query.trim()),
        distinctUntilChanged(),
        switchMap((query) => {
          if (!query) {
            return of({ products: [] as Product[], query });
          }
          this.isLoading = true;
          this.hasSearched = true;
          return this.apiService.getProducts({ search: query, page: 1, pageSize: 25 }).pipe(
            map((products) => ({ products, query })),
            catchError(() => of({ products: [] as Product[], query })),
          );
        }),
      )
      .subscribe((result) => {
        if (!this.isOpen || result.query !== this.searchQuery.trim()) return;
        this.filteredProducts = result.products;
        this.isLoading = false;
        this.hasSearched = result.query.length > 0;
      });
  }

  ngOnDestroy(): void {
    this.searchSubscription.unsubscribe();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['isOpen'] && this.isOpen) {
      setTimeout(() => {
        if (this.searchInput) {
          this.searchInput.nativeElement.focus();
        }
      }, 100);
      return;
    }
    if (changes['isOpen'] && !this.isOpen) {
      this.resetSearchState();
    }
  }

  onSearch(value: string) {
    this.searchQuery = value ?? '';
    this.searchInputSubject.next(this.searchQuery);
  }

  formatRupees(amount: number | string): string {
    const value = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
    if (!Number.isFinite(value)) return '';
    return Number.isInteger(value) ? `₹${value}` : `₹${value.toFixed(2)}`;
  }

  openProduct(productId: string): void {
    this.router.navigate(['/product', productId]);
    this.close();
  }

  close() {
    this.resetSearchState();
    this.closeModal.emit();
  }

  private resetSearchState(): void {
    this.searchQuery = '';
    this.filteredProducts = [];
    this.isLoading = false;
    this.hasSearched = false;
    this.searchInputSubject.next('');
  }
}
