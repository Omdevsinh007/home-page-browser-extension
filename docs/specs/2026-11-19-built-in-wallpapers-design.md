# Built-in wallpapers — design

Date: 2026-11-19 · Status: approved

## Intent

A fresh install shows a plain black page. Ship four built-in CSS wallpapers so the page looks finished from the
first frame, and let people switch between built-ins and their own uploads at any time.

## Goals / non-goals / anti-goals

- Goals: four built-ins (Midnight, Lagoon, Dusk, Graphite); Lagoon default (changed from Midnight at the user's request); selectable even when uploads exist;
  first frame never black for built-in users.
- Non-goals: daily rotation, new permissions, bundled images.
- Anti-goals: a flash of the wrong wallpaper before an upload loads; breaking existing users' active upload.

## Approaches

1. **CSS gradient wallpapers (picked).** Layered radial gradients + inline SVG grain, ~1 kB, paints first frame.
2. Bundled photo — heavy (200–400 kB), licensing; rejected.
3. Animated canvas — continuous GPU cost; rejected.

## Design

- One active background: a built-in id or an upload. Built-in choice persisted in KeyValueStorage key
  `wallpaper` = `{ builtIn: BuiltInId }`; uploads keep `isActive` in IndexedDB. Choosing a built-in clears every
  upload's `isActive`; choosing an upload makes it active (built-in still remembered for fallback).
- `BackgroundStore.load()` no longer forces the first upload active: no active upload = built-in shows.
  Existing users keep their active upload.
- "At least one background must remain" rule removed; deleting the active upload falls back to the built-in.
- Rendering: `<div class="wallpaper" [attr.data-wallpaper]="id">` behind content when no upload is active.
  Base CSS paints Lagoon on `body` so the first frame is never black.
- Render snapshot gains `wallpaper: BuiltInId | 'upload'`; on boot the built-in from the snapshot paints at once;
  `'upload'` paints the neutral page background until the upload loads.
- Backgrounds dialog: "Built-in" radio row of 4 swatches at top; uploads list below; fit/brightness/blur stay
  upload-only; copy "One must stay active" removed.

## Left to the builder

Exact gradient stops (from the approved mockup), swatch size, names of internal helpers.
