import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  PLATFORM_ID,
  Inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Product } from '../../models/product';
import { ProductCard } from '../product-card/product-card';

@Component({
  selector: 'app-product-grid',
  standalone: true,
  imports: [CommonModule, ProductCard],
  templateUrl: './product-grid.html',
  styleUrl: './product-grid.scss',
})
export class ProductGridComponent implements AfterViewInit, OnDestroy {
  @Input() products: Product[] = [];
  /** Number of columns on desktop (default 4). */
  @Input() gridColumns: 3 | 4 = 4;
  @Input() totalCount = 0;
  @Input() hasMore = false;
  @Input() isLoading = false;
  @Output() productClick = new EventEmitter<Product>();
  @Output() authRequired = new EventEmitter<void>();
  @Output() loadMore = new EventEmitter<void>();
  @ViewChild('scrollSentinel') scrollSentinel?: ElementRef<HTMLDivElement>;

  private observer?: IntersectionObserver;
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser || !this.scrollSentinel) {
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting && this.hasMore && !this.isLoading) {
          this.loadMore.emit();
        }
      },
      {
        root: null,
        rootMargin: '250px 0px',
        threshold: 0.1,
      },
    );
    this.observer.observe(this.scrollSentinel.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  onProductClick(product: Product) {
    this.productClick.emit(product);
  }

  onAuthRequired() {
    this.authRequired.emit();
  }
}
