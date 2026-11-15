import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { GroupTile, TopItem } from '../core/model';
import { ConfirmService } from '../services/confirm.service';
import { LinkOpenerService } from '../services/link-opener.service';
import { LinksStore } from '../services/links-store';
import { KeyValueStorage } from '../services/storage.service';
import { FakeStorage } from './fake-storage';

export const link = (id: string, position: number, extra: object = {}) => ({
  id,
  name: id.toUpperCase(),
  url: `https://${id}.example`,
  position,
  ...extra,
});

export function sampleItems(): TopItem[] {
  return [
    { id: 'mail', type: 'Shortcut', name: 'Mail', url: 'https://mail.example', position: 0 },
    {
      id: 'g',
      type: 'Group',
      name: 'Propera',
      position: 1,
      sections: [
        { id: 'git', name: 'Git', position: 0, sort: 'manual', links: [link('b', 0), link('a', 1)] },
        { id: 'docs', name: 'Docs', position: 1, sort: 'manual', links: [link('c', 0), link('d', 1), link('e', 2)] },
      ],
    },
    { id: 'g2', type: 'Group', name: 'Other', position: 2, sections: [{ id: 'o', name: 'General', position: 0, sort: 'manual', links: [] }] },
  ];
}

/** Configures TestBed with a real LinksStore on FakeStorage and scripted dialog results. */
export async function storeHarness(opts: { items?: TopItem[]; dialogResults?: unknown[]; confirm?: boolean; providers?: unknown[] } = {}) {
  const fake = new FakeStorage();
  const results = [...(opts.dialogResults ?? [])];
  const dialog = { open: vi.fn(() => ({ afterClosed: () => of(results.shift()), close: vi.fn() })) };
  const ask = vi.fn(async () => opts.confirm ?? true);
  const opener = { open: vi.fn(async () => undefined), openAll: vi.fn(async () => true) };
  TestBed.configureTestingModule({
    providers: [
      { provide: KeyValueStorage, useValue: fake },
      { provide: MatDialog, useValue: dialog },
      { provide: ConfirmService, useValue: { ask } },
      { provide: LinkOpenerService, useValue: opener },
      ...((opts.providers ?? []) as never[]),
    ],
  });
  const store = TestBed.inject(LinksStore);
  await store.load();
  await store.save(opts.items ?? sampleItems());
  const group = (id = 'g') => store.groups().find((g) => g.id === id) as GroupTile;
  return { fake, store, dialog, ask, opener, group };
}
