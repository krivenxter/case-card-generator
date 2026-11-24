import { setupViewport } from './viewport.js';
import { setupColors, setupDialogs, setupSelects, setupUpload } from './controls.js';
import { drawAsset, drawCover, loadImage, prepareCover } from './cover.js';

const byId = (id) => document.getElementById(id);
const status = byId('status');
const canvas = byId('cover');
const operation = byId('operation');
let operations = 0;

function trackOperation(start) {
  operations += start ? 1 : -1;
  operation.hidden = operations === 0;
}
const fields = [...document.querySelectorAll('[data-field]')];
const assetPath = 'blog-cases/assets/';
const toolsArt = {
  source: assetPath + 'tools.png', label: 'Инструменты', category: 'Услуги',
  width: 834, height: 824, aspect: 824 / 834, rotate: 90, crop: [-16.91, -17.62, 135.27, 133.68]
};
const featured = [
  toolsArt,
  { source: assetPath + 'auto.png', label: 'Автомобиль со звездой', category: 'Авторитейл', aspect: 829 / 698, crop: [-15.97, -25.15, 129.78, 154.22] },
  { source: assetPath + 'clinic.png', label: 'Клиника', category: 'Медицина', aspect: 936 / 814, crop: [-17.1, -28.42, 132.64, 152.38] }
];
let figma = featured;
const shared = [...CALLTOUCH_ASSETS.visuals, ...CALLTOUCH_ASSETS.generalVisuals]
  .map(({ previewSource, label, keywords }) => ({ source: previewSource, label, keywords }));
const brandGradients = [
  { id: 'violet-gradient', label: 'Фиолетовый', gradient: ['#4d3ac6', '#d8d2f3'], angle: 14 },
  { id: 'cyan-gradient', label: 'Голубой', gradient: ['#005c85', '#26ccef'], angle: 13 },
  { id: 'night-gradient', label: 'Тёмный сине-фиолетовый', gradient: ['#18193f', '#5039a4'], angle: 20 },
  { id: 'sky-gradient', label: 'Светлый голубой', gradient: ['#eafaff', '#a9d9f4'], angle: 13 },
  { id: 'mist-gradient', label: 'Приглушённый голубой', gradient: ['#d6e6ea', '#8ea6c3'], angle: 16 },
  { id: 'lilac-gradient', label: 'Приглушённый лиловый', gradient: ['#e1dcef', '#afa6d0'], angle: 22 },
  { id: 'custom-gradient', label: 'Свой градиент', gradient: ['#5141c9', '#d8d2f3'], angle: 14 }
];
const backgrounds = [
  { id: 'figma', label: 'Фиолетовый из Figma', source: assetPath + 'gradient.svg' },
  { id: 'blue', label: 'Голубой из Figma', source: assetPath + 'gradient-blue.svg' },
  { id: 'pearl', label: 'Серебристый из Figma', source: assetPath + 'gradient-pearl.svg' },
  ...brandGradients,
  { id: 'solid', label: 'Сплошной цвет' },
  ...CALLTOUCH_ASSETS.backgrounds.map(({ id, label, previewSource }) => ({ id, label, source: previewSource }))
];
const layouts = [...document.querySelector('[data-field="layout"]').options];
let state = {
  title: '', category: '', metric1: '+68% ↑', caption1: 'подняли конверсию',
  metric2: 'в 2 раза', caption2: 'снизили стоимость оптовой заявки',
  layout: 'double', art: toolsArt, zoom: 100, logo: true,
  background: 'figma', backgroundImage: backgrounds[0].source, color: '#5141c9', ink: '#ffffff',
  autoContrast: true, gradient: null, angle: 14, gradientStart: '#5141c9', gradientEnd: '#d8d2f3'
};

let variants = [];
let selected = -1;
let library = 'figma';
let editVersion = 0;
let uploadedBackground;
let setNumber = 0;
let pendingFrame = 0;
const fontsReady = Promise.all([
  document.fonts.load('200px "Dela Gothic One"', 'Аа +68% ↑'),
  document.fonts.load('500 58px "Museo Sans Cyrl"', 'Аа ↑ ₽')
]);

