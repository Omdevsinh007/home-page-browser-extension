# Sections, Search, Sorting + Review Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v3.0.0: sections as columns inside groups, global search, per-section sort, lossless
v1→v2 storage with downgrade support, and every fix from `docs/review.md`.

**Architecture:** All data rules are pure functions in `src/app/core/` (migration, flatten, reconcile,
section ops, sort, search) with unit tests. One signal-based `LinksStore` owns load/save and talks to a
thin `StorageService` adapter. Components only call store methods. Backgrounds move to IndexedDB.

**Tech Stack:** Angular 22.0.5 (standalone, signals, zoneless, OnPush), CDK 22.0.3 drag-drop,
Material 22.0.3, Tailwind 4.3, Vitest 4 via `@angular/build:unit-test` (jsdom), Chrome MV3.

**Spec:** `docs/specs/2026-11-11-sections-search-sort-design.md` · Findings: `docs/review.md`

## Global Constraints

- Work on `feature/link-sections-search-ui`. Never commit to `main`. Never push.
- Conventional Commits, one logical change per commit; each review finding fixed in its own commit.
- Standalone components, `inject()`, signals, `ChangeDetectionStrategy.OnPush`, Tailwind classes, Material Symbols icons.
- Main page tiles: no new features (no section preview, no count badge). Review fixes do apply.
- Zero data loss: every stored id survives migration; no link is dropped by migration or sort.
- Storage keys: `savedLinks_v2` = `{version:2,data,mirrorHash}`; `savedLinks` = `{version:1,data}` flat mirror;
  `linkStats`; `savedLinks_backup_v1`; `savedLinks_backup_preimport`; `savedLinks_backup_v2_prereconcile`; `savedLinks_quarantine`.
- Default section name: `General`. Sort modes: `'manual' | 'az' | 'recent' | 'most-used'`, default `manual`.
- Unsafe URL schemes (denylist): `javascript:`, `data:`, `vbscript:`.
- Version `3.0.0` in `manifest.json` and `package.json` (last task).
- Verify after every task: `npm run build` and `npm test -- --watch=false` both pass.

## Review Focus

1. **Partial save:** quota error between writing `savedLinks_v2` and the mirror → next load sees a stale mirror and reconcile deletes new links. Expect: both keys written in **one** `setMany` call; on failure neither changes. Test in Task 5.
2. **Two new-tab pages open:** tab A saves, tab B (stale) saves later and overwrites A. Expect: store reloads on `chrome.storage.onChanged` / `storage` event before the next write. Test in Task 5.
3. **Search input with regex characters** (`c++`, `(`, `[`): expect no throw, literal match. Test in Task 11.
4. **Open all on a big section** (e.g. 18 links): expect a confirm above 10 links, then tabs open in section order, inactive. Test in Task 8.
5. **Links without http(s)** (`file:///C:/...`, `52.0.205.252`, empty url): favicon falls back to letter avatar, opening still works. Test in Task 13.

---

## File Structure

```
src/app/core/                  pure logic, no Angular
  model.ts                     v1 + v2 types
  url.ts                       normalizeUrl, isUnsafeUrl, hostnameOf
  positions.ts                 renumber, nextPosition
  migrate.ts                   detectShape, migrateV1toV2
  flatten.ts                   flattenToV1
  hash.ts                      stableHash
  reconcile.ts                 reconcile
  section-ops.ts               group/section/link mutations (immutable)
  sort.ts                      sortLinks
  fuzzy.ts                     fuzzyScore
  search.ts                    buildIndex, search
  import-export.ts             buildExport, parseImport
  __fixtures__/*.json
src/app/services/
  storage.service.ts           chrome.storage / localStorage adapter (modify)
  links-store.ts               replaces save-links.ts
  link-stats.service.ts
  link-opener.service.ts
  background.store.ts          replaces video.service.ts (IndexedDB)
  notify.service.ts            MatSnackBar wrapper
src/app/components/
  favicon/                     _favicon + letter avatar
  confirm-dialog/
  name-dialog/                 replaces group-name for create/rename of group + section
  link-dialog/                 replaces shortcut-dialog + group-shortcut
  group-dialog/                rewritten: columns
  section-column/
  link-row/
  search-box/
  background-dialog/           replaces inline video menu
  empty-state/
src/styles/tokens.css          single token set
```

