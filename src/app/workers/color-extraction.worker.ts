/// <reference lib="webworker" />

addEventListener('message', ({ data }) => {
  const { imageBitmap } = data;
  
  if (!imageBitmap) return;

  const offscreen = new OffscreenCanvas(64, 64);
  const ctx = offscreen.getContext('2d', { willReadFrequently: true });
  
  if (!ctx) {
    imageBitmap.close();
    return;
  }

  try {
    ctx.drawImage(imageBitmap, 0, 0, 64, 64);
    const imageData = ctx.getImageData(0, 0, 64, 64).data;

    let r = 0, g = 0, b = 0;
    const step = 4 * 10;
    let samples = 0;

    for (let i = 0; i < imageData.length; i += step) {
      r += imageData[i];
      g += imageData[i + 1];
      b += imageData[i + 2];
      samples++;
    }

    if (samples > 0) {
      r = Math.floor(r / samples);
      g = Math.floor(g / samples);
      b = Math.floor(b / samples);

      postMessage({ r, g, b });
    }
  } catch (e) {
    // Ignore cross-origin errors if any
  } finally {
    // Always close bitmap to prevent memory leaks
    imageBitmap.close();
  }
});
