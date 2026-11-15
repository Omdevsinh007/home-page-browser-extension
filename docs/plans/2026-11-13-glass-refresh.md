# Glass Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle Custom Homepage in one Apple-style glass material, add a Tiles | Compact shortcut style, merge the corner controls into one Settings popover, and cut static assets under 1.5 MB.

**Architecture:** Tokens and one `.glass` utility live in `src/styles/tokens.css` and are the only source of colour and size values. Icons become SVG literals registered with `MatIconRegistry`, so the icon font goes. A small `UiPrefsService` stores the shortcut style under its own `chrome.storage.local` key. `Link` and `GroupLink` gain a `variant` input instead of new components, so both styles share one set of actions.

**Tech Stack:** Angular 22.2, Angular Material/CDK 22, Tailwind 4, Vitest 4 (jsdom) via `@angular/build:unit-test`.

**Spec:** `docs/specs/2026-11-13-glass-refresh-design.md`

## Global Constraints

- Glass tokens, exactly: `--glass-fill: rgba(255,255,255,0.14)`, `--glass-fill-strong: rgba(255,255,255,0.22)`, `--glass-fill-dark: rgba(30,30,36,0.40)`, `--glass-filter: blur(30px) saturate(180%)`, `--glass-stroke: 0.5px solid rgba(255,255,255,0.35)`, `--glass-highlight: inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(255,255,255,0.08)`, `--glass-shadow: 0 8px 32px rgba(0,0,0,0.18)`, `--text: #fff`, `--text-dim: rgba(255,255,255,0.72)`, `--text-on-glass-shadow: 0 1px 2px rgba(0,0,0,0.35)`.
- Radii: 22px tiles, 24px dialogs, 18px popovers, 16px section columns, 10px rows. Pill-height controls are fully rounded.
- Font stack: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif`. Sizes 12/14/16/20 px only, weights 400/500/600. 4px spacing grid.
- The 8 section accents `--accent-1..8` stay unchanged.
- No glows, coloured radial gradients or inner shine layers on any surface.
- No raw `rgba()`/hex in component templates or CSS outside `src/styles/tokens.css`, except accents and favicon letter colours.
- Copy: "Rename" (group tile menu), "Delete" (all tile/group delete actions), "Export for older version (2.x)", "Settings", "Shortcut style", "Tiles", "Compact", "Backgrounds…", "Export data", "Import data", "Download backups".
- Storage: new key `uiPrefs` = `{ shortcutStyle: 'tiles' | 'compact' }`, default `'tiles'`. Never written into links data, export or the v1 mirror.
- Do not change information architecture, search behaviour, sorting, Open all, or add features to tiles.
- `dist/browser` total under 1.5 MB, no icon font, no `googleapis`.
- Test command: `NO_COLOR=1 npx ng test --watch=false`. One file: add `--include <path>`.
- Commits on `feature/link-sections-search-ui`, Conventional Commits, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. No push.

## Review Focus

1. Existing users have no `uiPrefs` key. Expect Tiles, and no storage write on load (Task 3 test).
2. `uiPrefs` holds junk (`'grid'`, a string, `null`). Expect Tiles, no crash (Task 3 test).
3. Writing the style fails (quota, storage error). Expect the switch to revert and an error snackbar (Task 3 test).
4. Very long names in Compact pills. Expect truncation with the full name in `title`, no layout break (Task 5 test).
5. Keyboard and right-click on a pill. The ContextMenu key or Shift+F10 on a focused pill opens the same menu as right-click, and right-click never shows the browser menu (Task 5 test).
6. Tab hidden then shown with a video background. Expect it to resume only if it was playing before and reduced motion is off (Task 8 test).

---

### Task 1: Tokens, glass utility, system font

**Files:**
- Modify: `src/styles/tokens.css`, `src/styles.css`, `src/app/app.css`, `src/index.html`
- Create: `scripts/check-styles.mjs`
- Modify: `package.json` (remove `@fontsource/roboto`; add script `"check:styles": "node scripts/check-styles.mjs"`)

**Interfaces:**
- Produces: CSS custom properties from Global Constraints; global class `.glass` (fill, `backdrop-filter: var(--glass-filter)`, border `var(--glass-stroke)`, `box-shadow: var(--glass-highlight), var(--glass-shadow)`); modifiers `.glass-strong` (fill `--glass-fill-strong`) and `.glass-dark` (fill `--glass-fill-dark`); `.on-glass` (`color: var(--text); text-shadow: var(--text-on-glass-shadow)`).
- Produces: `npm run check:styles`. It exits 1 and lists `file:line` for any `rgba(`, `rgb(`, `hsl(` or `#hex` in `src/app/**/*.{css,html}`. Allowed: inside `var(...)` fallbacks, and lines carrying the comment marker `/* allow-color */`.

- [ ] **Step 1:** Write `scripts/check-styles.mjs` (Node ESM, `fs` + `path`, recursive walk of `src/app`, skip `*.spec.ts`).
- [ ] **Step 2:** Run `npm run check:styles`. Expected: FAIL, listing current literals (about 53).
- [ ] **Step 3:** Replace `tokens.css` contents with the Global Constraints tokens, radii, font stack and `.glass*` / `.on-glass` utilities. Keep the accents. In `styles.css`, remove the Roboto `@import`s and set `body { font-family: var(--font) }`. Delete the `.mat-mdc-dialog-surface` radial gradients and the `::before` shine. Restyle the dialog surface to `.glass` + `.glass-dark` values with a 24px radius. In `app.css`, replace every literal with tokens. `npm uninstall @fontsource/roboto`.
- [ ] **Step 4:** Run `npm run check:styles` and `npm run build`. Expected: `check:styles` still lists component files that later tasks own (`link`, `group-link`, `section-column`, `group-dialog`, `search-box`, `background-dialog`, `link-row`); `app.css` and `styles.css` are not listed; the build passes.
- [ ] **Step 5:** Commit `style: glass tokens and system font`.

### Task 2: SVG icons replace the icon font

**Files:**
- Create: `src/app/core/icons.ts`, `src/app/core/icons.spec.ts`
- Modify: `src/app/app.config.ts`, every template using `<mat-icon>name</mat-icon>`
- Modify: `package.json` (remove `material-symbols`), `src/styles.css` (remove its `@import`)

**Interfaces:**
- Produces: `export const ICONS: Readonly<Record<IconName, string>>` (full `<svg>` strings, `viewBox="0 -960 960 960"`, `fill="currentColor"`), `export type IconName` (the union below), `export function provideAppIcons(): EnvironmentProviders`. The last one registers each icon via `provideAppInitializer` with `MatIconRegistry.addSvgIconLiteral(name, DomSanitizer.bypassSecurityTrustHtml(svg))`.
- Icon names: `add, backup, check, check_circle, close, delete_outline, download, drag_indicator, history, more_vert, more_horiz, open_in_new, playlist_add, radio_button_unchecked, search, settings, sort, upload, upload_file, wallpaper`.
- Templates use `<mat-icon svgIcon="name" />`. Dynamic ones bind `[svgIcon]`. The sort check renders only when active (`@if`), not as an empty ligature.

- [ ] **Step 1:** Write tests in `icons.spec.ts`:
  - `it('defines every icon as an svg', ...)`: each `ICONS` value matches `/^<svg[^>]*viewBox="0 -960 960 960"[^>]*>.*<\/svg>$/s`.
  - `it('registers icons with MatIconRegistry', ...)`: TestBed with `provideAppIcons()` and `provideHttpClient()`; `await firstValueFrom(registry.getNamedSvgIcon('search'))` returns an `SVGElement`.
- [ ] **Step 2:** Run the file. Expected: FAIL, "Cannot find module './icons'".
- [ ] **Step 3:** Implement `icons.ts`. Path data comes from Material Symbols Outlined, weight 400 (Apache-2.0); add a license comment at the top. Copy the paths in as literals; no runtime dependency. Wire `provideAppIcons()` into `app.config.ts`, remove `MAT_ICON_DEFAULT_OPTIONS`, and convert all templates. Then `npm uninstall material-symbols` and remove the `@import`.
- [ ] **Step 4:** Run the full suite and `npm run build`; then `ls dist/browser/media`. Expected: suite PASS, build PASS, no `.woff2` files.
- [ ] **Step 5:** Commit `perf: inline SVG icons replace 4 MB icon font`.

### Task 3: UiPrefsService

**Files:**
- Create: `src/app/services/ui-prefs.service.ts`, `src/app/services/ui-prefs.service.spec.ts`

**Interfaces:**
- Consumes: `KeyValueStorage` (`getMany`, `setMany`), `NotifyService.error(message)`, `FakeStorage` from `src/app/testing/fake-storage.ts`.
- Produces: `export const UI_PREFS_KEY = 'uiPrefs'`, `export type ShortcutStyle = 'tiles' | 'compact'`, `@Injectable({providedIn:'root'}) class UiPrefsService { readonly shortcutStyle: Signal<ShortcutStyle>; load(): Promise<void>; setShortcutStyle(style: ShortcutStyle): Promise<void> }`.

- [ ] **Step 1:** Write tests:
  - `it('defaults to tiles and writes nothing when the key is missing')`: after `load()`, `shortcutStyle()` is `'tiles'` and `fake.setCalls.length === 0`.
  - `it('reads compact')`: `fake.data.uiPrefs = { shortcutStyle: 'compact' }` gives `'compact'`.
  - `it('treats junk as tiles')`: try each of `{shortcutStyle:'grid'}`, `'compact'`, `null` and `{}`; each gives `'tiles'`.
  - `it('persists the style')`: `setShortcutStyle('compact')` gives `fake.data.uiPrefs` equal to `{ shortcutStyle: 'compact' }`.
  - `it('reverts and reports when the write fails')`: `fake.failNextSet = true`; `setShortcutStyle('compact')`; `shortcutStyle()` is `'tiles'` and `notify.error` is called with `'Could not save the shortcut style.'`.
- [ ] **Step 2:** Run the file. Expected: FAIL, module not found.
- [ ] **Step 3:** Implement. The set is optimistic: set the signal, write, and on failure restore the previous value and notify.
- [ ] **Step 4:** Run the file. Expected: 5/5 PASS.
- [ ] **Step 5:** Commit `feat: shortcut style preference`.

### Task 4: Settings popover

**Files:**
- Create: `src/app/components/settings-panel/settings-panel.{ts,html,css}`, `settings-panel.spec.ts`
- Modify: `src/app/app.html` (remove the top-right data menu and the backgrounds button; add one Settings trigger bottom right), `src/app/app.ts` (`openBackgrounds` stays; remove `dataMenu` usage)

**Interfaces:**
- Consumes: `UiPrefsService` (Task 3), `DataTransferService` (`exportAll`, `exportForV2x`, `downloadBackups`, `importText`), `App.openBackgrounds()`.
- Produces: `<app-settings-panel>` with `output<void>() backgrounds` and `output<void>() importFile`. It is hosted in a CDK `cdkConnectedOverlay` opened by a `<button type="button" aria-label="Settings" aria-haspopup="dialog" [attr.aria-expanded]>` showing the settings icon and the visible text "Settings". The panel root has `role="dialog"`, `aria-label="Settings"`, and classes `.glass .glass-dark`, with an 18px radius.
- Panel content in order: heading "Shortcut style"; a segmented `role="radiogroup"` with two `role="radio"` buttons "Tiles" and "Compact"; then rows "Backgrounds…", "Export data", "Export for older version (2.x)", "Import data", "Download backups".

- [ ] **Step 1:** Write tests (TestBed with mocked `UiPrefsService` and `DataTransferService`):
  - `it('shows the current style as checked')`: with `shortcutStyle` `'compact'`, the "Compact" radio has `aria-checked="true"`.
  - `it('changes the style')`: clicking "Tiles" calls `setShortcutStyle('tiles')`.
  - `it('lists the actions with plain labels')`: `textContent` contains each of the five row labels exactly.
  - `it('emits backgrounds and importFile')`: clicking the rows emits each output.
  - `it('calls the data service')`: "Export data" calls `exportAll`, "Export for older version (2.x)" calls `exportForV2x`, and "Download backups" calls `downloadBackups`.
- [ ] **Step 2:** Run the file. Expected: FAIL, module not found.
- [ ] **Step 3:** Implement the panel. In `app.html`, use `cdkConnectedOverlay` with a backdrop (transparent); it closes on `backdropClick`, on `detach` and on Esc (`overlayKeydown`). Position it above the trigger, right-aligned with an 8px offset. On close, focus returns to the trigger. `importFile` calls `fileInput.click()`; `backgrounds` closes the panel and then calls `openBackgrounds()`.
- [ ] **Step 4:** Run the file, then the full suite. Expected: PASS.
- [ ] **Step 5:** Commit `feat: single settings popover with shortcut style`.

### Task 5: Compact variant for Link and GroupLink

**Files:**
- Modify: `src/app/components/link/link.{ts,html,css}`, `src/app/components/group-link/group-link.{ts,html,css}`
- Test: `link.spec.ts`, `group-link.spec.ts` (create if missing)

**Interfaces:**
- Produces: on both components, `variant = input<ShortcutStyle>('tiles')`. On `GroupLink`, `linkCount = computed(() => sections.reduce((n, s) => n + s.links.length, 0))`. Outputs are unchanged (`Link`: `editShortcut`, `removeShortcut`; `GroupLink`: `open`, `rename`, `removeLink`).
- Tiles variant: a 112×140 `.glass` card with a 22px radius. The name is `.on-glass` with a 14px single line, ellipsis and `[title]`. The "⋯" (`more_horiz`) button sits at 60% opacity and goes to 100% on hover or focus.
- Compact variant: a 40px-tall `.glass` pill, `max-width: 220px`, with a 26px favicon. The name is ellipsised with `[title]`. The group pill adds `.glass-strong` and shows `linkCount()` in `--text-dim`. The "⋯" button is visible only on hover or `:focus-within`.
- Both variants: `(contextmenu)` prevents the default and opens the same `mat-menu`, as does `keydown` of `ContextMenu` or `Shift+F10` on the focused tile or pill. Menu copy: Link → "Edit shortcut", "Delete"; Group → "Rename", "Delete".
- The group pill is a `<button type="button" [attr.aria-label]="'Open group ' + name">`. The link pill is an `<a>` that opens through `LinkOpenerService`, as today.

- [ ] **Step 1:** Write tests:
  - `it('compact link shows a pill with name and title')`: with name `'A very long shortcut name that will not fit'`, the element `[data-testid="pill"]` exists and its `title` equals that name.
  - `it('compact group shows the link count')`: `sampleItems()` group `Propera` has 5 links, so the text contains `5`.
  - `it('right-click opens the menu and blocks the browser menu')`: dispatch a `contextmenu` MouseEvent with `cancelable: true`; `defaultPrevented` is `true` and `.mat-mdc-menu-panel` is in the overlay.
  - `it('Shift+F10 opens the menu')`: same, via `keydown` with `{ key: 'F10', shiftKey: true }`.
  - `it('group menu says Rename and Delete')` and `it('link menu says Edit shortcut and Delete')`.
- [ ] **Step 2:** Run both files. Expected: FAIL (no `variant` input, wrong labels).
- [ ] **Step 3:** Implement. Use `MatMenuTrigger` via `viewChild` and `openMenu()` for right-click and the key handlers.
- [ ] **Step 4:** Run both files and the full suite. Expected: PASS. Update any existing spec expecting "Edit" or "Remove".
- [ ] **Step 5:** Commit `feat: compact shortcut style and clearer tile menus`.

### Task 6: Main page in glass, loading state, style switch

**Files:**
- Modify: `src/app/app.{ts,html,css}`, `src/app/components/search-box/search-box.{html,css}`, `src/app/app.spec.ts`

**Interfaces:**
- Consumes: `UiPrefsService.shortcutStyle`, `load()` (Task 3); the `variant` input (Task 5); `SettingsPanel` (Task 4).
- Produces: `ngOnInit` also awaits `uiPrefs.load()`. The grid container has `data-testid="shortcuts"` and `[attr.data-style]="uiPrefs.shortcutStyle()"`. Tiles use a centred `auto-fit` grid with 144px tracks; Compact uses `flex flex-wrap justify-center gap-[10px] max-w-[780px]`. Both keep `cdkDropList cdkDropListOrientation="mixed"`.
- Search pill: `.glass`, 48px tall, fully rounded, `max-width: 580px`, with the search icon, the `/` kbd and the placeholder "Search links". The placeholder colour is `var(--text)` at 0.8 opacity, and the input layer carries an extra `--glass-fill-dark` underlay at 0.35 so the placeholder stays ≥4.5:1 over white.
- Loading: when `store.status() === 'loading'`, render the search pill only.

- [ ] **Step 1:** Write tests in `app.spec.ts` with `storeHarness`:
  - Un-todo `it('renders the add tile')`: when ready with items, `button[aria-label="Add shortcut or group"]` exists.
  - `it('shows nothing but search while loading')`: hold gets via `FakeStorage.holdGets()`; `[data-testid="shortcuts"]` and the add button are absent, and `input[aria-label="Search links"]` is present.
  - `it('switches to compact pills')`: with `uiPrefs` set to compact, `[data-style="compact"]` exists and `[data-testid="pill"]` count equals `store.items().length`.
  - `it('has one settings button and no other corner buttons')`: there is exactly one `button[aria-label="Settings"]` and no `button[aria-label="Backgrounds"]`.
- [ ] **Step 2:** Run the file. Expected: FAIL.
- [ ] **Step 3:** Implement. Restyle the status banners and empty state with `.glass .glass-dark .on-glass`. Remove the leftover `.add-links`/`.glass-button` CSS in favour of the utilities.
- [ ] **Step 4:** Run the full suite, `npm run check:styles` and `npm run build`. Expected: PASS. `check:styles` no longer lists `app.*` or `search-box.*`.
- [ ] **Step 5:** Commit `feat: glass main page with tiles or compact shortcuts`.

### Task 7: Dialogs, columns, menus and snackbars in glass

**Files:**
- Modify: `src/app/components/group-dialog/*`, `section-column/*`, `link-row/*`, `background-dialog/*`, `confirm-dialog/*`, `name-dialog/*`, `link-dialog/*`, `src/styles.css` (Material menu and snackbar overrides via `--mat-*` tokens or panel classes)

**Interfaces:**
- Consumes: Task 1 utilities.
- Produces:
  - Dialog surface: `.glass .glass-dark`, 24px radius.
  - Section column: fill `rgba` taken from a token (add `--glass-fill-faint: rgba(255,255,255,0.08)` to `tokens.css`), hairline stroke, 16px radius.
  - Rows: 38px tall, 10px radius; hover or selected uses `--glass-fill-strong`.
  - Buttons: small glass pills, 30px (column header 26px).
  - Mat menus and snackbars: `--glass-fill-dark` with the same stroke, highlight and shadow.

- [ ] **Step 1:** Run `npm run check:styles`. Expected: FAIL, listing only this task's files.
- [ ] **Step 2:** Restyle each file onto tokens and utilities. No behaviour change.
- [ ] **Step 3:** Run the full suite, `npm run check:styles` and `npm run build`. Expected: all PASS; `check:styles` reports 0 findings.
- [ ] **Step 4:** Commit `style: glass dialogs, sections, menus and snackbars`.

### Task 8: Pause the video background when the tab is hidden

**Files:**
- Modify: `src/app/app.{ts,html}`
- Test: `src/app/app.spec.ts`

**Interfaces:**
- Produces: `viewChild<ElementRef<HTMLVideoElement>>('bgVideo')`. A `visibilitychange` listener registered in the constructor via `DestroyRef`:
  - Hidden: if the video is playing, remember `wasPlaying = true` and call `pause()`.
  - Visible: if `wasPlaying` and not `reducedMotion`, call `play()` (catching rejection) and reset `wasPlaying`.

- [ ] **Step 1:** Write tests (stub `HTMLMediaElement.prototype.play`/`pause` with `vi.fn`, stub `document.visibilityState` via `Object.defineProperty`, and set the active background to a video meta):
  - `it('pauses a playing video when the tab is hidden and resumes when shown')`.
  - `it('does not resume a video that was paused before hiding')`.
  - `it('does not resume under reduced motion')`.
- [ ] **Step 2:** Run the file. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the full suite. Expected: PASS.
- [ ] **Step 5:** Commit `perf: pause background video in hidden tabs`.

### Task 9: Release 3.1.0

**Files:**
- Modify: `package.json`, `src/manifest.json` (version `3.1.0`), `README.md` (Shortcut style, Settings popover, glass look; remove the "Fonts and icons are bundled" wording in favour of "Icons are bundled; text uses the system font")

- [ ] **Step 1:** Run `npm run build && du -sb dist/browser && grep -rl googleapis dist/browser; ls dist/browser/media 2>/dev/null`. Expected: under 1,572,864 bytes, no googleapis match, no font files.
- [ ] **Step 2:** Bump the versions and update the README.
- [ ] **Step 3:** Run the full suite and `npm run check:styles`. Expected: PASS, 0 findings.
- [ ] **Step 4:** Commit `chore: release 3.1.0 glass refresh`.
