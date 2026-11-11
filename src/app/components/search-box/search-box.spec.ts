import { TestBed } from '@angular/core/testing';
import { storeHarness } from '../../testing/store-harness';
import { SearchBox } from './search-box';

async function render() {
  const h = await storeHarness();
  const fixture = TestBed.createComponent(SearchBox);
  fixture.detectChanges();
  document.body.appendChild(fixture.nativeElement);
  const el = fixture.nativeElement as HTMLElement;
  const input = el.querySelector('input') as HTMLInputElement;
  const type = (value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const key = (target: EventTarget, k: string, init: KeyboardEventInit = {}) => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));
    fixture.detectChanges();
  };
  return { ...h, fixture, el, input, type, key };
}

afterEach(() => document.body.querySelectorAll('app-search-box').forEach((n) => n.remove()));

describe('SearchBox', () => {
  it('"/" focuses the search box', async () => {
    const { input, key } = await render();
    key(document, '/');
    expect(document.activeElement).toBe(input);
  });

  it('"/" does nothing while typing in another input', async () => {
    const { input, key } = await render();
    const other = document.createElement('input');
    document.body.appendChild(other);
    other.focus();
    key(other, '/');
    expect(document.activeElement).toBe(other);
    expect(document.activeElement).not.toBe(input);
    other.remove();
  });

  it('Ctrl+K and Cmd+K focus the box and prevent the browser default', async () => {
    const { input, key } = await render();
    const ev = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true });
    document.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(input);
    input.blur();
    key(document, 'k', { metaKey: true });
    expect(document.activeElement).toBe(input);
  });

  it('shows results with their Group › Section path', async () => {
    const { el, type } = await render();
    type('docs');
    const options = [...el.querySelectorAll('[role=option]')];
    expect(options.length).toBe(3);
    expect(options[0].textContent).toContain('Propera › Docs');
  });

  it('ArrowDown + Enter opens the active result in a new tab', async () => {
    const { input, type, key, opener } = await render();
    type('docs');
    key(input, 'ArrowDown');
    expect(input.getAttribute('aria-activedescendant')).toBe('search-opt-1');
    key(input, 'Enter');
    expect(opener.open).toHaveBeenCalledWith({ id: 'd', url: 'https://d.example' }, { background: false });
  });

  it('Ctrl+Enter opens in a background tab', async () => {
    const { input, type, key, opener } = await render();
    type('mail');
    key(input, 'Enter', { ctrlKey: true });
    expect(opener.open).toHaveBeenCalledWith({ id: 'mail', url: 'https://mail.example' }, { background: true });
  });

  it('Esc clears, a second Esc blurs', async () => {
    const { input, type, key } = await render();
    input.focus();
    type('docs');
    key(input, 'Escape');
    expect(input.value).toBe('');
    expect(document.activeElement).toBe(input);
    key(input, 'Escape');
    expect(document.activeElement).not.toBe(input);
  });

  it('no match: shows the heading and every link grouped by group › section', async () => {
    const { el, type } = await render();
    type('zzzz');
    expect(el.querySelector('[data-testid=no-match]')!.textContent!.trim()).toBe('No links match "zzzz"');
    expect(el.querySelectorAll('[role=option]')).toHaveLength(6);
    const headings = [...el.querySelectorAll('[data-testid=result-group]')].map((h) => h.textContent!.trim());
    expect(headings).toEqual(['Shortcuts', 'Propera › Git', 'Propera › Docs']);
  });

  it('input is an accessible combobox', async () => {
    const { input, type } = await render();
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    type('docs');
    expect(input.getAttribute('aria-expanded')).toBe('true');
  });
});
