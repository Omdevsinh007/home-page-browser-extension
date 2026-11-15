import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { ConfirmData, ConfirmDialog } from '../components/confirm-dialog/confirm-dialog';

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private dialog = inject(MatDialog);

  async ask(data: ConfirmData): Promise<boolean> {
    const ref = this.dialog.open(ConfirmDialog, { data, maxWidth: '480px', width: '100%' });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }
}
