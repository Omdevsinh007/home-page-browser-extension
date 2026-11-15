# Design: Sections inside groups, search, sorting (v3.0.0)

Status: ready for owner approval · Date: 2026-11-11 · Branch: `feature/link-sections-search-ui`

Companion doc: `docs/review.md` (Phase 1 findings). All findings there are approved for fixing.

## 1. Intent

The owner keeps project links in groups. Their real "Propera" group holds 18 links in one flat
grid: 7 GitHub repos/issues, 3 environments (Vercel demo, Strapi, Swagger), 2 Figma files,
6 docs (Google Docs, Keep, SOW). Many share the same GitHub favicon, so finding the right one
means reading every tile.

They want, **when they open a group, every kind of link separated but visible in one place**:
no tabs, no "General" page to switch to. They chose **side-by-side columns** (mockup C).

They also want one search box that finds any link, and per-section sorting that never loses
their manual order.

## 2. Goals

1. A group contains named **sections**, shown as **side-by-side columns** in the group dialog.
2. Users create, rename, delete, reorder sections, and drag links within and between sections.
3. Existing data (StorageData v1) migrates to v2 with **zero loss**.
4. A **search box** on the new tab page finds links across shortcuts, groups and sections.
5. Per-section **sorting**: manual (default), A–Z, recently added, most used.
6. Fix every finding in `docs/review.md`, each in its own commit.

## 3. Non-goals

- Main page tiles do **not** get new features (owner: "do not touch the tiles on main page"): no
  sections preview, no link-count badge, same size and shape. Group tiles keep their favicon preview
  and name. **Review fixes are applied** even where they change the main page (owner: "fix them now"),
  see §11.
- No web-search fallback in the search box.
- No automatic sectioning by URL/name. The owner splits groups themselves.
- No sync across devices (`chrome.storage.sync`), no accounts, no analytics.
- No visual redesign of the whole page. That is Phase 3, proposed separately.

## 4. Anti-goals (failure even if it "works")

- Any saved link lost or reordered by migration or by a sort.
- Owner has to click through tabs/pages to see a group's links.
- A link's URL or usage data leaves the browser.
- Downgrading to v2.6.0 corrupts data silently (see §6.4 backup).

## 5. Group dialog: columns layout

Decided with the owner (mockup C):

- Dialog header: group name, group menu (edit name, delete group), close.
- Body: one **column per section**, ordered by `section.position`, left to right.
  - Column header: section name, link count badge, optional colour accent, a **sort** control,
    an **Open all** button, and a section menu (rename, colour, delete).
  - Column body: compact **link rows** (favicon + name; hostname as secondary text).
  - **Click a row** opens that single link (same behaviour as today: new tab, `noopener`).
  - **Open all** opens every link in that section in new tabs (owner wants both single and all).
- "Add section" control at the end of the column row. "Add link" control at the bottom of each column.
- A group with only the default section shows one column (looks like a list).
- Sidebar group switcher (exists today) stays, and must reflect live data (fixes review finding).
- Responsive: columns wrap; below ~640 px dialog width, columns stack vertically and the group
  sidebar collapses to a dropdown/select. Exact breakpoints: builder's call.

Builder's call: column width, row density, colour palette (≤ 8 preset accents), animation.

### 5.1 Section operations

| Operation | Behaviour |
|---|---|
| Create | Name required, trimmed, non-empty. Appended last. |
| Rename | Inline or small dialog. Same validation. |
| Delete | If it has links: confirm, then move its links to the end of the **first** section (by position). Deleting the last remaining section is not allowed. |
| Reorder | Drag column headers (CDK drop list, horizontal). |
| Move link | Drag a row within a column or into another column (CDK connected drop lists). Dropping into a column whose sort is not manual: link is appended to that section's manual order; view stays sorted. |
| Collapse | Per section, persisted (`collapsed`). Collapsed column shows header only. |

Default section name for migrated/new groups: **"General"**. It is a normal section: renamable,
deletable when it is not the last one.

## 6. Data model and migration

### 6.1 v2 model (`src/app/models/`)

