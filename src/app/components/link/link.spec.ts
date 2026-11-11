import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Link } from './link';

describe('Link', () => {
  let fixture: ComponentFixture<Link>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Link] }).compileComponents();
    fixture = TestBed.createComponent(Link);
    fixture.componentRef.setInput('quickLink', { id: 's1', type: 'Shortcut', name: 'Gmail', url: 'https://mail.google.com', position: 0 });
    fixture.detectChanges();
  });

  it('renders the tile name', () => {
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Gmail');
  });
});
