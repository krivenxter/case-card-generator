import { BLOCK_DEFINITIONS, EMAIL_STORAGE_KEY, createBlock, createDefaultEmail, createId, cloneEmail } from "./email-model.js";
import { buildAutoVariants, readImportedFile } from "./email-parser.js";
import { renderEmailDocument } from "./email-renderer.js";
import { normalizeEmailDesign, validateEmail } from "./email-quality.js";
import { BRAND_SCENE_MIN_HEIGHT, BRAND_SCENE_WIDTH, brandSceneSignature, isBrandScenePublished, renderBrandSceneMarkup } from "./email-brand-scene.js";
import { BRAND_TITLE_MIN_HEIGHT, BRAND_TITLE_WIDTH, brandTitleSignature, isBrandTitlePublished, renderBrandTitleMarkup, resolveBrandTitleColors } from "./email-brand-title.js";

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const escapeAttr = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));

const elements = {
  start: $("#startScreen"), variants: $("#variantScreen"), editor: $("#editorScreen"), pastePanel: $("#pastePanel"), importText: $("#importText"), fileInput: $("#importFileInput"),
  variantFrames: [$("#variantAFrame"), $("#variantBFrame")], preview: $("#emailPreview"), previewStage: $("#previewStage"), previewCanvas: $("#previewCanvas"), previewModeLabel: $("#previewModeLabel"), zoomIndicator: $("#zoomIndicator"),
  projectTitle: $("#projectTitle"), theme: $("#themeSelect"), blockList: $("#blockList"), blockEditor: $("#blockEditor"), footnoteList: $("#footnoteList"),
  blockLibraryDialog: $("#blockLibraryDialog"), blockLibrary: $("#blockLibrary"), assetDialog: $("#assetDialog"), assetGrid: $("#assetGrid"), customAssetFile: $("#customAssetFile"), customAssetUrl: $("#customAssetUrl"),
  qualityDialog: $("#qualityDialog"), qualityTitle: $("#qualityTitle"), qualityResults: $("#qualityResults"), codePreview: $("#codePreview"), copyButton: $("#copyHtmlButton"), downloadButton: $("#downloadHtmlButton"),
  saveStatus: $("#saveStatus"), toast: $("#emailToast")
};

let email = null;
let autoVariants = [];
let selectedBlockId = "";
let assetTargetId = "";
let assetTargetPath = "content.image";
let customPreviewSource = "";
let saveTimer = 0;
let previewTimer = 0;
let draggedBlockId = "";
let pendingPreviewScroll = null;
const canvasState = { zoom: 1, panX: 0, panY: 0, panning: false, spacePressed: false, fitMode: true, startX: 0, startY: 0, originX: 0, originY: 0 };

function showScreen(name) {
  elements.start.hidden = name !== "start";
  elements.variants.hidden = name !== "variants";
  elements.editor.hidden = name !== "editor";
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => { elements.toast.hidden = true; }, 2600);
}

function iconRefresh() {
  window.lucide?.createIcons({ attrs: { "stroke-width": 1.8 } });
}

function persistSoon() {
  if (!email) return;
  elements.saveStatus.textContent = "Сохраняем…";
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(EMAIL_STORAGE_KEY, JSON.stringify(email));
      elements.saveStatus.textContent = "Сохранено локально";
    } catch (error) {
      elements.saveStatus.textContent = "Не удалось сохранить";
      console.warn(error);
    }
  }, 260);
}

function restoreEmail() {
  try {
    const saved = JSON.parse(localStorage.getItem(EMAIL_STORAGE_KEY) || "null");
    return saved?.version === 1 && Array.isArray(saved.blocks) ? saved : null;
  } catch {
    return null;
  }
}

function getSelectedBlock() {
  return email?.blocks.find((block) => block.id === selectedBlockId) || null;
}

function getDefinition(type) {
  return BLOCK_DEFINITIONS.find((definition) => definition.type === type);
}

function setPath(target, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const parent = keys.reduce((node, key) => node[key], target);
  parent[last] = value;
}

function enterEditor(nextEmail) {
  email = cloneEmail(nextEmail || createDefaultEmail());
  email.settings.logo = "dark";
  canvasState.fitMode = true;
  selectedBlockId = email.blocks[0]?.id || "";
  showScreen("editor");
  renderEditor();
  persistSoon();
}

function renderEditor() {
  elements.projectTitle.textContent = email.meta.title || "Новое письмо";
  elements.theme.value = email.settings.theme;
  renderPreview();
  renderBlockList();
  renderBlockEditor();
  renderFootnotes();
  syncPreviewMode();
  iconRefresh();
}

function renderPreview({ preservePosition = true } = {}) {
  window.clearTimeout(previewTimer);
  if (preservePosition && elements.preview.contentWindow) pendingPreviewScroll = { x: elements.preview.contentWindow.scrollX, y: elements.preview.contentWindow.scrollY };
  previewTimer = window.setTimeout(() => {
    elements.preview.srcdoc = renderEmailDocument(email, { preview: true });
    elements.preview.addEventListener("load", bindPreviewInteractions, { once: true });
  }, 80);
}

