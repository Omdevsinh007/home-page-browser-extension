import { Component, inject, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { Shortcut } from '../../models/shortcut';
import { SaveLinks } from '../../services/save-links';

@Component({
  selector: 'app-shortcut-dialog',
  imports: [MatFormFieldModule, MatDialogModule, ReactiveFormsModule, MatInput, MatButtonModule],
  templateUrl: './shortcut-dialog.html',
  styleUrl: './shortcut-dialog.css'
})
export class ShortcutDialog implements OnInit {
  private dialogRef = inject(MatDialogRef<ShortcutDialog>);
  private fb = inject(FormBuilder);
  private service = inject(SaveLinks);
  data = inject<Shortcut>(MAT_DIALOG_DATA);

  shortcutForm = this.fb.group({
    name: ['', [Validators.required, this.checkForEmptySpaces]],
    url: ['', [Validators.required, this.checkForEmptySpaces]],
  });

  shortcutDataLength = 0

  ngOnInit(): void {
    if(this.data) {
      this.shortcutForm.patchValue({
        name: this.data.name,
        url: this.data.url
      })
    }
    this.service.getSavedLinks().subscribe({
      next:(data) => {
        this.shortcutDataLength = data.length;
      }
    })
  }

  async addShortcut() {
    if(this.shortcutForm.get('name')?.value?.trim()! === '' || this.shortcutForm.get('url')?.value?.trim()! === '') {
      this.shortcutForm.markAllAsDirty();
      this.shortcutForm.markAllAsTouched();
      this.shortcutForm.updateValueAndValidity();
      return;
    }
    const shortcut: Shortcut = {
      id: this.data ?  this.data.id : crypto.randomUUID(),
      position: this.data ?  this.data.position : this.shortcutDataLength,
      type: "Shortcut",
      name: this.shortcutForm.get('name')?.value?.trim()!,
      url: this.modifyUrl(this.shortcutForm.get('url')?.value?.trim()!),
      group: null
    }
    try {
      await this.service.addSavedLink(shortcut);
    } catch(err) {
      console.log({})
    }
    this.dialogRef.close();
  }

  checkForEmptySpaces(control: AbstractControl): ValidationErrors | null {
    const value = control.value || '';
    if (typeof value === 'string' && value.trim() === '') {
      return { whitespace: true };
    }
    return null;
  }

  modifyUrl(url: string) {
    // Check if it already starts with http:// or https://
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    return url;
  }
}
