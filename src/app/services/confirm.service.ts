import { Injectable, inject } from '@angular/core';
import type { ConfirmData } from '../components/confirm-dialog/confirm-dialog';
import { DIALOGS, DialogLoader } from './dialog-loader.service';

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private dialogs = inject(DialogLoader);

  async ask(data: ConfirmData): Promise<boolean> {
    return (await this.dialogs.open<boolean>(DIALOGS.confirm, { data, maxWidth: '480px', width: '100%' })) === true;
  }
}