function bindPreviewInteractions() {
  const previewDocument = elements.preview.contentDocument;
  if (!previewDocument) return;
  if (email.blocks.length && !previewDocument.querySelector("[data-block-id]")) {
    renderPreview({ preservePosition: false });
    return;
  }
  const style = previewDocument.createElement("style");
  style.textContent = `[data-block-id]{cursor:pointer;transition:filter .12s ease}[data-block-id]:hover{filter:brightness(.96)}[data-block-id].is-selected>td{outline:3px solid #24b8dc;outline-offset:0}[data-edit-path]{cursor:text;border-radius:4px;outline:1px dashed transparent;outline-offset:4px}[data-edit-path]:hover,[data-edit-path]:focus{outline-color:rgba(36,184,220,.8);background:rgba(255,255,255,.08)}[data-edit-path]:focus{outline-width:2px}`;
  previewDocument.head.append(style);
  previewDocument.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link) return;
    event.preventDefault();
    showToast("Ссылки в предпросмотре не открываются.");
  }, true);
  $$('[data-edit-path]', previewDocument).forEach((node) => {
    node.contentEditable = "plaintext-only";
    node.spellcheck = true;
    node.classList.add("is-inline-editable");
    node.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      selectedBlockId = node.closest("[data-block-id]")?.dataset.blockId || selectedBlockId;
      renderBlockList();
      renderBlockEditor();
      bindPreviewSelection();
    });
    node.addEventListener("focus", () => {
      node.dataset.editStart = node.innerText;
      selectedBlockId = node.closest("[data-block-id]")?.dataset.blockId || selectedBlockId;
      renderBlockList();
      renderBlockEditor();
      bindPreviewSelection();
    });
    node.addEventListener("input", () => {
      const block = email.blocks.find((item) => item.id === node.closest("[data-block-id]")?.dataset.blockId);
      if (!block) return;
      setPath(block, node.dataset.editPath, node.innerText.replace(/\n{3,}/g, "\n\n").trim());
      persistSoon();
    });
    // Перерендериваем предпросмотр только если текст реально изменился,
    // иначе каждый клик-выделение перезагружает iframe и мерцает белым.
    node.addEventListener("blur", () => {
      if (node.innerText !== node.dataset.editStart) commitChange({ rerenderEditor: true });
    });
  });
  $$('[data-block-id]', previewDocument).forEach((node) => {
    node.classList.toggle("is-selected", node.dataset.blockId === selectedBlockId);
    node.addEventListener("click", (event) => {
      event.preventDefault();
      selectedBlockId = node.dataset.blockId;
      renderBlockList();
      renderBlockEditor();
      bindPreviewSelection();
    });
  });
  bindPreviewCanvasControls(previewDocument);
  syncPreviewHeight(previewDocument);
  if (pendingPreviewScroll) {
    elements.preview.contentWindow.scrollTo(pendingPreviewScroll.x, pendingPreviewScroll.y);
    pendingPreviewScroll = null;
  }
}

function bindPreviewSelection() {
  const previewDocument = elements.preview.contentDocument;
  if (!previewDocument) return;
  $$('[data-block-id]', previewDocument).forEach((node) => node.classList.toggle("is-selected", node.dataset.blockId === selectedBlockId));
}

function renderBlockList() {
  elements.blockList.innerHTML = email.blocks.map((block, index) => {
    const definition = getDefinition(block.type);
    return `<div class="email-block-row${block.id === selectedBlockId ? " is-selected" : ""}" draggable="true" data-block-id="${escapeAttr(block.id)}"><i class="email-block-row__grip" data-lucide="grip-vertical" aria-hidden="true"></i><div><strong>${escapeAttr(definition?.label || block.type)}</strong><small>${escapeAttr(block.content.heading || block.content.text || block.content.body || "Системный интервал")}</small></div><div class="email-block-row__actions"><button type="button" data-action="up" title="Выше" ${index === 0 ? "disabled" : ""}><i data-lucide="chevron-up"></i></button><button type="button" data-action="down" title="Ниже" ${index === email.blocks.length - 1 ? "disabled" : ""}><i data-lucide="chevron-down"></i></button><button type="button" data-action="duplicate" title="Дублировать"><i data-lucide="copy"></i></button><button type="button" data-action="delete" title="Удалить"><i data-lucide="trash-2"></i></button></div></div>`;
  }).join("");
  iconRefresh(elements.blockList);
}

function field(label, path, value, { type = "text", rows = 0, hint = "", options = null } = {}) {
  let control = "";
  if (options) control = `<select data-field="${path}">${options.map(([optionValue, optionLabel]) => `<option value="${optionValue}"${value === optionValue ? " selected" : ""}>${optionLabel}</option>`).join("")}</select>`;
  else if (rows) control = `<textarea data-field="${path}" rows="${rows}">${escapeAttr(value)}</textarea>`;
  else control = `<input data-field="${path}" type="${type}" value="${escapeAttr(value)}">`;
  return `<label class="email-field"><span>${label}</span>${control}${hint ? `<small class="email-field__hint">${hint}</small>` : ""}</label>`;
}

