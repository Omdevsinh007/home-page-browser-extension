import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GroupLink } from './group-link';

describe('GroupLink', () => {
  let fixture: ComponentFixture<GroupLink>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [GroupLink] }).compileComponents();
    fixture = TestBed.createComponent(GroupLink);
    fixture.componentRef.setInput('quickLink', { id: 'g1', type: 'Group', name: 'Work', position: 0, sections: [{ id: 's', name: 'General', position: 0, sort: 'manual', links: [] }] });
    fixture.detectChanges();
  });

  it('renders the tile name', () => {
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Work');
  });
});
