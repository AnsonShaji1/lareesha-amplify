import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { Product } from '../../models/product';
import { CommonModule } from '@angular/common';
import { CartService } from '../../services/cart';
import { NotificationService } from '../../services/notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-product-card',
  imports: [CommonModule],
  templateUrl: './product-card.html',
  styleUrl: './product-card.scss',
})
export class ProductCard implements OnInit, OnDestroy {
  @Input() product!: Product;
  @Output() authRequired = new EventEmitter<void>();

  readonly placeholderSrc =
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500"><rect fill="#f0e8dc" width="400" height="500"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#6b6b6b" font-family="sans-serif" font-size="18">Product</text></svg>',
    );

  private authRequiredSubscription?: Subscription;
  private itemAddedSubscription?: Subscription;
  private cartErrorSubscription?: Subscription;

  constructor(
    private cartService: CartService,
    private notificationService: NotificationService,
  ) {}

  ngOnInit() {
    this.authRequiredSubscription = this.cartService.authRequired$.subscribe(() => {
      this.authRequired.emit();
    });

    // Listen for successful cart additions
    this.itemAddedSubscription = this.cartService.itemAdded$.subscribe(() => {
      this.notificationService.success('Added to cart');
    });

    // Listen for cart errors
    this.cartErrorSubscription = this.cartService.error$.subscribe((error) => {
      this.notificationService.error(error);
    });
  }

  ngOnDestroy() {
    this.authRequiredSubscription?.unsubscribe();
    this.itemAddedSubscription?.unsubscribe();
    this.cartErrorSubscription?.unsubscribe();
  }

  addToCart() {
    console.log('Adding to cart:', this.product.name);
    this.cartService.addToCart(this.product, 1);
  }
}
