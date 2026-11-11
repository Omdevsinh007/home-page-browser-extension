import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { LinkDialog, LinkDialogData } from './link-dialog';

function create(data: LinkDialogData) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    imports: [LinkDialog],
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close } },
    ],
  });
  const fixture = TestBed.createComponent(LinkDialog);
  fixture.detectChanges();
  return { fixture, close, el: fixture.nativeElement as HTMLElement, cmp: fixture.componentInstance };
}

describe('LinkDialog', () => {
  it('shows "Add link" when there is no initial value', () => {
    const { el } = create({ title: 'Add link' });
    expect(el.querySelector('h2')!.textContent!.trim()).toBe('Add link');
  });

  it('prefills when editing', () => {
    const { cmp } = create({ title: 'Edit link', initial: { name: 'A', url: 'https://a' } });
    expect(cmp.form.getRawValue()).toEqual({ name: 'A', url: 'https://a' });
  });

  it('closes with a trimmed name and normalised url', () => {
    const { cmp, close } = create({ title: 'Add link' });
    cmp.form.setValue({ name: '  Repo  ', url: 'github.com/acme' });
    cmp.submit();
    expect(close).toHaveBeenCalledWith({ name: 'Repo', url: 'https://github.com/acme' });
  });

  it('rejects blank fields', () => {
    const { cmp, close } = create({ title: 'Add link' });
    cmp.form.setValue({ name: '   ', url: 'x.com' });
    cmp.submit();
    expect(close).not.toHaveBeenCalled();
  });

  it('rejects unsafe urls with a field error', () => {
    const { cmp, close, fixture, el } = create({ title: 'Add link' });
    cmp.form.setValue({ name: 'Bad', url: 'javascript:alert(1)' });
    cmp.submit();
    fixture.detectChanges();
    expect(close).not.toHaveBeenCalled();
    expect(el.textContent).toContain('This URL type is not allowed');
  });
});
