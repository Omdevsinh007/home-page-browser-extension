# Custom Homepage v2.6.0 — Code & UX Review

Date: 2026-11-11 · Branch reviewed: `main` @ `00aae06`

## Method

- Read all of `src/`, `angular.json`, `manifest.json`, `package.json`, `README.md`.
- Built with `npm run build`. Served `dist/browser/` on `http://127.0.0.1:4300` and reviewed it in Chrome.
  `chrome.storage` is not available there, so `StorageService` falls back to `localStorage`.
- Seeded realistic v1 data (`{ version: 1, data: [...] }`): 2 shortcuts + 1 group with 15 links (5 repos, 5 docs, 5 PRs).
- **Not verified live** (needs the unpacked extension or manual steps): background upload into `chrome.storage.local`,
  quota failures, drag-drop by mouse, narrow window (window resize did not apply), OS light/dark theme.
  Items below that rely only on code reading are marked *(code)*.

Severity: **P0** breaks build/data · **P1** user-visible bug or real risk · **P2** quality / should fix · **P3** nice to have.

## Baseline status

| Check | Result |
|---|---|
| `npm run build` on clean checkout | **Fails**: `environment.production.ts path in file replacements does not exist` |
| `npm run build` with local env stub | Passes. main.js 681.8 kB raw / 150.5 kB transfer |
| `npm test` | **Fails**: `A DOM environment is required for non-browser tests. Please install either "jsdom" or "happy-dom".` |
| Console errors on load (v1 data) | None |
| Existing remote branches (`development`, `feature/new-ui`, `ui/layout`, `feature/misc`, `feature/file-path-save`) | All fully merged into `main`; 0 commits ahead. No overlap. |

## Bugs

| Sev | Where | Finding | Fix |
|---|---|---|---|
| P0 | `angular.json:56-59`, `angular.json:67-71`, `.gitignore:48` | Build needs `environment.production.ts` / `environment.development.ts`, but they are gitignored. A clean clone cannot build. | Commit non-secret env files (no secrets live there today), or drop `fileReplacements` and use a build-time define. |
| P0 | `package.json:27-45`, `angular.json:96-103` | Test runner is Vitest but no `jsdom`/`happy-dom` installed, so `npm test` cannot run. Karma/Jasmine devDeps are dead weight. | Add `jsdom` devDep; remove karma*, jasmine*, `@types/jasmine`. |
| P1 | `src/app/components/group-name/group-name.ts:76` | Renaming a group sets `position = links.length`. The group jumps to the end of the grid. Same path from tile menu (`group-link.ts:21`). *(code)* | Keep `this.data.position`. |
| P1 | `group-name.ts:47`, `shortcut-dialog.ts:53`, `save-links.ts:32-38` | New items get `position = count`. Delete does not re-number. After a delete, two items can share a position → unstable order. *(code)* | Use `max(position)+1`, or renumber on every write. |
| P1 | `src/app/app.html:19`, `group-dialog.html:37` | Drag-sortable lists use `track $index`. DOM nodes get reused for different items after reorder/delete (menus, ripples, focus can attach to wrong item). | `track link.id`. |
| P1 | `src/app/app.ts:97` | `s.sort(...)` sorts the array held in the `ReplaySubject` in place. Mutates shared state. | `[...s].sort(...)`. |
| P1 | `group-shortcut.ts:56`, `group-shortcut.ts:85` | Mutates the cached array from `savedLinks$` (`group.push`, `group[i] = ...`) before save. A failed save leaves memory and storage different. | Copy before change. |
| P2 | `group-shortcut.html:2` | Dialog title inverted: shows "Edit Shortcut" when adding, "Add Shortcut" when editing. | Swap labels. |
| P2 | `group-dialog.ts:113` | `addSavedLink` not awaited in `removeShortcut`; errors are unhandled. | `await` + error UI. |
| P2 | `group-dialog.ts:30` | Sidebar `allGroups` is a snapshot. Rename/add in the dialog is not reflected in the sidebar. | Derive from `SaveLinks` observable / signal. |
| P2 | `group-name.ts:29`, `shortcut-dialog.ts:37` | `getSavedLinks().subscribe` never unsubscribed (subscription per dialog open). | `takeUntilDestroyed()` or `firstValueFrom`. |
| P2 | `group-name.ts:57` | New-group dialog opens with `disableClose: true`; Esc / backdrop do nothing. | Remove `disableClose`. |
| P2 | `src/environments/environment.ts:2-10` | `isProd: ''` and `dummyData` returns `''`. In dev, `linksData.set('')` (string, not array). | Typed env interface; `dummyData: Shortcut[]`. |
| P3 | `video.service.ts:158`, `storage.service.ts:17` | `chrome?.storage` throws `ReferenceError` when `chrome` is undeclared (jsdom, Firefox). In `VideoService` it is outside `try` → unhandled rejection. | `typeof chrome !== 'undefined' && chrome.storage?.local`. |

