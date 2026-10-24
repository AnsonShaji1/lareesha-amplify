import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { CategoryPage } from './pages/category-page/category-page';
import { ProductDetailPage } from './pages/product-detail-page/product-detail-page';
import { CheckoutPage } from './pages/checkout-page/checkout-page';
import { NewInPage } from './pages/new-in-page/new-in-page';
import { ShopPage } from './pages/shop-page/shop-page';
import { CollectionsPage } from './pages/collections-page/collections-page';
import { HelpSupportPage } from './pages/help-support-page/help-support-page';
import { ResetPasswordPageComponent } from './pages/reset-password-page/reset-password-page';
import { ManageAddressesComponent } from './pages/manage-addresses-page/manage-addresses';
import { MyAccountPage } from './pages/my-account/my-account';
import { AccountProfileComponent } from './pages/my-account/account-profile/account-profile';
import { AccountOrdersComponent } from './pages/my-account/account-orders/account-orders';
import { OrderDetailComponent } from './pages/order-detail/order-detail';
import { authGuard } from './services/auth.guard';
import { guestAuthGuard } from './services/guest-auth.guard';
import { AuthPage } from './pages/auth-page/auth-page';
import { ForgotPasswordPage } from './pages/forgot-password-page/forgot-password-page';
import { WishlistPage } from './pages/wishlist-page/wishlist-page';
import { CartPage } from './pages/cart-page/cart-page';

export const routes: Routes = [
  { path: '', component: Home },
  {
    path: 'sign-in',
    component: AuthPage,
    canActivate: [guestAuthGuard],
    data: { authMode: 'signin' },
  },
  {
    path: 'sign-up',
    component: AuthPage,
    canActivate: [guestAuthGuard],
    data: { authMode: 'signup' },
  },
  { path: 'forgot-password', component: ForgotPasswordPage, canActivate: [guestAuthGuard] },
  { path: 'new-in', component: NewInPage },
  { path: 'shop', component: ShopPage },
  { path: 'categories', component: CollectionsPage },
  { path: 'collections', redirectTo: 'categories', pathMatch: 'full' },
  { path: 'category/:slug', component: CategoryPage },
  { path: 'product/:id', component: ProductDetailPage },
  { path: 'wishlist', component: WishlistPage, canActivate: [authGuard] },
  { path: 'cart', component: CartPage, canActivate: [authGuard] },
  { path: 'checkout', component: CheckoutPage },
  {
    path: 'account',
    component: MyAccountPage,
    canActivate: [authGuard],
    children: [
      { path: '', component: AccountProfileComponent },
      { path: 'orders', component: AccountOrdersComponent },
      { path: 'address', component: ManageAddressesComponent },
    ],
  },
  { path: 'help', component: HelpSupportPage },
  { path: 'order/:id', component: OrderDetailComponent, canActivate: [authGuard] },
  {
    path: 'reset-password',
    component: ResetPasswordPageComponent,
    canActivate: [guestAuthGuard],
  },
  { path: '**', redirectTo: '' },
];