Delete at the end of their task: `save-links.ts(+spec)`, `group-name/`, `group-shortcut/`, `shortcut-dialog/`,
`video.service.ts`, `src/environments/`.

---

### Task 1: Build on clean clone + working test runner

Closes review: P0 env files, P0 jsdom/karma, P1 `app.spec.ts` h1, P2 dialog spec providers.

**Files:** Modify `angular.json`, `package.json`, `.gitignore`, `src/app/app.ts`, `src/app/services/video.service.ts`, all `*.spec.ts`. Delete `src/environments/`.

- [ ] Remove `fileReplacements` from `angular.json` `production` + `development`. Replace `environment.isProd` checks with the storage adapter's own availability check (Task 5 finalises; here: `typeof chrome !== 'undefined' && !!chrome.storage?.local`). Remove `environment` imports and the unused `videoPoster`, `loadDataForDev`.
- [ ] Remove `.gitignore` lines `src/environments/*` and `!src/environments/environment.ts`; delete `src/environments/`.
- [ ] `npm uninstall karma karma-chrome-launcher karma-coverage karma-jasmine karma-jasmine-html-reporter jasmine-core @types/jasmine istanbul-lib-instrument && npm install -D jsdom`.
- [ ] Rewrite stub specs so they create with providers: dialog components get `{provide: MAT_DIALOG_DATA, useValue: …}` and `{provide: MatDialogRef, useValue: {close: vi.fn()}}`. `app.spec.ts`: replace the h1 test with `it('renders the add tile')` asserting `button[aria-label="Add shortcut or group"]` exists — **mark `it.todo` until Task 15**.
- [ ] Run `npm run build` → success from a tree with no `src/environments/`. Run `npm test -- --watch=false` → all pass.
- [ ] Commit `build: build without gitignored env files` and `test: run vitest with jsdom, drop karma`.

### Task 2: Core types, URL and position helpers

Closes review: P2 duplicated `modifyUrl`/`checkForEmptySpaces`, P3 `javascript:` URLs.

**Files:** Create `src/app/core/model.ts`, `url.ts`, `positions.ts` + specs.

**Interfaces (Produces):**
```ts
// model.ts — v2 types exactly as spec §6.1 (SortMode, LinkItem, Section, ShortcutTile, GroupTile, TopItem)
export interface V1Link { id: string; name: string; url: string; position: number }
export interface V1Shortcut { id: string; type: 'Shortcut' | 'Group'; name: string | null; url: string | null; group: V1Link[] | null; position: number }
export const DEFAULT_SECTION_NAME = 'General';
// url.ts
export function normalizeUrl(input: string): string;       // current modifyUrl behaviour
export function isUnsafeUrl(url: string): boolean;          // denylist, case/space-insensitive
export function hostnameOf(url: string): string;            // '' when unparsable
export function isBlank(v: unknown): boolean;               // whitespace validator core
// positions.ts
export function renumber<T extends { position: number }>(items: readonly T[]): T[]; // stable sort by position, then 0..n-1, new objects
export function nextPosition(items: readonly { position: number }[]): number;      // max+1, 0 if empty
```

- [ ] Tests: `normalizeUrl('github.com')==='https://github.com'`; keeps `http://x`, `file:///C:/a`, `C:\\a`, `./a`, `about:blank`, `chrome://extensions`; `isUnsafeUrl(' JavaScript:alert(1)')===true`, `data:text/html,x` true, `https://a` false, `mailto:a@b` false; `hostnameOf('52.0.205.252')===''`; `renumber([{position:1},{position:1},{position:3}])` → positions `[0,1,2]`, original order for ties, inputs not mutated; `nextPosition([{position:1},{position:1}])===2`.
- [ ] Run → fail. Implement. Run → pass.
- [ ] Commit `refactor: shared url and position helpers`.

