import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideAppIcons } from '../../core/icons';
import { GroupTile } from '../../core/model';
import { sampleItems } from '../../testing/store-harness';
import { GroupLink } from './group-link';

const propera = () => sampleItems().find((i) => i.id === 'g') as GroupTile;

describe('GroupLink', () => {
  let fixture: ComponentFixture<GroupLink>;

  function create(variant: 'tiles' | 'compact', group: GroupTile = propera()) {
    fixture = TestBed.createComponent(GroupLink);
    fixture.componentRef.setInput('quickLink', group);
    fixture.componentRef.setInput('variant', variant);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [GroupLink], providers: [provideAppIcons()] }).compileComponents();
  });

  it('renders the tile name', () => {
    expect(create('tiles').textContent).toContain('Propera');
  });

  it('compact group shows the link count', () => {
    const pill = create('compact').querySelector('[data-testid="pill"]') as HTMLElement;
    expect(pill.textContent).toContain('Propera');
    expect(pill.textContent).toContain('5');
    expect(pill.getAttribute('aria-label')).toBe('Open group Propera');
  });

  it('clicking the pill opens the group', () => {
    const el = create('compact');
    const open = vi.fn();
    fixture.componentInstance.open.subscribe(open);
    (el.querySelector('[data-testid="pill"]') as HTMLElement).click();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('right-click opens the menu and blocks the browser menu', () => {
    const el = create('compact');
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    el.querySelector('[data-testid="pill"]')!.dispatchEvent(event);
    fixture.detectChanges();
    expect(event.defaultPrevented).toBe(true);
    expect(document.querySelector('[role="menu"]')).toBeTruthy();
  });

  it('group menu says Rename and Delete', () => {
    const el = create('tiles');
    el.querySelector('button[aria-label="Open group Propera"]')!.dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
    const items = [...document.querySelectorAll('[role="menu"] [role^="menuitem"]')].map((b) => b.textContent!.trim());
    expect(items).toEqual(['Rename', 'Delete']);
  });

  it('choosing Delete in the menu emits removeLink', async () => {
    const el = create('tiles');
    const spy = vi.fn();
    fixture.componentInstance.removeLink.subscribe(spy);
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
