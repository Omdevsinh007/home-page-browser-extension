import { TestBed } from '@angular/core/testing';
import { provideAppIcons } from '../../core/icons';
import { LinkOpenerService } from '../../services/link-opener.service';
import { LinkRow } from './link-row';

describe('LinkRow', () => {
  function create() {
    TestBed.configureTestingModule({ imports: [LinkRow], providers: [provideAppIcons(), { provide: LinkOpenerService, useValue: { open: vi.fn() } }] });
    const fixture = TestBed.createComponent(LinkRow);
    fixture.componentRef.setInput('link', { id: 'a', name: 'Jira', url: 'https://jira.example', position: 0 });
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  async function openMenu() {
    const r = create();
    (r.el.querySelector('button[aria-label="Options for Jira"]') as HTMLElement).click();
    r.fixture.detectChanges();
    await r.fixture.whenStable();
    return r;
  }

  const items = () => [...document.querySelectorAll<HTMLElement>('.popover-menu[role="menu"] [role^="menuitem"]')];

  it('options menu says Edit link and Delete', async () => {
    await openMenu();
    expect(items().map((i) => i.textContent!.trim())).toEqual(['Edit link', 'Delete']);
  });

  it('choosing Delete emits remove and closes the menu', async () => {
    const { fixture } = await openMenu();
    const spy = vi.fn();
    fixture.componentInstance.remove.subscribe(spy);
    items()[1].click();
    fixture.detectChanges();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.popover-menu[role="menu"]')).toBeNull();
  });

  it('drops the menu from the options button, right edges aligned', async () => {
    const { el } = await openMenu();
    expect(el.querySelector('button[aria-label="Options for Jira"]')!.hasAttribute('data-menu-origin')).toBe(true);
    expect(document.querySelector('.popover-menu')!.closest('.cdk-overlay-pane')!.classList.contains('placement-below-end')).toBe(true);
  });
});
