import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAppIcons } from '../../core/icons';
import { ShortcutTile } from '../../core/model';
import { LinkOpenerService } from '../../services/link-opener.service';
import { Link } from './link';

const tile = (name = 'Gmail'): ShortcutTile => ({ id: 's1', type: 'Shortcut', name, url: 'https://mail.google.com', position: 0 });


/** Every item in a menu starts its label at the same x: all have a leading icon/swatch, or none do. */
function expectAlignedLeads(items: HTMLElement[]) {
  const leads = items.map((i) => !!i.querySelector(':scope > mat-icon, :scope > .popover-lead'));
  expect(leads.every(Boolean) || leads.every((l) => !l)).toBe(true);
}

describe('Link', () => {
  let fixture: ComponentFixture<Link>;

  function create(variant: 'tiles' | 'compact', name?: string) {
    fixture = TestBed.createComponent(Link);
    fixture.componentRef.setInput('quickLink', tile(name));
    fixture.componentRef.setInput('variant', variant);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Link],
      providers: [provideAppIcons(), { provide: LinkOpenerService, useValue: { open: vi.fn() } }],
    }).compileComponents();
  });

  it('renders the tile name', () => {
    expect(create('tiles').textContent).toContain('Gmail');
  });

  it('compact link shows a pill with name and title', () => {
    const name = 'A very long shortcut name that will not fit';
    const pill = create('compact', name).querySelector('[data-testid="pill"]') as HTMLElement;
    expect(pill).toBeTruthy();
    expect(pill.getAttribute('title')).toBe(name);
  });

  it('right-click opens the menu and blocks the browser menu', () => {
    const el = create('compact');
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    el.querySelector('[data-testid="pill"]')!.dispatchEvent(event);
    fixture.detectChanges();
    expect(event.defaultPrevented).toBe(true);
    expect(document.querySelector('[role="menu"]')).toBeTruthy();
  });

  it('keyboard menu keys are left to the contextmenu event', () => {
    // Browsers turn the Menu key and Shift+F10 into a contextmenu event on the focused element.
    // Opening on keydown as well would move focus into the menu, and the later native
    // contextmenu would then land on a menu item and show the browser menu.
    const el = create('tiles');
    el.querySelector('a')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });

  it('contextmenu inside the open menu is blocked too', () => {
    const el = create('tiles');
    el.querySelector('a')!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    const item = document.querySelector('[role="menu"] [role^="menuitem"]')!;
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    item.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('link menu says Edit shortcut and Delete', () => {
    const el = create('tiles');
    el.querySelector('a')!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    const items = [...document.querySelectorAll('[role="menu"] [role^="menuitem"]')].map((b) => b.textContent!.trim());
    expect(items).toEqual(['Edit shortcut', 'Delete']);
    expectAlignedLeads([...document.querySelectorAll<HTMLElement>('[role="menu"] [role^="menuitem"]')]);
  });

  it('choosing Delete in the menu emits removeShortcut', async () => {
    const el = create('tiles');
    const spy = vi.fn();
    fixture.componentInstance.removeShortcut.subscribe(spy);
    (el.querySelector('.shortcut-more') as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const target = [...document.querySelectorAll<HTMLElement>('[role="menu"] [role^="menuitem"]')].find((i) => i.textContent!.trim() === 'Delete')!;
    target.click();
    fixture.detectChanges();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });

  it('drops the menu from the options button', () => {
    const el = create('tiles');
    (el.querySelector('.shortcut-more') as HTMLElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.shortcut-more')!.hasAttribute('data-menu-origin')).toBe(true);
    expect(el.querySelector('.shortcut')!.hasAttribute('data-menu-origin')).toBe(false);
  });
});
