import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { BackgroundStore, MAX_BACKGROUNDS, ObjectFit } from '../../services/background.store';
import { NotifyService } from '../../services/notify.service';
import { BUILT_IN_WALLPAPERS, BuiltInId } from '../../core/wallpapers';

/** Background manager as a real dialog: Esc closes, focus is trapped, heading labels it. */
@Component({
  selector: 'app-background-dialog',
  imports: [MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './background-dialog.html',
  styles: `
    .builtin { border: 1px solid transparent; color: var(--text-dim); }
    .builtin:hover { background: var(--glass-fill-faint); }
    .builtin-active { border-color: var(--glass-stroke-focus); background: var(--glass-fill); color: var(--text); }
    .motion-switch { position: relative; width: 40px; height: 24px; border-radius: var(--radius-pill); background: var(--glass-fill-strong); transition: background 150ms ease; }
    .motion-switch.motion-on { background: var(--success); }
    .motion-knob { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: var(--text); transition: transform 150ms ease; }
    .motion-on .motion-knob { transform: translateX(16px); }
  `,
})
export class BackgroundDialog {
  readonly bg = inject(BackgroundStore);
  private notify = inject(NotifyService);
  private ref = inject(MatDialogRef<BackgroundDialog>);

  readonly max = MAX_BACKGROUNDS;
  readonly builtIns = BUILT_IN_WALLPAPERS;
  readonly fits: { value: ObjectFit; label: string }[] = [
    { value: 'cover', label: 'Cover' },
    { value: 'contain', label: 'Contain' },
    { value: 'fill', label: 'Fill' },
  ];

  close(): void {
    this.ref.close();
  }

  /** Back to the Settings panel this dialog was opened from. */
  back(): void {
    this.ref.close('back');
  }

  select(id: string): Promise<void> {
    return this.run(() => this.bg.setActive(id));
  }

  selectBuiltIn(id: BuiltInId): Promise<void> {
    return this.run(() => this.bg.setBuiltIn(id));
  }

  setMotion(on: boolean): Promise<void> {
    return this.run(() => this.bg.setMotion(on));
  }

  remove(id: string, event: Event): Promise<void> {
    event.stopPropagation();
    return this.run(() => this.bg.remove(id));
  }

  async upload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) await this.run(() => this.bg.add(file));
  }

  setFit(objectFit: ObjectFit): Promise<void> {
    this.bg.preview({ objectFit });
    return this.run(() => this.bg.commit());
  }

  previewNumber(key: 'brightness' | 'blur', event: Event): void {
    this.bg.preview({ [key]: Number((event.target as HTMLInputElement).value) });
  }

  commit(): Promise<void> {
    return this.run(() => this.bg.commit());
  }

  private async run(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (error) {
      this.notify.error(error instanceof Error ? error.message : 'Something went wrong');
    }
  }
}
