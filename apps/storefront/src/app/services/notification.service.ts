import { Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';
@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(private snackBar: MatSnackBar) {}
  success(message: string, duration: number = 4000) {
    this.show(message, 'success', duration);
  }
  error(message: string, duration: number = 5000) {
    this.show(message, 'error', duration);
  }
  warning(message: string, duration: number = 4000) {
    this.show(message, 'warning', duration);
  }
  info(message: string, duration: number = 4000) {
    this.show(message, 'info', duration);
  }
  private show(message: string, type: 'success' | 'error' | 'warning' | 'info', duration: number) {
    const config: MatSnackBarConfig = {
      duration,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass: [`snackbar-${type}`, 'snackbar-offset'],
    };
    this.snackBar.open(message, 'X', config);
  }
}