## Performance

| Sev | Where | Finding | Fix |
|---|---|---|---|
| P1 | `app.html:125-126`, `app.html:133-134`, `video.service.ts:99-111` | Every slider `(input)` tick writes **all** backgrounds (full data URLs, potentially MBs) to `chrome.storage.local`. *(code)* | Update signal on input, persist on `(change)` / debounce; store blobs separately (see Data). |
| P2 | `app.ts:111-162`, `app.ts:117` | `requestAnimationFrame` loop runs forever at 60 fps, even with an image or no background. It feeds `--theme-rgb`, which **no CSS uses**. | Remove, or sample on `timeupdate` only and actually use the colour. |
| P2 | `app.html:2-12` | `activeVideo$ \| async` evaluated 8 times. | `activeVideo = toSignal(...)` once. |
| P2 | `index.html:9-10` | Material Symbols + Roboto from Google Fonts. First paint shows raw ligature text (observed: "ad", "wa"). Offline new tab has no icons. | Bundle fonts locally in `assets/`. |
| P3 | `app.ts:30`, `app.html:57` | `colorDecoder` directive + `iconColor` signal that never changes: duplicate colour logic. | Pick one. |

## Security & permissions

| Sev | Where | Finding | Fix |
|---|---|---|---|
| P1 | `manifest.json:9-16` | `tabs`, `https://*/*`, `file:///*` are **unused**: no `chrome.tabs` call, no `fetch`. Favicons load via `<img>` (no host permission needed). Broad host access triggers the "Read and change all your data on all websites" warning and slower CWS review. | Keep only `storage` (+ `favicon`, see below). |
| P1 | `link.html:7`, `group-link.html:8` | Every link's full URL is sent to `google.com/s2/favicons` (leaks private repo names, PR paths, internal hostnames). | Use MV3 `_favicon` API (`chrome-extension://<id>/_favicon/?pageUrl=...&size=32`, `"favicon"` permission) with fallback icon. Verify API in docs before use. |
| P2 | `package.json` | `npm audit --omit=dev`: moderate in `@angular/common`/`@angular/compiler` (22.0.x), high in transitive `nanoid`. | Bump Angular to latest 22.x, `npm audit fix`. |
| P3 | `link.html:2` | `href` from stored data; `javascript:` URLs would be blocked by Angular sanitisation, but import accepts any string. | Validate scheme on save/import. |

## Data & storage

| Sev | Where | Finding | Fix |
|---|---|---|---|
| P1 | `video.service.ts:57`, `video.service.ts:171`, `manifest.json:9` | Backgrounds stored as base64 data URLs (+33% size) in `chrome.storage.local` without `unlimitedStorage` (10 MB quota). One HD video can exceed it; save then fails with an `alert`. *(code)* | Store blobs in IndexedDB, keep metadata in storage. Or add `unlimitedStorage` (mild permission). |
| P1 | `app.ts:331-363` | Import overwrites everything with no confirm and no backup. | Confirm dialog + auto-backup before overwrite. |
| P2 | `app.ts:291-303` | Export has no version and omits backgrounds/settings, so a future import cannot detect format. | Export `{ app, version, exportedAt, links }`. |
| P2 | `storage.service.ts:83-95` | Unknown version: logs warning and returns data as-is. Data from a **newer** version (downgrade) is used unvalidated and re-saved as v1 on next write. | Refuse to write when stored version > current; validate shape after migrate. |
| P2 | `video.service.ts:156-183` | `VideoService` bypasses `StorageService` (unversioned, own error handling). | Route through one storage layer. |
| P3 | `video.service.ts:61` | `Date.now()` ids. | `crypto.randomUUID()`. |

## Accessibility

