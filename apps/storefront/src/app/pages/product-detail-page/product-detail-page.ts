import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  HostListener,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, ViewportScroller } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { map, switchMap, catchError, finalize, tap, of } from 'rxjs';
import { ProductService } from '../../services/product';
import { CartService } from '../../services/cart';
import { Wishlist } from '../../services/wishlist';
import { Product } from '../../models/product';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-product-detail-page',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  templateUrl: './product-detail-page.html',
  styleUrl: './product-detail-page.scss',
})
export class ProductDetailPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly productService = inject(ProductService);
  private readonly cartService = inject(CartService);
  private readonly wishlistService = inject(Wishlist);
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);
  private readonly viewportScroller = inject(ViewportScroller);

  readonly loading = signal(true);
  readonly loadError = signal(false);
  product: Product | null = null;
  readonly currentImageSrc = signal('');
  readonly imageReveal = signal(true);

  quantity = 1;
  cartQuantity = 0;
  isInWishlist = false;

  readonly isDesktop = signal(this.readDesktopMq());

  readonly galleryOpen = signal(false);
  readonly modalIndex = signal(0);
  readonly modalZoom = signal(1);
  readonly modalPanX = signal(0);
  readonly modalPanY = signal(0);

  private modalBaseZoom = 1;
  private pinchStartDist = 0;
  private modalTouchPanX = 0;
  private modalTouchPanY = 0;
  private lastModalTap = 0;

  private mediaQuery?: MediaQueryList;
  private mediaHandler?: (e: MediaQueryListEvent) => void;

  private modalPanning = false;
  private modalMouseStartX = 0;
  private modalMouseStartY = 0;
  private modalPanOriginX = 0;
  private modalPanOriginY = 0;

  private touchStartX = 0;
  private touchActive = false;
  private singleTouchPanning = false;
  private readonly onModalTouchMoveBound = (event: TouchEvent) => {
    if (!this.galleryOpen()) return;
    this.onModalTouchMove(event);
  };

  private readonly onModalWheelBound = (event: WheelEvent) => {
    if (!this.galleryOpen()) return;
    this.onModalWheel(event);
  };

  ngOnInit(): void {
    if (typeof globalThis.matchMedia === 'function') {
      this.mediaQuery = globalThis.matchMedia('(min-width: 1024px)');
      this.mediaHandler = (ev: MediaQueryListEvent) => {
        this.isDesktop.set(ev.matches);
        if (ev.matches) {
          this.closeGallery();
        }
      };
      this.mediaQuery.addEventListener('change', this.mediaHandler);
    }

    this.wishlistService.wishlistItems$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.product) {
          this.isInWishlist = this.wishlistService.isInWishlist(this.product.id);
        }
      });

    this.cartService.cartItems$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((items) => {
      const id = this.product?.id;
      this.cartQuantity = id ? (items.find((item) => item.product.id === id)?.quantity ?? 0) : 0;
      const remaining = this.remainingAddable();
      if (remaining > 0 && this.quantity > remaining) {
        this.quantity = remaining;
      }
    });

    this.route.paramMap
      .pipe(
        map((pm) => pm.get('id') || ''),
        tap(() => {
          this.closeGallery();
          this.scrollToTop();
        }),
        switchMap((id) => {
          if (!id) {
            return of(null).pipe(tap(() => this.loading.set(false)));
          }
          this.loading.set(true);
          this.loadError.set(false);
          return this.productService.getProductById(id).pipe(
            catchError((err) => {
              console.error('Error loading product:', err);
              return of(null);
            }),
            finalize(() => this.loading.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((p) => {
        if (p) {
          const images = (Array.isArray(p.images) ? p.images : []).filter(
            (url) => typeof url === 'string' && url.trim().length > 0,
          );
          this.product = { ...p, images };
          this.cartQuantity = this.cartService.quantityInCart(p.id);
          const first = images[0] ?? '';
          this.currentImageSrc.set(first);
          this.modalIndex.set(0);
          this.quantity = 1;
          this.isInWishlist = this.wishlistService.isInWishlist(p.id);
          this.loadError.set(false);
          queueMicrotask(() => this.triggerImageReveal());
        } else {
          this.product = null;
          this.currentImageSrc.set('');
          this.loadError.set(true);
        }
      });
  }

  ngOnDestroy(): void {
    if (this.mediaQuery && this.mediaHandler) {
      this.mediaQuery.removeEventListener('change', this.mediaHandler);
    }
    this.detachGalleryListeners();
    this.unlockBodyScroll();
  }

  private scrollToTop(): void {
    this.viewportScroller.scrollToPosition([0, 0]);
    globalThis.scrollTo?.(0, 0);
  }

  private readDesktopMq(): boolean {
    return (
      typeof globalThis !== 'undefined' &&
      typeof globalThis.matchMedia === 'function' &&
      globalThis.matchMedia('(min-width: 1024px)').matches
    );
  }

  private lockBodyScroll(): void {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }
  }

  private unlockBodyScroll(): void {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
  }

  selectImage(src: string, index?: number): void {
    if (!src) return;
    if (this.currentImageSrc() !== src) {
      this.currentImageSrc.set(src);
      this.triggerImageReveal();
    }
    if (index !== undefined) {
      this.modalIndex.set(index);
    }
    this.resetModalView();
  }

  private triggerImageReveal(): void {
    this.imageReveal.set(false);
    requestAnimationFrame(() => this.imageReveal.set(true));
  }

  onMainTap(event: MouseEvent): void {
    if (!this.currentImageSrc()) return;
    event.stopPropagation();
    this.openGallery();
  }

  openGallery(): void {
    if (!this.product) return;
    const imgs = this.product.images ?? [];
    if (!imgs.length && !this.currentImageSrc()) return;
    const idx = imgs.length
      ? Math.max(0, imgs.indexOf(this.currentImageSrc()))
      : 0;
    this.modalIndex.set(idx);
    this.resetModalView();
    this.galleryOpen.set(true);
    this.lockBodyScroll();
    this.attachGalleryListeners();
  }

  closeGallery(): void {
    this.galleryOpen.set(false);
    this.resetModalView();
    this.modalPanning = false;
    this.unlockBodyScroll();
    this.detachGalleryListeners();
  }

  private attachGalleryListeners(): void {
    if (typeof document === 'undefined') return;
    document.addEventListener('touchmove', this.onModalTouchMoveBound, {
      passive: false,
    });
    document.addEventListener('wheel', this.onModalWheelBound, { passive: false });
    document.addEventListener('mousemove', this.onModalMouseMoveBound);
    document.addEventListener('mouseup', this.onModalMouseUpBound);
  }

  private detachGalleryListeners(): void {
    if (typeof document === 'undefined') return;
    document.removeEventListener('touchmove', this.onModalTouchMoveBound);
    document.removeEventListener('wheel', this.onModalWheelBound);
    document.removeEventListener('mousemove', this.onModalMouseMoveBound);
    document.removeEventListener('mouseup', this.onModalMouseUpBound);
  }

  private readonly onModalMouseMoveBound = (event: MouseEvent) => {
    if (!this.galleryOpen() || !this.modalPanning) return;
    this.modalPanX.set(this.modalPanOriginX + event.clientX - this.modalMouseStartX);
    this.modalPanY.set(this.modalPanOriginY + event.clientY - this.modalMouseStartY);
  };

  private readonly onModalMouseUpBound = () => {
    this.modalPanning = false;
  };

  onModalMouseDown(event: MouseEvent): void {
    if (this.modalZoom() <= 1.05) return;
    event.preventDefault();
    this.modalPanning = true;
    this.modalMouseStartX = event.clientX;
    this.modalMouseStartY = event.clientY;
    this.modalPanOriginX = this.modalPanX();
    this.modalPanOriginY = this.modalPanY();
  }

  onModalDblClick(event: MouseEvent): void {
    event.preventDefault();
    this.toggleModalDoubleTapZoom();
  }

  onModalWheel(event: WheelEvent): void {
    event.preventDefault();
    const step = event.deltaY > 0 ? -0.18 : 0.18;
    const next = Math.min(4, Math.max(1, this.modalZoom() + step));
    this.modalZoom.set(next);
    if (next <= 1.05) {
      this.modalPanX.set(0);
      this.modalPanY.set(0);
    }
  }

  private resetModalView(): void {
    this.modalZoom.set(1);
    this.modalPanX.set(0);
    this.modalPanY.set(0);
    this.modalBaseZoom = 1;
    this.pinchStartDist = 0;
    this.singleTouchPanning = false;
    this.modalPanning = false;
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(ev: KeyboardEvent): void {
    if (!this.galleryOpen()) return;
    if (ev.key === 'Escape') {
      this.closeGallery();
    } else if (ev.key === 'ArrowLeft') {
      this.modalPrev();
    } else if (ev.key === 'ArrowRight') {
      this.modalNext();
    }
  }

  modalImage(): string {
    const imgs = this.product?.images;
    if (!imgs?.length) return this.currentImageSrc();
    const i = Math.min(Math.max(0, this.modalIndex()), imgs.length - 1);
    return imgs[i] ?? '';
  }

  modalTransform(): string {
    return `translate(${this.modalPanX()}px, ${this.modalPanY()}px) scale(${this.modalZoom()})`;
  }

  modalPrev(): void {
    const imgs = this.product?.images;
    if (!imgs?.length) return;
    const i = (this.modalIndex() - 1 + imgs.length) % imgs.length;
    this.modalIndex.set(i);
    this.currentImageSrc.set(imgs[i]);
    this.resetModalView();
    this.triggerImageReveal();
  }

  modalNext(): void {
    const imgs = this.product?.images;
    if (!imgs?.length) return;
    const i = (this.modalIndex() + 1) % imgs.length;
    this.modalIndex.set(i);
    this.currentImageSrc.set(imgs[i]);
    this.resetModalView();
    this.triggerImageReveal();
  }

  onModalTouchStart(event: TouchEvent): void {
    if (event.touches.length === 1) {
      const t = event.touches[0];
      this.touchStartX = t.clientX;
      this.touchActive = true;
      this.singleTouchPanning = this.modalZoom() > 1.05;
      this.modalTouchPanX = t.clientX - this.modalPanX();
      this.modalTouchPanY = t.clientY - this.modalPanY();
    } else if (event.touches.length === 2) {
      this.touchActive = false;
      this.singleTouchPanning = false;
      this.pinchStartDist = this.touchDistance(event.touches);
      this.modalBaseZoom = this.modalZoom();
    }
  }

  onModalTouchMove(event: TouchEvent): void {
    if (event.touches.length === 2) {
      event.preventDefault();
      const d = this.touchDistance(event.touches);
      if (this.pinchStartDist > 0) {
        const next = (d / this.pinchStartDist) * this.modalBaseZoom;
        this.modalZoom.set(Math.min(4, Math.max(1, next)));
        if (this.modalZoom() <= 1.05) {
          this.modalPanX.set(0);
          this.modalPanY.set(0);
        }
      }
      return;
    }

    if (event.touches.length === 1 && this.singleTouchPanning) {
      event.preventDefault();
      const t = event.touches[0];
      this.modalPanX.set(t.clientX - this.modalTouchPanX);
      this.modalPanY.set(t.clientY - this.modalTouchPanY);
    }
  }

  onModalTouchEnd(event: TouchEvent): void {
    if (event.touches.length < 2) {
      this.pinchStartDist = 0;
      this.modalBaseZoom = this.modalZoom();
    }

    if (event.changedTouches.length === 1 && this.touchActive && !this.singleTouchPanning) {
      const now = Date.now();
      const t = event.changedTouches[0];
      const dx = t.clientX - this.touchStartX;

      if (now - this.lastModalTap < 320) {
        this.toggleModalDoubleTapZoom();
        this.lastModalTap = 0;
      } else {
        this.lastModalTap = now;
        if (this.modalZoom() <= 1.02 && Math.abs(dx) > 56) {
          if (dx < 0) this.modalNext();
          else this.modalPrev();
        }
      }
    }

    this.touchActive = false;
    this.singleTouchPanning = false;
  }

  private toggleModalDoubleTapZoom(): void {
    if (this.modalZoom() > 1.05) {
      this.resetModalView();
    } else {
      this.modalZoom.set(2);
    }
  }

  pickModalThumb(idx: number, src: string): void {
    this.modalIndex.set(idx);
    this.currentImageSrc.set(src);
    this.resetModalView();
    this.triggerImageReveal();
  }

  private touchDistance(touches: TouchList): number {
    const a = touches[0];
    const b = touches[1];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  remainingAddable(): number {
    if (!this.product) return 0;
    const stock = Number(this.product.availableStock);
    const available = Number.isFinite(stock) ? stock : 0;
    return Math.max(0, available - this.cartQuantity);
  }

  canAddToCart(): boolean {
    return this.remainingAddable() > 0;
  }

  increaseQuantity(): void {
    if (this.product && this.quantity < this.remainingAddable()) {
      this.quantity++;
    }
  }

  decreaseQuantity(): void {
    if (this.quantity > 1) this.quantity--;
  }

  addToCart(): void {
    if (!this.product || !this.canAddToCart()) return;
    if (!this.authService.isAuthenticated) {
      void this.router.navigate(['/sign-in'], {
        queryParams: { returnUrl: this.router.url },
      });
      return;
    }
    if (this.quantity > this.remainingAddable()) {
      const left = this.product.availableStock;
      this.notificationService.warning(left === 1 ? 'Only 1 left in stock' : `Only ${left} left in stock`);
      return;
    }
    if (this.cartService.addToCart(this.product, this.quantity)) {
      this.notificationService.success('Added to cart');
    }
  }

  toggleWishlist(): void {
    if (!this.product) return;
    if (!this.authService.isAuthenticated) {
      void this.router.navigate(['/sign-in'], {
        queryParams: { returnUrl: this.router.url },
      });
      return;
    }
    this.wishlistService.toggleWishlist(this.product);
  }

  goBack(): void {
    void this.router.navigate(['/categories']);
  }

  hasDiscount(p: Product): boolean {
    const sale = Number(p.salePrice);
    const orig = Number(p.originalPrice);
    return Number.isFinite(sale) && Number.isFinite(orig) && sale < orig;
  }

  primaryPrice(p: Product): string | number {
    const sale = p.salePrice;
    if (sale !== undefined && sale !== null && `${sale}`.trim() !== '') {
      return sale;
    }
    return p.originalPrice ?? '';
  }
}