### Task 3: v1 → v2 migration + shape detection

**Files:** Create `src/app/core/migrate.ts`, `migrate.spec.ts`, `__fixtures__/{v1-real-shape,legacy-unversioned,empty,corrupt-string,corrupt-object,corrupt-types,v2,future-v3}.json`.

`v1-real-shape.json`: 9 top items (1 Shortcut, 8 Groups with 6,18,5,1,3,4,2,2 links), top positions `1,1,2,3,4,5,6,7,8`, names/URLs anonymised (e.g. `Link 01`, `https://example.com/01`), includes one url `52.0.205.252` and one empty url.

**Interfaces (Produces):**
```ts
export type Shape = 'empty' | 'v1' | 'v2' | 'future' | 'corrupt';
export function detectShape(raw: unknown): Shape;
// {version,data} unwrap; bare array = v1; items with `sections` → v2; with `group`/type → v1;
// version > 2 → future; anything else → corrupt. Never trust `version` alone (v2.6.0 re-save keeps version 1).
export function migrateV1toV2(data: unknown[], newId?: () => string): { items: TopItem[]; quarantine: unknown[] };
```

- [ ] Tests (each fixture): `detectShape` returns expected; real-shape migrates to 9 items, all ids equal input ids, top positions `0..8` with the two `1`s in original array order, each group has exactly 1 section named `General`, `sort:'manual'`, links in old position order renumbered; total link count 41; group `url` gone; shortcut `group` gone; unknown `type` item ends in `quarantine` not `items`; `{version:1,data:[...v2 shaped]}` detects as `v2`; empty → `{items:[],quarantine:[]}`.
- [ ] Run → fail. Implement. Run → pass.
- [ ] Commit `feat(storage): pure v1 to v2 migration with shape detection`.

### Task 4: Flatten, hash, reconcile (downgrade support)

**Files:** Create `src/app/core/flatten.ts`, `hash.ts`, `reconcile.ts` + specs.

**Interfaces (Produces):**
```ts
export function flattenToV1(items: TopItem[]): V1Shortcut[];  // spec §6.4a flatten rule
export function stableHash(value: unknown): string;           // FNV-1a 32-bit hex over JSON.stringify with sorted keys
export function reconcile(v2: TopItem[], mirror: V1Shortcut[], newId?: () => string): TopItem[]; // spec §6.4a step 2
```

- [ ] Tests: flatten output passes a copy of v2.6.0's `isValidShortcutData` (paste it into the spec file as `legacyValidate`); `migrateV1toV2(flattenToV1(x)).items` has the same link ids per group as `x`; `stableHash` equal for key-reordered objects, differs on one-char change. Reconcile cases, each its own `it`: unchanged mirror → deep-equal v2; renamed link → name changed, section kept; link added in mirror → appended to first section; link deleted in mirror → gone; group added → one `General` section; group deleted → gone; top-level reorder → v2 order follows mirror; link moved between groups in mirror → appears in target group's first section; empty sections kept.
- [ ] Run → fail. Implement. Run → pass.
- [ ] Commit `feat(storage): flat v1 mirror and reconcile for downgrade support`.

### Task 5: StorageService adapter + LinksStore

Closes review: P2 future-version handling, P3 `chrome?.storage` ReferenceError, Review Focus 1 and 2.

**Files:** Modify `src/app/services/storage.service.ts`. Create `src/app/services/links-store.ts`, `links-store.spec.ts`, `src/app/testing/fake-storage.ts`.

