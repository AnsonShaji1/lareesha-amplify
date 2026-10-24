import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Don't inject AuthService here it causes circular dependency

  // Instead, directly access localStorage

  if (typeof window !== 'undefined' && localStorage) {
    const token = localStorage.getItem('access_token');

    // Clone the request and add the authorization header if token exists

    if (token) {
      req = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      });
    }
  }

  return next(req);
};
