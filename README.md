# Home Page Chrome Extension

A Chrome extension built with Angular that overrides your browser's new tab/home page with a customizable dashboard. Organize your web with shortcuts and grouped links — keep similar links together for quick, clean access every time you open a new tab.

## Features

- **Custom Home Page** — Replaces your browser's default new tab page with a personalized dashboard
- **Shortcuts** — Add quick-access links to your most visited or important sites
- **Link Groups** — Organize related links into named groups, keeping similar shortcuts together in one place

## Tech Stack

- [Angular](https://angular.dev) (generated with Angular CLI v20.0.3)
- Chrome Extension APIs

## Development

### Start the dev server

```bash
ng serve
```

Navigate to `http://localhost:4200/`. The app reloads automatically on file changes.

### Build for production

```bash
ng build
```

Build artifacts are output to the `dist/` directory, optimized for performance.

### Load as a Chrome Extension

1. Run `ng build` to produce the `dist/` folder
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the `dist/` folder
5. Open a new tab — your custom home page will appear

## Code Scaffolding

Generate a new component with:

```bash
ng generate component component-name
```

For a full list of schematics:

```bash
ng generate --help
```

## Testing

### Unit tests

```bash
ng test
```

### End-to-end tests

```bash
ng e2e
```

## Additional Resources

- [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli)
- [Chrome Extension Developer Guide](https://developer.chrome.com/docs/extensions/)
