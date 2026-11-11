import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { Favicon } from '../favicon/favicon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { ShortcutTile } from '../../core/model';
import { LinkOpenerService } from '../../services/link-opener.service';

@Component({
  selector: 'app-link',
  imports: [Favicon, MatButtonModule, MatMenuModule],
  templateUrl: './link.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './link.css',
})
export class Link {
  private opener = inject(LinkOpenerService);
  quickLink = input.required<ShortcutTile>();
  removeShortcut = output<void>();
  editShortcut = output<void>();

  open(event: MouseEvent): void {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    void this.opener.open(this.quickLink());
  }
}
