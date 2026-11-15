# Scorecard

1. Good design is innovative — Score: 1/3
   Evidence: tile grid and glass cards follow the Chrome new-tab / Momentum pattern (E2 tile geometry). Sections-as-columns and fuzzy search are improvements, but the worst instance is the main page.
   Justification: the main surface imitates peers with minor variation. It doesn't refresh the pattern, so not 2.

2. Good design makes a product useful — Score: 2/3
   Evidence: links in groups take 2 actions; shortcuts and search take 1 (E1).
   Justification: the primary task completes directly. The group dialog adds a step, so not 3. Nothing forces a detour, so not 1.

3. Good design is aesthetic — Score: 1/3
   Evidence: 6-step type scale with an off-scale 11px, 11 spacing steps, 53 raw colour literals bypassing tokens, tile/track size mismatch (E2).
   Justification: there are 3–5 inconsistencies, not ≤2.

4. Good design makes a product understandable — Score: 1/3
   Evidence: tile menus hidden until hover (E5), "Edit" means rename (E3), "Export for v2.x" jargon (E3), icon-only corner buttons (E1).
   Justification: 2–3 controls are unclear and jargon is present.

5. Good design is unobtrusive — Score: 2/3
   Evidence: wallpaper is the figure and chrome is quiet (settings at 60% opacity), but dialog glows and glass layers draw attention (E2).
   Justification: chrome is visible but quiet. The decoration doesn't compete with links on the main page, so not 1.

6. Good design is honest — Score: 2/3
   Evidence: one label/behaviour mismatch ("Edit" → rename, E3). No dark patterns.
   Justification: ≤1 minor issue, so not 3.

7. Good design is long-lasting — Score: 1/3
   Evidence: glassmorphism backdrop blur on every surface, pink/blue radial glows, skeuomorphic inner highlights (E2).
   Justification: 2–3 dated trend markers.

8. Good design is thorough down to the last detail — Score: 2/3
   Evidence: empty, error, success, focus and disabled are present; loading is missing and flashes an almost-empty grid (E2).
   Justification: exactly 1 state is missing.

9. Good design is environmentally friendly — Score: 0/3
   Evidence: 729 KB JS, 4.0 MB icon font for about 25 icons, background video autoplays by default, `prefers-color-scheme` ignored (E4).
   Justification: anchor 0 is ">2MB OR autoplay video OR dark mode ignored", and all three hold.

10. Good design is as little design as possible — Score: 2/3
    Evidence: duplicate "Add section" (E1), two floating corner controls that could be one (E1).
    Justification: there are ≤2 removable elements.

**Total: 14/30**
