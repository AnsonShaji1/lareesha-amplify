import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { Product } from '../models/product';
import { ApiService, CartItemResponse } from './api.service';
import { AuthService } from './auth.service';

export interface CartItem {
  id?: string;
  product: Product;
  quantity: number;
}

@Injectable({
  providedIn: 'root',
})
export class CartService {
  private cartItems: CartItem[] = [];
  private cartItemsSubject = new BehaviorSubject<CartItem[]>([]);
  cartItems$ = this.cartItemsSubject.asObservable();

  private cartCountSubject = new BehaviorSubject<number>(0);
  cartCount$ = this.cartCountSubject.asObservable();

  private itemAddedSubject = new Subject<void>();
  itemAdded$ = this.itemAddedSubject.asObservable();

  // Event emitted when user is not authenticated
  private authRequiredSubject = new Subject<void>();
  authRequired$ = this.authRequiredSubject.asObservable();

  // Event emitted when there's an error
  private errorSubject = new Subject<string>();
  error$ = this.errorSubject.asObservable();

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
  ) {
    // Subscribe to auth state changes and reload cart when user logs in/signs out
    this.authService.isAuthenticated$.subscribe((isAuthenticated) => {
      if (isAuthenticated) {
        this.loadCart();
      } else {
        // Clear cart when user signs out
        this.cartItems = [];
        this.updateCartState();
      }
    });
  }

  private cartLoadInFlight = false;

  private loadCart(): void {
    if (!this.authService.isAuthenticated) {
      console.warn('Cannot load cart: user not authenticated');
      return;
    }
    if (this.cartLoadInFlight) return;
    this.cartLoadInFlight = true;
    this.apiService.getCart().subscribe({
      next: (items) => {
        this.cartItems = items.map((item) => ({
          id: item.id,
          product: item.product,
          quantity: item.quantity,
        }));
        this.updateCartState();
        this.cartLoadInFlight = false;
      },
      error: (error) => {
        console.error('Error loading cart:', error);
        this.cartLoadInFlight = false;
      },
    });
  }

  quantityInCart(productId: string): number {
    return this.cartItems.find((item) => item.product.id === productId)?.quantity ?? 0;
  }

  addToCart(product: Product, quantity: number = 1): boolean {
    if (!this.authService.isAuthenticated) {
      this.authRequiredSubject.next();
      return false;
    }

    const requested = Math.max(1, quantity);
    const inCart = this.quantityInCart(product.id);
    if (inCart + requested > product.availableStock) {
      const left = product.availableStock;
      this.errorSubject.next(left === 1 ? 'Only 1 left in stock' : `Only ${left} left in stock`);
      return false;
    }

    const existing = this.cartItems.find((item) => item.product.id === product.id);
    if (existing?.id) {
      this.updateQuantity(product.id, existing.quantity + requested);
      this.itemAddedSubject.next();
      return true;
    }

    this.apiService.addToCart(product.id, requested).subscribe({
      next: (response) => {
        const already = this.cartItems.find((item) => item.product.id === product.id);
        if (!already) {
          this.cartItems = [
            ...this.cartItems,
            { id: response.id, product, quantity: response.quantity },
          ];
          this.updateCartState();
        }
        this.itemAddedSubject.next();
      },
      error: (error) => {
        console.error('Error adding to cart:', error);
        const errorMessage = error?.error?.message || 'Failed to add item to cart';
        this.errorSubject.next(errorMessage);
      },
    });
    return true;
  }

  removeFromCart(productId: string): void {
    if (!this.authService.isAuthenticated) {
      this.authRequiredSubject.next();
      return;
    }

    const item = this.cartItems.find((i) => i.product.id === productId);
    if (item && item.id) {
      this.apiService.removeFromCart(item.id).subscribe({
        next: () => {
          this.cartItems = this.cartItems.filter((entry) => entry.product.id !== productId);
          this.updateCartState();
        },
        error: (error) => {
          console.error('Error removing from cart:', error);
        },
      });
    }
  }

  updateQuantity(productId: string, quantity: number): void {
    if (!this.authService.isAuthenticated) {
      this.authRequiredSubject.next();
      return;
    }

    const item = this.cartItems.find((i) => i.product.id === productId);
    if (item && item.id) {
      if (quantity <= 0) {
        this.removeFromCart(productId);
      } else {
        this.apiService.updateCartItem(item.id, quantity).subscribe({
          next: (saved) => {
            item.quantity = saved.quantity;
            this.updateCartState();
          },
          error: (error) => {
            console.error('Error updating cart:', error);
          },
        });
      }
    }
  }

  clearCart(): void {
    if (!this.authService.isAuthenticated) {
      this.authRequiredSubject.next();
      return;
    }

    this.apiService.clearCart().subscribe({
      next: () => {
        this.cartItems = [];
        this.updateCartState();
      },
      error: (error) => {
        console.error('Error clearing cart:', error);
      },
    });
  }

  getTotal(): number {
    return this.cartItems.reduce((total, item) => {
      const raw = item.product.salePrice;
      const price = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
      const safe = Number.isFinite(price) ? price : 0;
      return total + safe * item.quantity;
    }, 0);
  }

  private updateCartState(): void {
    this.cartItemsSubject.next([...this.cartItems]);
    const totalCount = this.cartItems.reduce((count, item) => count + item.quantity, 0);
    this.cartCountSubject.next(totalCount);
  }

  refreshCart(): void {
    this.cartLoadInFlight = false;
    this.loadCart();
  }

  /** Uses the cart already loaded in memory. Does not call the API again. */
  stockIssues(): { product_name: string; requested: number; available: number }[] {
    return this.cartItems
      .filter((item) => item.product.availableStock < item.quantity)
      .map((item) => ({
        product_name: item.product.name,
        requested: item.quantity,
        available: item.product.availableStock,
      }));
  }
}
