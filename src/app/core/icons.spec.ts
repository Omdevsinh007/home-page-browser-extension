import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { MatIconRegistry } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { ICONS, provideAppIcons } from './icons';

describe('icons', () => {
  it('defines every icon as an svg', () => {
    const entries = Object.entries(ICONS);
    expect(entries.length).toBe(21);
    for (const [, svg] of entries) {
      expect(svg).toMatch(/^<svg[^>]*viewBox="0 -960 960 960"[^>]*>.*<\/svg>$/s);
      expect(svg).toContain('fill="currentColor"');
    }
  });

  it('registers icons with MatIconRegistry', async () => {
    // TestBed runs app initializers when it creates the test module.
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideAppIcons()] });
    const registry = TestBed.inject(MatIconRegistry);
    const icon = await firstValueFrom(registry.getNamedSvgIcon('search'));
    expect(icon).toBeInstanceOf(SVGElement);
  });
});
