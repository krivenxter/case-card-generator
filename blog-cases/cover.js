const WIDTH = 1920;
const HEIGHT = 1080;
const headlineFont = '"Dela Gothic One", "Museo Sans Cyrl", sans-serif';
const bodyFont = '"Museo Sans Cyrl", sans-serif';
const images = new Map();

export function loadImage(source) {
  if (!source) return Promise.resolve(null);
  if (!images.has(source)) {
    const image = new Image();
    image.src = source;
    const pending = image.decode().then(() => image).catch((error) => {
      images.delete(source);
      throw error;
    });
    images.set(source, pending);
    if (images.size > 24) images.delete(images.keys().next().value);
  }
  return images.get(source);
}

function wrap(context, text, width) {
  const lines = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? line + ' ' + word : word;
      if (context.measureText(candidate).width <= width) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = '';
      for (const char of word) {
        if (line && context.measureText(line + char).width > width) {
          lines.push(line);
          line = '';
        }
        line += char;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function textBlock(context, text, width, maxSize, maxLines, family) {
  const weight = family === bodyFont ? 500 : 400;
  for (let size = maxSize; size >= 1; size -= 1) {
    const font = weight + ' ' + size + 'px ' + family;
    context.font = font;
    const lines = wrap(context, text, width);
    if (lines.length <= maxLines) return { lines, font, leading: size * 1.38, size };
  }
}

function textHeight(block) {
  return block.lines.length * block.leading;
}

function drawText(context, block, x, y) {
  context.font = block.font;
  block.lines.forEach((line, index) => context.fillText(line, x, y + block.size + index * block.leading));
}

function metricBlock(context, text, width, maxSize) {
  const number = text.match(/\d+(?:[\s\u00a0]\d{3})*(?:[.,]\d+)?(?:\s?[%₽])?/u);
  const parts = number ? [
    text.slice(0, number.index).trim(),
    number[0],
    text.slice(number.index + number[0].length).trim()
  ] : ['', text, ''];
  const sizePart = (size, index) => index === 1 ? size : size * .48;
  const measure = (size) => parts.map((part, index) => {
    context.font = sizePart(size, index) + 'px ' + headlineFont;
    return part ? context.measureText(part.toUpperCase()).width : 0;
  });
  const gapCount = parts.filter(Boolean).length - 1;
  let size = maxSize;
  let widths = measure(size);
  while (size > 1 && widths.reduce((total, part) => total + part, 0) + gapCount * size * .1 > width) {
    size -= 1;
    widths = measure(size);
  }
  const centered = parts.every((part, index) => index === 1 || /^[+−\-↑↓↗↘]*$/u.test(part));
  return {
    height: size,
    draw(x, y) {
      let offset = x;
      parts.forEach((part, index) => {
        if (!part) return;
        const partSize = sizePart(size, index);
        const baseline = y + size * .88 - (centered ? (size - partSize) * .35 : 0);
        context.font = partSize + 'px ' + headlineFont;
        context.fillText(part.toUpperCase(), offset, baseline);
        offset += widths[index] + size * .1;
      });
    }
  };
}

export function drawAsset(context, image, asset, x, y, width, height) {
  if (!image) return;
  const rotated = asset.rotate === 90;
  const aspect = asset.aspect || image.width / image.height;
  const scale = Math.min(width / (rotated ? 1 : aspect), height / (rotated ? aspect : 1));
  const w = scale * aspect;
  const h = scale;
  context.save();
  context.translate(x + width / 2, y + height / 2);
  if (rotated) context.rotate(Math.PI / 2);
  context.beginPath();
  context.rect(-w / 2, -h / 2, w, h);
  context.clip();
  const [left, top, iw, ih] = asset.crop || [0, 0, 100, 100];
  context.drawImage(image, -w / 2 + w * left / 100, -h / 2 + h * top / 100, w * iw / 100, h * ih / 100);
  context.restore();
}

function drawCoverImage(context, image) {
  const scale = Math.max(WIDTH / image.width, HEIGHT / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  context.drawImage(image, (WIDTH - width) / 2, (HEIGHT - height) / 2, width, height);
}

export async function prepareCover(state, logoSource) {
  const [background, art, logo] = await Promise.all([
    loadImage(state.backgroundImage), loadImage(state.art?.source), loadImage(state.logo ? logoSource : null)
  ]);
  return { background, art, logo };
}

export function drawCover(canvas, state, { background, art, logo }) {
  const ctx = canvas.getContext('2d');
  ctx.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
  ctx.fillStyle = state.color;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const mirror = state.layout === 'mirror';
  if (background) {
    ctx.save();
    if (mirror && ['figma', 'blue', 'pearl'].includes(state.background)) {
      ctx.translate(WIDTH, 0);
      ctx.scale(-1, 1);
    }
    drawCoverImage(ctx, background);
    ctx.restore();
  }
  const story = state.layout === 'story';
  const x = art && mirror ? 884 : 100;
  const width = art ? 936 : 1720;
  const zoom = Number(state.zoom) / 100;
  if (art) {
    const artWidth = (state.art.width || 842) * zoom;
    const artHeight = (state.art.height || 824) * zoom;
    const centerX = mirror ? 465 : 1404;
    drawAsset(ctx, art, state.art, centerX - artWidth / 2, 562 - artHeight / 2, artWidth, artHeight);
  }
  ctx.fillStyle = state.ink;
  const badge = state.category.trim();
  if (badge) {
    const label = 'КЕЙСЫ | ' + badge.toUpperCase();
    const block = textBlock(ctx, label, width - 40, 30, 1, bodyFont);
    const w = ctx.measureText(label).width + 44;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(x, 65, w, 58, 14);
    ctx.fill();
    ctx.fillStyle = '#242142';
    drawText(ctx, block, x + 22, 76);
  }
  if (logo) {
    ctx.save();
    if (state.background === 'pearl') ctx.filter = 'brightness(.25)';
    ctx.drawImage(logo, x, 150, 527, 87);
    ctx.restore();
  }
  ctx.fillStyle = state.ink;

  const rows = [[state.metric1, state.caption1], [state.metric2, state.caption2]].filter(row => row.some(value => value.trim()));
  const title = state.title.trim();
  const start = logo ? 317 : badge ? 180 : 110;
  const bottom = 1000;
  const titleBlock = textBlock(ctx, title, width, rows.length ? 78 : 137, rows.length ? 3 : 5, headlineFont);
  const showTitle = Boolean(title);
  const titleGap = showTitle && rows.length ? 24 : 0;
  const available = bottom - start - (showTitle ? textHeight(titleBlock) + titleGap : 0);
  const gap = rows.length > 1 ? 30 : 0;
  const metricSizes = story ? [135, 135] : state.layout === 'single' ? [248, 125] : [200, 200];
  const build = (factor) => rows.map(([metric, caption], index) => {
    const value = metric.trim() ? metricBlock(ctx, metric.trim(), width, Math.max(1, Math.floor(metricSizes[index] * factor))) : null;
    const description = textBlock(ctx, caption, width, Math.max(1, Math.floor(58 * factor)), 2, bodyFont);
    return { value, description, height: (value?.height || 0) + textHeight(description) };
  });
  let blocks = build(1);
  const height = (items) => items.reduce((sum, item) => sum + item.height, 0) + gap;
  for (let factor = .97; height(blocks) > available && factor > .05; factor -= .03) blocks = build(factor);
  let y = showTitle ? start : start + (rows.length === 1 ? (available - height(blocks)) / 2 : 0);
  if (showTitle) {
    drawText(ctx, titleBlock, x, y);
    y += textHeight(titleBlock) + titleGap;
  }
  for (const { value, description, height: rowHeight } of blocks) {
    value?.draw(x, y);
    drawText(ctx, description, x, y + (value?.height || 0));
    y += rowHeight + gap;
  }
}
