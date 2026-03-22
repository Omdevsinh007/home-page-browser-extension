import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GroupLink } from './group-link';

describe('GroupLink', () => {
  let component: GroupLink;
  let fixture: ComponentFixture<GroupLink>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GroupLink]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GroupLink);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
