/** The keyboard equivalents of right-click: the ContextMenu key and Shift+F10. */
export function isMenuKey(event: KeyboardEvent): boolean {
  return event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey);
}
