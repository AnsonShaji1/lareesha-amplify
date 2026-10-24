import { Injectable } from '@angular/core';

import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class CheckoutHandler {
  constructor(private router: Router) {}

  requestCheckout() {
    console.log('CheckoutHandler: navigating to /checkout');

    this.router.navigate(['/checkout']);
  }
}
