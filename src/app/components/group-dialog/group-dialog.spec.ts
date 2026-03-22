import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GroupDialog } from './group-dialog';

describe('GroupDialog', () => {
  let component: GroupDialog;
  let fixture: ComponentFixture<GroupDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GroupDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GroupDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
