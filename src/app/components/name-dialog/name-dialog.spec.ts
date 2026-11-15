import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NameDialog, NameDialogData } from './name-dialog';

function create(data: NameDialogData) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    imports: [NameDialog],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close } },
    ],
  });
  const fixture = TestBed.createComponent(NameDialog);
  fixture.detectChanges();
  return { close, cmp: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
}

describe('NameDialog', () => {
  const data = { title: 'Rename group', label: 'Group name', initial: 'Work', confirmText: 'Save' };

  it('prefills the initial name and shows the title', () => {
    const { cmp, el } = create(data);
    expect(cmp.name()).toBe('Work');
    expect(el.textContent).toContain('Rename group');
  });

  it('closes with the trimmed name', () => {
    const { cmp, close } = create(data);
    cmp.name.set('  Propera ');
    cmp.submit();
    expect(close).toHaveBeenCalledWith('Propera');
  });

  it('does not close with a blank name', () => {
    const { cmp, close } = create(data);
    cmp.name.set('   ');
    cmp.submit();
    expect(close).not.toHaveBeenCalled();
  });
});
