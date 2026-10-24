import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
  APP_INITIALIZER,
  importProvidersFrom,
} from '@angular/core';

import { provideRouter, withInMemoryScrolling } from '@angular/router';

import { provideAnimations } from '@angular/platform-browser/animations';

import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';

import { Wishlist } from './services/wishlist';

import { CartService } from './services/cart';

import { authInterceptor } from './services/auth.interceptor';

import { AuthService } from './services/auth.service';

import { MatBottomSheetModule } from '@angular/material/bottom-sheet';

export function initializeAuth(authService: AuthService) {
  return () => authService.initializeAuth();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),

    provideZoneChangeDetection({ eventCoalescing: true }),

    provideRouter(
      routes,
      withInMemoryScrolling({
        scrollPositionRestoration: 'top',
        anchorScrolling: 'enabled',
      }),
    ),

    provideAnimations(),

    importProvidersFrom(MatBottomSheetModule),

    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),

    Wishlist,

    CartService,

    {
      provide: APP_INITIALIZER,
      useFactory: initializeAuth,
      deps: [AuthService],
      multi: true,
    },
  ],
};
