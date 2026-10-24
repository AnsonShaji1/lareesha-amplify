import { Component, Inject, OnInit, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
} from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  MAT_BOTTOM_SHEET_DATA,
  MatBottomSheetRef,
} from '@angular/material/bottom-sheet';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NotificationService } from '../../services/notification.service';
import { AddressService, PincodeValidationResponse } from '../../services/address.service';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-address-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './address-dialog.html',
  styleUrl: './address-dialog.scss',
})
export class AddressDialogComponent implements OnInit {
  /** Rendered inside {@link MatBottomSheet} instead of full-screen overlay + card */
  readonly isBottomSheet: boolean;

  form: FormGroup;
  isLoading = false;
  isEditMode = false;
  isFirstAddress = false;
  isDefaultDisabled = false;
  isValidatingPincode = false;
  pincodeLookupError = '';
  pincodeSuggestions: string[] = [];
  private lastPincodeValidation: PincodeValidationResponse | null = null;
  locationAutoFilled = false;

  indianStates = [
    'Andhra Pradesh',
    'Arunachal Pradesh',
    'Assam',
    'Bihar',
    'Chhattisgarh',
    'Delhi',
    'Goa',
    'Gujarat',
    'Haryana',
    'Himachal Pradesh',
    'Jharkhand',
    'Karnataka',
    'Kerala',
    'Madhya Pradesh',
    'Maharashtra',
    'Manipur',
    'Meghalaya',
    'Mizoram',
    'Nagaland',
    'Odisha',
    'Punjab',
    'Rajasthan',
    'Sikkim',
    'Tamil Nadu',
    'Telangana',
    'Tripura',
    'Uttar Pradesh',
    'Uttarakhand',
    'West Bengal',
  ];

  /** Merged dialog or bottom-sheet payload */
  public readonly data: any;

  constructor(
    private fb: FormBuilder,
    private addressService: AddressService,
    private notificationService: NotificationService,
    @Optional() private dialogRef: MatDialogRef<AddressDialogComponent> | null,
    @Optional() private sheetRef: MatBottomSheetRef<AddressDialogComponent> | null,
    @Optional() @Inject(MAT_DIALOG_DATA) dialogData: unknown,
    @Optional() @Inject(MAT_BOTTOM_SHEET_DATA) sheetData: unknown,
  ) {
    this.isBottomSheet = sheetRef != null;
    this.data = (sheetData ?? dialogData ?? {}) as any;

    this.form = this.fb.group({
      full_name: ['', [Validators.required]],
      phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      email: ['', [Validators.required, Validators.email]],
      address_line_1: ['', [Validators.required]],
      address_line_2: [''],
      city: ['', [Validators.required]],
      state: ['', [Validators.required]],
      zip_code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
      country: ['India', [Validators.required]],
      is_default: [false],
    });
  }

  ngOnInit() {
    // If this is the first address (no addresses exist), make it default and disable the checkbox
    if (this.data && this.data.isFirstAddress) {
      this.isFirstAddress = true;
      this.isDefaultDisabled = true;
      this.form.patchValue({ is_default: true });
      // Disable the checkbox control
      this.form.get('is_default')?.disable({ emitEvent: false });
    }

    // If editing an existing address, populate form with its data
    if (this.data && this.data.id) {
      this.isEditMode = true;
      this.form.patchValue(this.data);
      // Re-enable the checkbox for editing (even if it was a first address initially)
      this.isDefaultDisabled = true; // Keep it disabled unless user explicitly decides
    }

    this.form
      .get('zip_code')
      ?.valueChanges.pipe(debounceTime(350), distinctUntilChanged())
      .subscribe((value) => this.handlePincodeChange(value));

    this.form
      .get('city')
      ?.valueChanges.pipe(debounceTime(150), distinctUntilChanged())
      .subscribe(() => this.validateLocationMatch());

    this.form
      .get('state')
      ?.valueChanges.pipe(distinctUntilChanged())
      .subscribe(() => this.validateLocationMatch());

    if (this.form.get('zip_code')?.value) {
      this.handlePincodeChange(this.form.get('zip_code')?.value);
    }
  }

  onSubmit() {
    this.validateLocationMatch();

    if (this.form.invalid || this.isValidatingPincode) {
      this.form.markAllAsTouched();
      this.notificationService.error('Please fill all required fields correctly');
      return;
    }

    this.isLoading = true;

    const payload = this.form.getRawValue();
    const operation = this.isEditMode
      ? this.addressService.updateAddress(this.data.id, payload)
      : this.addressService.createAddress(payload);

    operation.subscribe({
      next: (response: any) => {
        this.isLoading = false;
        const message = this.isEditMode
          ? 'Address updated successfully'
          : 'Address added successfully';
        this.notificationService.success(message);
        this.dismissWithResult(true);
      },
      error: (error: any) => {
        this.isLoading = false;
        this.notificationService.error(
          error?.message || error?.error?.error || 'Failed to save address',
        );
      },
    });
  }

  onCancel() {
    this.dismissWithResult(false);
  }

  private dismissWithResult(success: boolean): void {
    this.dialogRef?.close(success);
    this.sheetRef?.dismiss(success);
  }