```ts
type SortMode = 'manual' | 'az' | 'recent' | 'most-used';

interface LinkItem {          // was `Group` in v1 (misnamed)
  id: string;
  name: string;
  url: string;
  position: number;           // manual order, 0..n-1, always contiguous after writes
  createdAt?: number;         // epoch ms; absent on migrated links
}

interface Section {
  id: string;
  name: string;
  position: number;
  color?: string;             // one of the preset accent tokens
  collapsed?: boolean;
  sort: SortMode;             // default 'manual'
  links: LinkItem[];
}

interface ShortcutTile {
  id: string;
  type: 'Shortcut';
  name: string;
  url: string;
  position: number;
  createdAt?: number;
}

interface GroupTile {
  id: string;
  type: 'Group';
  name: string;
  position: number;
  createdAt?: number;
  sections: Section[];        // at least one
}

type TopItem = ShortcutTile | GroupTile;
```

Storage (owner-approved, for downgrade support, see §6.4a):
- `savedLinks_v2`: `{ version: 2, data: TopItem[], mirrorHash: string }` — source of truth for v3.
- `savedLinks`: `{ version: 1, data: Shortcut[] }` — **flat v1 mirror**, rewritten on every save.
- `CURRENT_VERSION = 2`.

**Usage stats** live in a separate key `linkStats` (unversioned map is fine, but use the same wrapper
for consistency): `Record<linkId, { count: number; lastOpenedAt: number }>`. Separate key so a click
does not rewrite all links, and so stats can be cleared independently. Counted on every open:
main-page shortcut, group row, search result, "Open all" (each link +1).

### 6.2 v1 → v2 migration (`StorageService.migrateData`)

Input shapes the code must accept:

| Input | Result |
|---|---|
| `{ version: 1, data: Shortcut[] }` | migrate |
| Legacy unversioned `Shortcut[]` (pre-wrapper) | treat as v1, migrate |
| `undefined` / `null` / missing key | `[]` |
| `{ version: 2, data }` | return as-is (validated) |
| `{ version: > 2 }` | return data **read-only**; app shows a banner "Data from a newer version"; no writes |
| Corrupt (not array, wrong types, JSON parse error) | do **not** overwrite storage; keep raw copy; app starts empty with an error banner offering "Export raw data" |

Per item rules:

- `type: 'Shortcut'` → `ShortcutTile` (drop `group`; `url ?? ''`; `name ?? ''`).
- `type: 'Group'` → `GroupTile` with exactly one section
  `{ id: uuid, name: 'General', position: 0, sort: 'manual', links }`,
  where `links` = old `group ?? []`, sorted by old `position`, then **renumbered 0..n-1**
  (stable: ties keep array order). Drop group `url`.
- Top-level items: sort by `position` (stable), renumber 0..n-1. This repairs the duplicate
  positions seen in the owner's real data (`1,1,2,3,...`).
- Unknown `type` items: keep in a `quarantine` array in a separate key `savedLinks_quarantine`,
  never silently dropped.
- IDs preserved exactly.

Migration is a **pure function** (`migrateV1toV2(data): TopItem[]`) in its own file, fully unit
tested, then wired into `StorageService`.

### 6.3 When migration writes

On first load after upgrade (`savedLinks_v2` absent): read `savedLinks` (v1) → back up (§6.4) →
migrate in memory → write `savedLinks_v2` + rewrite `savedLinks` mirror. Write only after backup succeeded.

### 6.4 Backup

- Before the first v2 write, copy the raw v1 value to key `savedLinks_backup_v1` (once; never overwritten).
- Before every **import**, copy the current value to `savedLinks_backup_preimport` (overwritten each time).
- Settings/data panel: "Download backup" for both, if present.

### 6.5 Export / import

- Export file: `{ app: 'custom-homepage', version: 2, exportedAt: ISO, links: TopItem[], linkStats? }`.
  Backgrounds are **not** exported (size). Builder's call whether to add a separate background export.
- Import accepts: v2 export object, a bare v1 array (old exports), and `{version:1,data}`.
  Runs the same migration + validation. Shows a confirm: "Replace N items with M items?".
