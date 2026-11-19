// Runs before every spec file: the render snapshot lives in localStorage, so no spec may see another's.
beforeEach(() => localStorage.clear());
