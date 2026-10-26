import { Component, OnInit, OnDestroy, inject, Injector, afterNextRender } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule, MatRadioChange } from '@angular/material/radio';
import { CartService, CartItem } from '../../services/cart';
import { NotificationService } from '../../services/notification.service';
import { AddressService, Address } from '../../services/address.service';
import { AddressEditorOpenerService } from '../../services/address-editor-opener.service';
import { ApiService, CreateOrderResponse } from '../../services/api.service';
import { RazorpayService, RazorpayResponse } from '../../services/razorpay.service';
import { Subscription, finalize } from 'rxjs';

@Component({
  selector: 'app-checkout-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatRadioModule],
  templateUrl: './checkout-page.html',
  styleUrl: './checkout-page.scss',
})
export class CheckoutPage implements OnInit, OnDestroy {
  private readonly injector = inject(Injector);

  cartItems: CartItem[] = [];
  subtotal = 0;
  shipping = 0;
  tax = 0;
  total = 0;
  /** True when no delivery address is selected yet, so shipping is excluded from the total. */
  shippingPendingAddress = false;
  private totalsRequestId = 0;
  private totalsKey = '';
  private addressesLoaded = false;
  orderPlaced = false;
  orderNumber = '';
  orderId: string | null = null;
  isProcessing = false;
  currentRazorpayOrderId = ''; // Store for payment cancellation
  private timerInterval: any;

  indianStates = [
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chhattisgarh",
    "Delhi",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal"
  ];

  checkoutForm = {
    firstName: '',
    lastName: '',
    address: '',
    apartment: '',
    zipCode: '',
    state: '',
    country: 'India',
    phone: '',
    city: '',
  };

  // Address management properties
  savedAddresses: Address[] = [];
  selectedAddressId: string | null = null;

  private subscription?: Subscription;

  constructor(
    private cartService: CartService,
    private router: Router,
    private notificationService: NotificationService,
    private addressService: AddressService,
    private apiService: ApiService,
    private razorpayService: RazorpayService,
    private addressEditorOpener: AddressEditorOpenerService,
  ) {}

  lineItemTotal(item: CartItem): number {
    const raw = item.product.salePrice;
    const price = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
    const safe = Number.isFinite(price) ? price : 0;
    return safe * item.quantity;
  }

  formatRupees(amount: number): string {
    const safe = Number.isFinite(amount) ? amount : 0;
    return Number.isInteger(safe) ? `₹${safe}` : `₹${safe.toFixed(2)}`;
  }

  ngOnInit() {
    this.subscription = this.cartService.cartItems$.subscribe((items: CartItem[]) => {
      this.cartItems = items;
      if (items.length === 0 && !this.orderPlaced) {
        this.router.navigate(['/']);
        return;
      }
      if (this.addressesLoaded) this.queueTotals();
    });

    // Load saved addresses
    this.loadSavedAddresses();
  }

  loadSavedAddresses() {
    this.addressService.getAddresses().subscribe({
      next: (addresses: Address[]) => {
        this.savedAddresses = addresses;
        // Auto-select default address if available
        const defaultAddress = addresses.find((a) => a.is_default);
        const first = addresses[0];
        const toSelect = defaultAddress ?? first ?? null;
        if (toSelect) {
          this.selectedAddressId = toSelect.id;
        }
        this.addressesLoaded = true;
        this.queueTotals(toSelect?.id);
      },
      error: (error) => {
        console.error('Error loading addresses:', error);
        this.addressesLoaded = true;
        this.queueTotals();
      },
    });
  }

  openAddressDialog() {
    this.addressEditorOpener
      .open({ isNew: true, isFirstAddress: this.savedAddresses.length === 0 })
      .subscribe((result) => {
        if (result) {
          this.loadSavedAddresses();
        }
      });
  }

  editAddress(address: Address) {
    this.addressEditorOpener.open({ ...address, isNew: false }).subscribe((result) => {
      if (result) {
        this.loadSavedAddresses();
      }
    });
  }

  deleteAddress(address: Address) {
    if (confirm(`Are you sure you want to delete the address: ${address.full_name}?`)) {
      this.addressService.deleteAddress(address.id).subscribe({
        next: () => {
          this.notificationService.success('Address deleted successfully');
          // If the deleted address was selected, clear the selection
          if (this.selectedAddressId === address.id) {
            this.selectedAddressId = null;
          }
          // If the deleted address was default and there are other addresses, set another as default
          if (address.is_default) {
            const remainingAddresses = this.savedAddresses.filter((a) => a.id !== address.id);
            if (remainingAddresses.length > 0) {
              const firstRemainingAddress = remainingAddresses[0];
              this.addressService.setDefaultAddress(firstRemainingAddress.id).subscribe({
                next: () => {
                  this.loadSavedAddresses();
                },
                error: (error) => {
                  console.error('Error setting default address:', error);
                  this.loadSavedAddresses();
                },
              });
            } else {
              this.loadSavedAddresses();
            }
          } else {
            this.loadSavedAddresses();
          }
        },
        error: (error) => {
          console.error('Error deleting address:', error);
          this.notificationService.error('Failed to delete address');
        },
      });
    }
  }

