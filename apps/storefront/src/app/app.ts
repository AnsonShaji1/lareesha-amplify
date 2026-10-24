import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from './components/header/header';
import { SearchModalComponent } from './components/search-modal/search-modal';
import { SiteFooterComponent } from './components/site-footer/site-footer';
import { ProductService } from './services/product';
import { CartService } from './services/cart';
import { Wishlist } from './services/wishlist';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    RouterOutlet,
    HeaderComponent,
    SearchModalComponent,
    SiteFooterComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit, OnDestroy {
  title = 'Lareesha Luxe';
  isSearchOpen = false;
  private cartAuthRequiredSubscription?: Subscription;
  private wishlistAuthRequiredSubscription?: Subscription;

  constructor(
    private productService: ProductService,
    private cartService: CartService,
    private wishlistService: Wishlist,
    private router: Router,
  ) {}

  ngOnInit() {
    this.productService.products$.subscribe();

    this.cartAuthRequiredSubscription = this.cartService.authRequired$.subscribe(() => {
      console.log('Cart: Auth required');
      this.openSignIn();
    });

    this.wishlistAuthRequiredSubscription = this.wishlistService.authRequired$.subscribe(() => {
      console.log('Wishlist: Auth required');
      this.openSignIn();
    });

  }

  ngOnDestroy() {
    this.cartAuthRequiredSubscription?.unsubscribe();
    this.wishlistAuthRequiredSubscription?.unsubscribe();
  }

  openSearch() {
    this.isSearchOpen = true;
  }

  closeSearch() {
    this.isSearchOpen = false;
  }

  openSignIn() {
    void this.router.navigate(['/sign-in']);
  }
}
