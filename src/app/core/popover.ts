import type { ConnectedPosition } from '@angular/cdk/overlay';

/**
 * Where popover menus open, in order of preference: centred under the trigger with an 8px gap, else centred
 * above it, else aligned to the trigger's end or start edge (below, then above). The panel class names the side the panel grows
 * from, so `popover.css` can set a matching transform-origin.
 */
export const POPOVER_POSITIONS: ConnectedPosition[] = [
  { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 8, panelClass: 'placement-below' },
  { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -8, panelClass: 'placement-above' },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 8, panelClass: 'placement-below' },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -8, panelClass: 'placement-above' },
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 8, panelClass: 'placement-below' },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -8, panelClass: 'placement-above' },
];

/**
 * Tile menus drop from the tile's ⋯ button: right edges aligned, 4px below, overlapping the tile like a
 * desktop menu. Near the bottom they open upwards; near the left edge they align to the button's left side.
 */
export const TILE_MENU_POSITIONS: ConnectedPosition[] = [
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4, panelClass: 'placement-below-end' },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4, panelClass: 'placement-above-end' },
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4, panelClass: 'placement-below-start' },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4, panelClass: 'placement-above-start' },
];

/** Submenus open beside their item: to the end, else to the start. */
export const SUBMENU_POSITIONS: ConnectedPosition[] = [
  { originX: 'end', originY: 'top', overlayX: 'start', overlayY: 'top', offsetX: 4, panelClass: 'placement-end' },
  { originX: 'start', originY: 'top', overlayX: 'end', overlayY: 'top', offsetX: -4, panelClass: 'placement-start' },
];

/** Space kept between a popover and the viewport edge. */
export const POPOVER_VIEWPORT_MARGIN = 8;
