import { Component, OnInit, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { filter } from 'rxjs/operators';

interface Breadcrumb {
  label: string;
  path: string;
}

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './breadcrumb.html',
  styleUrl: './breadcrumb.scss',
})
export class BreadcrumbComponent implements OnInit, OnChanges {
  @Input() selectedOrderNumber?: string;
  breadcrumbs: Breadcrumb[] = [];

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
  ) {}

  ngOnInit() {
    // Update breadcrumbs on route change
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.buildBreadcrumbs();
    });

    this.buildBreadcrumbs();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['selectedOrderNumber']) {
      this.buildBreadcrumbs();
    }
  }

  private buildBreadcrumbs() {
    const urlSegments = this.router.url.split('/').filter((segment) => segment);

    this.breadcrumbs = [];

    // Always start with Home
    this.breadcrumbs.push({
      label: 'Home',
      path: '/',
    });

    // Build breadcrumbs from URL segments
    let currentPath = '';
    for (let i = 0; i < urlSegments.length; i++) {
      const segment = urlSegments[i];
      currentPath += '/' + segment;

      // Skip certain segments
      if (segment === '') continue;

      // Format the label
      let label = this.formatLabel(segment);

      // For order detail page, include the order ID
      if (segment === 'orders' && i === urlSegments.length - 1) {
        // Check if previous segment was /account/orders
        if (i > 0 && urlSegments[i - 1] === 'account') {
          label = 'My Orders';
        }
      }

      this.breadcrumbs.push({
        label,
        path: currentPath,
      });
    }

    // For order details page, replace the last order ID with "Order Details"
    if (this.router.url.includes('/orders/') && !this.router.url.includes('/account')) {
      const lastBreadcrumb = this.breadcrumbs[this.breadcrumbs.length - 1];
      if (lastBreadcrumb && !isNaN(Number(lastBreadcrumb.label))) {
        lastBreadcrumb.label = 'Order #' + lastBreadcrumb.label;
      }
    }

    // Add selected order number to breadcrumbs if provided (for inline view)
    if (this.selectedOrderNumber) {
      this.breadcrumbs.push({
        label: 'Order #' + this.selectedOrderNumber,
        path: this.router.url,
      });
    }
  }

  private formatLabel(segment: string): string {
    // Handle specific cases
    const labelMap: { [key: string]: string } = {
      account: 'My Account',
      orders: 'My Orders',
      address: 'Manage Addresses',
      profile: 'Profile Information',
      checkout: 'Checkout',
      'product-detail': 'Product Detail',
      'new-in': 'New Arrivals',
      category: 'Category',
    };

    if (labelMap[segment]) {
      return labelMap[segment];
    }

    // Capitalize and replace hyphens with spaces
    return segment.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  navigate(path: string) {
    this.router.navigate([path]);
  }
}