**Interfaces (Produces):**
```ts
// storage.service.ts
export abstract class KeyValueStorage {
  abstract getMany(keys: string[]): Promise<Record<string, unknown>>;
  abstract setMany(values: Record<string, unknown>): Promise<void>;  // one chrome.storage.local.set call
  abstract onChange(cb: (changedKeys: string[]) => void): () => void; // chrome.storage.onChanged or window 'storage'
}
@Injectable({providedIn:'root', useClass: BrowserStorage}) // chrome.storage.local when `typeof chrome!=='undefined' && chrome.storage?.local`, else localStorage
// links-store.ts
export type LoadStatus = 'loading' | 'ready' | 'readonly-future' | 'corrupt';
@Injectable({providedIn:'root'}) export class LinksStore {
  readonly items: Signal<TopItem[]>;          // sorted by position
  readonly status: Signal<LoadStatus>;
  readonly groups: Signal<GroupTile[]>;
  load(): Promise<void>;
  save(next: TopItem[]): Promise<void>;       // renumber top level, write v2 + mirror + mirrorHash in ONE setMany; throws when status !== 'ready'
  update(fn: (items: TopItem[]) => TopItem[]): Promise<void>;
  rawForExport(): Promise<unknown>;           // raw stored value when corrupt
}
```
`src/app/testing/fake-storage.ts`: `FakeStorage extends KeyValueStorage` with in-memory map, `failNextSet` flag, `emitChange(keys)`.

- [ ] Tests: first upgrade (only `savedLinks` v1) → `savedLinks_backup_v1` equals raw v1, `savedLinks_v2.data` migrated, `savedLinks` rewritten as flatten, `mirrorHash` matches; second load with no change → no writes; mirror edited (simulate v2.6.0) → reconciled, `savedLinks_backup_v2_prereconcile` written; quarantine stored when present; future v3 → status `readonly-future`, `save` rejects, zero writes; corrupt → status `corrupt`, zero writes, `rawForExport` returns raw; `failNextSet` during save → both keys unchanged and `items` signal unchanged; `emitChange(['savedLinks_v2'])` → store reloads and `items` reflects new data; `setMany` called once per save with both keys.
- [ ] Run → fail. Implement. Run → pass.
- [ ] Commit `feat(storage): versioned links store with dual write and reconcile`.

### Task 6: Section and link operations

Closes review: P1 position collisions, P1 cached-array mutation.

**Files:** Create `src/app/core/section-ops.ts` + spec.

**Interfaces (Produces):** all pure, return new arrays, never mutate input, renumber touched lists.
```ts
export function addShortcut(items: TopItem[], name: string, url: string, now: number, id?: string): TopItem[];
export function updateTile(items: TopItem[], id: string, patch: { name?: string; url?: string }): TopItem[]; // keeps position
export function addGroup(items: TopItem[], name: string, now: number, id?: string): TopItem[]; // 1 General section
export function removeTile(items: TopItem[], id: string): TopItem[];
export function moveTile(items: TopItem[], from: number, to: number): TopItem[];
export function addSection(g: GroupTile, name: string, id?: string): GroupTile;
export function renameSection(g: GroupTile, sectionId: string, name: string): GroupTile;
export function deleteSection(g: GroupTile, sectionId: string): GroupTile; // links → end of first remaining section; throws if last
export function moveSection(g: GroupTile, from: number, to: number): GroupTile;
export function patchSection(g: GroupTile, sectionId: string, patch: Partial<Pick<Section,'color'|'collapsed'|'sort'>>): GroupTile;
export function addLink(g: GroupTile, sectionId: string, name: string, url: string, now: number, id?: string): GroupTile;
export function updateLink(g: GroupTile, linkId: string, patch: { name?: string; url?: string }): GroupTile;
export function removeLink(g: GroupTile, linkId: string): GroupTile;
export function moveLink(g: GroupTile, fromSectionId: string, toSectionId: string, fromIndex: number, toIndex: number): GroupTile;
// indexes are MANUAL-order indexes; when target section sort !== 'manual', toIndex is ignored and the link is appended
export function replaceGroup(items: TopItem[], g: GroupTile): TopItem[];
```