  selectAddress(addressId: string) {
    this.selectedAddressId = addressId;
    this.queueTotals(addressId);
  }

  /**
   * Fires when the user picks an address via the radio control (card click uses selectAddress).
   * Without this, shipping never recalculates when only the radio is used.
   */
  onShippingAddressChange(event: MatRadioChange) {
    const id = event.value as string | null;
    if (id == null) {
      this.queueTotals();
      return;
    }
    this.selectedAddressId = id;
    this.queueTotals(id);
  }

  formatPhoneNumber(event: any) {
    let value = event.target.value.replace(/\D/g, '');
    if (value.length > 10) {
      value = value.slice(0, 10);
    }
    if (value.length > 0) {
      if (value.length <= 5) {
        event.target.value = value;
      } else {
        event.target.value = `${value.slice(0, 5)} ${value.slice(5)}`;
      }
    }
    this.checkoutForm.phone = value;
  }

  formatPinCode(event: any) {
    let value = event.target.value.replace(/\D/g, '');
    if (value.length > 6) {
      value = value.slice(0, 6);
    }
    event.target.value = value;
    this.checkoutForm.zipCode = value;
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  private queueTotals(addressId?: string) {
    if (!this.cartItems.length) return;
    const id = addressId ?? this.selectedAddressId ?? '';
    const cartKey = this.cartItems.map((item) => `${item.product.id}:${item.quantity}`).join(',');
    const key = `${id}|${cartKey}`;
    if (key === this.totalsKey) return;
    this.totalsKey = key;
    this.calculateTotals(id || undefined);
  }

  calculateTotals(addressId?: string) {
    // Totals include flat store shipping from the Shipping settings row.
    const shippingAddressId = addressId ?? this.selectedAddressId ?? undefined;
    const requestId = ++this.totalsRequestId;
    this.apiService.calculateTotals(shippingAddressId).subscribe({
      next: (response) => {
        if (requestId !== this.totalsRequestId) return;
        const pending = response.shipping_pending_address === true;
        this.applyDisplayedTotals({
          subtotal: Number(response.subtotal) || 0,
          tax: Number(response.tax) || 0,
          shipping: pending ? 0 : Number(response.shipping) || 0,
          pending,
        });
      },
      error: (error: any) => {
        if (requestId !== this.totalsRequestId) return;
        this.totalsKey = '';
        console.error('Error calculating totals:', error);
        if (!shippingAddressId) {
          this.applyDisplayedTotals({
            subtotal: this.cartService.getTotal(),
            tax: this.estimateMerchandiseTax(),
            shipping: 0,
            pending: true,
          });
          return;
        }
        this.notificationService.error('Could not calculate shipping for this address');
      },
    });
  }

  /** Rows on screen must add up. Pending shipping is omitted from the total. */
  private applyDisplayedTotals(parts: {
    subtotal: number;
    tax: number;
    shipping: number;
    pending: boolean;
  }) {
    this.subtotal = this.roundMoney(parts.subtotal);
    this.tax = this.roundMoney(parts.tax);
    this.shippingPendingAddress = parts.pending;
    this.shipping = parts.pending ? 0 : this.roundMoney(parts.shipping);
    this.total = this.roundMoney(this.subtotal + this.shipping + this.tax);
  }

  private estimateMerchandiseTax(): number {
    return this.cartItems.reduce((sum, item) => {
      const raw = item.product.salePrice;
      const price = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
      const safe = Number.isFinite(price) ? price : 0;
      const bps = Number(item.product.taxPercentageBps) || 0;
      return sum + (safe * item.quantity * bps) / 10000;
    }, 0);
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  placeOrder() {
    // Validate address selection
    if (!this.selectedAddressId) {
      this.notificationService.warning(
        this.savedAddresses.length === 0
          ? 'Please add a delivery address before placing your order.'
          : 'Please select a delivery address before placing your order.',
      );
      return;
    }

    const selectedAddress = this.savedAddresses.find((a) => a.id === this.selectedAddressId);
    if (!selectedAddress) {
      this.notificationService.error('Please select a valid address');
      return;
    }

    // Validate cart is not empty
    if (this.cartItems.length === 0) {
      this.notificationService.error('Your cart is empty');
      return;
    }

    this.isProcessing = true;

    // Prepare order data - only send shipping_address_id
    const orderData = {
      shipping_address_id: selectedAddress.id,
    };

    // Call backend to create order and get Razorpay details
    this.apiService.createOrder(orderData).subscribe({
      next: (response: CreateOrderResponse) => {
        this.orderNumber = response.order_number;
        this.orderId = response.id; // Store order ID for post-payment navigation
        this.openRazorpayPayment(response, selectedAddress);
      },
      error: (error: any) => {
        this.isProcessing = false;
        console.error('Error creating order:', error);
        const errorMessage = error.error?.error || 'Failed to create order';
        this.notificationService.error(errorMessage);
      },
    });
  }

  openRazorpayPayment(orderResponse: CreateOrderResponse, address: Address) {
    // Ensure razorpay_order_id is present
    if (!orderResponse.razorpay_order_id) {
      this.notificationService.error('Failed to initialize payment. Please try again.');
      this.isProcessing = false;
      return;
    }

    // Store order ID for cancellation handling
    this.currentRazorpayOrderId = orderResponse.razorpay_order_id;

    const options = {
      key: orderResponse.razorpay_key,
      amount: orderResponse.amount,
      currency: 'INR',
      name: 'Lareesha Luxe',
      description: `Order ${orderResponse.order_number}`,
      order_id: orderResponse.razorpay_order_id,
      timeout: 900, // 15 minutes timeout in seconds (matches STOCK_RESERVATION_MINUTES)
      method: {
        upi: true, // 👈 enables UPI properly
      },
      prefill: {
        name: address.full_name,
        email: address.email,
        contact: address.phone,
      },
      theme: {
        color: '#D4AF37', // Gold color for luxury brand
      },
      handler: (response: RazorpayResponse) => {
        this.verifyPayment(response);
      },
      modal: {
        ondismiss: () => {
          // User cancelled payment - release stock reservation
          this.isProcessing = false;
          if (this.timerInterval) {
            clearInterval(this.timerInterval);
          }
          this.notificationService.warning('Payment cancelled');
          // Call payment_failed to release stock immediately, then return home
          if (this.currentRazorpayOrderId) {
            this.apiService
              .paymentFailed(this.currentRazorpayOrderId)
              .pipe(
                finalize(() => {
                  this.cartService.clearCart();
                  this.router.navigate(['/']);
                }),
              )
              .subscribe({
                next: (response) => {
                  console.log('Stock released after payment cancellation:', response);
                },
                error: (error) => {
                  console.error('Error releasing stock:', error);
                },
              });
          } else {
            this.cartService.clearCart();
            this.router.navigate(['/']);
          }
        },
      },
    };

    this.razorpayService.openPaymentModal(options);
  }

  verifyPayment(response: RazorpayResponse) {
    const verificationData = {
      razorpay_order_id: response.razorpay_order_id,
      razorpay_payment_id: response.razorpay_payment_id,
      razorpay_signature: response.razorpay_signature,
    };

    this.apiService.verifyPayment(verificationData).subscribe({
      next: (order) => {
        // Clear timer on successful payment
        if (this.timerInterval) {
          clearInterval(this.timerInterval);
        }

        // Payment successful
        this.isProcessing = false;
        this.notificationService.success('Payment successful!');
        this.orderPlaced = true;

        // User often returns from Razorpay with scroll still at the bottom; success UI is at the top
        afterNextRender(
          () => {
            globalThis.scrollTo?.({ top: 0, left: 0, behavior: 'smooth' });
          },
          { injector: this.injector },
        );

        // Clear cart after successful order
        this.cartService.clearCart();

        // Redirect to order detail page
        setTimeout(() => {
          if (this.orderId) {
            this.router.navigate(['/order', this.orderId]);
          } else {
            // Fallback to home if order ID is not available
            this.router.navigate(['/']);
          }
        }, 6000);
      },
      error: (error: any) => {
        // Clear timer on payment failure
        if (this.timerInterval) {
          clearInterval(this.timerInterval);
        }

        // Payment verification failed (invalid signature)
        this.isProcessing = false;
        console.error('Payment verification failed:', error);

        // Backend already:
        // - Set order status to 'payment_failed'
        // - Set payment_status to 'failed'
        // - Released stock reservations
        // So no need to call paymentFailed API again

        this.notificationService.error(
          'Payment verification failed. Please try again or contact support.',
        );
      },
    });
  }

}
