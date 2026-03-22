import { Component, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatInput } from '@angular/material/input';
import { Shortcut } from '../../models/shortcut';
import { SaveLinks } from '../../services/save-links';
import { MatFormFieldModule } from '@angular/material/form-field';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-group-shortcut',
  imports: [MatDialogModule, MatDialogModule, ReactiveFormsModule, MatInput, MatButtonModule, MatFormFieldModule],
  templateUrl: './group-shortcut.html',
  styleUrl: './group-shortcut.css'
})
export class GroupShortcut {
  private dialogRef = inject(MatDialogRef<GroupShortcut>)
  private fb = inject(FormBuilder);
  private service = inject(SaveLinks);
  data = inject<{ shortcut:Shortcut, index:number, isNewGroup: boolean }>(MAT_DIALOG_DATA);

  shortcutForm = this.fb.group({
    name: ['', [Validators.required, this.checkForEmptySpaces]],
    url: ['', [Validators.required, this.checkForEmptySpaces]],
  });

  ngOnInit(): void {
    if(this.data?.shortcut && !this.data.isNewGroup) {
      this.shortcutForm.patchValue({
        name: this.data.shortcut.group?.[this.data.index]?.name,
        url: this.data.shortcut.group?.[this.data.index]?.url
      })
    }
  }

  shortcuts = this.service.getSavedLinks();

  async addShortcut() {
    if(this.shortcutForm.get('name')?.value?.trim()! === '' || this.shortcutForm.get('url')?.value?.trim()! === '') {
      this.shortcutForm.markAllAsDirty();
      this.shortcutForm.markAllAsTouched();
      this.shortcutForm.updateValueAndValidity();
      return;
    }
    const data = await firstValueFrom(this.shortcuts);
    const group = data.filter((data => data.id === this.data.shortcut.id))[0]?.group || [];
    const newGroup = {
      id: crypto.randomUUID(),
      name: this.shortcutForm.get('name')?.value?.trim()!,
      url: this.modifyUrl(this.shortcutForm.get('url')?.value?.trim()!),
      position: group.length
    }

    group.push(newGroup);

    const shortcut: Shortcut = {
      id: this.data.shortcut?.id,
      type: "Group",
      name: this.data.shortcut.name,
      url: null,
      group: group,
      position: this.data.shortcut?.position
    }
    await this.service.addSavedLink(shortcut);
    this.dialogRef.close({ success: true, data: shortcut });
  }

  async editShortcut() {
    if(this.shortcutForm.get('name')?.value?.trim()! === '' || this.shortcutForm.get('url')?.value?.trim()! === '') {
      this.shortcutForm.markAllAsDirty();
      this.shortcutForm.markAllAsTouched();
      this.shortcutForm.updateValueAndValidity();
      return;
    }
    const data = await firstValueFrom(this.shortcuts);
    const group = data.filter((data => data.id === this.data.shortcut.id))[0]?.group!;
    const newData = {
      id: group[this.data.index].id,
      name: this.shortcutForm.get('name')?.value?.trim()!,
      url: this.modifyUrl(this.shortcutForm.get('url')?.value?.trim()!),
      position: group[this.data.index].position
    }
    group[this.data.index] = newData;

    const shortcut: Shortcut = {
      id: this.data.shortcut?.id,
      type: "Group",
      name: this.data.shortcut.name,
      url: null,
      group: group,
      position: this.data.shortcut?.position
    }
    await this.service.addSavedLink(shortcut);
    this.dialogRef.close({ success: true, data: shortcut });
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
