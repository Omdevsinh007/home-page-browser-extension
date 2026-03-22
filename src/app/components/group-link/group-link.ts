import { Component, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { Shortcut } from '../../models/shortcut';
import { GroupName } from '../group-name/group-name';

@Component({
  selector: 'app-group-link',
  imports: [MatMenuModule, MatButtonModule],
  templateUrl: './group-link.html',
  styleUrl: './group-link.css'
})
export class GroupLink {
  quickLink = input<Shortcut>();
  private dialog = inject(MatDialog);
  removeLink = output<string>();

  editShortcut() {
    this.dialog.open(GroupName, {
      hasBackdrop: true,
      maxWidth: '600px',
      width: '100%',
      data: this.quickLink()
    });
  }

  removeShortcut() {
    this.removeLink.emit(this.quickLink()!.id);
  }
}
