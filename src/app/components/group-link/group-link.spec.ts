import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GroupLink } from './group-link';

describe('GroupLink', () => {
  let fixture: ComponentFixture<GroupLink>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [GroupLink] }).compileComponents();
    fixture = TestBed.createComponent(GroupLink);
    fixture.componentRef.setInput('quickLink', { id: 'g1', type: 'Group', name: 'Work', url: '', group: [], position: 0 });
    fixture.detectChanges();
  });

  it('renders the tile name', () => {
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Work');
  });
});
