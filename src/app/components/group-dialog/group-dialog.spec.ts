import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { storeHarness } from '../../testing/store-harness';
import { GroupDialog } from './group-dialog';

async function render(opts: Parameters<typeof storeHarness>[0] = {}) {
  const close = vi.fn();
  const h = await storeHarness({
    ...opts,
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: { groupId: 'g' } },
      { provide: MatDialogRef, useValue: { close } },
    ],
  });
  const fixture = TestBed.createComponent(GroupDialog);
  fixture.detectChanges();
  return { ...h, close, fixture, cmp: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
}

describe('GroupDialog', () => {
  it('renders one column per section in position order', async () => {
    const { el } = await render();
    expect([...el.querySelectorAll('app-section-column')].map((c) => c.getAttribute('data-id'))).toEqual(['git', 'docs']);
  });

  it('adds a section from the name dialog', async () => {
    const { cmp, group, fixture, el } = await render({ dialogResults: ['Design'] });
    await cmp.addSection();
    fixture.detectChanges();
    expect(group().sections.map((s) => s.name)).toEqual(['Git', 'Docs', 'Design']);
    expect(el.querySelectorAll('app-section-column')).toHaveLength(3);
  });

  it('moves a section with moveSectionBy', async () => {
    const { cmp, group } = await render();
    await cmp.moveSectionBy('docs', -1);
    expect(group().sections.map((s) => [s.id, s.position])).toEqual([['docs', 0], ['git', 1]]);
  });

  it('sidebar lists live groups and switches between them', async () => {
    const { cmp, store, fixture, el } = await render();
    await store.update((items) => items.map((i) => (i.id === 'g2' ? { ...i, name: 'Renamed live' } : i)));
    fixture.detectChanges();
    expect(el.textContent).toContain('Renamed live');
    cmp.select('g2');
    fixture.detectChanges();
    expect(cmp.group()!.id).toBe('g2');
  });

  it('renaming the group keeps its position', async () => {
    const { cmp, store } = await render({ dialogResults: ['Propera 2'] });
    await cmp.renameGroup();
    expect(store.items()[1]).toMatchObject({ id: 'g', name: 'Propera 2', position: 1 });
  });

  it('deleting the group confirms, removes it and closes', async () => {
    const { cmp, store, close } = await render();
    await cmp.deleteGroup();
    expect(store.items().map((i) => i.id)).toEqual(['mail', 'g2']);
    expect(close).toHaveBeenCalled();
  });
});
