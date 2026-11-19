import { ChangeDetectionStrategy, Component, inject, input, output, viewChild } from '@angular/core';
import { MatRippleModule } from '@angular/material/core';
import { MatIcon } from '@angular/material/icon';
import { OverlayModule } from '@angular/cdk/overlay';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@angular/aria/menu';
import { POPOVER_VIEWPORT_MARGIN, TILE_MENU_POSITIONS } from '../../core/popover';
import { ShortcutTile } from '../../core/model';
import { LinkOpenerService } from '../../services/link-opener.service';
import { ShortcutStyle } from '../../services/ui-prefs.service';
import { Favicon } from '../favicon/favicon';

/** A shortcut on the main page, as a tile or a compact pill. */
@Component({
  selector: 'app-link',
  imports: [Favicon, MatIcon, MatRippleModule, OverlayModule, Menu, MenuContent, MenuItem, MenuTrigger],
  templateUrl: './link.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Link {
  private opener = inject(LinkOpenerService);
  private trigger = viewChild.required(MenuTrigger);
  readonly menu = viewChild<Menu<string>>('linkMenu');
  readonly positions = TILE_MENU_POSITIONS;
  readonly margin = POPOVER_VIEWPORT_MARGIN;

  quickLink = input.required<ShortcutTile>();
  variant = input<ShortcutStyle>('tiles');
  removeShortcut = output<void>();
  editShortcut = output<void>();

  open(event: MouseEvent): void {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    void this.opener.open(this.quickLink());
  }

  /** Right-click, the Menu key and Shift+F10 all arrive here as contextmenu: show the app menu, not the browser one. */
  openMenu(event: Event): void {
    event.preventDefault();
    this.trigger().open();
  }

  onSelected(value: string | undefined): void {
    if (value === 'edit') this.editShortcut.emit();
    else if (value === 'delete') this.removeShortcut.emit();
  }
}
