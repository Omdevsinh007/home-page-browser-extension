import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { DialogLoader } from './dialog-loader.service';
import { NotifyService } from './notify.service';

@Component({ selector: 'app-test-dialog', template: '<p class="test-dialog">hi</p>' })
class TestDialog {
  readonly ref = inject(MatDialogRef);
}

const loadTest = () => Promise.resolve(TestDialog);

const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r));
};

afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => (n.innerHTML = '')));

describe('DialogLoader', () => {
  it('open resolves with the dialog result', async () => {
    const loader = TestBed.inject(DialogLoader);
    const result = loader.open<string>(loadTest, {});
    await vi.waitFor(() => expect(document.querySelectorAll('mat-dialog-container').length).toBe(1), { timeout: 3000 });
    const { MatDialog } = await import('@angular/material/dialog');
    TestBed.inject(MatDialog).openDialogs[0].close('ok');
    expect(await result).toBe('ok');
  });

  it('opens one dialog when asked twice while loading', async () => {
    const loader = TestBed.inject(DialogLoader);
    const first = loader.open<string>(loadTest, {});
    const second = loader.open<string>(loadTest, {});
    await flush();
    expect(document.querySelectorAll('mat-dialog-container').length).toBe(1);
    expect(await second).toBeUndefined();
    const { MatDialog } = await import('@angular/material/dialog');
    TestBed.inject(MatDialog).openDialogs[0].close('ok');
    expect(await first).toBe('ok');
  });

  it('opens the same dialog again after the first one closed', async () => {
    const loader = TestBed.inject(DialogLoader);
    const { MatDialog } = await import('@angular/material/dialog');
    const first = loader.open<string>(loadTest, {});
    await flush();
    TestBed.inject(MatDialog).openDialogs[0].close('a');
    expect(await first).toBe('a');
    const second = loader.open<string>(loadTest, {});
    await flush();
    TestBed.inject(MatDialog).openDialogs[0].close('b');
    expect(await second).toBe('b');
  });
});

describe('NotifyService', () => {
  it('error shows a snackbar with the message', async () => {
    TestBed.inject(NotifyService).error('Could not save');
    await vi.waitFor(() => expect(document.querySelector('.mat-mdc-snack-bar-container')?.textContent).toContain('Could not save'), {
      timeout: 3000,
    });
  });
});
