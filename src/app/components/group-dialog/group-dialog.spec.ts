import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { GroupDialog } from './group-dialog';

describe('GroupDialog', () => {
  let component: GroupDialog;
  let fixture: ComponentFixture<GroupDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GroupDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { shortcut: { id: 'g1', type: 'Group', name: 'Work', url: '', group: [], position: 0 }, allGroups: [{ id: 'g1', type: 'Group', name: 'Work', url: '', group: [], position: 0 }] } },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GroupDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
