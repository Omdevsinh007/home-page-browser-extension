import { POPOVER_POSITIONS, SUBMENU_POSITIONS, TILE_MENU_POSITIONS } from './popover';

describe('popover positions', () => {
  it('starts below-centre with an 8px gap', () => {
    expect(POPOVER_POSITIONS[0]).toMatchObject({ originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 8 });
  });

  it('falls back above-centre, then end-aligned below/above, then start-aligned below/above', () => {
    expect(POPOVER_POSITIONS[1]).toMatchObject({ originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -8 });
    expect(POPOVER_POSITIONS[2]).toMatchObject({ originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 8 });
    expect(POPOVER_POSITIONS[3]).toMatchObject({ originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -8 });
    expect(POPOVER_POSITIONS[4]).toMatchObject({ originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 8 });
    expect(POPOVER_POSITIONS[5]).toMatchObject({ originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -8 });
  });

  it('tags each position with the side the panel grows from', () => {
    expect(POPOVER_POSITIONS.map((p) => p.panelClass)).toEqual([
      'placement-below',
      'placement-above',
      'placement-below',
      'placement-above',
      'placement-below',
      'placement-above',
    ]);
  });

  it('opens submenus to the end, falling back to the start', () => {
    expect(SUBMENU_POSITIONS[0]).toMatchObject({ originX: 'end', originY: 'top', overlayX: 'start', overlayY: 'top', offsetX: 4, panelClass: 'placement-end' });
    expect(SUBMENU_POSITIONS[1]).toMatchObject({ originX: 'start', originY: 'top', overlayX: 'end', overlayY: 'top', offsetX: -4, panelClass: 'placement-start' });
  });

  it('tile menus drop from the options button, right edges aligned, flipping up or left near edges', () => {
    expect(TILE_MENU_POSITIONS).toEqual([
      { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4, panelClass: 'placement-below-end' },
      { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4, panelClass: 'placement-above-end' },
      { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4, panelClass: 'placement-below-start' },
      { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4, panelClass: 'placement-above-start' },
    ]);
  });
});
