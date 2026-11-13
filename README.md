# Custom Homepage

A Chrome extension (Manifest V3) that replaces the new tab page with your own dashboard of shortcuts and link groups, on top of a background image or video of your choice.

## Features

- **Shortcuts and groups.** Put single shortcuts on the new tab page, or collect related links in a group. Drag tiles to reorder them.
- **Sections inside groups.** A group holds one or more sections, shown side by side as columns. Drag links within a section or between sections, and drag sections to reorder them. Each section can be renamed, given an accent colour, collapsed or deleted.
- **Open one or all.** Click a link to open it. Use **Open all** on a section to open every link in it in new tabs. You are asked first when there are more than 10.
- **Sorting.** Each section sorts manually, A–Z, by most recently opened, or by most used. Open counts are kept locally.
- **Search.** Press `/` or `Ctrl+K` (`Cmd+K` on macOS) to search all links by name, site, section or group, with typo tolerance. `Enter` opens the selected result and `Ctrl+Enter` opens it in a background tab. If nothing matches, all links are listed below the message.
- **Backgrounds.** Upload up to 3 images or videos and adjust fit, brightness and blur. Files are stored locally in this browser (IndexedDB).
- **Import, export and backups.** Export your links to a JSON file and import them again. Your current links are backed up before every import, and backups can be downloaded from the menu.
- **Offline and private.** Fonts and icons are bundled with the extension. Site icons come from the browser's own favicon cache, so no request goes to a third party.

## Install from source

```bash
npm install
npm run build
```

1. Open `chrome://extensions/`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select the `dist/browser/` folder.
4. Open a new tab.

Links to `file:///` pages need **Allow access to file URLs** turned on in the extension's details.

## Upgrading from 2.x and downgrading

Version 3 stores links in a new format (`savedLinks_v2`), and migrates your 2.x data automatically on first start. A backup of the original data is kept. Background files move to IndexedDB, and the old copy is left in place.

Version 3 also keeps writing a 2.x-compatible copy of your links. If you go back to 2.6.0, it shows your links as before, without sections (links from all sections of a group appear together). When you upgrade again, changes you made in 2.6.0 are merged back in. To move links to a 2.x install on another browser, use **Export for v2.x** in the menu.

## Development

```bash
npm start        # dev server on http://localhost:4200
npm test         # unit tests (Vitest, jsdom)
npm run build    # production build into dist/browser/
```

Outside the extension (for example on the dev server), data is saved to `localStorage` instead of `chrome.storage`.

## Tech stack

- Angular 22 (standalone components, signals, zoneless)
- Angular Material and CDK (dialogs, menus, drag and drop)
- Tailwind CSS 4
- Vitest

Design notes live in `docs/`: the review (`docs/review.md`), the design spec (`docs/specs/`) and the implementation plan (`docs/plans/`).
