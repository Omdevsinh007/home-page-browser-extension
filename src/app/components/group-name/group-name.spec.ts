import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GroupName } from './group-name';

describe('GroupName', () => {
  let component: GroupName;
  let fixture: ComponentFixture<GroupName>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GroupName]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GroupName);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
