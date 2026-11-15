# Handoff

````
/make-plan Redesign the visual language of Custom Homepage (Chrome/Brave MV3 new-tab extension, Angular 22 + Tailwind 4 + Material/CDK, repo C:/Work-folder/angular/home-page-browser-extension). Current design failed a Dieter Rams audit at 14/30 with critical gaps in principles #9 environmentally friendly (0), #3 aesthetic (1), #4 understandable (1), #7 long-lasting (1).

Verdict paragraph (quoted from 03-verdict.md):
> The total is 14/30, below the 20-point threshold for REFINE, and #9 scored 0, so the rule gives REDESIGN. The weak scores are in the visual system, the clarity of controls and resource use. The information architecture approved in Phase 2 is not what failed, so it is preserved; the redesign replaces the visual language and the control surface, not the structure.

Why redesign and not refine: the total is below 20 and #9 scored 0. The failures come from the glassmorphism visual system as a whole, not from isolated details.

Preserve from current design:
- Information architecture: groups → sections → links; sections as side-by-side columns in the group dialog (src/app/components/group-dialog/group-dialog.html, section-column.html).
- Search box behaviour and position above the grid: `/` and Ctrl/Cmd+K, combobox, no-match fallback listing all links (src/app/components/search-box/).
- Main page tile grid: shortcut tiles, group tiles with 4-favicon preview, add tile, drag to reorder (src/app/app.html:31-57). Owner rule: no new features on main page tiles.
- User background image/video with fit, brightness and blur (src/app/services/background.store.ts).
- Section accent presets --accent-1..8 (src/styles/tokens.css).
- All behaviour, storage, a11y labels and status banners from 3.0.0.

Discard:
- Glassmorphism as the base material (backdrop-blur on every surface, rgba(255,255,255,.1) cards). Evidence: link.html:3, app.css .add-links/.glass-button. Caused failure on #3 and #7.
- Pink/blue radial glows and inner highlights on dialogs. Evidence: src/styles.css .mat-mdc-dialog-surface and ::before. Caused failure on #7.
- Raw rgba()/hex literals outside tokens (53 found). Caused failure on #3.
- 4.0 MB Material Symbols variable font for about 25 icons. Evidence: dist/browser/media/material-symbols-outlined.woff2. Caused failure on #9.
- Hover-only tile menu buttons (link.css:13, group-link.css:13) and separate floating corner buttons (app.html:63, app.html:72). Caused failure on #4.

Top moves from the audit (verbatim):
1. #3 + #7: Replace glassmorphism with one small token system. Use opaque or near-opaque surfaces, a 4-step type scale (12/14/16/20), a 4px spacing grid, and at most 8 colour tokens plus the 8 accents. Remove the radial glows and inner highlights. Evidence: 53 raw colours, 11 spacing steps, styles.css dialog surface.
2. #4: Make every control visible and named. Tile menus get a visible affordance; group "Edit" becomes "Rename"; "Remove"/"Delete" unify to "Delete"; "Export for v2.x" becomes "Export for older version (2.x)"; the two corner buttons merge into one labelled settings entry point. Evidence: link.css:13, group-link.html:33, app.html:63, app.html:72, app.html:95.
3. #9: Subset the icon font or swap it for inline SVG icons (target <50 KB). Make background video autoplay opt-in and pause it when the tab is hidden. Honour prefers-color-scheme with a light theme. Evidence: 729 KB main.js, 4.0 MB font, autoplay video, no prefers-color-scheme.
4. #8: Add a loading state so the page doesn't flash a lone add tile before store.status() is known. Evidence: app.html:21.
5. #3 legibility: Give tile names guaranteed contrast (solid label chip or bottom scrim) over any wallpaper. Evidence: link.html:8.

Redesign principles in priority order:
1. #4 understandable — a first-time user names every control on the main page and in the group dialog without hovering.
2. #3 aesthetic — every colour, size and spacing value on the audited surfaces comes from tokens.css; no orphan values.
3. #9 environmentally friendly — static assets under 1.5 MB total, no autoplay by default, light and dark themes.

Deliverables for the plan:
- New visual language spec (tokens, type, spacing, surfaces, icon set) compared side by side with current.
- Main page, group dialog, background/settings dialog and menus restyled on the new tokens (low-fi mockups first, owner picks a direction).
- States checklist (empty, loading, error, success, focus, disabled) per surface.
- Migration path: existing user data and settings untouched; one release switches the look.
- Cutover criteria: old glass styles and unused CSS deleted in the same release, no theme flag kept around.

Anti-patterns to guard against:
- Porting the glass look under new token names.
- Keeping old and new themes behind a flag indefinitely.
- Following a new trend instead of the principles above.
- Changing the approved information architecture or adding features to main page tiles.
````
