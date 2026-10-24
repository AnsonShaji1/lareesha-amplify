import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { Product } from '../models/product';
import { ApiService, WishlistItemResponse } from './api.service';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class Wishlist {
  private wishlistItems: Product[] = [];
  private wishlistItemsSubject = new BehaviorSubject<Product[]>([]);
  wishlistItems$ = this.wishlistItemsSubject.asObservable();
  private wishlistCountSubject = new BehaviorSubject<number>(0);
  wishlistCount$ = this.wishlistCountSubject.asObservable();
  private wishlistMap = new Map<string, string>();

  // Event emitted when user is not authenticated
  private authRequiredSubject = new Subject<void>();
  authRequired$ = this.authRequiredSubject.asObservable();

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
  ) {
    // Subscribe to auth state changes and reload wishlist when user logs in/signs out
    this.authService.isAuthenticated$.subscribe((isAuthenticated) => {
      if (isAuthenticated) {
        this.loadWishlist();
      } else {
        // Clear wishlist when user signs out
        this.wishlistItems = [];
        this.wishlistMap.clear();
        this.updateWishlistState();
      }
    });
  }

  private wishlistLoadInFlight = false;

  private loadWishlist(): void {
    if (!this.authService.isAuthenticated) {
      console.warn('Cannot load wishlist: user not authenticated');
      return;
    }
    if (this.wishlistLoadInFlight) return;
    this.wishlistLoadInFlight = true;
    this.apiService.getWishlist().subscribe({
      next: (items) => {
        this.wishlistItems = items.map((item) => item.product);
        this.wishlistMap.clear();
        items.forEach((item) => {
          this.wishlistMap.set(item.product.id, item.id);
        });
        this.updateWishlistState();
        this.wishlistLoadInFlight = false;
      },
      error: (error) => {
        console.error('Error loading wishlist:', error);
        this.wishlistLoadInFlight = false;
      },
    });
  }

  addToWishlist(product: Product): void {
    if (!this.authService.isAuthenticated) {
      this.authRequiredSubject.next();
      return;
    }
    if (this.wishlistMap.has(product.id)) return;

    this.apiService.addToWishlist(product.id).subscribe({
      next: (saved) => {
        if (this.wishlistMap.has(product.id)) return;
        this.wishlistItems = [...this.wishlistItems, product];
        this.wishlistMap.set(product.id, saved.id);
        this.updateWishlistState();
      },
      error: (error) => {
        console.error('Error adding to wishlist:', error);
      },
    });
  }

  removeFromWishlist(productId: string): void {
    if (!this.authService.isAuthenticated) {
      this.authRequiredSubject.next();
      return;
    }

    const itemId = this.wishlistMap.get(productId);
    if (itemId) {
      this.apiService.removeFromWishlist(itemId).subscribe({
        next: () => {
          this.wishlistMap.delete(productId);
          this.wishlistItems = this.wishlistItems.filter((item) => item.id !== productId);
          this.updateWishlistState();
        },
        error: (error) => {
          console.error('Error removing from wishlist:', error);
        },
      });
    }
  }

  toggleWishlist(product: Product): boolean {
    if (!this.authService.isAuthenticated) {
      this.authRequiredSubject.next();
      return this.isInWishlist(product.id);
    }

    const isInWishlist = this.isInWishlist(product.id);
    if (isInWishlist) {
      this.removeFromWishlist(product.id);
    } else {
      this.addToWishlist(product);
    }
    return isInWishlist;
  }

  isInWishlist(productId: string): boolean {
    return this.wishlistItems.some((item) => item.id === productId);
  }

  clearWishlist(): void {
    if (!this.authService.isAuthenticated) {
      this.authRequiredSubject.next();
      return;
    }

    this.apiService.clearWishlist().subscribe({
      next: () => {
        this.wishlistItems = [];
        this.wishlistMap.clear();
        this.updateWishlistState();
      },
      error: (error) => {
        console.error('Error clearing wishlist:', error);
      },
    });
  }

  private updateWishlistState(): void {
    this.wishlistItemsSubject.next([...this.wishlistItems]);
    this.wishlistCountSubject.next(this.wishlistItems.length);
  }

  refreshWishlist(): void {
    this.wishlistLoadInFlight = false;
    this.loadWishlist();
  }

  checkProductWishlistStatus(productId: string): void {
    if (!this.authService.isAuthenticated) {
      console.warn('Cannot check wishlist status: user not authenticated');
      return;
    }
    this.isInWishlist(productId);
  }
}
