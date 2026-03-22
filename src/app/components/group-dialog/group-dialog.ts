import { Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Link } from '../link/link';
import { Shortcut } from '../../models/shortcut';
import { SaveLinks } from '../../services/save-links';
import { GroupShortcut } from '../group-shortcut/group-shortcut';
import { GroupName } from '../group-name/group-name';

@Component({
  selector: 'app-group-dialog',
  imports: [MatDialogModule, Link, MatMenuModule, MatIcon, MatButton, DragDropModule],
  templateUrl: './group-dialog.html',
  styleUrl: './group-dialog.css'
})
export class GroupDialog {
  private dialogRef = inject(MatDialogRef<GroupDialog>);
  data = inject<Shortcut>(MAT_DIALOG_DATA);
  private savedLinks = inject(SaveLinks);
  private dialog = inject(MatDialog);

  shortcutData = signal(this.data);

  addShortcut() {
    const dialog = this.dialog.open(GroupShortcut, {
      hasBackdrop: true,
      maxWidth: '600px',
      width: '100%',
      data: { shortcut: this.data, isNewGroup: true }
    });

    dialog.afterClosed().subscribe({
      next:(data) => {
        if(data?.success) {
          this.shortcutData.update((s) => ({...s, group: data.data.group}));
        }
      }
    })
  }

  editShortcut(index: number) {
    const dialog = this.dialog.open(GroupShortcut, {
      hasBackdrop: true,
      maxWidth: '600px',
      width: '100%',
      data: { shortcut: this.data, isNewGroup: false, index: index }
    });

    dialog.afterClosed().subscribe({
      next:(data) => {
        if(data?.success) {
          this.shortcutData.update((s) => ({...s, group: data.data.group}));
        }
      }
    })
  }

  closeGroup() {
    this.dialogRef.close()
  }

  editGroup() {
    const dialogRef = this.dialog.open(GroupName, {
      hasBackdrop: true,
      maxWidth: '600px',
      width: '100%',
      data: this.shortcutData()
    });
    dialogRef.afterClosed().subscribe((data) => {
      this.shortcutData.update(() => data);
    })
  }

  async removeGroup(id: any) {
    await this.savedLinks.removeSavedLink(id);
    this.closeGroup();
  }

  removeShortcut(id: string) {
    this.shortcutData.update((v) => {
      return ({ ...v, group: v.group?.filter(g => g.id !== id)!});
    });
    this.savedLinks.addSavedLink(this.shortcutData());
  }

  async drop(event: CdkDragDrop<Shortcut[]>) {
    moveItemInArray(this.shortcutData().group!, event.previousIndex, event.currentIndex);
    this.shortcutData.update((value) => ({...value, group: value.group!.map((data, index) => ({...data, position: index}))}));
    await this.savedLinks.addSavedLink(this.shortcutData());
  }
}
