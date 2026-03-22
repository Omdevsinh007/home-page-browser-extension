import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { Shortcut } from '../../models/shortcut';
import { SaveLinks } from '../../services/save-links';
import { GroupDialog } from '../group-dialog/group-dialog';

@Component({
  selector: 'app-group-name',
  imports: [FormsModule, MatFormFieldModule, MatInputModule, MatDialogModule, MatButtonModule],
  templateUrl: './group-name.html',
  styleUrl: './group-name.css'
})
export class GroupName implements OnInit {

  private dialogRef = inject(MatDialogRef<GroupName>);
  readonly data = inject<Shortcut>(MAT_DIALOG_DATA);
  private dialog = inject(MatDialog);
  private savedLinkGroup = inject(SaveLinks);

  ngOnInit(): void {
    if(this.data && this.data.name) {
      this.groupName = this.data.name;
    }
    this.savedLinkGroup.getSavedLinks().subscribe({
      next:(data) => {
        this.shortcutData = data.length;
      }
    })
  }

  shortcutData = 0

  groupName = "";

  async createGroup() {
    const data: Shortcut = {
      id: crypto.randomUUID(),
      type: "Group",
      name: this.groupName,
      url: '',
      group: [],
      position: this.shortcutData
    }
    this.savedLinkGroup.addSavedLink(data);
    this.dialog.open(GroupDialog, {
      hasBackdrop: true,
      maxWidth: '70dvw',
      maxHeight: '70dvh',
      height: '100%',
      width: '100%',
      disableClose: true,
      data: data,
      id: "dialog-group-overlay"
    });
    this.dialogRef.close()
  }

  saveGroup() {
    const data: Shortcut = {
      id: this.data.id,
      type: this.data.type,
      name: this.groupName,
      url: this.data.url,
      group: this.data.group,
      position: this.shortcutData
    }
    this.savedLinkGroup.addSavedLink(data)
    this.dialogRef.close(data);
  }
}
