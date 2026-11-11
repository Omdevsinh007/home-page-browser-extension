import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { GroupShortcut } from './group-shortcut';

describe('GroupShortcut', () => {
  let component: GroupShortcut;
  let fixture: ComponentFixture<GroupShortcut>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GroupShortcut],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { shortcut: { id: 'g1', type: 'Group', name: 'Work', url: '', group: [], position: 0 }, index: 0, isNewGroup: true } },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GroupShortcut);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
