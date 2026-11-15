import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { firstValueFrom } from 'rxjs';
import { GroupTile } from '../../core/model';
import { renumber } from '../../core/positions';
import { addSection, moveSection, removeTile, replaceGroup, updateTile } from '../../core/section-ops';
import { ConfirmService } from '../../services/confirm.service';
import { LinksStore } from '../../services/links-store';
import { NotifyService } from '../../services/notify.service';
import { NameDialog, NameDialogData } from '../name-dialog/name-dialog';
import { SectionColumn } from '../section-column/section-column';

export interface GroupDialogData {
  groupId: string;
}

/** A group's sections as side-by-side columns (spec §5). Reads the group live from the store. */
@Component({
  selector: 'app-group-dialog',
  imports: [MatMenuModule, MatIcon, CdkDropList, CdkDropListGroup, CdkDrag, SectionColumn],
  templateUrl: './group-dialog.html',
  styleUrl: './group-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupDialog {
  private ref = inject(MatDialogRef<GroupDialog>);
  private store = inject(LinksStore);
  private dialog = inject(MatDialog);
  private confirm = inject(ConfirmService);
  private notify = inject(NotifyService);
  private readonly data = inject<GroupDialogData>(MAT_DIALOG_DATA);

  private readonly currentId = signal(this.data.groupId);
  readonly groups = this.store.groups;
  readonly group = computed(() => this.groups().find((g) => g.id === this.currentId()));
  readonly sections = computed(() => renumber(this.group()?.sections ?? []));

  select(id: string): void {
    this.currentId.set(id);
  }

  close(): void {
    this.ref.close();
  }

  async addSection(): Promise<void> {
    const name = await this.askName({ title: 'Add section', label: 'Section name', confirmText: 'Add' });
    if (name) await this.change((g) => addSection(g, name));
  }

  async moveSectionBy(sectionId: string, delta: number): Promise<void> {
    const from = this.sections().findIndex((s) => s.id === sectionId);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= this.sections().length) return;
    await this.change((g) => moveSection(g, from, to));
  }

  async dropSection(event: CdkDragDrop<unknown>): Promise<void> {
    if (event.previousIndex === event.currentIndex) return;
    await this.change((g) => moveSection(g, event.previousIndex, event.currentIndex));
  }

  async renameGroup(): Promise<void> {
    const g = this.group();
    if (!g) return;
    const name = await this.askName({ title: 'Rename group', label: 'Group name', initial: g.name, confirmText: 'Save' });
    if (name) await this.save((items) => updateTile(items, g.id, { name }));
  }

  async deleteGroup(): Promise<void> {
    const g = this.group();
    if (!g) return;
    const count = g.sections.reduce((n, s) => n + s.links.length, 0);
    const ok = await this.confirm.ask({
      title: `Delete group “${g.name}”?`,
      message: `This removes the group and its ${count} link${count === 1 ? '' : 's'}.`,
      confirmText: 'Delete group',
      danger: true,
    });
    if (!ok) return;
    await this.save((items) => removeTile(items, g.id));
    this.ref.close();
  }

  private change(fn: (g: GroupTile) => GroupTile): Promise<void> {
    const g = this.group();
    if (!g) return Promise.resolve();
    return this.save((items) => replaceGroup(items, fn(g)));
  }

  private async save(fn: Parameters<LinksStore['update']>[0]): Promise<void> {
    try {
      await this.store.update(fn);
    } catch (error) {
      this.notify.error(error instanceof Error ? error.message : 'Could not save changes');
    }
  }

  private async askName(data: NameDialogData): Promise<string | undefined> {
    const ref = this.dialog.open(NameDialog, { data, maxWidth: '520px', width: '100%' });
    return firstValueFrom(ref.afterClosed());
  }
}
