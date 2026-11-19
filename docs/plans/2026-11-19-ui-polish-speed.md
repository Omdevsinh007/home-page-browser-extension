# UI Polish + Speed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menus that land right, legible search with match highlighting, concentric hover shapes, and a page that shows tiles on the first frame with roughly half the startup JS.

**Architecture:** Every `mat-menu` becomes `@angular/aria` menu directives (`ngMenuTrigger`/`ngMenu`/`ngMenuItem`/`ngMenuContent`) rendered in a `cdkConnectedOverlay` with shared positions and CSS. Dialogs and the snackbar load through dynamic `import()` behind two small loader services. `LinksStore` paints from a synchronous `localStorage` render snapshot while the real async load runs.

**Tech Stack:** Angular 22 (zoneless, signals, OnPush), `@angular/aria` 22, `@angular/cdk/overlay`, Angular Material (dialog, snackbar, icon, form field), Tailwind 4, Vitest + jsdom.

**Spec:** `docs/specs/2026-11-19-ui-polish-speed-design.md`

## Global Constraints

- Angular 22 zoneless + OnPush + signals; match existing code style (standalone components, `inject()`, `host` metadata).
- Check `@angular/aria` menu and CDK overlay APIs in the installed typings (`node_modules/@angular/aria/types/menu.d.ts`, `node_modules/@angular/cdk/types/overlay.d.ts`) and the angular.dev `guide/aria/menu` docs before use.
- Colours only via tokens in `src/styles/tokens.css`; `npm run check:styles` must pass.
- Concentric rule: inner radius = outer radius − inset. Panel 18 / padding 4 → item 14. Results 18 / padding 8 → row 10.
- Popover positions: below-centre (offsetY 8), above-centre (offsetY −8), below-end, below-start; viewport margin 8px.
- Popover motion: opacity 0→1 + scale 0.96→1, 120ms ease-out, origin at the edge nearest the trigger; reduced motion: opacity only.
- Snapshot never written to `chrome.storage`; editing blocked until real load finishes.
- Baseline: `npx ng test --watch=false` = 25 files / 244 tests passing; `main.js` 755.00 kB raw.
- Do not commit unless the user asks. "Commit" steps below mean: stage nothing, just check `git status` is limited to the task's files.

## Review Focus

1. Menu on a tile at the right/bottom viewport edge (narrow window, last tile) must flip and stay fully on screen — Task 2 test asserts the position list order; Task 8 checks it in Chrome at 800px width.
2. Clicking Add → "Add shortcut" twice fast, or before the dialog chunk is loaded, must open exactly one dialog — Task 6 test `opens one dialog when asked twice while loading`.
3. A stale, corrupt or wrong-shape snapshot (`"x"`, `{}`, `[{}]`, old v1 array) must be ignored, never crash, never be saved — Task 7 tests.
4. Highlight with case/diacritics (`cafe` vs `Café`, `GIT` vs `GitHub`) must mark the original characters — Task 4 tests.
5. Choosing a menu item that opens a dialog must close the menu first and, after the dialog closes, focus must not be lost to `<body>` — Task 2 test `closes the menu before the dialog opens`.

---

### Task 0: Baseline measurement

