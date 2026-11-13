import { ChangeDetectionStrategy, Component, inject, input, output, viewChild } from '@angular/core';
import { MatRippleModule } from '@angular/material/core';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { ShortcutTile } from '../../core/model';
import { LinkOpenerService } from '../../services/link-opener.service';
import { ShortcutStyle } from '../../services/ui-prefs.service';
import { Favicon } from '../favicon/favicon';
import { isMenuKey } from './menu-keys';

/** A shortcut on the main page, as a tile or a compact pill. */
@Component({
  selector: 'app-link',
  imports: [Favicon, MatIcon, MatMenuModule, MatRippleModule],
  templateUrl: './link.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Link {
  private opener = inject(LinkOpenerService);
  private menu = viewChild.required(MatMenuTrigger);

  quickLink = input.required<ShortcutTile>();
  variant = input<ShortcutStyle>('tiles');
  removeShortcut = output<void>();
  editShortcut = output<void>();

  open(event: MouseEvent): void {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    void this.opener.open(this.quickLink());
  }

  /** Right-click shows the app menu instead of the browser one. */
  openMenu(event: Event): void {
    event.preventDefault();
    this.menu().openMenu();
  }

  onKeydown(event: KeyboardEvent): void {
    if (isMenuKey(event)) this.openMenu(event);
  }
}
