import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { isBlank } from '../../core/url';

export interface NameDialogData {
  title: string;
  label: string;
  initial?: string;
  confirmText: string;
}

/** Create/rename a group or a section. Closes with the trimmed name, or undefined on cancel. */
@Component({
  selector: 'app-name-dialog',
  imports: [FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title class="!text-white">{{ data.title }}</h2>
    <form (ngSubmit)="submit()" class="px-6">
      <mat-form-field class="w-full" appearance="outline">
        <mat-label class="!text-white/70">{{ data.label }}</mat-label>
        <input matInput class="!text-white" name="name" [ngModel]="name()" (ngModelChange)="name.set($event)" cdkFocusInitial />
      </mat-form-field>
    </form>
    <mat-dialog-actions align="end">
      <button class="!text-white" mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button [disabled]="blank()" (click)="submit()">{{ data.confirmText }}</button>
    </mat-dialog-actions>
  `,
})
export class NameDialog {
  readonly data = inject<NameDialogData>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<NameDialog, string>);
  readonly name = signal(this.data.initial ?? '');

  blank(): boolean {
    return isBlank(this.name());
  }

  submit(): void {
    if (this.blank()) return;
    this.ref.close(this.name().trim());
  }
}
