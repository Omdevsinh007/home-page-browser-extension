# Glass refresh: design

**Status:** draft for owner approval
**Inputs:** Rams audit in `DESIGN-IS-2026-11-13/` (14/30, REDESIGN of the visual language), owner's choice of mockup `ui-direction-v3` (kept in `.superpowers/brainstorm/`, which git ignores).
**Builds on:** 3.0.0 on branch `feature/link-sections-search-ui`.

## 1. Intent

Give Custom Homepage one calm, consistent look that feels like Apple's frosted glass. Fix the clarity and weight problems the audit found, without changing what the extension does or how it is organised.

The owner chose this direction after seeing three options:
- **Search bar:** the minimal pill from option A.
- **Shortcuts:** two styles the user can switch between: **Tiles** (today's tiles, in the new material) and **Compact** (pills, from option C).
- **Material:** one Apple-style frosted glass used on every surface.

## 2. Goals

1. One glass material, defined once as tokens and used by every surface.
2. A **Shortcut style** setting: Tiles or Compact.
3. Every control visible and named (audit #4).
4. Static assets under 1.5 MB, so the 4 MB icon font goes (audit #9).
5. Readable text on any wallpaper, including bright ones.
6. A loading state, so the page doesn't flash a lone add tile.

## 3. Non-goals

- No change to the information architecture: groups → sections → links, section columns, search behaviour, sorting and Open all all stay as in 3.0.0.
- No new features on main page tiles (owner rule). The Compact style is a different presentation of the same items with the same actions.
- No light theme in this pass. Glass sits over the user's wallpaper, so `prefers-color-scheme` doesn't apply. *(My call; audit #9 noted it. It can come later.)*
- No refraction or "liquid" distortion effects (SVG displacement filters). They are heavy and fragile.

## 4. Anti-goals

- Glows, coloured radial gradients or inner "shine" layers on dialogs. The audit flagged these as dated.
- Raw colour or size values in components that bypass the tokens.
- Hover-only controls with no other way to find them.

## 5. The glass material

The material comes from the approved mockup. Define it once in `src/styles/tokens.css` and apply it through a single `.glass` utility class (or an equivalent mixin):

| Token | Value |
|---|---|
| `--glass-fill` | `rgba(255,255,255,0.14)` |
| `--glass-fill-strong` | `rgba(255,255,255,0.22)` (group pills, selected rows) |
| `--glass-fill-dark` | `rgba(30,30,36,0.40)` (dialogs, popovers, menus) |
| `--glass-filter` | `blur(30px) saturate(180%)` |
| `--glass-stroke` | `0.5px solid rgba(255,255,255,0.35)` |
| `--glass-highlight` | `inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(255,255,255,0.08)` |
| `--glass-shadow` | `0 8px 32px rgba(0,0,0,0.18)` |
| `--text` / `--text-dim` | `#fff` / `rgba(255,255,255,0.72)` |
| `--text-on-glass-shadow` | `0 1px 2px rgba(0,0,0,0.35)` |

- **Radii:** 24px (pill-height controls are fully rounded), 22px tiles, 24px dialogs, 18px popovers, 16px section columns, 10px rows.
- **Type:** the system font stack `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif`. Sizes 12 / 14 / 16 / 20 px only, weights 400 / 500 / 600. *(My call: this replaces bundled Roboto, matches the Apple feel and removes about 70 KB of font files.)*
- **Spacing:** a 4px grid.
- **Accents:** the 8 section accents stay unchanged.
- **Legibility:** text on glass gets `--text-on-glass-shadow`. The search placeholder must stay readable over a white area of the wallpaper. Target 4.5:1, using a slightly darker fill behind the input if needed. This fixes the faint placeholder seen in the mockup.

## 6. Surfaces

### 6.1 Main page
- **Search:** the 48px pill from the mockup: glass, search icon, "Search links" placeholder, `/` hint. Behaviour unchanged.
- **Shortcuts, Tiles style:** 112×140 glass tiles with a 40px favicon and the name under it (single line, ellipsis, full name in `title`). Group tiles show the 2×2 favicon preview. The "⋯" menu button is always visible at reduced opacity, and at full opacity on hover or focus. The add tile uses a lighter fill.
- **Shortcuts, Compact style:** 40px-tall glass pills with a 26px favicon and the name. Group pills use `--glass-fill-strong` and show the link count. The add pill uses a lighter fill.
  - Clicking does what the tile does: open the link, or open the group dialog.
  - The menu (edit/rename, delete) opens from a "⋯" button that appears on hover or focus, and from right-click.
  - Drag to reorder works as it does for tiles.
- **Settings:** one corner button labelled "Settings" (bottom right). It opens a glass popover with:
  - **Shortcut style:** a segmented control, Tiles | Compact.
  - **Backgrounds…:** opens the background dialog.
  - **Export data**, **Export for older version (2.x)**, **Import data**, **Download backups**.

  The top-right "more" button goes away. The popover closes on Esc or an outside click and returns focus to the button.
- **Status banners and empty state:** same content as 3.0.0, in the glass material.
- **Loading state:** while `store.status()` is `loading`, render the search pill and nothing else (no add tile).

### 6.2 Group dialog
The structure is the same as 3.0.0. The dialog surface uses `--glass-fill-dark`. Section columns use a faint fill and hairline stroke, rows are 38px, the hovered or selected row uses `--glass-fill-strong`, and buttons are small glass pills. The current pink/blue dialog glow is removed.

### 6.3 Background dialog, small dialogs, menus, snackbars
All of these use `--glass-fill-dark` with the same stroke, highlight and shadow. That covers the background dialog, the name, link and confirm dialogs, Material menus and snackbars. Controls follow the same pill and segmented styles.

## 7. Copy changes (audit #4)
- The group tile menu says "Rename" instead of "Edit".
- "Remove" becomes "Delete" everywhere, for both tiles and groups.
- "Export for v2.x" becomes "Export for older version (2.x)".

## 8. Weight (audit #9)
- Replace the Material Symbols font with inline SVG icons for the about 25 icons in use. Use one small icon component and `MatIconRegistry` with SVG literals, or plain SVG; the builder picks. Remove the `material-symbols` and `@fontsource/roboto` packages.
- Target: `dist/browser` static assets (excluding the user's own data) under 1.5 MB.
- **Video background:**
  - It keeps autoplaying for users who chose a video.
  - It pauses while the tab is hidden (`visibilitychange`).
  - It doesn't autoplay under `prefers-reduced-motion` (as in 3.0.0).

  *(My call: the mockup note said "autoplay off by default", but that would silently stop a feature the owner uses. Pausing when hidden saves most of the energy.)*
- Blur cost: many blurred elements over a playing video can be heavy on the GPU. Check this in the real browser with the owner's data (about 9 tiles) and both styles. If it stutters, the fallback is a single blurred layer behind the grid instead of one per tile.

## 9. Data
- Shortcut style is stored under a new `chrome.storage.local` key, `uiPrefs`: `{ shortcutStyle: 'tiles' | 'compact' }`. The default is `'tiles'`.
- It is not part of the links data, so v2.6.0 downgrade and the v1 mirror are unaffected. Export and import don't include it.

## 10. Acceptance
- `npm run build` and `npm test` pass; specs are updated for changed labels and the new setting.
- No raw `rgba()` or hex values in component templates and CSS outside `tokens.css`, except the 8 accents and favicon letter colours.
- `dist/browser` contains no `googleapis` and no icon font. Its total static size is under 1.5 MB.
- Both shortcut styles support click, menu (button and right-click), keyboard focus and drag reorder.
- Owner's manual check in Brave over a bright and a dark wallpaper, plus a video background: names and the search placeholder are readable, and scrolling and dragging are smooth.

## 11. Left to the builder
- Exact SVG icon source and component shape.
- Whether `.glass` is a global utility class or a Tailwind `@utility`.
- Popover implementation (CDK overlay or Material menu with custom content), as long as it meets §6.1.
