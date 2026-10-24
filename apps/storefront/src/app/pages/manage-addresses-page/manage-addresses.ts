import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { NotificationService } from '../../services/notification.service';
import { AddressService } from '../../services/address.service';
import { AddressEditorOpenerService } from '../../services/address-editor-opener.service';

export interface Address {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  is_default: boolean;
  created_at: string;
}

@Component({
  selector: 'app-manage-addresses',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './manage-addresses.html',
  styleUrl: './manage-addresses.scss',
})
export class ManageAddressesComponent implements OnInit {
  addresses: Address[] = [];
  isLoading = false;

  constructor(
    private addressService: AddressService,
    private notificationService: NotificationService,
    private addressEditorOpener: AddressEditorOpenerService,
  ) {}

  ngOnInit() {
    this.loadAddresses();
  }

  loadAddresses() {
    this.isLoading = true;
    this.addressService.getAddresses().subscribe({
      next: (data) => {
        this.addresses = data;
        this.isLoading = false;
      },
      error: (error) => {
        this.isLoading = false;
        this.notificationService.error('Failed to load addresses');
      },
    });
  }

  openAddDialog() {
    this.addressEditorOpener.open(null).subscribe((result) => {
      if (result) {
        this.loadAddresses();
      }
    });
  }

  editAddress(address: Address) {
    this.addressEditorOpener.open(address).subscribe((result) => {
      if (result) {
        this.loadAddresses();
      }
    });
  }

  deleteAddress(address: Address) {
    if (confirm('Are you sure you want to delete this address?')) {
      this.addressService.deleteAddress(address.id).subscribe({
        next: () => {
          this.notificationService.success('Address deleted successfully');
          this.loadAddresses();
        },
        error: () => {
          this.notificationService.error('Failed to delete address');
        },
      });
    }
  }

  setDefault(address: Address) {
    this.addressService.setDefaultAddress(address.id).subscribe({
      next: () => {
        this.notificationService.success('Default address updated');
        this.loadAddresses();
      },
      error: () => {
        this.notificationService.error('Failed to update default address');
      },
    });
  }
}
