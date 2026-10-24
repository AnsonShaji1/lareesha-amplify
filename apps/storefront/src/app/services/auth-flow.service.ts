import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthFlowService {
  private checkoutPendingAfterLogin = false;

  markCheckoutPending(): void {
    this.checkoutPendingAfterLogin = true;
  }

  consumeCheckoutPending(): boolean {
    const v = this.checkoutPendingAfterLogin;
    this.checkoutPendingAfterLogin = false;
    return v;
  }
}