function selectBackground(item) {
  const gradient = item.id === 'custom-gradient' ? [state.gradientStart, state.gradientEnd] : item.gradient;
  return {
    background: item.id, backgroundImage: item.source, gradient: gradient || null,
    ...(gradient ? {
      gradientStart: gradient[0], gradientEnd: gradient[1],
      angle: item.id === 'custom-gradient' ? state.angle : item.angle
    } : {})
  };
}

function syncFields() {
  byId('manual-ink').hidden = state.autoContrast;
  for (const field of fields) {
    const value = state[field.dataset.field];
    if (field.type === 'checkbox') field.checked = value;
    else field.value = value;
    field.dispatchEvent(new Event('blog-sync'));
  }
}

async function draw(canvas, snapshot, isCurrent) {
  const [, assets] = await Promise.all([fontsReady, prepareCover(snapshot)]);
  if (!isCurrent()) return;
  const contrast = drawCover(canvas, snapshot, assets);
  if (canvas.id === 'cover') {
    const label = { dark: 'тёмный', light: 'белый с голубым знаком', white: 'белый' };
    const result = contrast.ratio >= 4.5 ? 'Достаточный контраст' : 'Низкий контраст';
    byId('contrast-summary').textContent = result + ' ' + contrast.ratio.toFixed(1) + ':1' +
      (snapshot.logo ? ' — логотип ' + label[contrast.logo] : '');
    canvas.dataset.logoTone = contrast.logo;
    canvas.dataset.ink = contrast.ink;
    canvas.dataset.contrast = contrast.ratio.toFixed(2);
  }
}

function render() {
  const version = ++editVersion;
  cancelAnimationFrame(pendingFrame);
  pendingFrame = requestAnimationFrame(() => {
    const snapshot = state;
    draw(canvas, snapshot, () => version === editVersion).catch(() => {
      if (version === editVersion) status.textContent = 'Не удалось загрузить картинку или фон. Выберите другой файл.';
    });
  });
}

function refreshSelection() {
  [...byId('variants').children].forEach((button, index) => button.setAttribute('aria-pressed', index === selected));
  for (const button of byId('assets').querySelectorAll('button')) {
    button.setAttribute('aria-pressed', button.dataset.source === state.art?.source);
  }
}

function update(patch, sync = false) {
  state = { ...state, ...patch };
  if (sync) syncFields();
  if (selected !== -1) {
    variants[selected] = state;
    const preview = byId('variants').children[selected].querySelector('canvas');
    const snapshot = state;
    draw(preview, state, () => variants.includes(snapshot)).catch(() => {});
  }
  refreshSelection();
  render();
}

const categoryTerms = [
  [/авто|дилер|машин|trade.?in/iu, 'Авторитейл'],
  [/жил|недвиж|строи|квартир|застройщ/iu, 'Недвижимость'],
  [/медиц|клиник|стомат|пациент|записей|аптек/iu, 'Медицина'],
  [/финанс|банк|страхов|кредит/iu, 'Финансы'],
  [/ресторан|кафе|отел|horeca/iu, 'HoReCa'],
  [/салон|красот|бьюти/iu, 'Бьюти'],
  [/фитнес|трениров/iu, 'Фитнес'],
  [/психолог|mental health/iu, 'Mental Health'],
  [/коммерс|магазин|розниц|доставк/iu, 'Е-коммерс'],
  [/услуг|ремонт|сервис/iu, 'Услуги']
];

function relevantArt() {
  const query = [state.category, state.title, state.caption1, state.caption2].join(' ');
  const category = categoryTerms.find(([pattern]) => pattern.test(query))?.[1];
  if (category) return figma.filter((item) => item.category === category);
  const words = query.toLowerCase().match(/[\p{L}]{4,}/gu) || [];
  return shared.filter((item) => item.keywords?.some((keyword) => words.some((word) => word.startsWith(keyword))));
}

function renderVariants() {
  const container = byId('variants');
  container.replaceChildren();
  for (const [index, variant] of variants.entries()) {
    const button = document.createElement('button');
    button.type = 'button';
    const thumb = document.createElement('canvas');
    thumb.width = 320;
    thumb.height = 180;
    const name = document.createElement('span');
    name.textContent = layouts.find((option) => option.value === variant.layout).textContent;
    button.append(thumb, name);
    button.addEventListener('click', () => {
      selected = index;
      state = variants[index];
      syncFields();
      refreshSelection();
      render();
    });
    container.append(button);
    draw(thumb, variant, () => variants[index] === variant).catch(() => {});
  }
  refreshSelection();
}

