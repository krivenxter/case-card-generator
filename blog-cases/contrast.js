const WHITE = '#ffffff';
const DARK = '#1f282c';
const sampleCanvas = document.createElement('canvas');
sampleCanvas.width = 30;
sampleCanvas.height = 28;
const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true });

function channels(hex) {
  return [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
}

const linear = Array.from({ length: 256 }, (_, channel) => {
  const value = channel / 255;
  return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
});

function luminance([r, g, b]) {
  return .2126 * linear[Math.round(r)] + .7152 * linear[Math.round(g)] + .0722 * linear[Math.round(b)];
}

function ratio(first, second) {
  return (Math.max(first, second) + .05) / (Math.min(first, second) + .05);
}

function pixels(canvas, x, width) {
  const scale = canvas.width / 1920;
  const w = sampleCanvas.width;
  const h = sampleCanvas.height;
  sampleContext.drawImage(canvas, x * scale, 150 * scale, width * scale, 850 * scale, 0, 0, w, h);
  const data = sampleContext.getImageData(0, 0, w, h).data;
  return Array.from({ length: w * h }, (_, i) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]);
}

function minContrast(samples, ink, scrim = 0) {
  const level = luminance(channels(ink));
  const fill = level > .45 ? 0 : 255;
  return samples.reduce((minimum, pixel) => {
    const blended = pixel.map(value => value + (fill - value) * scrim);
    return Math.min(minimum, ratio(level, luminance(blended)));
  }, 21);
}

function requiredScrim(samples, ink) {
  if (minContrast(samples, ink) >= 4.5) return 0;
  let min = 0;
  let max = 1;
  for (let i = 0; i < 12; i += 1) {
    const middle = (min + max) / 2;
    if (minContrast(samples, ink, middle) >= 4.6) max = middle;
    else min = middle;
  }
  return Math.min(1, max + .008);
}

export function coverContrast(canvas, x, width, state) {
  const samples = pixels(canvas, x, width);
  const levels = samples.map(luminance);
  const complex = Math.max(...levels) - Math.min(...levels) > .36;
  const whiteScrim = state.autoContrast ? requiredScrim(samples, WHITE) : 0;
  const darkScrim = state.autoContrast ? requiredScrim(samples, DARK) : 0;
  const preferDark = complex && whiteScrim > 0 && darkScrim > 0
    ? false
    : darkScrim < whiteScrim || (!darkScrim && !whiteScrim && minContrast(samples, DARK) > minContrast(samples, WHITE));
  const ink = state.autoContrast ? (preferDark ? DARK : WHITE) : state.ink;
  const scrim = state.autoContrast ? (preferDark ? darkScrim : whiteScrim) : 0;
  const logoArea = samples.slice(0, 3 * sampleCanvas.width).filter((_, index) => index % sampleCanvas.width < Math.ceil(530 / width * sampleCanvas.width));
  const logoDark = minContrast(logoArea, DARK) > minContrast(logoArea, WHITE);
  const logo = state.autoContrast
    ? preferDark ? 'dark' : complex || scrim > .18 ? 'white' : 'light'
    : logoDark ? 'dark' : complex ? 'white' : 'light';
  return { ink, scrim, logo, ratio: minContrast(samples, ink, scrim) };
}

export function paintScrim(context, x, width, opacity, ink, mirror) {
  if (!opacity) return;
  const [from, to] = mirror ? [x - 150, x] : [x + width + 10, x + width + 150];
  const fill = ink === DARK ? '255,255,255' : '0,0,0';
  const edge = `rgba(${fill},${opacity})`;
  const fade = context.createLinearGradient(from, 0, to, 0);
  fade.addColorStop(mirror ? 0 : 1, `rgba(${fill},0)`);
  fade.addColorStop(mirror ? 1 : 0, edge);
  context.fillStyle = fade;
  context.fillRect(0, 0, 1920, 1080);
}
