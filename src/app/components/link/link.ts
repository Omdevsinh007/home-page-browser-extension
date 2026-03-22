import { Component, input, output } from '@angular/core';
import { Group, Shortcut } from '../../models/shortcut';
import { MatMenuModule } from "@angular/material/menu";
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-link',
  imports: [MatMenuModule, MatButtonModule],
  templateUrl: './link.html',
  styleUrl: './link.css'
})
export class Link {
  quickLink = input<Shortcut | Group>();
  index = input<number>();
  removeShortcut = output<string>();
  editShortcut = output<Shortcut>();
  editIndex = output<number>();

  edit() {
    this.editShortcut.emit(this.quickLink() as Shortcut);
    this.editIndex.emit(this.index()!)
  }

  remove() {
    this.removeShortcut.emit(this.quickLink()!.id);
  }
}
