# Built-in Wallpapers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Four built-in CSS wallpapers (Midnight default), selectable any time alongside uploads, painted on the first frame.

**Architecture:** The wallpaper is the `body` background, chosen by `html[data-wallpaper]`. A tiny external `boot.js`
(MV3 forbids inline scripts) sets that attribute from the render snapshot before first paint; the app keeps it in
sync from `BackgroundStore.shown()`. Uploads still render as the `<img>/<video>` layer above `body`.

**Tech Stack:** Angular 22 signals, CSS gradients + inline SVG grain, IndexedDB (uploads), KeyValueStorage (choice).

**Spec:** `docs/specs/2026-11-19-built-in-wallpapers-design.md`

## Global Constraints

- No new permissions; no image assets.
- Built-in ids exactly: `midnight`, `lagoon`, `dusk`, `graphite`; default `midnight`.
- Choice key in KeyValueStorage: `wallpaper` = `{ builtIn: BuiltInId }`; never in exports.
- Snapshot field `wallpaper: BuiltInId | 'upload'`.
- Colours in CSS only via `src/styles/wallpapers.css` (global stylesheet, outside `check:styles` scope) — gradient stops from the approved mockup.
- No commits unless the user asks.

## Review Focus

1. Existing user with an active upload updates: upload stays active, no built-in flash on first frame (snapshot `upload`) — Task 2 test `keeps an existing active upload`; Task 4 Chrome check.
2. Snapshot missing/corrupt on first install: `boot.js` must not throw; page shows Midnight — Task 4 Chrome check with empty localStorage.
3. Stored `wallpaper` value junk (`'neon'`, `{}`) → Midnight — Task 2 test.
4. Deleting the last upload → built-in shows, no error — Task 2 test.
5. Choosing a built-in while an upload is active → upload layer disappears at once — Task 2 test + Task 3 test.

---

### Task 1: Wallpaper catalogue, CSS, snapshot field

**Files:** Create `src/app/core/wallpapers.ts`, `src/app/core/wallpapers.spec.ts`, `src/styles/wallpapers.css` (import in `src/styles.css`); modify `src/app/core/render-snapshot.ts` + spec.

**Produces:** `type BuiltInId = 'midnight'|'lagoon'|'dusk'|'graphite'`; `BUILT_IN_WALLPAPERS: { id: BuiltInId; name: string }[]` (order above, names Midnight/Lagoon/Dusk/Graphite); `DEFAULT_WALLPAPER: BuiltInId = 'midnight'`; `isBuiltIn(v: unknown): v is BuiltInId`; `RenderSnapshot.wallpaper?: BuiltInId | 'upload'`. CSS: `html body` = Midnight; `html[data-wallpaper='<id>'] body` per palette; `html[data-wallpaper='upload'] body` = `var(--page-bg)`; grain via `body::after` fixed overlay, `pointer-events:none`, opacity .10, `mix-blend-mode: overlay`, hidden for `upload`; `.wallpaper-swatch[data-wallpaper]` uses the same gradients.

- [ ] Tests: `catalogue lists four built-ins in order`; `default is midnight`; `isBuiltIn accepts ids and rejects 'upload', 'neon', {}`; snapshot `round-trips wallpaper`, `ignores unknown wallpaper`.
- [ ] Run → FAIL; implement; run → PASS.

### Task 2: BackgroundStore — built-in choice, no forced upload, no last-one rule

**Files:** `src/app/services/background.store.ts` + spec.

**Produces:** `WALLPAPER_KEY = 'wallpaper'`; `builtIn: Signal<BuiltInId>` (initial from snapshot, else default); `shown: Signal<BuiltInId | 'upload'>` (`'upload'` iff an upload is active); `setBuiltIn(id: BuiltInId): Promise<void>` clears every upload's `isActive`, saves `{builtIn:id}`; `load()` reads the key (junk → default) and no longer forces an upload active; `remove()` allows removing the last; removing the active upload leaves none active. Every publish writes snapshot `wallpaper: shown()`.

- [ ] Tests (update the old last-one test): `defaults to midnight with no uploads`; `reads the stored built-in; junk falls back to midnight`; `keeps an existing active upload` (legacy import with one active → `shown()==='upload'`); `setBuiltIn deactivates uploads and saves the choice`; `deleting the active upload falls back to the built-in`; `the last upload can be removed`; `snapshot follows shown()`.
- [ ] Run → FAIL; implement; run → PASS; full suite.

### Task 3: Backgrounds dialog + app sync + boot.js

**Files:** `background-dialog.{html,ts,spec.ts}`; `src/app/app.ts` (effect: `document.documentElement.dataset.wallpaper = bg.shown()`), `app.spec.ts`; create `public/boot.js`; `src/index.html` (`<script src="boot.js"></script>` in `<head>`).

- [ ] Tests: dialog `shows four built-in swatches as radios`; `the chosen built-in is checked when no upload is active`; `clicking a swatch calls setBuiltIn`; `no longer says one must stay active`; app `syncs html[data-wallpaper] with the shown wallpaper`.
- [ ] Run → FAIL; implement (dialog: "Built-in" radiogroup above uploads, upload radios unchecked when a built-in shows); run → PASS; full suite + check:styles.
- [ ] `boot.js`: read `localStorage.renderSnapshot_v1`, set `document.documentElement.dataset.wallpaper` when `wallpaper` is a known id or `'upload'`; wrap in try/catch.

### Task 4: Verify in Chrome + build

- [ ] Prod build (budget passes); serve dist; empty localStorage → Midnight first frame; pick each built-in → reload → same wallpaper on first paint; upload an image → reload → no gradient flash; delete it → built-in back.
- [ ] `npx ng test --watch=false`, `npm run check:styles`, `npx ng build` all pass.
