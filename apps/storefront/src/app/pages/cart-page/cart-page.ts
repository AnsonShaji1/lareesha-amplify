import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CartItem, CartService } from '../../services/cart';

@Component({
  selector: 'app-cart-page',
  standalone: true,
  imports: [CommonModule, MatIconModule, RouterLink],
  templateUrl: './cart-page.html',
  styleUrl: './cart-page.scss',
})
export class CartPage implements OnInit, OnDestroy {
  items: CartItem[] = [];
  total = 0;
  errorMessage = '';

  readonly placeholderSrc =
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500"><rect fill="#161616" width="400" height="500"/></svg>',
    );

  private subscription?: Subscription;

  constructor(
    private cartService: CartService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.subscription = this.cartService.cartItems$.subscribe((items) => {
      this.items = items;
      this.total = this.cartService.getTotal();
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  get pieceCount(): number {
    return this.items.reduce((count, item) => count + item.quantity, 0);
  }

  get summary(): string {
    if (this.pieceCount === 0) {
      return 'Pieces you are ready to take home';
    }
    return this.pieceCount === 1 ? '1 piece' : `${this.pieceCount} pieces`;
  }

  unitPrice(item: CartItem): number {
    const raw = item.product.salePrice || item.product.originalPrice;
    const price = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
    return Number.isFinite(price) ? price : 0;
  }

  lineTotal(item: CartItem): number {
    return this.unitPrice(item) * item.quantity;
  }

  formatRupees(amount: number): string {
    return Number.isInteger(amount) ? `₹${amount}` : `₹${amount.toFixed(2)}`;
  }

  openProduct(item: CartItem): void {
    this.router.navigate(['/product', item.product.id]);
  }

  increase(item: CartItem): void {
    if (item.quantity < item.product.availableStock) {
      this.errorMessage = '';
      this.cartService.updateQuantity(item.product.id, item.quantity + 1);
    }
  }

  decrease(item: CartItem): void {
    if (item.quantity > 1) {
      this.errorMessage = '';
      this.cartService.updateQuantity(item.product.id, item.quantity - 1);
    }
  }

  remove(item: CartItem): void {
    this.errorMessage = '';
    this.cartService.removeFromCart(item.product.id);
  }

  checkout(): void {
    const issues = this.cartService.stockIssues();
    if (!issues.length) {
      this.errorMessage = '';
      this.router.navigate(['/checkout']);
      return;
    }
    const details = issues
      .map(
        (item) =>
          `${item.product_name}: you asked for ${item.requested}, and ${item.available} are available`,
      )
      .join('\n');
    this.errorMessage = `Some pieces are short on stock.\n${details}`;
  }
}
