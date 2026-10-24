import { Routes } from '@angular/router';
import { adminGuard } from './auth.guard';
import { LoginPage } from './pages/login.page';
import { DashboardPage } from './pages/dashboard.page';
import { ProductsListPage } from './pages/products-list.page';
import { ProductFormPage } from './pages/product-form.page';
import { CategoriesPage } from './pages/categories.page';
import { CategoryFormPage } from './pages/category-form.page';
import { CategoryDeletePage } from './pages/category-delete.page';
import { CartsPage } from './pages/carts.page';
import { CartFormPage } from './pages/cart-form.page';
import { CartDeletePage } from './pages/cart-delete.page';
import { WishlistsPage } from './pages/wishlists.page';
import { WishlistFormPage } from './pages/wishlist-form.page';
import { WishlistDeletePage } from './pages/wishlist-delete.page';
import { UsersPage } from './pages/users.page';
import { UserDetailPage } from './pages/user-detail.page';
import { AddressesPage } from './pages/addresses.page';
import { AddressDetailPage } from './pages/address-detail.page';
import { OrdersListPage } from './pages/orders-list.page';
import { OrderDetailPage } from './pages/order-detail.page';
import { PaymentsPage } from './pages/payments.page';
import { PaymentDetailPage } from './pages/payment-detail.page';
import { ReservationsPage } from './pages/reservations.page';
import { ReservationDetailPage } from './pages/reservation-detail.page';
import { ShippingPage } from './pages/shipping.page';
import { ShippingFormPage } from './pages/shipping-form.page';
import { ShippingDeletePage } from './pages/shipping-delete.page';
import { SeedPage } from './pages/seed.page';

export const routes: Routes = [
  { path: 'login', component: LoginPage },
  { path: '', component: DashboardPage, canActivate: [adminGuard] },
  { path: 'products', component: ProductsListPage, canActivate: [adminGuard] },
  { path: 'products/new', component: ProductFormPage, canActivate: [adminGuard] },
  { path: 'products/:id', component: ProductFormPage, canActivate: [adminGuard] },
  { path: 'categories/new', component: CategoryFormPage, canActivate: [adminGuard] },
  { path: 'categories/delete', component: CategoryDeletePage, canActivate: [adminGuard] },
  { path: 'categories/:id', component: CategoryFormPage, canActivate: [adminGuard] },
  { path: 'categories', component: CategoriesPage, canActivate: [adminGuard] },
  { path: 'orders', component: OrdersListPage, canActivate: [adminGuard] },
  { path: 'users/:id', component: UserDetailPage, canActivate: [adminGuard] },
  { path: 'users', component: UsersPage, canActivate: [adminGuard] },
  { path: 'carts/new', component: CartFormPage, canActivate: [adminGuard] },
  { path: 'carts/delete', component: CartDeletePage, canActivate: [adminGuard] },
  { path: 'carts/:id', component: CartFormPage, canActivate: [adminGuard] },
  { path: 'carts', component: CartsPage, canActivate: [adminGuard] },
  { path: 'wishlists/new', component: WishlistFormPage, canActivate: [adminGuard] },
  { path: 'wishlists/delete', component: WishlistDeletePage, canActivate: [adminGuard] },
  { path: 'wishlists/:id', component: WishlistFormPage, canActivate: [adminGuard] },
  { path: 'wishlists', component: WishlistsPage, canActivate: [adminGuard] },
  { path: 'addresses/:id', component: AddressDetailPage, canActivate: [adminGuard] },
  { path: 'addresses', component: AddressesPage, canActivate: [adminGuard] },
  { path: 'orders/:id', component: OrderDetailPage, canActivate: [adminGuard] },
  { path: 'payments/:id', component: PaymentDetailPage, canActivate: [adminGuard] },
  { path: 'payments', component: PaymentsPage, canActivate: [adminGuard] },
  { path: 'reservations/:id', component: ReservationDetailPage, canActivate: [adminGuard] },
  { path: 'reservations', component: ReservationsPage, canActivate: [adminGuard] },
  { path: 'shipping/new', component: ShippingFormPage, canActivate: [adminGuard] },
  { path: 'shipping/delete', component: ShippingDeletePage, canActivate: [adminGuard] },
  { path: 'shipping/:id', component: ShippingFormPage, canActivate: [adminGuard] },
  { path: 'shipping', component: ShippingPage, canActivate: [adminGuard] },
  { path: 'seed', component: SeedPage, canActivate: [adminGuard], data: { imageSource: 'test' } },
  { path: 'seed-live', component: SeedPage, canActivate: [adminGuard], data: { imageSource: 'live' } },
  { path: '**', redirectTo: '' },
];
