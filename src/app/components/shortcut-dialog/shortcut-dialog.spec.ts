import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShortcutDialog } from './shortcut-dialog';

describe('ShortcutDialog', () => {
  let component: ShortcutDialog;
  let fixture: ComponentFixture<ShortcutDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShortcutDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShortcutDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
