import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Product } from '../../../models/product';
import { ProductCard } from '../../product-card/product-card';
import { toTitleCase } from '../../../utils/text';

@Component({
  selector: 'app-home-product-carousel',
  standalone: true,
  imports: [CommonModule, RouterModule, ProductCard],
  templateUrl: './home-product-carousel.html',
  styleUrl: './home-product-carousel.scss',
})
export class HomeProductCarouselComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() title = '';
  @Input() products: Product[] = [];
  @Input() totalCount = 0;
  @Input() isLoading = false;
  @Input() viewAllLink: string | string[] = '/';
  @Input() loadingMessage = 'Loading products…';
  @Input() emptyMessage = 'No products available.';
  @Input() sectionBottomSpacing = false;

  @Output() productClick = new EventEmitter<Product>();

  @ViewChild('viewport') viewportRef?: ElementRef<HTMLElement>;

  currentIndex = 0;
  itemsPerView = 4;
  slideWidthPx = 0;
  animateTransitions = false;
  isSliding = false;
  isMobileScroll = false;
  activeMobilePage = 0;

  private static readonly MOBILE_BREAKPOINT = 600;
  private resizeObserver?: ResizeObserver;
  private layoutFrame?: number;
  private prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  get sectionId(): string {
    return this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  ngAfterViewInit(): void {
    this.scheduleLayoutUpdate();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['products'] || changes['isLoading']) {
      if (changes['products'] && !changes['products'].firstChange) {
        this.currentIndex = 0;
      }
      this.scheduleLayoutUpdate();
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (this.layoutFrame !== undefined) {
      cancelAnimationFrame(this.layoutFrame);
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.scheduleLayoutUpdate();
  }

  get maxIndex(): number {
    return Math.max(0, this.products.length - this.itemsPerView);
  }

  get canGoPrev(): boolean {
    return this.currentIndex > 0;
  }

  get canGoNext(): boolean {
    return this.slideWidthPx > 0 && this.currentIndex < this.maxIndex;
  }

  get trackTransformStyle(): string | null {
    if (this.isMobileScroll || this.usePartialRow || !this.slideWidthPx) {
      return null;
    }
    return `translate3d(-${this.currentIndex * this.slideWidthPx}px, 0, 0)`;
  }

  get showDesktopNav(): boolean {
    return !this.isMobileScroll && this.products.length > this.itemsPerView;
  }

  get showMobilePagination(): boolean {
    return this.isMobileScroll && this.mobilePageCount > 1;
  }

  get mobilePageCount(): number {
    return Math.ceil(this.products.length / this.itemsPerView);
  }

  get mobilePages(): number[] {
    return Array.from({ length: this.mobilePageCount }, (_, i) => i);
  }

  /** Fewer products than visible slots — centered row, same card width as carousel. */
  get usePartialRow(): boolean {
    return (
      this.products.length > 0 && this.products.length < this.itemsPerView
    );
  }

  get showViewAll(): boolean {
    return this.totalCount > 0;
  }

  get displayTitle(): string {
    return toTitleCase(this.title);
  }

  get carouselLabel(): string {
    return `${this.displayTitle} products`;
  }

  prev(): void {
    if (!this.canGoPrev || this.isSliding) {
      return;
    }
    const previousIndex = this.currentIndex;
    if (
      this.currentIndex === this.maxIndex &&
      this.currentIndex % this.itemsPerView !== 0
    ) {
      this.currentIndex =
        Math.floor(this.maxIndex / this.itemsPerView) * this.itemsPerView;
    } else {
      this.currentIndex = Math.max(0, this.currentIndex - this.itemsPerView);
    }
    this.beginSlide(previousIndex);
  }

  next(): void {
    if (!this.canGoNext || this.isSliding) {
      return;
    }
    const previousIndex = this.currentIndex;
    this.currentIndex = Math.min(
      this.currentIndex + this.itemsPerView,
      this.maxIndex,
    );
    this.beginSlide(previousIndex);
  }

  onTrackTransitionEnd(event: TransitionEvent): void {
    if (
      event.target !== event.currentTarget ||
      event.propertyName !== 'transform'
    ) {
      return;
    }
    this.isSliding = false;
  }

  onViewportScroll(): void {
    if (!this.isMobileScroll) {
      return;
    }
    const viewport = this.viewportRef?.nativeElement;
    if (!viewport || viewport.clientWidth <= 0) {
      return;
    }
    const page = Math.round(viewport.scrollLeft / viewport.clientWidth);
    this.activeMobilePage = Math.min(
      Math.max(0, page),
      this.mobilePageCount - 1,
    );
  }

  goToMobilePage(page: number): void {
    const viewport = this.viewportRef?.nativeElement;
    if (!viewport || !this.isMobileScroll) {
      return;
    }
    const clamped = Math.min(Math.max(0, page), this.mobilePageCount - 1);
    viewport.scrollTo({
      left: clamped * viewport.clientWidth,
      behavior: this.prefersReducedMotion ? 'auto' : 'smooth',
    });
    this.activeMobilePage = clamped;
  }

  private beginSlide(previousIndex: number): void {
    if (
      this.prefersReducedMotion ||
      !this.animateTransitions ||
      previousIndex === this.currentIndex
    ) {
      this.isSliding = false;
      return;
    }
    this.isSliding = true;
  }

  private scheduleLayoutUpdate(): void {
    if (this.layoutFrame !== undefined) {
      cancelAnimationFrame(this.layoutFrame);
    }
    this.layoutFrame = requestAnimationFrame(() => {
      this.layoutFrame = requestAnimationFrame(() => {
        this.layoutFrame = undefined;
        this.updateLayout();
        this.attachResizeObserver();
      });
    });
  }

  private attachResizeObserver(): void {
    const el = this.viewportRef?.nativeElement;
    if (!el || typeof ResizeObserver === 'undefined') {
      return;
    }
    if (!this.resizeObserver) {
      this.resizeObserver = new ResizeObserver(() => this.updateLayout());
    }
    this.resizeObserver.disconnect();
    this.resizeObserver.observe(el);
  }

  private updateLayout(): void {
    const viewport = this.viewportRef?.nativeElement;
    if (!viewport || this.isLoading || !this.products.length) {
      return;
    }

    this.animateTransitions = false;
    this.isSliding = false;

    const width = viewport.clientWidth;
    if (width <= 0) {
      return;
    }

    const wasMobileScroll = this.isMobileScroll;
    this.isMobileScroll =
      width < HomeProductCarouselComponent.MOBILE_BREAKPOINT;

    if (this.isMobileScroll) {
      this.itemsPerView = 2;
    } else if (width < 900) {
      this.itemsPerView = 3;
    } else {
      this.itemsPerView = 4;
    }

    this.slideWidthPx = width / this.itemsPerView;
    const slideWidth = `${this.slideWidthPx}px`;
    viewport.style.setProperty('--slide-width', slideWidth);
    viewport.style.setProperty('--items-per-view', String(this.itemsPerView));

    const track = viewport.querySelector('.home-product-carousel__track');
    track?.querySelectorAll<HTMLElement>('.home-product-carousel__slide').forEach((slide) => {
      slide.style.flexBasis = slideWidth;
      slide.style.width = slideWidth;
      slide.style.maxWidth = slideWidth;
      slide.style.minWidth = slideWidth;
    });

    if (this.currentIndex > this.maxIndex) {
      this.currentIndex = this.maxIndex;
    }
    if (!this.isMobileScroll) {
      this.snapToPage();
    }

    if (wasMobileScroll !== this.isMobileScroll) {
      viewport.scrollLeft = 0;
      this.currentIndex = 0;
      this.activeMobilePage = 0;
    }

    if (this.isMobileScroll) {
      this.onViewportScroll();
      this.animateTransitions = false;
      this.isSliding = false;
    } else {
      this.enableTransitionsAfterLayout();
    }
  }

  private enableTransitionsAfterLayout(): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.animateTransitions =
          !this.prefersReducedMotion && !this.isMobileScroll;
      });
    });
  }

  /** Keep index aligned to a page boundary after resize. */
  private snapToPage(): void {
    if (this.currentIndex <= 0) {
      this.currentIndex = 0;
      return;
    }
    if (this.currentIndex >= this.maxIndex) {
      this.currentIndex = this.maxIndex;
      return;
    }
    this.currentIndex =
      Math.floor(this.currentIndex / this.itemsPerView) * this.itemsPerView;
  }
}
