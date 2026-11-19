# UI polish + speed — design

Date: 2026-11-19 · Status: draft for approval

## Intent

The new-tab page must feel instant and look finished. Today menus land in the wrong place, search results are
hard to read, hover shapes don't match their borders, and the page waits on a 755 kB bundle and async storage
before showing anything. Goal: "fast as light" — tiles on the first frame, no visual seams.

## Goals

1. Menus (Add, tile `⋯`, group dialog, section sort/options/colour) open centred under their trigger with an 8px
   gap, never cover the neighbouring tile, flip above/side near viewport edges, and grow out of the trigger.
2. Search results are legible over any wallpaper, the active row is clearly marked, matched letters are highlighted.
3. Every hover/active shape is concentric with its container (inner radius = outer radius − inset).
4. Tiles visible on the first paint; initial JS roughly halved.

## Non-goals

- No redesign of tiles, dialogs or settings layout.
- No removal of Angular Material dialogs / form fields (option 3, rejected).
- No change to stored data format.

## Anti-goals

- Faster but broken: lost edits, stale data overwriting fresh data, keyboard/screen-reader regressions in menus.
- Frosted-glass look visibly degraded.

## Approaches considered

1. Polish in place — keep `mat-menu`, CSS offsets, lazy dialogs. Cheapest; Material has no gap/centre option, so
   menu placement stays a fight.
2. **Own popover + lean boot (picked by user).** Replace `mat-menu` with a small CDK Overlay popover (same tool as
   the Settings panel), redo search styling, lazy-load dialogs, drop router, paint from cache, cheaper tile blur.
3. Drop Angular Material entirely. Largest bundle cut; rewrites every dialog and field. Too much risk for the
   marginal gain over 2.

## Design

### A. Popover menu (replaces every `mat-menu`)

- One reusable trigger directive + menu component, built on `@angular/cdk/overlay` for positioning. For
  keyboard + ARIA use `@angular/aria` menu primitives if their API fits (already a dependency; check docs via
  Context7), otherwise a small roving-focus implementation: `role="menu"/"menuitem"`, Arrow/Home/End, type-ahead
  not required, Escape and outside click close and return focus to the trigger, Tab closes.
- Positions, in order: below-centre (offsetY 8), above-centre (offsetY −8), below-end, below-start. Viewport
  margin 8px.
- Motion: opacity 0→1 + scale 0.96→1, 120ms ease-out, `transform-origin` at the edge nearest the trigger (set from
  the resolved position). Reduced motion: opacity only.
- Nested colour submenu in section-column must still work (submenu opens to the side).
- Item styling: panel radius 18, padding 4 → item radius 14. Danger item keeps `--danger`. No ripple.
- Removes `MatMenuModule` from the bundle.

### B. Search

- Remove the browser focus outline on the input; the pill shows focus via `--glass-stroke-focus` border (keep a
  visible focus state — anti-goal on a11y).
- Results panel: more opaque fill (new token, ~0.75 alpha dark) so tiles don't show through; keep blur.
- Active row: stronger fill + inset hairline, radius 10 (panel 18 − padding 8).
- Mouse only moves the active row on real `mousemove`, not on `mouseenter` caused by keyboard scroll / list change.
- Matched-letter highlight on the result name: `core/fuzzy.ts` gains `matchRanges(query, text)` returning index
  ranges (contiguous for exact/prefix/word-prefix/substring, per-char for subsequence, none for typo match).
  Rendered as `<mark>`-style spans via template, never `innerHTML`. Style: full-white + 600 weight on the dimmer
  name, no yellow background. Accent/diacritic normalisation must map back to original indexes.
- Unit tests for `matchRanges`.

### C. Concentric hover shapes

- Add a short rule in `tokens.css` comment + tokens where needed (`--radius-menu-item: 14px`).
- Fix: menu items (A), search rows (B), tile `⋯` button positioned on the corner's curve centre
  (`top/right = 22 − 12 = 10px`), compact pill `⋯` centred in the end cap (`top/right = 8px`). Audit remaining
  hover states (settings rows, segmented, group dialog, section column) and fix any that break the rule.
- Verified in Chrome by zoomed screenshots.

### D. Speed

Measured on the production build (`ng build`) served statically, before and after, in Chrome:
initial JS size, first-contentful-paint, time to first tile.

1. Lazy-load every dialog (link, name, group, background, confirm) and `MatDialog` itself through dynamic
   `import()` at open time; idle-prefetch after first paint so the first open is still instant.
2. Settings panel content behind `@defer` (prefetch on idle).
3. Snackbar (`NotifyService`) loaded on first use.
4. Remove `provideRouter` (routes are empty).
5. Instant paint: on every successful load/save, write a small render snapshot (items + shortcut style) to
   `localStorage`. On boot, render the snapshot synchronously while status is `loading`; editing stays blocked
   until the real load finishes and replaces it. Snapshot never written back to storage. Corrupt snapshot ignored.
6. Tiles: cheaper backdrop blur (smaller radius, no `saturate`) plus `contain: paint`; search/popovers/dialogs
   keep the full glass. Check visually that the look holds.
7. Budget in `angular.json` tightened to the achieved size so regressions fail the build.

Target: initial JS ≤ ~400 kB raw (from 755 kB), tiles on first frame.

## Constraints

- Angular 22 zoneless, signals, OnPush; Tailwind 4; Vitest + jsdom; MV3 extension (CSP: no inline scripts).
- Existing tests and `npm run check:styles` must pass; new behaviour gets tests (TDD).
- No commits unless the user asks.

## Left to the builder

- Exact component/directive names and file layout for the popover.
- Whether `@angular/aria` menu fits or a hand-rolled roving focus is simpler.
- Exact blur radius for tiles and results-panel alpha, chosen by looking at it over a bright and a dark wallpaper.