function assetField(block, path = "content.image", label = "Изображение") {
  const asset = path.split(".").reduce((value, key) => value?.[key], block);
  return `<div class="email-asset-field"><span>${label}</span><button class="email-asset-trigger" type="button" data-asset-target="${escapeAttr(block.id)}" data-asset-path="${escapeAttr(path)}"><img src="${escapeAttr(asset?.previewSource || "visuals/Calltouch-1.png")}" alt=""><span>${escapeAttr(asset?.label || "Выбрать изображение")}</span></button></div>`;
}

function brandImageStatus(block) {
  const published = block.type === "brandTitle" ? isBrandTitlePublished(block) : isBrandScenePublished(block);
  if (published) return `<div class="email-brand-publish-status is-ready"><strong>Изображение готово</strong><a href="${escapeAttr(block.content.renderedUrl)}" target="_blank" rel="noopener">Открыть файл</a></div>`;
  if (block.content.renderedUrl) return `<div class="email-brand-publish-status is-stale"><strong>Композиция изменена</strong><span>Обновите изображение перед экспортом.</span></div>`;
  return `<div class="email-brand-publish-status"><strong>Изображение ещё не создано</strong><span>Предпросмотр живой, но в письмо попадёт PNG.</span></div>`;
}

function renderBlockEditor() {
  const block = getSelectedBlock();
  if (!block) {
    elements.blockEditor.innerHTML = `<h2>Выберите блок</h2>`;
    return;
  }
  const definition = getDefinition(block.type);
  let controls = "";
  if (block.type === "title") controls = `${field("Композиция", "variant", block.variant, { options: [["plain", "Обычный"], ["subtitle", "С подзаголовком"], ["accent", "С акцентной плашкой"]] })}${field("Заголовок", "content.heading", block.content.heading, { rows: 3, hint: "Рекомендуется до 90 символов" })}${field("Подзаголовок", "content.subtitle", block.content.subtitle, { rows: 3 })}${field("Фрагмент в плашке", "content.accent", block.content.accent)}`;
  if (block.type === "text") controls = field("Текст", "content.body", block.content.body, { rows: 8, hint: "Пустая строка — абзац, дефис — пункт, **текст** — жирный, [ссылка](https://…) — ссылка" });
  if (block.type === "promo") controls = `${field("Лейбл", "content.eyebrow", block.content.eyebrow)}${field("Заголовок", "content.heading", block.content.heading, { rows: 3 })}${field("Оффер / цифра", "content.offer", block.content.offer)}${field("Описание", "content.body", block.content.body, { rows: 5 })}${assetField(block)}${field("Текст кнопки", "content.ctaText", block.content.ctaText)}${field("Ссылка кнопки", "content.ctaUrl", block.content.ctaUrl, { type: "url" })}`;
  if (["imageText", "featureCard"].includes(block.type)) controls = `${field("Картинка", "variant", block.variant, { options: [["image-left", "Слева"], ["image-right", "Справа"]] })}${field("Заголовок", "content.heading", block.content.heading, { rows: 2 })}${field("Описание", "content.body", block.content.body, { rows: 5 })}${assetField(block)}${block.type === "imageText" ? `${field("Текст ссылки", "content.linkText", block.content.linkText)}${field("Адрес ссылки", "content.linkUrl", block.content.linkUrl, { type: "url" })}` : ""}`;
  if (block.type === "brandTitle") controls = `${field("Цветовая схема", "variant", block.variant, { options: [["light-cyan", "Светло-голубая"], ["cyan", "Циановая"], ["navy", "Тёмно-синяя"], ["purple", "Фиолетовая"], ["magenta", "Розовая"], ["custom", "Свой цвет"]] })}${block.variant === "custom" ? field("Цвет фона", "content.backgroundColor", block.content.backgroundColor, { type: "color" }) : ""}${block.variant === "cyan" ? "" : field("Цвет текста", "content.textTone", block.content.textTone, { options: [["auto", "Автоматически"], ["dark", "Тёмно-синий"], ["light", "Белый"]] })}${field("Заголовок Dela", "content.heading", block.content.heading, { rows: 3, hint: "Размер шрифта подстроится под длину" })}${brandImageStatus(block)}<button class="email-button email-button--primary email-brand-publish" type="button" data-brand-publish>${block.content.renderedUrl ? "Обновить изображение" : "Создать изображение"}</button>`;
  if (block.type === "brandScene") controls = `${field("Цветовая тема", "variant", block.variant, { options: [["navy-purple", "Синий — фиолетовый"], ["cyan-navy", "Циановый — синий"], ["purple-cyan", "Фиолетовый — циановый"]] })}${field("Заголовок Dela", "content.heading", block.content.heading, { rows: 3, hint: "До 70 символов" })}${field("Тезисы", "content.body", block.content.body, { rows: 5, hint: "Каждый тезис — с новой строки" })}${assetField(block, "content.background", "Фон или пятно")}${assetField(block, "content.image", "Вылезающая иллюстрация")}${field("Ссылка со всего блока", "content.linkUrl", block.content.linkUrl, { type: "url" })}${field("Описание картинки", "content.alt", block.content.alt, { rows: 2 })}${brandImageStatus(block)}<button class="email-button email-button--primary email-brand-publish" type="button" data-brand-publish>${block.content.renderedUrl ? "Обновить изображение" : "Создать изображение"}</button>`;
  if (block.type === "iconGrid") controls = `<div class="email-icon-items">${block.content.items.map((item, index) => `<div class="email-icon-item"><strong>Преимущество ${index + 1}</strong><input data-field="content.items.${index}.heading" value="${escapeAttr(item.heading)}" placeholder="Заголовок"><input data-field="content.items.${index}.body" value="${escapeAttr(item.body)}" placeholder="Короткое описание"></div>`).join("")}</div>`;
  if (block.type === "ctaCard") controls = `${field("Тема", "variant", block.variant, { options: [["dark", "Тёмно-синяя"], ["light", "Светлая"]] })}${field("Заголовок", "content.heading", block.content.heading, { rows: 3 })}${field("Пояснение", "content.subtitle", block.content.subtitle, { rows: 3 })}${field("Текст кнопки", "content.ctaText", block.content.ctaText)}${field("Ссылка", "content.ctaUrl", block.content.ctaUrl, { type: "url" })}`;
  if (block.type === "button") controls = `${field("Акцент", "variant", block.variant, { options: [["primary", "Основной"], ["secondary", "Спокойный"]] })}${field("Текст", "content.text", block.content.text)}${field("Ссылка", "content.url", block.content.url, { type: "url" })}`;
  if (block.type === "divider") controls = field("Интервал", "variant", block.variant, { options: [["s", "S — компактный"], ["m", "M — обычный"], ["l", "L — большой"], ["xl", "XL — очень большой"]] });
  elements.blockEditor.innerHTML = `<div class="email-block-editor__header"><h2>${escapeAttr(definition?.label || block.type)}</h2><span>ЗАЩИЩЁННЫЙ ВАРИАНТ</span></div>${controls}`;
}

