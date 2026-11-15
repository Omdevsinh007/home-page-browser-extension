# Verdict: REDESIGN (visual language only)

The total is 14/30, below the 20-point threshold for REFINE, and #9 scored 0. So the rule gives REDESIGN. The weak scores are in the visual system (#3, #7), the clarity of controls (#4), and resource use (#9). The information architecture approved in Phase 2 (groups, sections as columns, search, sorting, Open all) is not what failed, so it is preserved. The redesign replaces the visual language and the control surface, not the structure.

## Highest-leverage moves

1. **#3 aesthetic + #7 long-lasting:** replace glassmorphism with one small token system. Use opaque or near-opaque surfaces, a 4-step type scale (12/14/16/20), a 4px spacing grid, and at most 8 colour tokens plus the 8 accents. Remove the radial glows and inner highlights. Evidence: E2 (53 raw colours, 11 spacing steps, `styles.css` dialog surface).
2. **#4 understandable:** make every control visible and named. Tile menus show on hover *and* get a visible affordance, "Edit" on a group becomes "Rename", "Remove"/"Delete" are unified to "Delete", "Export for v2.x" becomes "Export for older version (2.x)", and the two corner buttons merge into one labelled settings entry point. Evidence: E3, E5, `link.css:13`, `group-link.html:33`, `app.html:63`, `app.html:72`, `app.html:95`.
3. **#9 environmentally friendly:** subset the icon font, or swap it for inline SVG icons for the about 25 icons in use (target <50 KB). Make background video opt-in to autoplay and pause it when the tab is hidden. Honour `prefers-color-scheme` with a light theme. Evidence: E4.
4. **#8 thorough:** add a loading state, so the page shows neutral placeholders (or nothing) until `store.status()` is known instead of a lone add tile. Evidence: E2, `app.html:21`.
5. **#3 + legibility:** give tile names a guaranteed-contrast treatment (a solid label chip or a bottom scrim) so they stay readable over any wallpaper. Evidence: E2, `link.html:8`.