- URL rule (**Claude's call**): **denylist** of `javascript:`, `data:`, `vbscript:` schemes; everything
  else allowed (`http(s)`, `file`, `chrome://`, `brave://`, `chrome-extension://`, `mailto:`, deep links).
  On **import**, a bad item is skipped and listed in the confirm dialog ("2 links skipped: unsafe URL");
  the rest imports. On **migration** of stored data nothing is dropped: links keep their URL as-is
  (Angular sanitises `href` at render), so zero-loss holds.

### 6.4a Version support: downgrade and re-upgrade (owner-approved)

Goal: owner can go back to v2.6.0 and forward again without losing links.

- **Dual write.** Every save writes `savedLinks_v2` (truth) and `savedLinks` (flat v1 mirror).
  Flatten rule: top items as-is; each group → `group: LinkItem[]` = sections by `position`, then links
  by `position`, renumbered 0..n-1; `type`, `id`, `name`, `position` kept; group `url: ''`.
  Writes are ordered: v2 first, then mirror; `mirrorHash` = stable hash of the mirror's `data` JSON.
- **v2.6.0 behaviour:** reads `savedLinks`, works normally, shows all links flat (no sections).
  Its writes keep `version: 1`, so the mirror stays valid v1.
- **Re-upgrade (load in v3):**
  1. `savedLinks_v2` present and `hash(savedLinks.data) === mirrorHash` → use v2 as-is.
  2. Hash differs → the old version edited data. **Reconcile** (pure function, unit tested):
     - top items: order, names, URLs, add/delete taken from the mirror;
     - for groups that still exist: links whose `id` exists in v2 keep their section and in-section
       order; changed name/url taken from mirror; links new in the mirror go to the **first** section
       appended in mirror order; links missing from the mirror are deleted;
     - new groups in the mirror → one "General" section; sections left empty are kept (owner may want them).
     - Then back up the pre-reconcile v2 to `savedLinks_backup_v2_prereconcile` and save normally.
  3. `savedLinks_v2` absent → first upgrade path (§6.3).
- **Shape check:** never trust `version` alone. `sections` present → v2 shape; `group` present → v1 shape.
- `linkStats` is ignored by v2.6.0 and survives untouched.
- Export menu also offers "Export for v2.x" (the mirror) for manual rollback.
- Storage cost: ~2× link data (owner's data: ~7 KB → ~14 KB). Fine within quota.

### 6.6 Tests (TDD, write first)

Fixtures in `src/app/services/__fixtures__/`:
- `v1-real-shape.json` — anonymised copy of the owner's shape (9 top items, 8 groups,
  18-link group, duplicate top positions). Names/URLs replaced.
- `legacy-unversioned.json`, `empty.json`, `corrupt-*.json` (string, object, wrong field types),
  `v2.json`, `future-v3.json`.

Must assert: item count, every id kept, link order kept, positions contiguous, backup written,
no write on corrupt/future data.

Version-support tests: flatten(v2) is valid v1 and v2.6.0's validator (`isValidShortcutData`) accepts it;
round trip migrate(flatten(v2)) keeps every link; reconcile cases — unchanged mirror, renamed link,
link added in old version, link deleted in old version, group added, group deleted, reorder in old version.

## 7. Search

Decided with the owner:

- One input at the top of the new tab page. Focus with `/` or `Ctrl+K` (also `Cmd+K`).
  `/` must not trigger while typing in another input.
- Matches: link name, URL (hostname + path), group name, section name, top-level shortcut name/URL.
  Case-insensitive, accent-insensitive, **tolerant of small typos** (owner: "strpi" → Strapi).
- Results panel under the input. Each row: favicon, link name, path
  `Group › Section › Link` (shortcut: just name), hostname. Ranked: exact/prefix name match >
  substring > fuzzy; ties by most used.
- Keyboard: ↑/↓ move, **Enter opens in a new foreground tab** (same as clicking a tile today),
  Ctrl/Cmd+Enter opens in a background tab, Esc clears, Esc again blurs (**Claude's call**).
  Use `chrome.tabs.create` when available, `window.open(url, '_blank', 'noopener')` otherwise.
  Increment the use counter **before** opening.
- **No match:** heading *No links match "‹query›"*, then **all links listed below**, grouped
  Group › Section, still clickable and keyboard navigable (owner's request).
- Empty query: panel closed.
- Opening a result counts as a use (§6.1).

Builder's call: fuzzy algorithm (small in-house scorer preferred over a dependency; if a dependency,
it must be tiny and maintained), debounce, max results before "show more".

Search must not change the main tiles layout: it is an input above the grid plus an overlay panel.

## 8. Sorting

Per section, stored in `section.sort`. Default `manual`.

| Mode | Order | Ties |
|---|---|---|
| manual | `position` | — |
| az | `name`, locale compare, numeric aware | position |
| recent | `createdAt` desc; links without `createdAt` after dated ones, in position order | position |
| most-used | `linkStats.count` desc, then `lastOpenedAt` desc | position |

- Sorting is a **view only**: it never writes `position`. Switching back to manual shows the saved order.
- In non-manual modes, drag **within** the column is disabled (the column shows a small
  "sorted by …" hint); drag **into** the column still works (appends to manual order).
- Sort functions are pure and unit tested.
- New links get `createdAt = Date.now()`.

Top-level main grid: no sort (tiles untouched).

## 9. Permissions

From review + this feature:

- Keep `storage`.
- Keep `tabs`: needed for **Open all** (`chrome.tabs.create({ url, active: false })` per link, avoids
  pop-up blocking).
- Remove `host_permissions` `https://*/*` and `file:///*` (unused).
- Add `favicon` and use the MV3 `_favicon` endpoint instead of Google's service (privacy).
  **Builder must verify** with docs that `_favicon` works in Chrome and Brave; fallback = letter avatar.
- Add `unlimitedStorage` **only if** backgrounds stay in `chrome.storage.local`; preferred fix is
  IndexedDB for blobs (then not needed). Builder's call, state it in the plan.

## 10. Bug fixes in scope

All of `docs/review.md`, each its own commit, test first where testable. Notably: env files /
build on clean clone, jsdom + real tests, rename-moves-group, position collisions, `track` by id,
no in-place mutation, slider writes, rAF loop, single `activeVideo` signal, local fonts, undefined
CSS tokens, keyboard access, aria-labels, README.

## 11. Constraints

- Angular 22 standalone, signals, `inject()`, OnPush, zoneless, Tailwind 4, Material icons, CDK drag-drop.
  Check APIs with Context7 before use.
- Data must survive upgrade from v2.6.0. Version bump to **3.0.0** in `manifest.json` and `package.json`.
- Main page tiles: no new features. Review fixes **are** applied there, each its own commit
  (owner: "fix them now"): centred grid, always-visible data/settings button, first-run empty state,
  background panel as an accessible dialog, snackbar instead of `alert()`, letter-avatar favicon
  fallback, keyboard access + aria-labels + focus ring, and long-name clamp to 2 lines with `title`
  (**Claude's call**: clamp included as it is a review finding).
- `npm run build` and `npm test` green after each phase.
- No commits to `main`, no push.

## 12. Left to the builder

Column/row visual details, colour presets, fuzzy scorer, debounce, breakpoints, IndexedDB vs
`unlimitedStorage`, component split, file layout, background export.

## 13. Calls made by Claude (not owner decisions — please check)

1. Section delete moves links to the first section; last section cannot be deleted.
2. No auto-sectioning by URL.
3. Typo-tolerant search; Ctrl+Enter = background tab.
4. Click stats in a separate `linkStats` key.
5. Non-manual sort disables in-column drag.
6. Future-version data is read-only; corrupt data is never overwritten.
7. Export excludes backgrounds.
8. Keep `tabs` permission for Open all (owner confirmed wanting Open all).
9. URL denylist; import skips unsafe items; migration drops nothing (§6.5).
10. ~~Downgrade unsupported~~ → owner chose full version support: dual write + reconcile (§6.4a).
    Reconcile details (new links → first section, empty sections kept) are Claude's call.
11. Search Enter = new foreground tab, consistent with tiles (§7).
