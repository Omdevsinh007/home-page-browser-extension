# Scope

**Audited:** Custom Homepage 3.0.0 (branch `feature/link-sections-search-ui`, head of the 3.0.0 release commit), source in `src/app/`, build in `dist/browser/`.

**Surfaces:**
- Main page: wallpaper, search box, tile grid (shortcut tiles, group tiles, add tile), settings button, backgrounds button, status banners, empty state.
- Group dialog: group sidebar / switcher, section columns, link rows, section and group menus.
- Background dialog.
- Menus: add menu, data menu, tile menus.

**Primary user:** the owner, a developer who opens many new tabs a day and keeps work links (repos, docs, dashboards) organised in groups and sections.

**Primary task:** get to a saved link in as few actions as possible. Secondary: keep the collection organised.

**Constraints:**
- Angular 22, Tailwind 4, Material/CDK. Chrome/Brave MV3 new-tab page.
- Information architecture from Phase 2 is approved and stays: groups → sections → links, sections as side-by-side columns (mockup C), search with no-match fallback, per-section sort, Open all.
- Owner rule: no new features on main page tiles.
- The background image/video is a feature the owner uses.

**Method:** source reading plus build measurements. No live screenshots in this pass, so contrast values over wallpaper are INFERRED. Evidence gathered inline by the orchestrator, not by subagents (cost decision).