function renderFootnotes() {
  elements.footnoteList.innerHTML = email.footnotes.map((note, index) => `<div class="email-footnote-row" data-footnote-id="${escapeAttr(note.id)}"><span>${"*".repeat(index + 1)}</span><textarea rows="2" data-footnote-field="text">${escapeAttr(note.text)}</textarea><div class="email-footnote-row__actions"><button type="button" data-footnote-action="up" title="Выше">↑</button><button type="button" data-footnote-action="down" title="Ниже">↓</button><button type="button" data-footnote-action="delete" title="Удалить">×</button></div></div>`).join("");
}

function syncPreviewMode() {
  const mobile = email.settings.preview === "mobile";
  elements.previewStage.classList.toggle("is-mobile", mobile);
  elements.previewModeLabel.textContent = mobile ? "Телефон · 390 px" : "Компьютер · 660 px";
  $$('[data-preview]').forEach((button) => button.classList.toggle("is-active", button.dataset.preview === email.settings.preview));
}

function commitChange({ rerenderEditor = false, refreshPreview = true } = {}) {
  if (refreshPreview) renderPreview();
  renderBlockList();
  if (rerenderEditor) renderBlockEditor();
  persistSoon();
}

function applyCanvasTransform() {
  elements.previewCanvas.style.transform = `translate(${canvasState.panX}px, ${canvasState.panY}px) scale(${canvasState.zoom})`;
  elements.zoomIndicator.value = `${Math.round(canvasState.zoom * 100)}%`;
  elements.zoomIndicator.textContent = `${Math.round(canvasState.zoom * 100)}%`;
}

function setCanvasZoom(nextZoom) {
  canvasState.fitMode = false;
  canvasState.zoom = Math.min(1.8, Math.max(0.08, nextZoom));
  applyCanvasTransform();
}

function fitCanvas() {
  const horizontalScale = (elements.previewStage.clientWidth - 64) / elements.preview.offsetWidth;
  const verticalScale = (elements.previewStage.clientHeight - 56) / elements.preview.offsetHeight;
  canvasState.zoom = Math.min(1, horizontalScale, verticalScale);
  canvasState.panX = 0;
  canvasState.panY = 0;
  applyCanvasTransform();
}

function resetCanvas() {
  canvasState.fitMode = true;
  fitCanvas();
}

function syncPreviewHeight(previewDocument) {
  const height = Math.max(previewDocument.body.scrollHeight, previewDocument.documentElement.scrollHeight, 720);
  elements.preview.style.height = `${height}px`;
  if (canvasState.fitMode) window.requestAnimationFrame(fitCanvas);
  previewDocument.querySelectorAll("img").forEach((image) => image.addEventListener("load", () => {
    const nextHeight = Math.max(previewDocument.body.scrollHeight, previewDocument.documentElement.scrollHeight, 720);
    elements.preview.style.height = `${nextHeight}px`;
    if (canvasState.fitMode) fitCanvas();
  }, { once: true }));
}

