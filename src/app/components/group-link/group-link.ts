import { ChangeDetectionStrategy, Component, computed, input, output, viewChild } from '@angular/core';
import { MatRippleModule } from '@angular/material/core';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { GroupTile } from '../../core/model';
import { renumber } from '../../core/positions';
import { ShortcutStyle } from '../../services/ui-prefs.service';
import { Favicon } from '../favicon/favicon';

/** A group on the main page, as a tile with a favicon preview or a compact pill with a link count. */
@Component({
  selector: 'app-group-link',
  imports: [Favicon, MatIcon, MatMenuModule, MatRippleModule],
  templateUrl: './group-link.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupLink {
  private menu = viewChild.required(MatMenuTrigger);

  quickLink = input.required<GroupTile>();
  variant = input<ShortcutStyle>('tiles');
  open = output<void>();
  rename = output<void>();
  removeLink = output<void>();

  /** First four links in section order, same preview as before sections existed. */
  readonly preview = computed(() =>
    renumber(this.quickLink().sections)
      .flatMap((s) => renumber(s.links))
      .slice(0, 4),
  );

  readonly linkCount = computed(() => this.quickLink().sections.reduce((n, s) => n + s.links.length, 0));

  /** Right-click, the Menu key and Shift+F10 all arrive here as contextmenu: show the app menu, not the browser one. */
  openMenu(event: Event): void {
    event.preventDefault();
    this.menu().openMenu();
  }
}
