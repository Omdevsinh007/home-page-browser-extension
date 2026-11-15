# Evidence

## E1 Structural
- Interactive elements (buttons / inputs / menu items) per template: `app.html` 13/1/6, `section-column.html` 12/0/7, `group-dialog.html` 8/1/3, `background-dialog.html` 4/3/0, `group-link.html` 4/0/2, `link.html` 3/0/2, `search-box.html` 0/1/0.
- Duplicated affordance: "Add section" appears twice in the group dialog, as a header icon (`group-dialog.html:34`) and as a column at the end (`group-dialog.html:60`).
- Two separate floating controls in opposite corners: settings (`app.html:63`, top right) and backgrounds (`app.html:72`, bottom right).
- Group switching exists as sidebar plus `<select>` (`group-dialog.html:3`, `:24`). This is responsive, not a duplicate.
- Reaching a link inside a group takes 2 actions (open group, click link). Shortcuts and search results take 1.

## E2 Visual (INFERRED from source)
- Type scale in use: 11, 12, 14, 16, 18, 20 px (`text-[11px]` ×11, `text-xs` ×5, `text-sm` ×11, `text-base` ×1, `text-lg` ×7, `text-xl` ×2). The 11px uppercase labels (`background-dialog.html:34`) sit outside the Tailwind scale.
- Spacing steps in use (Tailwind units): 0, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 8. That is 11 steps, including 3 half steps.
- Colours: 53 distinct raw `rgba()`/hex literals in CSS, plus 23 distinct Tailwind colour utilities in templates. A token file exists (`src/styles/tokens.css`) but most surfaces bypass it.
- Tile geometry: tiles are 112×144 (`link.html:3`, `w-28 h-36`) inside 144px grid tracks with `!p-4` padding (`app.html:35`). The add tile has its own 112×144 card (`app.css` `.add-links`).
- Tile names are white text on `bg-white/10` over an arbitrary wallpaper (`link.html:8`). There is no scrim, so contrast depends on the image. A bright wallpaper can drop it below 3:1 (INFERRED).
- Dialog surface: pink and blue radial-gradient glows plus layered inner highlights (`src/styles.css`, `.mat-mdc-dialog-surface` and `::before`).
- States: empty ✓ (`app.html:21`, `background-dialog.html:61`, `section-column.html:63`), error ✓ (`app.html:16-18`), success ✓ (snackbar), focus ✓ (`styles.css :focus-visible`), disabled ✓ (`section-column.html:89`, `background-dialog.html:70`), **loading ✗**. While status is `loading`, the grid renders with only the add tile (`app.html:21` condition is `ready && empty`), so the page flashes an almost-empty state.

## E3 Copy and honesty
- Label/behaviour mismatch: the group tile menu item says "Edit" but opens a rename dialog (`group-link.html:33`).
- Inconsistent verbs for the same act: tile menus say "Remove" (`link.html:28`, `group-link.html:35`), the group dialog says "Delete group" (`group-dialog.html:78`), sections say "Delete section" (`section-column.html:89`).
- Jargon: "Export for v2.x" (`app.html:95`). Plain: "Export for older version (2.x)".
- "Colour" (`section-column.html:87`) vs "colour" elsewhere: consistent British spelling, fine.
- No inflations, no dark patterns. Destructive actions confirm first.

## E4 Weight and friction
- `main.js` 729,376 bytes (raw, not compressed). `styles.css` 57,298 bytes.
- Icon font `material-symbols-outlined.woff2` 4,011,996 bytes for about 25 icons in use.
- Network requests for the primary view: 0 remote. All local.
- Idle animation: background video autoplays unless reduced motion is set (`app.html:4`).
- Dark mode: the UI is always dark; `prefers-color-scheme` is never read (0 matches in `src`).
- Modals or banners on initial load: 0 in the normal case.

## E5 Accessibility
- Landmarks: `nav` in the group dialog only. The main page has no `main`; its only heading is in the empty state (`app.html:23`).
- Tile menu buttons are invisible until hover (`link.css:13`, `group-link.css:13`, `opacity: 0`). They are keyboard reachable and become visible on focus, but a mouse user cannot see that they exist.
- Every primary action is keyboard reachable: search (`/`, Ctrl+K), tiles, add, settings, backgrounds, dialog controls.
- No skip link (only one landmark, low need).