- [ ] Tests: `updateTile` keeps position (regression for rename-moves-group); after `removeTile` then `addShortcut`, positions are unique and contiguous; `deleteSection` moves 3 links to end of first section in order; deleting last section throws `'Cannot delete the last section'`; `moveLink` across sections preserves ids and renumbers both; into a sorted section appends; `addLink` sets `createdAt=now`; inputs deep-equal before/after (no mutation, check with `structuredClone` snapshot).
- [ ] Run → fail. Implement. Run → pass.
- [ ] Commit `feat(core): immutable group, section and link operations`.

### Task 7: Main page and dialogs on LinksStore

Closes review: P1 rename moves group, P1 `track $index` (main grid), P1 in-place `sort`, P2 inverted dialog title, P2 un-awaited save, P2 stale sidebar, P2 subscription leaks, P2 `disableClose`. One commit per finding where the diff is separable.

**Files:** Create `components/name-dialog/`, `components/link-dialog/`, `components/confirm-dialog/`, `services/notify.service.ts`. Modify `app.ts`, `app.html`, `group-link/*`, `link/*`. Delete `save-links.ts(+spec)`, `group-name/`, `group-shortcut/`, `shortcut-dialog/`.

**Interfaces (Produces):**
```ts
// NameDialog data: { title: string; label: string; initial?: string; confirmText: string } → closes with trimmed string | undefined
// LinkDialog data: { title: 'Add link' | 'Edit link'; initial?: { name: string; url: string } } → closes with { name, url: normalizeUrl(url) } | undefined; rejects isUnsafeUrl with field error "This URL type is not allowed"
// ConfirmDialog data: { title: string; message: string; confirmText: string; danger?: boolean } → boolean
// NotifyService: info(msg: string): void; error(msg: string): void   // MatSnackBar, 4000 ms
```
- [ ] App component: `items = store.items`; `@for (link of store.items(); track link.id)`; all writes via `store.update(fn => sectionOps…)`; `await` and `notify.error` on rejection.
- [ ] Tests (component, with `FakeStorage` provided as `KeyValueStorage`): renaming a group via NameDialog result keeps its index in the rendered grid; adding a shortcut after deleting one renders tiles in stable order; LinkDialog title text is `Add link` when no `initial`.
- [ ] Build + test pass. Commits as listed.

### Task 8: Link stats + opener

**Files:** Create `services/link-stats.service.ts`, `services/link-opener.service.ts` + specs. Manifest keeps `tabs`.

**Interfaces (Produces):**
```ts
export interface LinkStat { count: number; lastOpenedAt: number }
export class LinkStatsService { readonly stats: Signal<Record<string, LinkStat>>; load(): Promise<void>; record(ids: string[], now?: number): Promise<void>; }
export class LinkOpenerService {
  open(link: { id: string; url: string }, opts?: { background?: boolean }): Promise<void>; // record first, then chrome.tabs.create({url, active: !background}) or window.open(url,'_blank','noopener')
  openAll(links: { id: string; url: string }[]): Promise<boolean>; // > 10 links → ConfirmDialog "Open N links in new tabs?"; returns false if cancelled; tabs inactive, in order
}
export const OPEN_ALL_CONFIRM_THRESHOLD = 10;
```
- [ ] Tests: `record(['a','a','b'])` → a.count 2; `open` calls `record` before `tabs.create` (call order); `openAll` 18 links → confirm shown; cancel → no tabs; accept → 18 `tabs.create` calls with `active:false` in order; 3 links → no confirm.
- [ ] Main-page `<a>` tiles call `opener.open` on click (keep `href` for middle-click / a11y; `preventDefault` on plain left click only).
- [ ] Run → fail → implement → pass. Commit `feat: link usage stats and opener`.

### Task 9: Sort functions

**Files:** Create `src/app/core/sort.ts` + spec.

```ts
export function sortLinks(links: readonly LinkItem[], mode: SortMode, stats: Record<string, LinkStat>): LinkItem[];
```
Rules exactly as spec §8 table; `Intl.Collator(undefined, {numeric: true, sensitivity: 'base'})` for `az`.

