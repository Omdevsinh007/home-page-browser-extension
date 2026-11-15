import { CURRENT_VERSION, detectShape, migrateV1toV2, normalizeV2Items, unwrap } from './migrate';
import { LinkStat, TopItem } from './model';
import { renumber } from './positions';
import { isUnsafeUrl } from './url';

export interface ExportFile {
  app: 'custom-homepage';
  version: 2;
  exportedAt: string;
  links: TopItem[];
  linkStats?: Record<string, LinkStat>;
}

export interface SkippedItem {
  name: string;
  reason: 'unsafe-url';
}

export interface ImportResult {
  items: TopItem[];
  skipped: SkippedItem[];
  stats?: Record<string, LinkStat>;
}

export function buildExport(items: TopItem[], stats: Record<string, LinkStat>, now: Date): ExportFile {
  return { app: 'custom-homepage', version: CURRENT_VERSION as 2, exportedAt: now.toISOString(), links: items, linkStats: stats };
}

const invalid = () => new Error('Invalid file');

/** Accepts a v3 export, an old v2.x export (bare v1 array) or a `{version, data}` record (spec §6.5). */
export function parseImport(json: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw invalid();
  }

  let raw: unknown = parsed;
  let stats: Record<string, LinkStat> | undefined;
  const asRecord = parsed as Partial<ExportFile> | null;
  if (asRecord && typeof asRecord === 'object' && asRecord.app === 'custom-homepage') {
    if (!Array.isArray(asRecord.links)) throw invalid();
    raw = { version: asRecord.version, data: asRecord.links };
    if (asRecord.linkStats && typeof asRecord.linkStats === 'object') stats = asRecord.linkStats;
  }

  const shape = detectShape(raw);
  const data = (unwrap(raw).data ?? []) as unknown[];
  let items: TopItem[];
  if (shape === 'v1') items = migrateV1toV2(data).items;
  else if (shape === 'v2') items = normalizeV2Items(data);
  else if (shape === 'empty') items = [];
  else throw invalid();

  return { ...sanitize(items), ...(stats && { stats }) };
}

function sanitize(items: TopItem[]): ImportResult {
  const skipped: SkippedItem[] = [];
  const keep = (name: string, url: string) => {
    if (!isUnsafeUrl(url)) return true;
    skipped.push({ name, reason: 'unsafe-url' });
    return false;
  };
  const clean = items
    .filter((item) => item.type !== 'Shortcut' || keep(item.name, item.url))
    .map((item) =>
      item.type === 'Group'
        ? { ...item, sections: item.sections.map((s) => ({ ...s, links: renumber(s.links.filter((l) => keep(l.name, l.url))) })) }
        : item,
    );
  return { items: renumber(clean), skipped };
}