| Sev | Where | Finding | Fix |
|---|---|---|---|
| P1 | `app.html:35-42`, `group-dialog.html:48-53` | "Add" tile is a `div`: not focusable, no role. Keyboard users cannot add anything. (Observed: absent from tab order.) | `<button aria-label="Add shortcut or group">`. |
| P1 | `app.html:29` | Group tile opens on `(click)` of a non-focusable element. Keyboard cannot open groups. | Make the tile a button. |
| P1 | `link.html:24`, `group-link.html:18` | `more_vert` menu buttons have no accessible name (observed: empty button text). | `aria-label="Options for {{name}}"`. |
| P2 | `app.html:48` | Data menu is `opacity-0` until hover: invisible to keyboard and touch. | Always visible, or settings panel. |
| P2 | global | No visible focus styles, no `prefers-reduced-motion` handling (scale/rotate transitions, autoplay video). | `:focus-visible` ring; reduce motion + pause video. |
| P2 | `app.html:65-154` | Background panel is not a dialog: no Esc, no focus trap, no `role`. | CDK overlay / `MatDialog`. |

## UX

| Sev | Where | Finding | Fix |
|---|---|---|---|
| P2 | `app.html:16` | Grid uses `auto-fill`, so tiles sit left of centre on wide screens (observed). | `auto-fit` or flex-wrap centred. |
| P2 | `link.html:18`, `group-link.html:12` | Long names wrap over the icon (observed). | `line-clamp-2` + `title`. |
| P2 | `group-dialog.html:3`, `app.ts:248` | Group dialog: fixed 192 px sidebar inside `70dvw`. On small windows the content area is narrower than one 144 px tile. *(code)* | Responsive: collapse sidebar below `md`. |
| P2 | `app.html` | No empty state for first run: black screen + one "+" tile. | Onboarding card. |
| P3 | `app.ts:198`, `app.ts:337`, `app.ts:355` | `alert()` for errors. | Snackbar / inline message. |
| P3 | `app.html:150` | Copy says "Stored securely" — it is plain local storage. | "Stored locally in this browser". |

## Code quality

| Sev | Where | Finding | Fix |
|---|---|---|---|
| P2 | `app.ts:56` | `CUSTOM_ELEMENTS_SCHEMA` on root hides template errors. Example: `matRipple` used in 4 templates but `MatRippleModule` never imported → no ripple at all. | Remove schema; import what is used. |
| P2 | `shortcut-dialog.ts:79-90`, `group-shortcut.ts:107-118` | `modifyUrl` / `checkForEmptySpaces` duplicated. | Shared util + tests. |
| P2 | `models/shortcut.ts` | `Shortcut` union by `type` but with nullable fields; `Group` is actually a link. | Discriminated union (`ShortcutLink \| GroupTile`); rename `Group`→`LinkItem`. Done as part of v2 model. |
| P3 | `app.css:1-28`, `styles.css:14-40` | Two `:root` token sets with different values; `--glass-highlight`, `--glass-blur-sm`, `--glass-bg-light`, `--glass-border-light`, `--glass-shadow-lg`, `--transition-smooth` are used but **never defined**. | One token file. |
| P3 | `app.ts:107` | `loadDataForDev(data: any)`. | Typed. |

## Tests

| Sev | Where | Finding | Fix |
|---|---|---|---|
| P0 | all `*.spec.ts` | 8 spec files, ~9 `should create` stubs. Zero behaviour coverage. Runner does not start. | jsdom + real tests (migration, CRUD, search, sort). |
| P1 | `app.spec.ts:19-24` | Asserts `h1` contains "Hello, home-page-extension": will fail when runner works. | Replace. |
| P2 | dialog specs | No `MAT_DIALOG_DATA` / `MatDialogRef` providers: they will fail to create. | Provide test doubles. |

## Docs

| Sev | Where | Finding | Fix |
|---|---|---|---|
| P2 | `README.md:13` | Says "Angular CLI v20.0.3"; project is Angular 22. | Update. |
| P2 | `README.md:40` | Says load `dist/`; the extension is in `dist/browser/`. | Fix path, or set `outputPath.browser: ""`. |
| P3 | `README.md:56-64` | Documents `ng e2e`; no e2e target exists. | Remove. |

## Suspicions from the brief — verdicts

| Suspicion | Verdict |
|---|---|
| `tabs`, `https://*/*`, `file:///*` needed? | **Not needed.** No API uses them. |
| Data URLs in storage, no `unlimitedStorage` | **Confirmed** (code). Not reproduced live. |
| `track $index` on sortable list | **Confirmed**, also in group dialog. |
| `activeVideo$ \| async` many times | **Confirmed**: 8 times. |
| Specs are stubs | **Confirmed**, and the runner cannot start. |
| README "Angular CLI v20.0.3" | **Confirmed**. |
