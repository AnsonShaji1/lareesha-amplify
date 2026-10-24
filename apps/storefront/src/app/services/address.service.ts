import { Injectable } from '@angular/core';
import { Observable, from, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { dataClient } from '../amplify-client';
import { AuthService } from './auth.service';

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
  updated_at: string;
}

export interface PincodeValidationResponse {
  valid: boolean;
  pincode?: string;
  cities?: string[];
  states?: string[];
  post_offices?: Array<{
    name: string;
    city: string;
    state: string;
  }>;
  error?: string;
}

function mapAddress(row: any): Address {
  return {
    id: row.id,
    full_name: row.fullName,
    phone: row.phone,
    email: row.email,
    address_line_1: row.addressLine1,
    address_line_2: row.addressLine2,
    city: row.city,
    state: row.state,
    zip_code: row.zipCode,
    country: row.country,
    is_default: !!row.isDefault,
    created_at: row.createdAtIso || row.createdAt,
    updated_at: row.updatedAt,
  };
}

@Injectable({
  providedIn: 'root',
})
export class AddressService {
  private addressesSubject = new BehaviorSubject<Address[]>([]);
  public addresses$ = this.addressesSubject.asObservable();

  constructor(private auth: AuthService) {}

  getAddresses(): Observable<Address[]> {
    return from(dataClient.models.Address.list({})).pipe(
      map((result: any) => (result.data || []).map(mapAddress)),
      tap((addresses) => this.addressesSubject.next(addresses)),
    );
  }

  getDefaultAddress(): Observable<Address> {
    return this.getAddresses().pipe(
      map((addresses) => {
        const match = addresses.find((row) => row.is_default) || addresses[0];
        if (!match) throw new Error('No default address set');
        return match;
      }),
    );
  }

  createAddress(address: Omit<Address, 'id' | 'created_at' | 'updated_at'>): Observable<Address> {
    return from(
      dataClient.models.Address.create({
        fullName: address.full_name,
        phone: address.phone,
        email: address.email,
        addressLine1: address.address_line_1,
        addressLine2: address.address_line_2,
        city: address.city,
        state: address.state,
        zipCode: address.zip_code,
        country: address.country || 'India',
        isDefault: address.is_default === true,
        userId: this.auth.currentUserValue?.id || '',
        createdAtIso: new Date().toISOString(),
      }),
    ).pipe(
      map((result: any) => {
        if (result.errors?.length || !result.data) {
          throw result.errors?.[0] || new Error('Could not save the address');
        }
        return mapAddress(result.data);
      }),
    );
  }

  updateAddress(id: string, address: Partial<Address>): Observable<Address> {
    return from(
      dataClient.models.Address.update({
        id,
        fullName: address.full_name,
        phone: address.phone,
        email: address.email,
        addressLine1: address.address_line_1,
        addressLine2: address.address_line_2,
        city: address.city,
        state: address.state,
        zipCode: address.zip_code,
        country: address.country,
        isDefault: address.is_default === true,
      }),
    ).pipe(
      map((result: any) => {
        if (result.errors?.length || !result.data) {
          throw result.errors?.[0] || new Error('Could not update the address');
        }
        return mapAddress(result.data);
      }),
    );
  }

  deleteAddress(id: string): Observable<unknown> {
    return from(dataClient.models.Address.delete({ id }));
  }

  setDefaultAddress(id: string): Observable<Address> {
    return from(dataClient.mutations.setDefaultAddress({ addressId: id })).pipe(
      map((result: any) => mapAddress(result.data)),
    );
  }

  validatePincode(pincode: string): Observable<PincodeValidationResponse> {
    return from(dataClient.queries.validatePincode({ pincode })).pipe(
      map((result: any) => {
        const row = result.data;
        return {
          valid: !!row?.valid,
          pincode: row?.pincode || undefined,
          cities: (row?.cities || []).filter((v: unknown): v is string => !!v),
          states: (row?.states || []).filter((v: unknown): v is string => !!v),
          post_offices: (row?.postOffices || []).map((office: any) => ({
            name: office?.name || '',
            city: office?.city || '',
            state: office?.state || '',
          })),
          error: row?.error || undefined,
        };
      }),
    );
  }
}
