import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/** Non-blocking messages; replaces alert(). */
@Injectable({ providedIn: 'root' })
export class NotifyService {
  private snack = inject(MatSnackBar);

  info(message: string): void {
    this.snack.open(message, 'OK', { duration: 4000 });
  }

  error(message: string): void {
    this.snack.open(message, 'Dismiss', { duration: 4000, panelClass: 'snack-error', politeness: 'assertive' });
  }
}
