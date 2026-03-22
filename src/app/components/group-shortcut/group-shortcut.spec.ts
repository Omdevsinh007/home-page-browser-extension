import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GroupShortcut } from './group-shortcut';

describe('GroupShortcut', () => {
  let component: GroupShortcut;
  let fixture: ComponentFixture<GroupShortcut>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GroupShortcut]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GroupShortcut);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
