import { Component, DestroyRef, inject, signal, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { OverlayModule } from '@angular/cdk/overlay';
import { Link } from '../link/link';
import { Shortcut } from '../../models/shortcut';
import { SaveLinks } from '../../services/save-links';
import { GroupShortcut } from '../group-shortcut/group-shortcut';
import { GroupName } from '../group-name/group-name';

@Component({
  selector: 'app-group-dialog',
  imports: [MatDialogModule, Link, MatMenuModule, MatIcon, MatIconButton, DragDropModule, OverlayModule],
  templateUrl: './group-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './group-dialog.css'
})
export class GroupDialog implements OnInit {
  private dialogRef = inject(MatDialogRef<GroupDialog>);
  private destroyRef = inject(DestroyRef);
  data = inject<{ shortcut: Shortcut, allGroups: Shortcut[] }>(MAT_DIALOG_DATA);
  private savedLinks = inject(SaveLinks);
  private dialog = inject(MatDialog);

  shortcutData = signal(this.data.shortcut);
  allGroups = signal<Shortcut[]>(this.data.allGroups);

  ngOnInit() {
    // Data is initialized from dialog data
  }

  switchGroup(group: Shortcut) {
    this.shortcutData.set(group);
  }

  addShortcut() {
    const dialog = this.dialog.open(GroupShortcut, {
      hasBackdrop: true,
      maxWidth: '600px',
      width: '100%',
      data: { shortcut: this.shortcutData(), isNewGroup: true }
    });
    dialog.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          if (data?.success) {
            this.shortcutData.update((s) => ({ ...s, group: data.data.group }));
          }
        }
      });
  }

  addGroup() {
    this.dialog.open(GroupName, {
      hasBackdrop: true,
      maxWidth: '600px',
      width: '100%',
    });
  }

  editShortcut(index: number) {
    const dialog = this.dialog.open(GroupShortcut, {
      hasBackdrop: true,
      maxWidth: '600px',
      width: '100%',
      data: { shortcut: this.shortcutData(), isNewGroup: false, index: index }
    });
    dialog.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          if (data?.success) {
            this.shortcutData.update((s) => ({ ...s, group: data.data.group }));
          }
        }
      });
  }

  closeGroup() {
    this.dialogRef.close();
  }

  editGroup() {
    const dialogRef = this.dialog.open(GroupName, {
      hasBackdrop: true,
      maxWidth: '600px',
      width: '100%',
      data: this.shortcutData()
    });
    dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => {
        if (data) {
          this.shortcutData.update(() => data);
        }
      });
  }

  async removeGroup(id: any) {
    await this.savedLinks.removeSavedLink(id);
    this.closeGroup();
  }

  removeShortcut(id: string) {
    this.shortcutData.update((v) => {
      return ({ ...v, group: v.group?.filter(g => g.id !== id)! });
    });
    this.savedLinks.addSavedLink(this.shortcutData());
  }

  async drop(event: CdkDragDrop<Shortcut[]>) {
    moveItemInArray(this.shortcutData().group!, event.previousIndex, event.currentIndex);
    this.shortcutData.update((value) => ({ ...value, group: value.group!.map((data, index) => ({ ...data, position: index })) }));
    await this.savedLinks.addSavedLink(this.shortcutData());
  }
}
