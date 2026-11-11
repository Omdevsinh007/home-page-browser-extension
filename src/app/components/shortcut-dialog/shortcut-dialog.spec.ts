import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { ShortcutDialog } from './shortcut-dialog';

describe('ShortcutDialog', () => {
  let component: ShortcutDialog;
  let fixture: ComponentFixture<ShortcutDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShortcutDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: null },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ShortcutDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
