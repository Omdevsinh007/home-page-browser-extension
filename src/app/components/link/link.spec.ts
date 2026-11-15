import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { provideAppIcons } from '../../core/icons';
import { ShortcutTile } from '../../core/model';
import { LinkOpenerService } from '../../services/link-opener.service';
import { Link } from './link';

const tile = (name = 'Gmail'): ShortcutTile => ({ id: 's1', type: 'Shortcut', name, url: 'https://mail.google.com', position: 0 });

describe('Link', () => {
  let fixture: ComponentFixture<Link>;
  let overlay: HTMLElement;

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
    overlay = TestBed.inject(OverlayContainer).getContainerElement();
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
    expect(overlay.querySelector('.mat-mdc-menu-panel')).toBeTruthy();
  });

  it('keyboard menu keys are left to the contextmenu event', () => {
    // Browsers turn the Menu key and Shift+F10 into a contextmenu event on the focused element.
    // Opening on keydown as well would move focus into the menu, and the later native
    // contextmenu would then land on a menu item and show the browser menu.
    const el = create('tiles');
    el.querySelector('a')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(overlay.querySelector('.mat-mdc-menu-panel')).toBeNull();
  });

  it('contextmenu inside the open menu is blocked too', () => {
    const el = create('tiles');
    el.querySelector('a')!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    const item = overlay.querySelector('[mat-menu-item]')!;
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    item.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('link menu says Edit shortcut and Delete', () => {
    const el = create('tiles');
    el.querySelector('a')!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    const items = [...overlay.querySelectorAll('[mat-menu-item]')].map((b) => b.textContent!.trim());
    expect(items).toEqual(['Edit shortcut', 'Delete']);
  });
});
