import { EnvironmentInjector, Injectable, inject } from '@angular/core';
import type { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';

/** Non-blocking messages; replaces alert(). The snackbar module loads on the first message. */
@Injectable({ providedIn: 'root' })
export class NotifyService {
  private injector = inject(EnvironmentInjector);
  private snack?: Promise<MatSnackBar>;

  info(message: string): void {
    this.show(message, 'OK', { duration: 4000 });
  }

  error(message: string): void {
    this.show(message, 'Dismiss', { duration: 4000, panelClass: 'snack-error', politeness: 'assertive' });
  }

  private show(message: string, action: string, config: MatSnackBarConfig): void {
    this.snack ??= import('@angular/material/snack-bar').then((m) => this.injector.get(m.MatSnackBar));
    this.snack.then((snack) => snack.open(message, action, config)).catch((error) => console.error(message, error));
  }
}