- [ ] Tests: `manual` by position; `az` puts `Git - 2` before `Git - 10`; `recent` dated desc then undated in position order; `most-used` count desc, then lastOpenedAt desc, then position; input array and positions unchanged.
- [ ] Run → fail → implement → pass. Commit `feat(core): per-section sort modes`.

### Task 10: Group dialog as columns

Closes review: P1 `track $index` (dialog), P2 narrow-window dialog, P2 stale sidebar.

**Files:** Rewrite `components/group-dialog/*`. Create `components/section-column/*`, `components/link-row/*`.

**Interfaces:**
- `GroupDialog` data `{ groupId: string }`; reads group from `store.groups()` (live). Sidebar = `store.groups()`; below 640 px dialog width → `<select>` instead of sidebar.
- `SectionColumn` inputs `group: GroupTile`, `section: Section`, `stats`; outputs none (calls store directly). Header: name, count badge, colour accent, sort `mat-menu` (Manual / A–Z / Recently added / Most used, checkmark on current), **Open all** button (`aria-label="Open all links in {{name}}"`), section menu (Rename, Colour, Collapse/Expand, Delete). Body: `cdkDropList` with `[cdkDropListData]="section.id"`, `[cdkDropListSortingDisabled]="section.sort !== 'manual'"`, rows from `sortLinks(...)`, `track link.id`; footer "Add link".
- Columns container: `cdkDropListGroup` for links; separate horizontal `cdkDropList` for column reorder using a `cdkDragHandle` on headers. Drop handler maps view index → manual index (find link id in manual order) then calls `moveLink`.
- `LinkRow` input `link`, `stats`; row is an `<a>` (open via opener), menu Edit / Remove with aria-labels.
- Colour presets (Claude's call): 8 tokens `--accent-1..8` in `tokens.css`.
- [ ] Component tests: renders one column per section in position order; `Add section` via NameDialog adds a column; deleting a section with links shows ConfirmDialog then links appear in first column; sort menu `A–Z` reorders rows and stored positions are unchanged; drop event between columns calls `moveLink` with manual indexes; Open all calls `opener.openAll` with the section's links in **displayed** order.
- [ ] Manual check on `http://127.0.0.1:4300` with imported data: drag link between columns, drag column header, collapse persists after reload.
- [ ] Commit `feat(group): sections as side-by-side columns` (+ separate commits for column reorder and sort UI if large).

### Task 11: Search

**Files:** Create `src/app/core/fuzzy.ts`, `search.ts` + specs; `components/search-box/*`.

```ts
export function fuzzyScore(query: string, text: string): number | null; // null = no match; normalise NFD + strip diacritics + lowercase; exact > prefix > substring > subsequence; allow 1 typo (edit distance ≤ 1) for queries ≥ 4 chars
export interface SearchEntry { linkId: string; name: string; url: string; host: string; path: string[]; } // path: ['Propera','Git','Git - CMS'] or ['Gmail']
export function buildIndex(items: TopItem[]): SearchEntry[];
export interface SearchResult { query: string; matches: SearchEntry[]; noMatch: boolean; all: SearchEntry[] }
export function search(index: SearchEntry[], query: string, stats: Record<string, LinkStat>, limit = 20): SearchResult;
```
- [ ] Core tests: `strpi` matches `Strapi CMS`; `figma` matches by host; `git` matches section name `Git` → all its links; prefix outranks substring; ties by stats count; `c++`, `(`, `[` → no throw; `zzzz` → `noMatch:true`, `all` = every link; accent `café` matches `cafe`.
- [ ] `SearchBox` (placed above the grid in `app.html`; grid untouched): `/` focuses unless `document.activeElement` is an input/textarea/contenteditable; `Ctrl+K`/`Cmd+K` focuses and `preventDefault`; ↑/↓ moves `aria-activedescendant`; Enter → `opener.open`; Ctrl/Cmd+Enter → `{background:true}`; Esc clears, second Esc blurs; no-match heading text exactly `No links match "‹query›"`, then `all` grouped by path[0] › path[1]. ARIA: `role="combobox"` input, `role="listbox"` panel.
- [ ] Component tests for each key above.
- [ ] Commit `feat(search): fuzzy core` and `feat(search): search box with keyboard navigation`.

### Task 12: Import / export / backups

Closes review: P1 import without confirm/backup, P2 export without version.

**Files:** Create `src/app/core/import-export.ts` + spec. Modify app data menu.

```ts
export interface ExportFile { app: 'custom-homepage'; version: 2; exportedAt: string; links: TopItem[]; linkStats?: Record<string, LinkStat> }
export function buildExport(items: TopItem[], stats: Record<string, LinkStat>, now: Date): ExportFile;
export function parseImport(json: string): { items: TopItem[]; skipped: { name: string; reason: 'unsafe-url' }[]; stats?: Record<string, LinkStat> } ; // throws Error('Invalid file') on unknown shape
```
- [ ] Tests: v2 export round-trips; bare v1 array (old export) migrates; `{version:1,data}` migrates; `javascript:` link skipped and listed; garbage → throws `Invalid file`.
- [ ] Menu: Export, Export for v2.x (`flattenToV1`), Import (ConfirmDialog `Replace N items with M items?` + skipped list; writes `savedLinks_backup_preimport` first), Download backup (each backup key present).
- [ ] Commit `feat(data): versioned export, safe import with backup`.

### Task 13: Favicons + permissions

Closes review: P1 Google favicon leak, P1 unused host permissions.

**Files:** Create `components/favicon/*`. Modify `link`, `group-link`, `link-row`, `search-box` templates; `src/manifest.json`.

- `Favicon` inputs `url: string`, `name: string`, `size = 32`. When `chrome.runtime?.id` and `/^https?:/` url → `<img [src]="chrome.runtime.getURL('/_favicon/') + '?pageUrl=' + encodeURIComponent(url) + '&size=' + size">`; on `(error)` or otherwise → letter avatar (first letter of name, uppercase; background from hash of hostname into 8 accent tokens).
- Manifest `permissions: ["storage","tabs","favicon"]`; remove `host_permissions`.
- [ ] Tests: `file:///C:/a` → avatar; `52.0.205.252` → avatar; `''` → avatar with name letter; https outside extension (jsdom, no `chrome.runtime`) → avatar; img error → avatar.
- [ ] Manual (owner, Brave + Chrome): favicons render on the real new tab.
- [ ] Commits `fix(privacy): load favicons via _favicon api` and `fix(manifest): least-privilege permissions`.

### Task 14: Backgrounds on IndexedDB

Closes review: P1 data URLs/quota, P1 slider writes, P2 rAF loop/unused `--theme-rgb`, P2 8× async, P2 bypassing storage layer, P3 `Date.now()` ids, P3 duplicate colour logic.

**Files:** Create `services/background.store.ts` + spec, `components/background-dialog/*`. Delete `video.service.ts`, `workers/color-extraction.worker.ts` (if colour unused). Modify `app.ts/html`.

```ts
export interface Background { id: string; name: string; type: 'video'|'image'; blob: Blob; isActive: boolean; objectFit: 'cover'|'contain'|'fill'; brightness: number; blur: number }
export class BackgroundStore {
  readonly list: Signal<Omit<Background,'blob'>[]>; readonly active: Signal<{ meta: Omit<Background,'blob'>; objectUrl: string } | null>;
  load(): Promise<void>;                // one-time import of legacy `backgroundVideos` data URLs into IDB db `custom-homepage`, store `backgrounds`; legacy key left untouched (v2.6.0 can still read it)
  add(file: File): Promise<void>;       // max 3; crypto.randomUUID()
  remove(id: string): Promise<void>;
  setActive(id: string): Promise<void>;
  preview(patch: Partial<Pick<Background,'objectFit'|'brightness'|'blur'>>): void; // signal only
  commit(): Promise<void>;              // persist settings (called on slider `change`)
}
```
Use `fake-indexeddb` devDep for tests (verify it exists on npm before install).
- [ ] Tests: legacy data URL imported once (second load no duplicate); `preview` does not write; `commit` writes once; 4th add rejects `Maximum limit of 3 backgrounds reached`; object URLs revoked on switch.
- [ ] Remove the rAF loop and worker (no consumer of `--theme-rgb`), remove `colorDecoder`/`iconColor`; template uses `bg.active()` signal once.
- [ ] Background panel → `BackgroundDialog` (MatDialog: Esc, focus trap, `aria-labelledby`); copy "Stored locally in this browser."
- [ ] Commits per finding.

### Task 15: Main page review fixes

Closes review: a11y P1 ×3, P2 hidden data menu, P2 focus/reduced motion, UX P2 centring/clamp/empty state, P3 `alert()`.

**Files:** Modify `app.html`, `app.css`, `link/*`, `group-link/*`. Create `components/empty-state/*`.

- [ ] Add tile → `<button aria-label="Add shortcut or group">`; group tile → `<button aria-label="Open group {{name}}">`; menu buttons `aria-label="Options for {{name}}"`.
- [ ] Settings/data button always visible (top-right, 60 % opacity, 100 % on hover/focus).
- [ ] `:focus-visible` ring token; `@media (prefers-reduced-motion: reduce)` disables scale/rotate transitions and pauses background video (show poster frame).
- [ ] Grid `auto-fill` → `auto-fit` + `justify-content:center`; tile size unchanged.
- [ ] Names: `line-clamp-2` + `[title]`.
- [ ] `EmptyState` when `store.items().length === 0`: heading "Your new tab is empty", buttons "Add shortcut", "Add group", "Import data".
- [ ] All `alert()` → `notify.error`.
- [ ] Status banner (spec §6.2): `store.status()==='readonly-future'` → "Your links were saved by a newer version. Editing is disabled." ; `'corrupt'` → "Saved links could not be read. Nothing was overwritten." + button "Export raw data" (`store.rawForExport()`). Edit controls disabled in both. Test both banners.
- [ ] Un-todo the `app.spec.ts` test; add tests: empty state renders with zero items; Tab order reaches add button and group tile; Enter on group tile opens dialog.
- [ ] One commit per bullet.

### Task 16: Tokens, fonts, schema cleanup

Closes review: P2 `CUSTOM_ELEMENTS_SCHEMA`/ripple, P2 remote fonts, P3 duplicate/undefined tokens, P3 `any` typings.

- [ ] Create `src/styles/tokens.css` with one `:root` set; define the previously undefined `--glass-highlight`, `--glass-blur-sm`, `--glass-bg-light`, `--glass-border-light`, `--glass-shadow-lg`, `--transition-smooth`; delete duplicates in `app.css`/`styles.css`.
- [ ] Remove `CUSTOM_ELEMENTS_SCHEMA`; import `MatRippleModule` where `matRipple` is used; fix any template errors this reveals.
- [ ] Local fonts: `npm i material-symbols @fontsource/roboto` (check package exists + size; budget: added fonts ≤ 1.5 MB in `dist/browser`), import CSS in `styles.css`, remove Google Fonts `<link>`s from `index.html`.
- [ ] Verify: build passes, `dist/browser` has no `fonts.googleapis.com` reference (`grep -r googleapis dist/browser` → nothing).
- [ ] Commits per bullet.

### Task 17: Release prep

- [ ] `npm audit fix` (no `--force`); bump Angular to latest 22.x if audit still flags `@angular/common`/`compiler`.
- [ ] Version `3.0.0` in `manifest.json` + `package.json`.
- [ ] README: Angular 22, `dist/browser/` load path, features (sections, search `/` `Ctrl+K`, sort, Open all, backups, downgrade note), test command; remove `ng e2e`.
- [ ] Commits `chore: dependency audit fixes`, `chore: release 3.0.0`, `docs: update readme`.

---

## Not in this plan

- Phase 3 visual redesign directions (proposed separately after this lands; owner picks one).
- Section icons (spec: colour only).
