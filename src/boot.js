// Runs before first paint: applies the last wallpaper from the render snapshot (see core/render-snapshot.ts),
// so the page never flashes the default. An external file because MV3 forbids inline scripts.
try {
  var w = JSON.parse(localStorage.getItem('renderSnapshot_v1') || 'null');
  var snap = w && w.v === 1 ? w : {};
  if (['midnight', 'lagoon', 'dusk', 'graphite', 'upload'].indexOf(snap.wallpaper) >= 0) document.documentElement.dataset.wallpaper = snap.wallpaper;
  if (snap.motion === false) document.documentElement.dataset.motion = 'off';
} catch (e) {}
