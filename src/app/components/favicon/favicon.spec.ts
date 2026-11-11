import { TestBed } from '@angular/core/testing';
import { Favicon } from './favicon';

function render(url: string, name = 'Strapi CMS') {
  const fixture = TestBed.createComponent(Favicon);
  fixture.componentRef.setInput('url', url);
  fixture.componentRef.setInput('name', name);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

afterEach(() => vi.unstubAllGlobals());

describe('Favicon', () => {
  describe('inside the extension', () => {
    beforeEach(() => {
      vi.stubGlobal('chrome', { runtime: { id: 'ext', getURL: (p: string) => `chrome-extension://ext${p}` } });
    });

    it('loads http(s) favicons from the _favicon endpoint', () => {
      const { el } = render('https://github.com/acme/cms');
      expect(el.querySelector('img')!.getAttribute('src')).toBe(
        'chrome-extension://ext/_favicon/?pageUrl=https%3A%2F%2Fgithub.com%2Facme%2Fcms&size=32',
      );
    });

    it('never calls Google’s favicon service', () => {
      const { el } = render('https://github.com');
      expect(el.innerHTML).not.toContain('google.com/s2/favicons');
    });

    it('falls back to the letter avatar when the image fails', () => {
      const { el, fixture } = render('https://github.com');
      el.querySelector('img')!.dispatchEvent(new Event('error'));
      fixture.detectChanges();
      expect(el.querySelector('img')).toBeNull();
      expect(el.textContent!.trim()).toBe('S');
    });
  });

  it.each(['file:///C:/a.txt', '52.0.205.252', ''])('shows a letter avatar for %p', (url) => {
    const { el } = render(url);
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent!.trim()).toBe('S');
  });

  it('shows a letter avatar for https outside the extension', () => {
    const { el } = render('https://github.com');
    expect(el.querySelector('img')).toBeNull();
  });

  it('uses "?" for an empty name', () => {
    const { el } = render('', '  ');
    expect(el.textContent!.trim()).toBe('?');
  });
});
