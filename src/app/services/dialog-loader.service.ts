import { EnvironmentInjector, Injectable, Type, inject } from '@angular/core';
import type { MatDialogConfig, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

export type ComponentLoader<C = unknown> = () => Promise<Type<C>>;

/** Dialog components, loaded on first use so they stay out of the startup bundle. */
export const DIALOGS = {
  link: () => import('../components/link-dialog/link-dialog').then((m) => m.LinkDialog),
  name: () => import('../components/name-dialog/name-dialog').then((m) => m.NameDialog),
  group: () => import('../components/group-dialog/group-dialog').then((m) => m.GroupDialog),
  background: () => import('../components/background-dialog/background-dialog').then((m) => m.BackgroundDialog),
  confirm: () => import('../components/confirm-dialog/confirm-dialog').then((m) => m.ConfirmDialog),
};

const loadDialogModule = () => import('@angular/material/dialog');

/**
 * Opens Material dialogs without importing the dialog module at startup. A dialog that is still loading or
 * open is not opened a second time: the extra request resolves `undefined`, so a double click acts once.
 */
@Injectable({ providedIn: 'root' })
export class DialogLoader {
  private injector = inject(EnvironmentInjector);
  private busy = new Set<ComponentLoader>();

  async openRef<C, D = unknown>(load: ComponentLoader<C>, config: MatDialogConfig<D>): Promise<MatDialogRef<C>> {
    const [{ MatDialog }, component] = await Promise.all([loadDialogModule(), load()]);
    return this.injector.get(MatDialog).open(component, config);
  }

  async open<R, D = unknown>(load: ComponentLoader, config: MatDialogConfig<D>): Promise<R | undefined> {
    if (this.busy.has(load)) return undefined;
    this.busy.add(load);
    try {
      const ref = await this.openRef(load, config);
      return (await firstValueFrom(ref.afterClosed())) as R | undefined;
    } finally {
      this.busy.delete(load);
    }
  }

  /** Warms every lazy chunk once the page is idle, so the first open is as fast as a later one. */
  prefetch(extra: (() => Promise<unknown>)[] = []): void {
    const run = () => {
      for (const load of [loadDialogModule, ...Object.values(DIALOGS), ...extra]) load().catch(() => undefined);
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 2000 });
    else setTimeout(run, 200);
  }
}