function startCanvasPan(clientX, clientY) {
  canvasState.fitMode = false;
  canvasState.panning = true;
  canvasState.startX = clientX;
  canvasState.startY = clientY;
  canvasState.originX = canvasState.panX;
  canvasState.originY = canvasState.panY;
  elements.previewStage.classList.add("is-panning");
}

function moveCanvasPan(clientX, clientY) {
  if (!canvasState.panning) return;
  canvasState.panX = canvasState.originX + clientX - canvasState.startX;
  canvasState.panY = canvasState.originY + clientY - canvasState.startY;
  applyCanvasTransform();
}

function stopCanvasPan() {
  canvasState.panning = false;
  elements.previewStage.classList.remove("is-panning");
}

function bindPreviewCanvasControls(previewDocument) {
  const getPoint = (event) => {
    const rect = elements.preview.getBoundingClientRect();
    return { x: rect.left + event.clientX, y: rect.top + event.clientY };
  };
  previewDocument.addEventListener("wheel", (event) => {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      setCanvasZoom(canvasState.zoom + (event.deltaY < 0 ? .1 : -.1));
      return;
    }
    canvasState.fitMode = false;
    canvasState.panY -= event.deltaY;
    applyCanvasTransform();
  }, { passive: false });
  previewDocument.addEventListener("pointerdown", (event) => {
    if (event.button !== 1 && !canvasState.spacePressed) return;
    event.preventDefault();
    const point = getPoint(event);
    startCanvasPan(point.x, point.y);
  });
  previewDocument.addEventListener("pointermove", (event) => {
    if (!canvasState.panning) return;
    const point = getPoint(event);
    moveCanvasPan(point.x, point.y);
  });
  previewDocument.addEventListener("pointerup", stopCanvasPan);
  previewDocument.addEventListener("keydown", (event) => {
    if (event.code !== "Space" || previewDocument.activeElement?.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(previewDocument.activeElement?.tagName || "")) return;
    canvasState.spacePressed = true;
    elements.previewStage.classList.add("is-pan-ready");
    event.preventDefault();
  });
  previewDocument.addEventListener("keyup", (event) => {
    if (event.code !== "Space") return;
    canvasState.spacePressed = false;
    elements.previewStage.classList.remove("is-pan-ready");
    stopCanvasPan();
  });
}

function moveBlock(id, delta) {
  const index = email.blocks.findIndex((block) => block.id === id);
  const next = index + delta;
  if (index < 0 || next < 0 || next >= email.blocks.length) return;
  [email.blocks[index], email.blocks[next]] = [email.blocks[next], email.blocks[index]];
  commitChange();
}

function deleteBlock(id) {
  const index = email.blocks.findIndex((block) => block.id === id);
  if (index < 0) return;
  email.blocks.splice(index, 1);
  selectedBlockId = email.blocks[Math.min(index, email.blocks.length - 1)]?.id || "";
  commitChange({ rerenderEditor: true });
}

function duplicateBlock(id) {
  const index = email.blocks.findIndex((block) => block.id === id);
  if (index < 0) return;
  const copy = cloneEmail(email.blocks[index]);
  copy.id = createId();
  email.blocks.splice(index + 1, 0, copy);
  selectedBlockId = copy.id;
  commitChange({ rerenderEditor: true });
}

function renderLibrary() {
  elements.blockLibrary.innerHTML = BLOCK_DEFINITIONS.map((definition) => `<button class="email-library-item" type="button" data-add-type="${definition.type}"><i data-lucide="${definition.icon}"></i><span><strong>${definition.label}</strong><span>${definition.description}</span></span></button>`).join("");
  iconRefresh(elements.blockLibrary);
}

function renderAssetGrid() {
  const assets = assetTargetPath === "content.background" ? window.CALLTOUCH_ASSETS.backgrounds : window.CALLTOUCH_ASSETS.visuals;
  elements.assetGrid.innerHTML = assets.map((asset) => `<button class="email-asset-card" type="button" data-asset-id="${asset.id}"><img src="${escapeAttr(asset.previewSource)}" alt=""><span>${escapeAttr(asset.label)}</span></button>`).join("");
}

function openAssetDialog(blockId, path = "content.image") {
  assetTargetId = blockId;
  assetTargetPath = path;
  customPreviewSource = "";
  elements.customAssetFile.value = "";
  elements.customAssetUrl.value = "";
  renderAssetGrid();
  elements.assetDialog.showModal();
}

function applyAsset(asset) {
  const block = email.blocks.find((item) => item.id === assetTargetId);
  if (!block) return;
  setPath(block, assetTargetPath, { ...asset });
  elements.assetDialog.close();
  commitChange({ rerenderEditor: true });
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Не удалось создать PNG.")), "image/png"));
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(reader.error || new Error("Не удалось прочитать PNG."));
    reader.readAsDataURL(blob);
  });
}