  private handlePincodeChange(value: string) {
    const normalized = (value || '').replace(/\D/g, '').slice(0, 6);
    if (value !== normalized) {
      this.form.get('zip_code')?.setValue(normalized, { emitEvent: false });
    }

    this.pincodeLookupError = '';
    this.pincodeSuggestions = [];
    this.lastPincodeValidation = null;
    this.locationAutoFilled = false;
    this.clearPincodeValidationErrors();

    if (normalized.length === 0) {
      return;
    }

    if (normalized.length !== 6) {
      this.form.get('zip_code')?.setErrors({ ...(this.form.get('zip_code')?.errors || {}), invalidLength: true });
      return;
    }

    this.isValidatingPincode = true;
    this.addressService.validatePincode(normalized).subscribe({
      next: (response) => {
        this.isValidatingPincode = false;
        this.applyPincodeValidationResponse(response);
      },
      error: (error) => {
        this.isValidatingPincode = false;
        this.pincodeLookupError =
          error?.error?.error || 'Unable to validate this pincode right now. Please try again.';
        this.form.get('zip_code')?.setErrors({ ...(this.form.get('zip_code')?.errors || {}), lookupFailed: true });
      },
    });
  }

  private applyPincodeValidationResponse(response: PincodeValidationResponse) {
    if (!response.valid) {
      this.pincodeLookupError = response.error || 'Invalid pincode';
      this.form.get('zip_code')?.setErrors({ ...(this.form.get('zip_code')?.errors || {}), invalidPincode: true });
      return;
    }

    this.lastPincodeValidation = response;
    this.pincodeSuggestions = (response.post_offices || []).map((office) => office.name).filter(Boolean);
    this.autoFillCityStateFromPincode(response);
    this.validateLocationMatch(response);
  }

  private autoFillCityStateFromPincode(response: PincodeValidationResponse) {
    const cityControl = this.form.get('city');
    const stateControl = this.form.get('state');
    if (!cityControl || !stateControl) {
      return;
    }

    const cities = (response.cities || []).filter(Boolean);
    const states = (response.states || []).filter(Boolean);

    const currentCity = this.normalizeLocationValue(cityControl.value);
    const currentState = this.normalizeLocationValue(stateControl.value);

    const pickIfNeeded = (
      control: AbstractControl,
      currentNormalized: string,
      candidates: string[],
    ): boolean => {
      if (candidates.length === 0) {
        return false;
      }
      const normalizedCandidates = candidates.map((c) => this.normalizeLocationValue(c));
      const currentMatches = currentNormalized.length > 0 && normalizedCandidates.includes(currentNormalized);

      // If empty or mismatch, force to first (deterministic).
      if (!currentMatches) {
        control.setValue(candidates[0], { emitEvent: true });
        return true;
      }
      return false;
    };

    const cityChanged = pickIfNeeded(cityControl, currentCity, cities);
    const stateChanged = pickIfNeeded(stateControl, currentState, states);

    this.locationAutoFilled = cityChanged || stateChanged;
  }

  private validateLocationMatch(response?: PincodeValidationResponse) {
    const zipControl = this.form.get('zip_code');
    const cityControl = this.form.get('city');
    const stateControl = this.form.get('state');

    if (!zipControl || !cityControl || !stateControl) {
      return;
    }

    const city = this.normalizeLocationValue(cityControl.value);
    const state = this.normalizeLocationValue(stateControl.value);
    const hasCity = city.length > 0;
    const hasState = state.length > 0;

    const clearError = (control: AbstractControl | null, key: string) => {
      if (!control?.errors?.[key]) {
        return;
      }
      const nextErrors = { ...(control.errors || {}) };
      delete nextErrors[key];
      control.setErrors(Object.keys(nextErrors).length ? nextErrors : null);
    };

    clearError(cityControl, 'pincodeCityMismatch');
    clearError(stateControl, 'pincodeStateMismatch');

    const effectiveResponse = response ?? this.lastPincodeValidation;

    if (!effectiveResponse || !effectiveResponse.valid || !hasCity || !hasState) {
      return;
    }

    const matchedCity = (effectiveResponse.cities || []).some(
      (item) => this.normalizeLocationValue(item) === city,
    );
    const matchedState = (effectiveResponse.states || []).some(
      (item) => this.normalizeLocationValue(item) === state,
    );

    if (!matchedCity) {
      cityControl.setErrors({ ...(cityControl.errors || {}), pincodeCityMismatch: true });
    }

    if (!matchedState) {
      stateControl.setErrors({ ...(stateControl.errors || {}), pincodeStateMismatch: true });
    }
  }

  private clearPincodeValidationErrors() {
    const zipControl = this.form.get('zip_code');
    const cityControl = this.form.get('city');
    const stateControl = this.form.get('state');

    [zipControl, cityControl, stateControl].forEach((control) => {
      if (!control?.errors) {
        return;
      }
      const nextErrors = { ...(control.errors || {}) };
      delete nextErrors['invalidLength'];
      delete nextErrors['invalidPincode'];
      delete nextErrors['lookupFailed'];
      delete nextErrors['pincodeCityMismatch'];
      delete nextErrors['pincodeStateMismatch'];
      control.setErrors(Object.keys(nextErrors).length ? nextErrors : null);
    });
  }

  private normalizeLocationValue(value: string): string {
    return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }
}
