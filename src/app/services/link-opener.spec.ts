import { TestBed } from '@angular/core/testing';
import { FakeStorage } from '../testing/fake-storage';
import { ConfirmService } from './confirm.service';
import { LinkOpenerService, OPEN_ALL_CONFIRM_THRESHOLD } from './link-opener.service';
import { LinkStatsService, STATS_KEY } from './link-stats.service';
import { KeyValueStorage } from './storage.service';

function setup(confirmAnswer = true) {
  const fake = new FakeStorage();
  const log: string[] = [];
  const create = vi.fn(async (opts: { url: string; active: boolean }) => {
    log.push(`tab:${opts.url}`);
  });
  vi.stubGlobal('chrome', { tabs: { create } });
  const realSet = fake.setMany.bind(fake);
  fake.setMany = async (v) => {
    log.push('stats');
    return realSet(v);
  };
  const ask = vi.fn(async () => confirmAnswer);
  TestBed.configureTestingModule({
    providers: [
      { provide: KeyValueStorage, useValue: fake },
      { provide: ConfirmService, useValue: { ask } },
    ],
  });
  return { fake, log, create, ask, stats: TestBed.inject(LinkStatsService), opener: TestBed.inject(LinkOpenerService) };
}

const links = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `l${i}`, url: `https://x/${i}` }));

afterEach(() => vi.unstubAllGlobals());

describe('LinkStatsService', () => {
  it('counts each id and stores lastOpenedAt', async () => {
    const { fake, stats } = setup();
    await stats.load();
    await stats.record(['a', 'a', 'b'], 1000);
    expect(stats.stats()).toEqual({ a: { count: 2, lastOpenedAt: 1000 }, b: { count: 1, lastOpenedAt: 1000 } });
    expect(fake.data[STATS_KEY]).toEqual({ version: 1, data: stats.stats() });
  });
});

describe('LinkOpenerService', () => {
  it('records the use before opening the tab', async () => {
    const { log, create, opener } = setup();
    await opener.open({ id: 'a', url: 'https://a' });
    expect(log).toEqual(['stats', 'tab:https://a']);
    expect(create).toHaveBeenCalledWith({ url: 'https://a', active: true });
  });

  it('opens in a background tab when asked', async () => {
    const { create, opener } = setup();
    await opener.open({ id: 'a', url: 'https://a' }, { background: true });
    expect(create).toHaveBeenCalledWith({ url: 'https://a', active: false });
  });

  it('falls back to window.open outside the extension', async () => {
    const { opener } = setup();
    vi.stubGlobal('chrome', undefined);
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    await opener.open({ id: 'a', url: 'https://a' });
    expect(open).toHaveBeenCalledWith('https://a', '_blank', 'noopener');
  });

  it(`asks before opening more than ${OPEN_ALL_CONFIRM_THRESHOLD} links`, async () => {
    const { ask, create, opener } = setup(true);
    expect(await opener.openAll(links(18))).toBe(true);
    expect(ask).toHaveBeenCalledWith(expect.objectContaining({ title: 'Open 18 links in new tabs?' }));
    expect(create.mock.calls.map((c) => c[0])).toEqual(links(18).map((l) => ({ url: l.url, active: false })));
  });

  it('opens nothing when the confirm is cancelled', async () => {
    const { create, opener } = setup(false);
    expect(await opener.openAll(links(18))).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it('does not ask for a small section', async () => {
    const { ask, create, opener } = setup();
    await opener.openAll(links(3));
    expect(ask).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(3);
  });

  it('counts every link opened by openAll', async () => {
    const { stats, opener } = setup();
    await opener.openAll(links(2));
    expect(Object.keys(stats.stats())).toEqual(['l0', 'l1']);
  });
});
