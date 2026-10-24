import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { Product } from '../../models/product';
import { CartService } from '../../services/cart';
import { NotificationService } from '../../services/notification.service';
import { Wishlist } from '../../services/wishlist';

@Component({
  selector: 'app-wishlist-page',
  standalone: true,
  imports: [CommonModule, MatIconModule, RouterLink],
  templateUrl: './wishlist-page.html',
  styleUrl: './wishlist-page.scss',
})
export class WishlistPage implements OnInit, OnDestroy {
  items: Product[] = [];

  readonly placeholderSrc =
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500"><rect fill="#161616" width="400" height="500"/></svg>',
    );

  private subscription?: Subscription;
  private cartErrorSubscription?: Subscription;

  constructor(
    private wishlistService: Wishlist,
    private cartService: CartService,
    private notificationService: NotificationService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.subscription = this.wishlistService.wishlistItems$.subscribe((items) => {
      this.items = items;
    });
    this.cartErrorSubscription = this.cartService.error$.subscribe((message) => {
      this.notificationService.error(message);
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.cartErrorSubscription?.unsubscribe();
  }

  get summary(): string {
    if (this.items.length === 0) {
      return 'Save pieces you want to come back to';
    }
    return this.items.length === 1 ? '1 saved piece' : `${this.items.length} saved pieces`;
  }

  openProduct(product: Product): void {
    this.router.navigate(['/product', product.id]);
  }

  remove(product: Product): void {
    this.wishlistService.removeFromWishlist(product.id);
  }

  addToCart(product: Product): void {
    if (product.availableStock <= 0) {
      return;
    }
    if (this.cartService.addToCart(product, 1)) {
      this.notificationService.success('Added to cart');
    }
  }
}
