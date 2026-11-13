import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { isBlank, isUnsafeUrl, normalizeUrl } from '../../core/url';

export interface LinkDialogData {
  title: 'Add link' | 'Edit link' | 'Add shortcut' | 'Edit shortcut';
  initial?: { name: string; url: string };
}

export interface LinkDialogResult {
  name: string;
  url: string;
}

const notBlank = (c: AbstractControl): ValidationErrors | null => (isBlank(c.value) ? { whitespace: true } : null);
const safeUrl = (c: AbstractControl): ValidationErrors | null => (isUnsafeUrl(c.value ?? '') ? { unsafe: true } : null);

/** Add/edit a shortcut or a link inside a section. Replaces shortcut-dialog and group-shortcut. */
@Component({
  selector: 'app-link-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4 px-6 pt-2">
      <mat-form-field class="w-full" appearance="outline">
        <mat-label>Name</mat-label>
        <input matInput formControlName="name" cdkFocusInitial />
        @if (form.controls.name.invalid) {
          <mat-error>This field is required</mat-error>
        }
      </mat-form-field>
      <mat-form-field class="w-full" appearance="outline">
        <mat-label>URL</mat-label>
        <input matInput formControlName="url" />
        @if (form.controls.url.hasError('unsafe')) {
          <mat-error>This URL type is not allowed</mat-error>
        } @else if (form.controls.url.invalid) {
          <mat-error>This field is required</mat-error>
        }
      </mat-form-field>
      <button type="submit" hidden></button>
    </form>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button (click)="submit()">Save</button>
    </mat-dialog-actions>
  `,
})
export class LinkDialog {
  readonly data = inject<LinkDialogData>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<LinkDialog, LinkDialogResult>);

  readonly form = inject(NonNullableFormBuilder).group({
    name: [this.data.initial?.name ?? '', [Validators.required, notBlank]],
    url: [this.data.initial?.url ?? '', [Validators.required, notBlank, safeUrl]],
  });

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const { name, url } = this.form.getRawValue();
    this.ref.close({ name: name.trim(), url: normalizeUrl(url) });
  }
}