function generate() {
  const matches = relevantArt();
  const related = state.art?.category ? figma.filter((asset) => asset.category === state.art.category) : [];
  const illustrations = matches.length ? matches : related.length ? related : state.art ? [state.art] : featured;
  const automaticBackgrounds = brandGradients.filter(({ id }) => id !== 'custom-gradient');
  variants = layouts.map((layout, index) => ({
    ...state,
    ...selectBackground(automaticBackgrounds[(setNumber + index) % automaticBackgrounds.length]),
    layout: layout.value,
    art: index === 0 && state.art ? state.art : illustrations[(setNumber + index) % illustrations.length],
    zoom: 100
  }));
  variants[0] = { ...state, layout: layouts[0].value };
  setNumber += 1;
  selected = -1;
  renderVariants();
  status.textContent = 'Собраны 4 варианта. Выберите любой, чтобы настроить его.';
}

function parseBrief(text) {
  const lines = text.trim().split(/\n+/).map((line) => line.replace(/^\s*[-•]\s+/, '').trim()).filter(Boolean);
  const title = [];
  const rows = [];
  for (const line of lines) {
    const metric = line.match(/^(?<value>[^—–:]+?)\s*(?:[—–:]|\s-\s)\s*(?<description>.+)$/u);
    const shorthand = line.match(/^(?<value>(?:(?:в|на|до)\s+)?[+−-]?\d+(?:[.,]\d+)?(?:\s?(?:%|₽|раза?|п\.п\.))?(?:\s?[↑↓])?)\s+(?<description>.+)$/iu);
    const parts = metric && /\d/.test(metric.groups.value) ? metric.groups : shorthand?.groups;
    if (parts && rows.length < 2) rows.push(parts);
    else title.push(line);
  }
  return {
    title: title.join('\n').slice(0, 220),
    metric1: rows[0]?.value.slice(0, 55) || '', caption1: rows[0]?.description.slice(0, 180) || '',
    metric2: rows[1]?.value.slice(0, 55) || '', caption2: rows[1]?.description.slice(0, 180) || ''
  };
}

const thumbnails = new IntersectionObserver((entries, observer) => {
  for (const { target, isIntersecting } of entries) {
    if (!isIntersecting) continue;
    observer.unobserve(target);
    const asset = target.asset;
    loadImage(asset.source).then((image) => drawAsset(target.getContext('2d'), image, asset, 8, 8, 80, 80))
      .catch(() => { target.parentElement.disabled = true; });
  }
}, { root: byId('assets'), rootMargin: '100px' });

function renderLibrary() {
  const container = byId('assets');
  thumbnails.disconnect();
  container.replaceChildren();
  const query = byId('asset-search').value.trim().toLowerCase();
  const items = (library === 'figma' ? figma : shared).filter((item) =>
    [item.label, item.category, ...(item.keywords || [])].join(' ').toLowerCase().includes(query)
  );
  for (const asset of items) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.source = asset.source;
    const image = document.createElement('canvas');
    image.width = 96;
    image.height = 96;
    image.asset = asset;
    const label = document.createElement('span');
    label.textContent = asset.label;
    button.append(image, label);
    container.append(button);
    thumbnails.observe(image);
    button.addEventListener('click', () => update({ art: asset, zoom: 100 }, true));
  }
  if (!items.length) {
    const empty = document.createElement('p');
    empty.textContent = 'Картинки не найдены';
    container.append(empty);
  }
  refreshSelection();
}

async function upload(file, apply) {
  trackOperation(true);
  try {
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    await loadImage(data);
    apply(data);
    status.textContent = 'Файл загружен.';
  } catch {
    status.textContent = 'Не удалось открыть файл как изображение.';
  } finally {
    trackOperation(false);
  }
}