**Files:**
- Modify: `src/app/components/link/link.html` (add `elementtiming="tiles"` to the tile name text; Element Timing API needs text/image)
- Create (scratchpad, not repo): `serve-dist.mjs` — zero-dep `node:http` static server for `dist/browser` (or the build's output folder) on port 4310

- [ ] **Step 1:** Add `elementtiming="tiles"` to the `.shortcut-name` span in `src/app/components/link/link.html` (first shortcut renders text → entry recorded).
- [ ] **Step 2:** `npx ng build`; record `main.js` raw size.
- [ ] **Step 3:** Serve dist, open in Chrome with the seeded test data (8 shortcuts + "Work" group in `localStorage.savedLinks`), reload 3×, read per load:
  `performance.getEntriesByType('paint')` FCP, and `await new Promise(r=>new PerformanceObserver(l=>r(l.getEntries()[0].renderTime)).observe({type:'element',buffered:true}))`.
- [ ] **Step 4:** Write the numbers into a `## Measurements` section at the bottom of this plan (baseline row).

---

### Task 1: Popover primitives (positions, placement, CSS)

**Files:**
- Create: `src/app/core/popover.ts`
- Create: `src/app/core/popover.spec.ts`
- Create: `src/styles/popover.css` (imported from `src/styles.css` after `tokens.css`)
- Modify: `src/styles/tokens.css` (add `--radius-menu-item: 14px`, `--radius-result-row: 10px`, `--glass-fill-results`, concentric-rule comment)

**Interfaces:**
- Produces:
  - `POPOVER_POSITIONS: ConnectedPosition[]` (order from Global Constraints)
  - `SUBMENU_POSITIONS: ConnectedPosition[]` — end/top (offsetX 4) then start/top (offsetX −4)
  - `type Placement = 'below' | 'above' | 'end' | 'start'`
  - `placementOf(pair: ConnectionPositionPair): Placement`
  - CSS classes: `.popover-menu` (panel), `.popover-item` (row; `[data-active]`/`:focus-visible`/`:hover` fill, `.danger` variant), `.popover-separator`; overlay pane attribute `data-placement` drives `transform-origin` (`below` → top centre, `above` → bottom centre, `end` → left top, `start` → right top); `@keyframes popover-in`; `prefers-reduced-motion` → opacity only.

- [ ] **Step 1: Write failing tests** in `popover.spec.ts`:
  - `POPOVER_POSITIONS starts below-centre with an 8px gap` → `[0]` equals `{originX:'center',originY:'bottom',overlayX:'center',overlayY:'top',offsetY:8}`
  - `POPOVER_POSITIONS falls back above-centre, then below-end, then below-start` → `[1].overlayY==='bottom' && [1].offsetY===-8`, `[2].originX==='end'`, `[3].originX==='start'`
  - `placementOf maps overlayY top to below, bottom to above, overlayX start to end, end to start` (submenu pairs have `overlayY:'top'` with `originX:'end'` → `'end'`; check origin side first for submenu pairs: `originY==='top' && originX==='end'` → `'end'`, `originX==='start'` with `overlayX==='end'` → `'start'`)
- [ ] **Step 2:** `npx ng test --watch=false --include src/app/core/popover.spec.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement `popover.ts`; write `popover.css` (panel: `--glass-fill-dark` + full glass, radius `--radius-popover`, padding 4px, min-width 168px; item: min-height 36px, radius `--radius-menu-item`, padding 0 12px, `--text-sm`, gap 10px; no ripple).
- [ ] **Step 4:** Tests PASS; `npm run check:styles` PASS.

---

### Task 2: Add menu on `aria` menu + overlay

**Files:**
- Modify: `src/app/app.html:48-80`, `src/app/app.ts` (imports), `src/app/app.css:151-153` (delete `.mat-mdc-menu-content` rule)
- Test: `src/app/app.spec.ts`

**Interfaces:**
- Consumes: `POPOVER_POSITIONS`, `placementOf` (Task 1)
- Produces: the template pattern every later menu copies:
  ```html
  <button ngMenuTrigger #t="ngMenuTrigger" [menu]="m" cdkOverlayOrigin #o="cdkOverlayOrigin">…</button>
  <ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="o" [cdkConnectedOverlayOpen]="t.expanded()"
    [cdkConnectedOverlayPositions]="positions" [cdkConnectedOverlayViewportMargin]="8"
    (positionChange)="placement.set(placementOf($event.connectionPair))">
    <div ngMenu #m="ngMenu" class="popover-menu" (itemSelected)="onAdd($event)"> <ng-template ngMenuContent>…items…</ng-template></div>
  </ng-template>
  ```
  (Adjust to the documented aria+overlay pattern if it differs — e.g. where `ngMenu` must live relative to the overlay; keep behaviour identical.) Pane gets `data-placement` via `cdkConnectedOverlayPanelClass` or a host binding on the panel div — pick one and reuse it.
  Item selection goes through `(itemSelected)` with string values, not `(click)`.

- [ ] **Step 1: Write failing tests** in `app.spec.ts` (with seeded items so the Add tile renders):
  - `Add opens a menu with Add shortcut and Add group` → click Add, `document.querySelector('[role=menu]')` present, item texts `['Add shortcut','Add group']`, trigger `aria-expanded="true"`
  - `Escape closes the Add menu and returns focus to Add` → keydown Escape on menu; no `[role=menu]`; `document.activeElement` is the Add button
  - `closes the menu before the dialog opens` → select "Add group"; `[role=menu]` gone; a `mat-dialog-container` present; close dialog; `document.activeElement !== document.body`
  - `uses POPOVER_POSITIONS for the Add menu` → the overlay directive instance's `positions` is `POPOVER_POSITIONS`
- [ ] **Step 2:** Run app.spec → FAIL.
- [ ] **Step 3:** Migrate the Add menu; remove `MatMenuModule` from `App.imports`.
- [ ] **Step 4:** app.spec PASS; full suite PASS.

---

### Task 3: Remaining menus (tile, group dialog, section column) + drop `MatMenuModule`

**Files:**
- Modify: `src/app/components/link/link.{html,ts}`, `group-link/group-link.{html,ts}`, `group-dialog/group-dialog.{html,ts}`, `section-column/section-column.{html,ts}`
- Modify: `src/styles.css:114-142` (delete `.glass-menu` rules)
- Test: `link.spec.ts:60-80`, `group-link.spec.ts:55-65`, `group-dialog.spec.ts`, `section-column.spec.ts` (replace `[mat-menu-item]` with `[role^=menuitem]`)

**Interfaces:**
- Consumes: Task 1 primitives, Task 2 template pattern
- Sort menu: items `role="menuitemradio"` with `aria-checked`; Colour: `ngMenuItem [submenu]` + nested overlay using `SUBMENU_POSITIONS`; "Delete section" `[disabled]="!canDelete()"`; danger items `class="popover-item danger"`.

- [ ] **Step 1: Update/extend failing tests:**
  - existing item-text assertions now query `[role^=menuitem]` (fail until migrated)
  - `section-column: Colour opens a submenu with None + 8 colours` → 9 items in the second `[role=menu]`
  - `section-column: choosing a sort mode marks it aria-checked` → after selecting "A–Z" (use the label from `sortLabels`), that item `aria-checked="true"`
  - `section-column: Delete section is disabled when it is the only section` → item has `aria-disabled="true"`
- [ ] **Step 2:** Run those specs → FAIL.
- [ ] **Step 3:** Migrate the four templates; remove `MatMenuModule` imports.
- [ ] **Step 4:** `grep -rn "mat-menu\|MatMenu\|matMenu\|glass-menu" src` → no hits. Full suite PASS; `npm run check:styles` PASS.

---

### Task 4: Search — match ranges + highlight + styling

**Files:**
- Modify: `src/app/core/fuzzy.ts`, `src/app/core/search.spec.ts` (or new `fuzzy.spec.ts`)
- Modify: `src/app/components/search-box/search-box.{html,ts,css}`, `search-box.spec.ts`
- Modify: `src/styles/tokens.css` (`--glass-fill-results` from Task 1)

**Interfaces:**
- Produces: `matchRanges(query: string, text: string): [start: number, end: number][]` — half-open ranges in **original** `text` indexes; `[]` when no match or typo-only match. Exact/prefix/word-prefix/substring → one contiguous range (first occurrence, word-prefix preferred over substring); in-word subsequence → one range per character. Normalisation is per character (NFD + strip combining marks + lowercase), so build an index map original→normalised instead of normalising the whole string.
- `SearchBox.segments(entry): { text: string; hit: boolean }[]` (computed per option in the template via a pure helper `splitByRanges(text, ranges)` in `fuzzy.ts`).

- [ ] **Step 1: Write failing tests:**
  - `matchRanges prefix` → `matchRanges('gi','GitHub')` = `[[0,2]]`
  - `matchRanges word prefix` → `matchRanges('over','Stack Overflow')` = `[[6,10]]`
  - `matchRanges substring` → `matchRanges('hub','GitHub')` = `[[3,6]]`
  - `matchRanges subsequence` → `matchRanges('gtb','GitHub')` = `[[0,1],[2,3],[5,6]]`
  - `matchRanges diacritics` → `matchRanges('cafe','Café Bar')` = `[[0,4]]`
  - `matchRanges uppercase query` → `matchRanges('GIT','GitHub')` = `[[0,3]]`
  - `matchRanges typo or none` → `matchRanges('gthib','GitHub')` = `[]`, `matchRanges('zz','GitHub')` = `[]`
  - `splitByRanges` → `splitByRanges('GitHub',[[0,2]])` = `[{text:'Gi',hit:true},{text:'tHub',hit:false}]`
  - search-box: `marks matched letters in result names` → type `gi`; first option contains `.hit` element with text `Gi`
  - search-box: `mouseenter without mousemove does not change the active row` → ArrowDown to index 1; dispatch `mouseenter` on option 0; active still 1; dispatch `mousemove` on option 0; active 0
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Template renders segments with `@for` → `<span [class.hit]="s.hit">`; no `innerHTML`. CSS: input `outline: none` (pill keeps `:focus-within` border; add `box-shadow: 0 0 0 2px var(--focus-ring)` on `:focus-within` only for `:has(input:focus-visible)`), results fill `--glass-fill-results`, option radius `--radius-result-row`, `.option.active` fill `--glass-fill-strong` + `inset 0 0 0 0.5px var(--glass-stroke-focus)`, name text `--text-dim` and `.hit` `--text` weight 600. Replace `(mouseenter)` with `(mousemove)` that sets active only if different.
- [ ] **Step 4:** PASS; check:styles PASS.

---

### Task 5: Concentric hover shapes audit

**Files:**
- Modify: `src/styles/shortcuts.css:103-160` (`.shortcut-more` tile: `top:10px; right:10px`; compact: `top:8px; right:8px`)
- Modify as found: `settings-panel.css`, `group-dialog.css`, `section-column.css`, `app.css`

- [ ] **Step 1:** In Chrome (dev server, seeded data) zoom-screenshot hover/active on: tile, tile `⋯`, compact pill + `⋯`, Add tile, every popover item, search row, settings rows + segmented, group-dialog header buttons, section-column icon buttons and rows.
- [ ] **Step 2:** Fix each shape breaking the concentric rule (list them in the task report with before/after values).
- [ ] **Step 3:** Re-screenshot each; full suite + check:styles PASS. `link.spec`/`group-link.spec` still pass (no DOM change).

---

### Task 6: Lazy dialogs, snackbar, settings; drop router

**Files:**
- Create: `src/app/services/dialog-loader.service.ts`, `dialog-loader.service.spec.ts`
- Modify: `src/app/app.ts`, `src/app/app.config.ts` (remove `provideRouter`), delete `src/app/app.routes.ts`
- Modify: `src/app/services/confirm.service.ts`, `notify.service.ts`, `src/app/app.html` (settings overlay content → `@defer (on immediate)`)
- Test: existing `app.spec.ts`, `data-transfer.service.spec.ts`, `ui-prefs.service.spec.ts`, `store-harness.ts` adjust to async open

**Interfaces:**
- Produces:
  - `DialogLoader.open<R, D = unknown>(load: () => Promise<Type<unknown>>, config: MatDialogConfig<D>): Promise<R | undefined>` — dynamic-imports `@angular/material/dialog`, gets `MatDialog` from `EnvironmentInjector`, opens, resolves on `afterClosed`. While one `open` is loading, a second call with the same `load` returns the same pending promise.
  - `DialogLoader.openRef<C>(load, config): Promise<MatDialogRef<C>>` — for `openGroup` (needs the ref).
  - `DialogLoader.prefetch(): void` — `requestIdleCallback` (fallback `setTimeout 200`) importing dialog module + all dialog components + snackbar + settings panel.
  - `NotifyService` keeps `info/error(message): void` signatures; lazily imports `MatSnackBar` on first call.
- No eager file imports `@angular/material/dialog` or `@angular/material/snack-bar` as a value (type-only `import type` allowed).

- [ ] **Step 1: Write failing tests** (`dialog-loader.service.spec.ts`):
  - `open resolves with the dialog result` → open a tiny test component that closes with `'ok'` → `'ok'`
  - `opens one dialog when asked twice while loading` → two `open` calls before awaiting → one `mat-dialog-container`
  - `NotifyService.error shows a snackbar` → after `await` of a microtask flush / `fixture.whenStable()`, `.mat-mdc-snack-bar-container` text contains message
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement; switch `App.ask`, `openGroup`, `openBackgrounds`, `ConfirmService.ask` to `DialogLoader`; call `prefetch()` at the end of `App.ngOnInit`; remove router.
- [ ] **Step 4:** `grep -rn "from '@angular/material/dialog'\|from '@angular/material/snack-bar'" src/app --include=*.ts | grep -v spec` → only lazily loaded files (dialog components, group-dialog, section-column, dialog-loader via `import()`/`import type`).
- [ ] **Step 5:** Full suite PASS; `npx ng build` shows lazy chunks; `main.js` smaller than baseline.

---

### Task 7: Instant paint from render snapshot

**Files:**
- Modify: `src/app/services/links-store.ts`, `src/app/services/ui-prefs.service.ts`, `src/app/app.html` (show tiles while `loading` when items exist; Add tile + `⋯` triggers + drag disabled until `ready`)
- Test: `links-store.spec.ts`, `ui-prefs.service.spec.ts`, `app.spec.ts`

**Interfaces:**
- Produces: `RENDER_SNAPSHOT_KEY = 'renderSnapshot_v1'` (localStorage), shape `{ items: TopItem[]; style: ShortcutStyle }`; `LinksStore.editable: Signal<boolean>` (`status() === 'ready'`).
- `LinksStore` constructor: read + validate snapshot synchronously (array of objects each with string `id`, `type` `'Shortcut'|'Group'`; groups have `sections` array) → `_items.set`; status stays `'loading'`. After `load()` ends in `ready` and after each successful `update` → write snapshot (try/catch, ignore failure). On `corrupt`/`readonly-future` → remove snapshot.
- `UiPrefsService` constructor: initial style from snapshot `style` if valid.

- [ ] **Step 1: Write failing tests:**
  - `snapshot items show before load resolves` → set snapshot; construct store; `items().length === 2`, `status() === 'loading'`
  - `load replaces snapshot items with stored items` → snapshot 2 items, storage 1 item → after `load()` `items().length === 1`
  - `invalid snapshots are ignored` → for each of `'x'`, `'{}'`, `'[{}]'`, a v1 array, invalid JSON: `items()` is `[]`, no throw
  - `update while loading is rejected and writes nothing` → snapshot present, call `update` before `load` → rejects `'Links are read-only'`; storage `setMany` not called
  - `snapshot written after ready load and after update` → localStorage key holds current items
  - `corrupt load removes the snapshot`
  - `snapshot never goes to KeyValueStorage` → no `setMany` call contains `RENDER_SNAPSHOT_KEY`
  - ui-prefs: `initial style comes from the snapshot` → snapshot style `'compact'` → `shortcutStyle() === 'compact'` before `load()`
  - app: `tiles render while loading when a snapshot exists; Add is disabled`
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Full suite PASS.

---

### Task 8: Cheaper tile glass, budget, final measurement + visual pass

**Files:**
- Modify: `src/styles/tokens.css` (`--glass-filter-tile: blur(12px)`), `src/styles/shortcuts.css` (`.shortcut-tile.glass, .shortcut-pill.glass { backdrop-filter: var(--glass-filter-tile); contain: paint; }`; keep the `-webkit-` prefix)
- Modify: `angular.json:40-51` (initial budget: warning = achieved size rounded up to next 25 kB, error = warning + 50 kB)
- Modify: this plan's `## Measurements`

- [ ] **Step 1:** Apply tile blur; check in Chrome over a bright and a dark background (upload via Backgrounds dialog) that tiles still read as glass; adjust radius between 10–16px if not.
- [ ] **Step 2:** `npx ng build`; set budgets; rebuild → no budget error.
- [ ] **Step 3:** Repeat Task 0 Step 3 measurements; add "after" row. Target: initial JS ≤ ~400 kB raw; tiles element-timing ≤ FCP + 16ms.
- [ ] **Step 4:** Chrome pass at 1568px and 800px width: Add menu, last-tile `⋯` menu (flips/stays on screen), group dialog menu, section sort + colour submenu, search with `gi`/`over`/no-match, keyboard-only through each menu.
- [ ] **Step 5:** `npx ng test --watch=false` PASS; `npm run check:styles` PASS; `npx ng build` PASS.

## Measurements

| Build | main.js raw | lazy chunks | FCP (ms) | tiles element-timing (ms) |
|---|---|---|---|---|
| baseline | 755.04 kB | – | 160 (cold 548) | 160 (cold 548) |
| after | 225.24 kB (+ 231.73 kB + 14.40 kB shared initial chunks; initial JS 471 kB, total 508 kB vs 791 kB) | dialogs, group dialog, settings, snackbar | ~148 (140–160) | ~148 (140–160) |

Localhost uses the synchronous localStorage fallback, so the render-snapshot gain shows only in the installed
extension (async chrome.storage); the localhost numbers mostly reflect the smaller bundle.
