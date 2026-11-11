import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Favicon } from '../favicon/favicon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { OverlayModule } from '@angular/cdk/overlay';
import { GroupTile } from '../../core/model';
import { renumber } from '../../core/positions';

@Component({
  selector: 'app-group-link',
  imports: [Favicon, MatButtonModule, MatMenuModule, OverlayModule],
  templateUrl: './group-link.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './group-link.css',
})
export class GroupLink {
  quickLink = input.required<GroupTile>();
  open = output<void>();
  rename = output<void>();
  removeLink = output<void>();

  /** First four links in section order, same preview as before sections existed. */
  readonly preview = computed(() =>
    renumber(this.quickLink().sections)
      .flatMap((s) => renumber(s.links))
      .slice(0, 4),
  );
}