for (const field of fields) {
  field.addEventListener('input', () => {
    const key = field.dataset.field;
    const value = field.type === 'checkbox' ? field.checked : field.value;
    if (key === 'background') {
      const item = backgrounds.find((background) => background.id === value) || uploadedBackground;
      update(selectBackground(item), true);
    } else if (key === 'color') {
      update({ color: value, background: 'solid', backgroundImage: undefined, gradient: null }, true);
    } else if (['gradientStart', 'gradientEnd', 'angle'].includes(key)) {
      const next = { ...state, [key]: value };
      update({
        [key]: value, background: 'custom-gradient', backgroundImage: undefined,
        gradient: [next.gradientStart, next.gradientEnd]
      }, true);
    } else if (key === 'autoContrast') {
      update({ autoContrast: value }, true);
    } else {
      update({ [key]: value });
    }
  });
}
const backgroundSelect = byId('background');
for (const background of backgrounds) backgroundSelect.add(new Option(background.label, background.id));

setupUpload(byId('upload-art'), (file) => upload(file, (source) => update({ art: { source }, zoom: 100 }, true)));
setupUpload(byId('upload-background'), (file) => upload(file, (source) => {
  if (!uploadedBackground) backgroundSelect.add(new Option('Свой фон', 'upload'));
  uploadedBackground = { id: 'upload', source };
  update(selectBackground(uploadedBackground), true);
}));
byId('reset-art').addEventListener('click', () => update({ art: null }));
byId('asset-search').addEventListener('input', renderLibrary);
for (const button of document.querySelectorAll('[data-library]')) {
  button.addEventListener('click', () => {
    library = button.dataset.library;
    for (const item of document.querySelectorAll('[data-library]')) item.setAttribute('aria-pressed', button === item);
    renderLibrary();
  });
}

const tabs = [...document.querySelectorAll('[role="tab"]')];
function activateTab(active) {
  for (const tab of tabs) {
    tab.setAttribute('aria-selected', tab === active);
    tab.tabIndex = tab === active ? 0 : -1;
    byId(tab.getAttribute('aria-controls')).hidden = tab !== active;
  }
  if (active.id === 'tab-art') renderLibrary();
}
for (const [index, tab] of tabs.entries()) {
  tab.addEventListener('click', () => activateTab(tab));
  tab.addEventListener('keydown', (event) => {
    const direction = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
    if (!direction && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const next = direction ? (index + direction + tabs.length) % tabs.length : event.key === 'Home' ? 0 : tabs.length - 1;
    activateTab(tabs[next]);
    tabs[next].focus();
  });
}

byId('generate').addEventListener('click', generate);
byId('from-brief').addEventListener('click', () => {
  const brief = byId('brief').value.trim();
  if (!brief) {
    byId('brief').focus();
    return;
  }
  selected = -1;
  const parsed = parseBrief(brief);
  const category = categoryTerms.find(([pattern]) => pattern.test(brief))?.[1] || '';
  state = { ...state, ...parsed, category };
  update({ art: relevantArt()[0] || toolsArt }, true);
  generate();
  byId('brief-dialog').close();
});

byId('download').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  const snapshot = state;
  const format = byId('export-format').value;
  button.disabled = true;
  trackOperation(true);
  try {
    const output = document.createElement('canvas');
    output.width = canvas.width;
    output.height = canvas.height;
    await draw(output, snapshot, () => true);
    const blob = await new Promise((resolve) => output.toBlob(resolve, 'image/' + format, .94));
    if (!blob || blob.type !== 'image/' + format) throw new Error('Unsupported format');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'blog-case-1920x1080.' + (format === 'jpeg' ? 'jpg' : format);
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = 'Обложка скачана.';
  } catch {
    status.textContent = 'Не удалось сохранить обложку. Проверьте фон и картинку или выберите другой формат.';
  } finally {
    trackOperation(false);
    button.disabled = false;
  }
});

fetch('blog-cases/figma-art.json').then((response) => {
  if (!response.ok) throw new Error('Library unavailable');
  return response.json();
}).then((items) => {
  const counts = new Map();
  figma = [...featured, ...items.map((item) => {
    const number = (counts.get(item.category) || 0) + 1;
    counts.set(item.category, number);
    return { ...item, source: assetPath + item.file, label: item.category + ' ' + number };
  })];
  if (!byId('panel-art').hidden && library === 'figma') renderLibrary();
}).catch(() => { status.textContent = 'Не удалось загрузить полную коллекцию Figma.'; });

syncFields();
setupViewport(canvas);
setupSelects();
setupDialogs();
setupColors();
render();
generate();
status.textContent = '';
window.lucide?.createIcons();
