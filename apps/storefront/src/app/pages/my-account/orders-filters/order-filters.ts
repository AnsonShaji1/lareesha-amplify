import { Component, EventEmitter, Input, OnChanges, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

export interface FilterOptions {
  orderStatuses: string[];
  orderPeriods: string[];
}

@Component({
  selector: 'app-order-filters',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './order-filters.html',
  styleUrl: './order-filters.scss',
})
export class OrderFiltersComponent implements OnInit, OnChanges {
  @Input() open = false;
  @Output() filterChange = new EventEmitter<FilterOptions>();

  // Make Object available in template
  Object = Object;

  // Filter state - use backend status values as keys
  selectedStatuses: { [key: string]: boolean } = {
    pending: false,
    on_the_way: false,
    shipped: false,
    delivered: false,
    cancelled: false,
  };

  // UI labels for statuses
  statusLabels: { [key: string]: string } = {
    pending: 'Pending',
    on_the_way: 'On the way',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
  };

  selectedPeriods: { [key: string]: boolean } = {
    last_30_days: false,
    last_3_months: false,
    last_12_months: false,
  };

  periodLabels: { [key: string]: string } = {
    last_30_days: 'Last 30 days',
    last_3_months: 'Last 3 months',
    last_12_months: 'Last 12 months',
  };

  private appliedStatuses: { [key: string]: boolean } = { ...this.selectedStatuses };
  private appliedPeriods: { [key: string]: boolean } = { ...this.selectedPeriods };

  expandedSections = {
    status: true,
    period: true,
  };

  ngOnInit() {
    // Initialize with default filters
  }

  ngOnChanges() {
    if (!this.open) {
      this.selectedStatuses = { ...this.appliedStatuses };
      this.selectedPeriods = { ...this.appliedPeriods };
    }
  }

  toggleStatus(statusKey: string) {
    this.selectedStatuses[statusKey] = !this.selectedStatuses[statusKey];
  }

  togglePeriod(periodKey: string) {
    this.selectedPeriods[periodKey] = !this.selectedPeriods[periodKey];
  }

  toggleSection(section: 'status' | 'period') {
    this.expandedSections[section] = !this.expandedSections[section];
  }

  clearFilters() {
    this.selectedStatuses = {
      pending: false,
      on_the_way: false,
      shipped: false,
      delivered: false,
      cancelled: false,
    };

    this.selectedPeriods = {
      last_30_days: false,
      last_3_months: false,
      last_12_months: false,
    };
  }

  applyFilters() {
    this.appliedStatuses = { ...this.selectedStatuses };
    this.appliedPeriods = { ...this.selectedPeriods };
    this.emitFilterChange();
  }

  private emitFilterChange() {
    const selectedStatuses = Object.keys(this.selectedStatuses).filter(
      (status) => this.selectedStatuses[status],
    );

    const selectedPeriods = Object.keys(this.selectedPeriods).filter(
      (period) => this.selectedPeriods[period],
    );

    this.filterChange.emit({
      orderStatuses: selectedStatuses,
      orderPeriods: selectedPeriods,
    });
  }

  // Get count of active filters
  getActiveFilterCount(): number {
    const activeStatuses = Object.values(this.selectedStatuses).filter((v) => v).length;
    const activePeriods = Object.values(this.selectedPeriods).filter((v) => v).length;
    return activeStatuses + activePeriods;
  }
}
