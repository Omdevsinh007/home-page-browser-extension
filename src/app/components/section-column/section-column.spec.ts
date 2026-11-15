import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { TestBed } from '@angular/core/testing';
import { storeHarness } from '../../testing/store-harness';
import { SectionColumn } from './section-column';

async function render(sectionId: string, opts: Parameters<typeof storeHarness>[0] = {}) {
  const h = await storeHarness(opts);
  const fixture = TestBed.createComponent(SectionColumn);
  const sync = () => {
    const g = h.group();
    fixture.componentRef.setInput('group', g);
    fixture.componentRef.setInput('section', g.sections.find((s) => s.id === sectionId) ?? g.sections[0]);
    fixture.detectChanges();
  };
  sync();
  return { ...h, fixture, cmp: fixture.componentInstance, el: fixture.nativeElement as HTMLElement, sync };
}

const sectionIds = (g: { sections: { id: string; links: { id: string }[] }[] }, s: string) =>
  g.sections.find((x) => x.id === s)!.links.map((l) => l.id);

function dropEvent(from: string, to: string, linkId: string, previousIndex: number, currentIndex: number) {
  return {
    previousContainer: { data: from },
    container: { data: to },
    item: { data: linkId },
    previousIndex,
    currentIndex,
  } as unknown as CdkDragDrop<string, string, string>;
}

describe('SectionColumn', () => {
  it('renders the header with name and link count, rows in manual order', async () => {
    const { el } = await render('git');
    expect(el.querySelector('[data-testid=section-name]')!.textContent!.trim()).toBe('Git');
    expect(el.querySelector('[data-testid=section-count]')!.textContent!.trim()).toBe('2');
    expect([...el.querySelectorAll('app-link-row')].map((r) => r.getAttribute('data-id'))).toEqual(['b', 'a']);
  });

  it('A–Z sort reorders the rows but not the stored positions', async () => {
    const { cmp, group, sync, el } = await render('git');
    await cmp.setSort('az');
    sync();
    expect([...el.querySelectorAll('app-link-row')].map((r) => r.getAttribute('data-id'))).toEqual(['a', 'b']);
    expect(sectionIds(group(), 'git')).toEqual(['b', 'a']);
    expect(group().sections[0].sort).toBe('az');
  });

  it('adds a link from the link dialog', async () => {
    const { cmp, group } = await render('git', { dialogResults: [{ name: 'New', url: 'https://new' }] });
    await cmp.addLink();
    expect(group().sections[0].links.at(-1)).toMatchObject({ name: 'New', url: 'https://new' });
  });

  it('deleting a section with links confirms, then moves links to the first section', async () => {
    const { cmp, group, ask } = await render('docs');
    await cmp.remove();
    expect(ask).toHaveBeenCalled();
    expect(group().sections.map((s) => s.id)).toEqual(['git']);
    expect(sectionIds(group(), 'git')).toEqual(['b', 'a', 'c', 'd', 'e']);
  });

  it('a cancelled delete changes nothing', async () => {
    const { cmp, group } = await render('docs', { confirm: false });
    await cmp.remove();
    expect(group().sections).toHaveLength(2);
  });

  it('drop between columns calls moveLink with manual indexes', async () => {
    const { cmp, group } = await render('git');
    await cmp.drop(dropEvent('docs', 'git', 'd', 1, 1));
    expect(sectionIds(group(), 'git')).toEqual(['b', 'd', 'a']);
    expect(sectionIds(group(), 'docs')).toEqual(['c', 'e']);
  });

  it('drop from a sorted column uses the manual index of the dragged link', async () => {
    const { cmp, group, sync } = await render('git');
    await cmp.setSort('az'); // displayed: a, b — manual: b, a
    sync();
    await cmp.drop(dropEvent('git', 'docs', 'a', 0, 0));
    expect(sectionIds(group(), 'git')).toEqual(['b']);
    expect(sectionIds(group(), 'docs')).toEqual(['a', 'c', 'd', 'e']);
  });

  it('Open all passes the links in displayed order', async () => {
    const { cmp, opener, sync } = await render('git');
    await cmp.setSort('az');
    sync();
    await cmp.openAll();
    expect(opener.openAll).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'a' }),
      expect.objectContaining({ id: 'b' }),
    ]);
  });

  it('collapse is persisted on the section', async () => {
    const { cmp, group } = await render('git');
    await cmp.toggleCollapsed();
    expect(group().sections[0].collapsed).toBe(true);
  });

  it('Open all button has an accessible name', async () => {
    const { el } = await render('git');
    expect(el.querySelector('button[aria-label="Open all links in Git"]')).not.toBeNull();
  });
});