function getBrandRenderConfig(block) {
  if (block.type === "brandTitle") {
    return { width: BRAND_TITLE_WIDTH, minHeight: BRAND_TITLE_MIN_HEIGHT, markup: renderBrandTitleMarkup(block), signature: brandTitleSignature, background: resolveBrandTitleColors(block).background };
  }
  return { width: BRAND_SCENE_WIDTH, minHeight: BRAND_SCENE_MIN_HEIGHT, markup: renderBrandSceneMarkup(block, { preview: true, editable: false }), signature: brandSceneSignature, background: "#064b79" };
}

async function renderBrandImagePng(block) {
  if (!window.DomExport) throw new Error("Модуль создания изображений не загрузился.");
  const config = getBrandRenderConfig(block);
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${config.width}px;min-height:${config.minHeight}px;pointer-events:none;`;
  host.innerHTML = config.markup;
  document.body.append(host);
  try {
    if (document.fonts?.ready) await document.fonts.ready;
    const height = Math.max(Math.ceil(host.firstElementChild.getBoundingClientRect().height), config.minHeight);
    host.firstElementChild.style.height = `${height}px`;
    const canvas = await window.DomExport.toCanvas(host.firstElementChild, {
      width: config.width,
      height,
      pixelRatio: 2,
      cacheBust: location.protocol !== "file:",
      backgroundColor: config.background,
      fontFaces: location.protocol === "file:" ? [] : [
        { family: "Dela Gothic One", src: "fonts/DelaGothicOne-Regular.ttf", format: "truetype", weight: "400" },
        { family: "Museo Sans Cyrl", src: "fonts/museosanscyrl-500.woff2", format: "woff2", weight: "500" }
      ]
    });
    return canvasToPngBlob(canvas);
  } finally {
    host.remove();
  }
}

function downloadBrandScene(blob, block) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `calltouch-brand-${block.id}.png`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function publishBrandImage(block, button) {
  button.disabled = true;
  button.textContent = "Создаём PNG…";
  try {
    const blob = await renderBrandImagePng(block);
    const config = window.CALLTOUCH_EMAIL_CONFIG || {};
    if (!config.brandAssetUploadEndpoint) {
      downloadBrandScene(blob, block);
      throw new Error("Функция загрузки ещё не подключена: PNG сохранён на компьютер.");
    }
    button.textContent = "Загружаем в облако…";
    const headers = { "Content-Type": "application/json" };
    if (config.uploadToken) headers["X-Generator-Token"] = config.uploadToken;
    const response = await fetch(config.brandAssetUploadEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ imageBase64: await blobToBase64(blob), blockId: block.id })
    });
    const rawResult = await response.json().catch(() => ({}));
    const result = typeof rawResult.body === "string" ? JSON.parse(rawResult.body) : rawResult;
    if (!response.ok || !result.url) throw new Error(result.error || "Облако не вернуло ссылку на изображение.");
    block.content.renderedUrl = result.url;
    block.content.renderedSignature = getBrandRenderConfig(block).signature(block);
    block.content.renderedAt = new Date().toISOString();
    commitChange({ rerenderEditor: true });
    showToast("Изображение создано и загружено.");
  } catch (error) {
    const localOrigin = ["localhost", "127.0.0.1", "::1"].includes(location.hostname);
    const networkError = error instanceof TypeError && /fetch/i.test(error.message || "");
    showToast(networkError && localOrigin ? "Локальный адрес не разрешён функцией. Обновите её версию." : error.message || "Не удалось создать изображение.");
    renderBlockEditor();
  }
}

async function importFile(file) {
  if (!file) return;
  try {
    const text = await readImportedFile(file);
    buildVariants(text);
  } catch (error) {
    showToast(error.message || "Не удалось прочитать файл.");
  } finally {
    elements.fileInput.value = "";
  }
}

function buildVariants(text) {
  if (!text.trim()) {
    showToast("Добавьте текст письма.");
    return;
  }
  autoVariants = buildAutoVariants(text);
  elements.variantFrames.forEach((frame, index) => { frame.srcdoc = renderEmailDocument(autoVariants[index], { preview: true }); });
  showScreen("variants");
}

function openQualityDialog() {
  if (!email) return;
  const report = validateEmail(email);
  const html = renderEmailDocument(email, { preview: false });
  elements.qualityTitle.textContent = report.errors.length ? `Нужно исправить: ${report.errors.length}` : report.warnings.length ? `Нужно проверить: ${report.warnings.length}` : "Письмо готово ✓";
  elements.qualityResults.innerHTML = `${report.errors.length ? `<section class="email-quality-group"><h3>Ошибки</h3><ul>${report.errors.map((item) => `<li>${escapeAttr(item)}</li>`).join("")}</ul></section>` : ""}${report.warnings.length ? `<section class="email-quality-group"><h3>Предупреждения</h3><ul>${report.warnings.map((item) => `<li>${escapeAttr(item)}</li>`).join("")}</ul></section>` : ""}${!report.errors.length && !report.warnings.length ? `<section class="email-quality-group"><h3>Критических проблем не найдено</h3><ul><li>Проверьте ссылки и отправьте тестовое письмо в вашей системе рассылок.</li></ul></section>` : ""}`;
  elements.codePreview.value = html;
  elements.copyButton.disabled = Boolean(report.errors.length);
  elements.downloadButton.disabled = Boolean(report.errors.length);
  elements.qualityDialog.showModal();
}

async function copyHtml() {
  try {
    await navigator.clipboard.writeText(elements.codePreview.value);
  } catch {
    elements.codePreview.select();
    document.execCommand("copy");
  }
  showToast("HTML скопирован.");
}

function downloadHtml() {
  const blob = new Blob([elements.codePreview.value], { type: "text/html;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "calltouch-email.html";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

$$('[data-start-action]').forEach((button) => button.addEventListener("click", () => {
  if (button.dataset.startAction === "paste") {
    $(".email-start__choices").hidden = true;
    elements.pastePanel.hidden = false;
    elements.importText.focus();
  } else {
    enterEditor(createDefaultEmail());
  }
}));

$("#cancelPasteButton").addEventListener("click", () => { elements.pastePanel.hidden = true; $(".email-start__choices").hidden = false; });
$("#generateVariantsButton").addEventListener("click", () => buildVariants(elements.importText.value));
elements.fileInput.addEventListener("change", () => importFile(elements.fileInput.files?.[0]));
$("#backToStartButton").addEventListener("click", () => showScreen("start"));
$$('[data-variant]').forEach((button) => button.addEventListener("click", () => enterEditor(autoVariants[Number(button.dataset.variant)])));

$$('[data-preview]').forEach((button) => button.addEventListener("click", () => { email.settings.preview = button.dataset.preview; syncPreviewMode(); persistSoon(); }));
elements.theme.addEventListener("change", () => { email.settings.theme = elements.theme.value; commitChange(); });
$("#normalizeButton").addEventListener("click", () => { email = normalizeEmailDesign(email); commitChange({ rerenderEditor: true }); showToast("Дизайн нормализован."); });

elements.blockList.addEventListener("click", (event) => {
  const row = event.target.closest("[data-block-id]");
  if (!row) return;
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "up") return moveBlock(row.dataset.blockId, -1);
  if (action === "down") return moveBlock(row.dataset.blockId, 1);
  if (action === "duplicate") return duplicateBlock(row.dataset.blockId);
  if (action === "delete") return deleteBlock(row.dataset.blockId);
  selectedBlockId = row.dataset.blockId;
  renderBlockList();
  renderBlockEditor();
  bindPreviewSelection();
});
elements.blockList.addEventListener("dragstart", (event) => {
  const row = event.target.closest("[data-block-id]");
  if (!row) return;
  draggedBlockId = row.dataset.blockId;
  event.dataTransfer.effectAllowed = "move";
  row.classList.add("is-dragging");
});
elements.blockList.addEventListener("dragover", (event) => {
  const row = event.target.closest("[data-block-id]");
  if (!row || row.dataset.blockId === draggedBlockId) return;
  event.preventDefault();
  $$(".email-block-row", elements.blockList).forEach((item) => item.classList.remove("is-drop-target"));
  row.classList.add("is-drop-target");
});
elements.blockList.addEventListener("drop", (event) => {
  const target = event.target.closest("[data-block-id]");
  if (!target || !draggedBlockId || target.dataset.blockId === draggedBlockId) return;
  event.preventDefault();
  const sourceIndex = email.blocks.findIndex((block) => block.id === draggedBlockId);
  const targetIndex = email.blocks.findIndex((block) => block.id === target.dataset.blockId);
  const [moved] = email.blocks.splice(sourceIndex, 1);
  email.blocks.splice(targetIndex + (sourceIndex < targetIndex ? 0 : 0), 0, moved);
  draggedBlockId = "";
  commitChange();
});
elements.blockList.addEventListener("dragend", () => {
  draggedBlockId = "";
  $$(".email-block-row", elements.blockList).forEach((item) => item.classList.remove("is-dragging", "is-drop-target"));
});

elements.blockEditor.addEventListener("input", (event) => {
  const control = event.target.closest("[data-field]");
  const block = getSelectedBlock();
  if (!control || !block) return;
  setPath(block, control.dataset.field, control.value);
  persistSoon();
});
elements.blockEditor.addEventListener("change", (event) => {
  const control = event.target.closest("[data-field]");
  if (!control) return;
  commitChange({ rerenderEditor: true });
});
elements.blockEditor.addEventListener("click", (event) => {
  const publishButton = event.target.closest("[data-brand-publish]");
  if (publishButton) {
    const block = getSelectedBlock();
    if (["brandTitle", "brandScene"].includes(block?.type)) publishBrandImage(block, publishButton);
    return;
  }
  const trigger = event.target.closest("[data-asset-target]");
  if (trigger) openAssetDialog(trigger.dataset.assetTarget, trigger.dataset.assetPath);
});

$("#addBlockButton").addEventListener("click", () => elements.blockLibraryDialog.showModal());
elements.blockLibrary.addEventListener("click", (event) => {
  const button = event.target.closest("[data-add-type]");
  if (!button) return;
  const block = createBlock(button.dataset.addType);
  const selectedIndex = email.blocks.findIndex((item) => item.id === selectedBlockId);
  email.blocks.splice(selectedIndex >= 0 ? selectedIndex + 1 : email.blocks.length, 0, block);
  selectedBlockId = block.id;
  elements.blockLibraryDialog.close();
  commitChange({ rerenderEditor: true });
});

$("#addFootnoteButton").addEventListener("click", () => { email.footnotes.push({ id: createId("footnote"), text: "Текст сноски" }); renderFootnotes(); renderPreview(); persistSoon(); });
elements.footnoteList.addEventListener("input", (event) => {
  const row = event.target.closest("[data-footnote-id]");
  const note = email.footnotes.find((item) => item.id === row?.dataset.footnoteId);
  if (!note) return;
  note.text = event.target.value;
  persistSoon();
});
elements.footnoteList.addEventListener("change", () => commitChange());
elements.footnoteList.addEventListener("click", (event) => {
  const action = event.target.closest("[data-footnote-action]")?.dataset.footnoteAction;
  const row = event.target.closest("[data-footnote-id]");
  const index = email.footnotes.findIndex((item) => item.id === row?.dataset.footnoteId);
  if (!action || index < 0) return;
  if (action === "delete") email.footnotes.splice(index, 1);
  if (action === "up" && index > 0) [email.footnotes[index], email.footnotes[index - 1]] = [email.footnotes[index - 1], email.footnotes[index]];
  if (action === "down" && index < email.footnotes.length - 1) [email.footnotes[index], email.footnotes[index + 1]] = [email.footnotes[index + 1], email.footnotes[index]];
  renderFootnotes();
  renderPreview();
  persistSoon();
});

elements.assetGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-asset-id]");
  const assets = assetTargetPath === "content.background" ? window.CALLTOUCH_ASSETS.backgrounds : window.CALLTOUCH_ASSETS.visuals;
  const asset = assets.find((item) => item.id === button?.dataset.assetId);
  if (asset) applyAsset(asset);
});
elements.customAssetFile.addEventListener("change", () => {
  const file = elements.customAssetFile.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => { customPreviewSource = String(reader.result || ""); });
  reader.readAsDataURL(file);
});
$("#applyCustomAssetButton").addEventListener("click", () => {
  const exportUrl = elements.customAssetUrl.value.trim();
  applyAsset({ id: createId("asset"), label: elements.customAssetFile.files?.[0]?.name || "Своё изображение", previewSource: customPreviewSource || exportUrl, exportUrl, keywords: [] });
});

$("#qualityButton").addEventListener("click", openQualityDialog);
elements.copyButton.addEventListener("click", copyHtml);
elements.downloadButton.addEventListener("click", downloadHtml);
$("#newEmailButton").addEventListener("click", () => {
  if (!window.confirm("Начать новое письмо? Текущая работа будет удалена.")) return;
  localStorage.removeItem(EMAIL_STORAGE_KEY);
  email = null;
  elements.pastePanel.hidden = true;
  $(".email-start__choices").hidden = false;
  showScreen("start");
});

$("#zoomInButton").addEventListener("click", () => setCanvasZoom(canvasState.zoom + .1));
$("#zoomOutButton").addEventListener("click", () => setCanvasZoom(canvasState.zoom - .1));
$("#resetCanvasButton").addEventListener("click", resetCanvas);
elements.previewStage.addEventListener("wheel", (event) => {
  event.preventDefault();
  if (event.ctrlKey || event.metaKey) {
    setCanvasZoom(canvasState.zoom + (event.deltaY < 0 ? .1 : -.1));
    return;
  }
  canvasState.fitMode = false;
  canvasState.panY -= event.deltaY;
  applyCanvasTransform();
}, { passive: false });
elements.previewStage.addEventListener("pointerdown", (event) => {
  if (event.button !== 1 && !canvasState.spacePressed) return;
  event.preventDefault();
  startCanvasPan(event.clientX, event.clientY);
});
window.addEventListener("pointermove", (event) => moveCanvasPan(event.clientX, event.clientY));
window.addEventListener("pointerup", stopCanvasPan);
window.addEventListener("keydown", (event) => {
  if (event.code !== "Space" || document.activeElement?.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) return;
  canvasState.spacePressed = true;
  elements.previewStage.classList.add("is-pan-ready");
  event.preventDefault();
});
window.addEventListener("keyup", (event) => {
  if (event.code !== "Space") return;
  canvasState.spacePressed = false;
  elements.previewStage.classList.remove("is-pan-ready");
  stopCanvasPan();
});

renderLibrary();
renderAssetGrid();
iconRefresh();
const restored = restoreEmail();
if (restored) enterEditor(restored);
else showScreen("start");
applyCanvasTransform();
