import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnChanges,
  SimpleChanges,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Product } from '../../models/product';
import { Wishlist } from '../../services/wishlist';
import { NotificationService } from '../../services/notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.scss',
})
export class ProductDetailComponent implements OnChanges, OnInit, OnDestroy {
  @Input() isOpen = false;
  @Input() product: Product | null = null;
  @Output() closeModal = new EventEmitter<void>();
  @Output() addedToCart = new EventEmitter<{ product: Product; quantity: number }>();
  @Output() authRequired = new EventEmitter<void>();

  currentImage = '';
  quantity = 1;
  isInWishlist = false;
  private authRequiredSubscription?: Subscription;

  constructor(
    private wishlistService: Wishlist,
    private notificationService: NotificationService,
  ) {}

  ngOnInit() {
    this.authRequiredSubscription = this.wishlistService.authRequired$.subscribe(() => {
      this.authRequired.emit();
    });
  }

  ngOnDestroy() {
    this.authRequiredSubscription?.unsubscribe();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['product'] && this.product) {
      this.currentImage = this.product.images[0] || '';
      this.quantity = 1;
      this.isInWishlist = this.wishlistService?.isInWishlist(this.product.id) ?? false;
    }
  }

  selectImage(image: string) {
    this.currentImage = image;
  }

  increaseQuantity() {
    if (this.product && this.quantity < this.product.availableStock) {
      this.quantity++;
    }
  }

  decreaseQuantity() {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }

  addToCart() {
    if (!this.product || this.product.availableStock === 0) {
      return;
    }

    console.log('Adding to cart:', { product: this.product, quantity: this.quantity });
    this.addedToCart.emit({
      product: this.product,
      quantity: this.quantity,
    });
    this.notificationService.success('Added to cart');
  }

  toggleWishlist() {
    if (!this.product || !this.wishlistService) {
      return;
    }

    this.isInWishlist = this.wishlistService.toggleWishlist(this.product);
    if (this.isInWishlist) {
      this.notificationService.success('Added to wishlist');
    } else {
      this.notificationService.success('Removed from wishlist');
    }
  }

  close() {
    this.closeModal.emit();
  }
}
