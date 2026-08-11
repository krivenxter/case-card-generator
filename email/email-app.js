import { BLOCK_DEFINITIONS, DELA_FONT_SIZES, EMAIL_STORAGE_KEY, createBlock, createDefaultEmail, createId, cloneEmail } from "./email-model.js";
import { buildAutoVariants, readImportedFile } from "./email-parser.js";
import { renderEmailDocument, renderBlock } from "./email-renderer.js";
import { normalizeEmailDesign, validateEmail } from "./email-quality.js";
import { BRAND_SCENE_MIN_HEIGHT, BRAND_SCENE_WIDTH, brandSceneSignature, isBrandScenePublished, renderBrandSceneMarkup } from "./email-brand-scene.js";
import { BRAND_TITLE_MIN_HEIGHT, BRAND_TITLE_WIDTH, brandTitleSignature, isBrandTitlePublished, renderBrandTitleMarkup, resolveBrandTitleColors } from "./email-brand-title.js";

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const escapeAttr = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));
const formatIconPaths = {
  bold: '<g fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 0 1 0 8H6z"/><path d="M6 12h9a4 4 0 0 1 0 8H6z"/></g>',
  dela: '<text x="2" y="19" font-family="Dela Gothic One,Arial Black,sans-serif" font-size="19" font-weight="400">D</text>',
  link: '<g fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17H7a5 5 0 0 1 0-10h2"/><path d="M15 7h2a5 5 0 0 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/></g>',
  cyan: '<circle cx="12" cy="12" r="8" fill="#33bfe2"/>',
  purple: '<circle cx="12" cy="12" r="8" fill="#BA6DE7"/>',
  list: '<g fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></g>',
  break: '<g fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4v7a4 4 0 0 0 4 4h10"/><path d="m15 11 4 4-4 4"/></g>',
  typograph: '<g fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/><path d="M8 7h8M8 11h6"/></g>'
};
function formatIcon(name) {
  return `<svg class="email-format-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${formatIconPaths[name] || formatIconPaths.typograph}</svg>`;
}

const elements = {
  start: $("#startScreen"), variants: $("#variantScreen"), editor: $("#editorScreen"), pastePanel: $("#pastePanel"), importText: $("#importText"), fileInput: $("#importFileInput"),
  variantFrames: [$("#variantAFrame"), $("#variantBFrame")], preview: $("#emailPreview"), previewStage: $("#previewStage"), previewCanvas: $("#previewCanvas"), previewModeLabel: $("#previewModeLabel"), zoomIndicator: $("#zoomIndicator"),
  projectTitle: $("#projectTitle"), themePicker: $("#themePicker"), blockList: $("#blockList"), blockEditor: $("#blockEditor"), footnoteList: $("#footnoteList"),
  blockLibraryDialog: $("#blockLibraryDialog"), blockLibrary: $("#blockLibrary"), assetDialog: $("#assetDialog"), assetGrid: $("#assetGrid"), customAssetFile: $("#customAssetFile"), customAssetFileName: $("#customAssetFileName"), customAssetUrl: $("#customAssetUrl"), customAssetPreview: $("#customAssetPreview"),
  qualityDialog: $("#qualityDialog"), qualityTitle: $("#qualityTitle"), qualityResults: $("#qualityResults"), codePreview: $("#codePreview"), copyButton: $("#copyHtmlButton"), downloadButton: $("#downloadHtmlButton"), linkDialog: $("#linkDialog"), linkDialogUrl: $("#linkDialogUrl"),
  saveStatus: $("#saveStatus"), toast: $("#emailToast"), undoButton: $("#undoButton"), redoButton: $("#redoButton"), exportDraftButton: $("#exportDraftButton"), importDraftInput: $("#importDraftInput")
};

let email = null;
let autoVariants = [];
let selectedBlockId = "";
let assetTargetId = "";
let assetTargetPath = "content.image";
let iconTargetIndex = -1;
let customPreviewSource = "";
let saveTimer = 0;
let historyTimer = 0;
const history = { undo: [], redo: [] };
const iconAutoTimers = new Map();
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
  window.lucide?.createIcons({ attrs: { "stroke-width": 2.35 } });
}

function persistSoon() {
  if (!email) return;
  elements.saveStatus.textContent = "Сохраняем…";
  window.clearTimeout(saveTimer);
  window.clearTimeout(historyTimer);
  historyTimer = window.setTimeout(() => pushHistory(), 350);
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

function pushHistory() {
  if (!email) return;
  const snapshot = JSON.stringify(email);
  if (history.undo.at(-1) === snapshot) return;
  history.undo.push(snapshot);
  if (history.undo.length > 20) history.undo.shift();
  history.redo = [];
  syncHistoryButtons();
}

function syncHistoryButtons() {
  if (elements.undoButton) elements.undoButton.disabled = history.undo.length < 2;
  if (elements.redoButton) elements.redoButton.disabled = history.redo.length === 0;
}

function restoreHistorySnapshot(snapshot) {
  email = cloneEmail(JSON.parse(snapshot));
  selectedBlockId = email.blocks[0]?.id || "";
  renderEditor();
  persistSoon();
  syncHistoryButtons();
}

function undo() {
  if (history.undo.length < 2) return;
  const current = history.undo.pop();
  history.redo.push(current);
  restoreHistorySnapshot(history.undo.at(-1));
}

function redo() {
  const snapshot = history.redo.pop();
  if (!snapshot) return;
  history.undo.push(snapshot);
  restoreHistorySnapshot(snapshot);
}

function downloadDraft() {
  if (!email) return;
  const blob = new Blob([JSON.stringify({ ...cloneEmail(email), exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${(email.meta.title || "письмо").replace(/[^а-яёa-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "письмо"}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function importDraft(file) {
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (parsed?.version !== 1 || !Array.isArray(parsed.blocks)) throw new Error("Неверный формат шаблона");
    enterEditor(parsed);
    history.undo = [JSON.stringify(email)];
    history.redo = [];
    syncHistoryButtons();
    showToast("Шаблон загружен.");
  } catch (error) {
    showToast(error.message || "Не удалось загрузить шаблон.");
  } finally {
    elements.importDraftInput.value = "";
  }
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
  history.undo = [JSON.stringify(email)];
  history.redo = [];
  syncHistoryButtons();
  persistSoon();
}

function renderEditor() {
  elements.projectTitle.textContent = email.meta.title || "Новое письмо";
  $$('[data-theme-option]', elements.themePicker).forEach((button) => {
    const active = button.dataset.themeOption === email.settings.theme;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-checked", String(active));
  });
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
    elements.preview.srcdoc = renderEmailDocument(email, { preview: true, mobile: email.settings.preview === "mobile" });
    elements.preview.addEventListener("load", bindPreviewInteractions, { once: true });
  }, 80);
}

// Переводит rich-разметку contenteditable (b/a/br/div) в markdown, который хранится в состоянии.
function richToMarkdown(root) {
  const walk = (node) => {
    if (node.nodeType === 3) return node.nodeValue || "";
    if (node.nodeType !== 1) return "";
    const tag = node.tagName.toLowerCase();
    const inner = [...node.childNodes].map(walk).join("");
    if (tag === "b" || tag === "strong") return inner.trim() ? `**${inner}**` : inner;
    if (node.dataset?.dela) {
      const wrapped = inner.trim() ? `%%${inner}%%` : inner;
      return node.dataset.color ? `{{${node.dataset.color}|${wrapped}}}` : wrapped;
    }
    if (node.dataset?.color) return inner.trim() ? `{{${node.dataset.color}|${inner}}}` : inner;
    if (tag === "a") return `[${inner}](${node.getAttribute("href") || ""})`;
    if (tag === "li") return `\n- ${inner}`;
    if (tag === "br") return "\n";
    if (tag === "div" || tag === "p") return `\n${inner}`;
    return inner;
  };
  return [...root.childNodes].map(walk).join("").replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n").trim();
}

function typographText(value, delaMode = false) {
  const protectedParts = [];
  const source = String(value || "");
  const protect = (text) => text.replace(/\{\{(?:cyan|purple)\|[\s\S]*?\}\}|%%[\s\S]*?%%|https?:\/\/[^\s)]+|\{\{[a-z0-9_]+\}\}/gi, (match) => `\u0000${protectedParts.push(match) - 1}\u0000`);
  const restore = (text) => text.replace(/\u0000(\d+)\u0000/g, (_, index) => protectedParts[Number(index)]);
  const result = protect(source)
    .replace(/\.{3}/g, "…")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,;:!?])(?=\S)/g, "$1 ")
    .replace(/\s+[–-]\s+/g, " — ")
    .replace(/(^|[\s(«])([А-Яа-яЁёA-Za-z])\s+(?=\S)/g, "$1$2\u00A0")
    .replace(/(\d)\s+(?=(?:₽|руб\.?|%|px|г\.|ч\.|мин\.|дн\.)\b)/gi, "$1\u00A0")
    .replace(/чтобы\s+не\s+пропустить/giu, "чтобы\u00A0не\u00A0пропустить")
    .replace(/(присоединяйтесь)\s+(к)\s+(ним)\s+(онлайн)/iu, "$1\u00A0$2\u00A0$3\u00A0$4")
    .replace(/\n+[ \t\u00A0]*(?=Присоединяйтесь(?:\s|$))/iu, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n");
  const isDelaText = delaMode || source.includes("%%");
  const lineBroken = result;
  const orphanSafe = isDelaText
    ? lineBroken.replace(/(\S+)[ \t]+(\S+)[ \t]+(\S+)([.!?…]?)$/gm, "$1\u00A0$2\u00A0$3$4")
    : lineBroken.replace(/(\S+)[ \t]+(\S+)([.!?…]?)$/gm, "$1\u00A0$2$3");
  return restore(orphanSafe);
}

function typographEmail(project) {
  const normalized = cloneEmail(project);
  const walk = (value, key = "") => {
    if (typeof value === "string") return /(?:url|source|signature|renderedat|^id$)/i.test(key) ? value : typographText(value);
    if (Array.isArray(value)) return value.map((item) => walk(item));
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, walk(childValue, childKey)]));
    return value;
  };
  normalized.meta = walk(normalized.meta);
  normalized.blocks = walk(normalized.blocks);
  normalized.footnotes = walk(normalized.footnotes);
  return normalized;
}

function brandDela(value) {
  const text = String(value || "").trim();
  if (!text || /%%[\s\S]*?%%/.test(text)) return text;
  return `%%${text.replace(/\{\{(?:cyan|purple)\|([\s\S]*?)\}\}/g, "$1").replace(/\*\*/g, "")}%%`;
}

function hasBrandedDelaHeading(project) {
  return project.blocks.some((block) => block.type === "brandTitle" || block.type === "brandScene" || /%%[\s\S]*?%%/.test(String(block.content?.heading || "")) || (block.content?.items || []).some((item) => /%%[\s\S]*?%%/.test(String(item.heading || ""))));
}

function brandEmail(project) {
  const branded = cloneEmail(project);
  branded.blocks.forEach((block) => {
    if (["brandTitle", "brandScene"].includes(block.type)) return;
    if (["title", "text"].includes(block.type) && String(block.content?.plate || "") !== "1") block.content.plate = "1";
    if (block.content?.heading) block.content.heading = brandDela(block.content.heading);
    if (block.type === "promo" && block.content?.offer) block.content.offer = brandDela(block.content.offer);
    if (block.type === "iconGrid") block.content.items = (block.content.items || []).map((item) => ({ ...item, heading: brandDela(item.heading) }));
  });
  return branded;
}

function isRichEditNode(node) {
  if (!/\.(body|subtitle|heading|offer)$/.test(node.dataset.editPath || "")) return false;
  const block = email.blocks.find((item) => item.id === node.closest("[data-block-id]")?.dataset.blockId);
  return Boolean(block) && !["brandTitle", "brandScene"].includes(block.type);
}

// Аккуратная модалка вместо системного prompt() для ввода адреса ссылки.
function askLinkUrl() {
  return new Promise((resolve) => {
    const dialog = elements.linkDialog;
    elements.linkDialogUrl.value = "https://";
    dialog.addEventListener("close", () => {
      const value = dialog.returnValue === "apply" ? elements.linkDialogUrl.value.trim() : "";
      resolve(value && value !== "https://" ? (/^https?:\/\//i.test(value) ? value : `https://${value}`) : "");
    }, { once: true });
    dialog.showModal();
    elements.linkDialogUrl.focus();
    elements.linkDialogUrl.setSelectionRange(elements.linkDialogUrl.value.length, elements.linkDialogUrl.value.length);
  });
}

// Плавающая панель форматирования: жирный и ссылка для выделенного текста.
function ensureEditToolbar(previewDocument) {
  const toolbar = previewDocument.createElement("div");
  const buttonStyle = "display:inline-flex;align-items:center;justify-content:center;width:28px;height:26px;padding:0;border:0;border-radius:6px;background:transparent;color:#fff;cursor:pointer;";
  toolbar.style.cssText = "position:absolute;z-index:60;display:none;gap:2px;padding:3px;border-radius:9px;background:#084E7D;box-shadow:0 8px 20px rgba(31,40,44,.3);";
  toolbar.innerHTML = `<button type="button" data-cmd="bold" title="Жирный (Ctrl+B)" aria-label="Жирный" style="${buttonStyle}">${formatIcon("bold")}</button><button type="button" data-cmd="dela" title="Шрифт Dela" aria-label="Шрифт Dela" style="${buttonStyle}">${formatIcon("dela")}</button><button type="button" data-cmd="cyan" title="Циановый текст" aria-label="Циановый текст" style="${buttonStyle}">${formatIcon("cyan")}</button><button type="button" data-cmd="purple" title="Пурпурный текст" aria-label="Пурпурный текст" style="${buttonStyle}">${formatIcon("purple")}</button><button type="button" data-cmd="link" title="Ссылка" aria-label="Ссылка" style="${buttonStyle}">${formatIcon("link")}</button><button type="button" data-cmd="list" title="Список с пунктами" aria-label="Список с пунктами" style="${buttonStyle}">${formatIcon("list")}</button><button type="button" data-cmd="break" title="Ручной перенос строки" aria-label="Перенос строки" style="${buttonStyle}">${formatIcon("break")}</button><button type="button" data-cmd="typograph" title="Типограф" aria-label="Типограф" style="${buttonStyle}">${formatIcon("typograph")}</button>`;
  previewDocument.body.append(toolbar);
  toolbar.addEventListener("mousedown", (event) => event.preventDefault());
  let savedRange = null;
  toolbar.addEventListener("click", async (event) => {
    const command = event.target.closest("[data-cmd]")?.dataset.cmd;
   if (!command) return;
   if (command === "bold") previewDocument.execCommand("bold");
    if (command === "cyan" || command === "purple") {
      const range = savedRange?.cloneRange();
      const selected = range?.toString();
      if (!range || !selected?.trim()) return;
      const rangeElement = range.commonAncestorContainer?.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer?.parentElement;
      const selectedColor = rangeElement?.closest("[data-color]");
      if (selectedColor?.textContent === selected) {
        const editable = selectedColor.closest("[data-rich]");
        if (selectedColor.dataset.color === command) {
          selectedColor.replaceWith(...selectedColor.childNodes);
        } else {
          selectedColor.dataset.color = command;
          selectedColor.style.color = command === "cyan" ? "#33bfe2" : "#BA6DE7";
        }
        editable?.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "formatColor", data: null }));
        return;
      }
      const delaParent = rangeElement?.closest("[data-dela]");
      if (delaParent) {
        const text = delaParent.textContent || "";
        const start = text.indexOf(selected);
        const selectedText = start >= 0 ? selected : text;
        const offset = Math.max(0, start);
        const colorParent = delaParent.parentElement?.dataset.color ? delaParent.parentElement : null;
        const originalTone = colorParent?.dataset.color || "";
        const editable = delaParent.closest("[data-rich]");
        const makeDela = (value) => { const node = delaParent.cloneNode(false); node.textContent = value; return node; };
        const withColor = (value, tone) => {
          const node = makeDela(value);
          if (!tone) return node;
          const wrapper = previewDocument.createElement("span");
          wrapper.dataset.color = tone;
          wrapper.style.color = tone === "cyan" ? "#33bfe2" : "#BA6DE7";
          wrapper.append(node);
          return wrapper;
        };
        const appendDela = (container, value, tone, splitWords = false) => {
          if (!splitWords) { container.append(withColor(value, tone)); return; }
          value.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            container.append(/^\s+$/.test(part) ? previewDocument.createTextNode(part) : withColor(part, tone));
          });
        };
        const fragment = previewDocument.createDocumentFragment();
        if (offset) appendDela(fragment, text.slice(0, offset), originalTone, true);
        appendDela(fragment, selectedText, command, true);
        if (offset + selectedText.length < text.length) appendDela(fragment, text.slice(offset + selectedText.length), originalTone, true);
        const target = colorParent?.textContent === text ? colorParent : delaParent;
        target.replaceWith(fragment);
        editable?.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "formatColor", data: null }));
        return;
      }
      const span = previewDocument.createElement("span");
      span.dataset.color = command;
      span.style.color = command === "cyan" ? "#33bfe2" : "#BA6DE7";
      span.append(range.extractContents());
      range.insertNode(span);
      span.closest("[data-rich]")?.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "formatColor", data: null }));
      return;
    }
    if (command === "break") {
      const range = savedRange?.cloneRange();
      if (range) {
        range.deleteContents();
        const lineBreak = previewDocument.createElement("br");
        range.insertNode(lineBreak);
        range.setStartAfter(lineBreak);
        range.collapse(true);
        const selection = previewDocument.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        const editable = lineBreak.parentElement?.closest("[data-rich]");
        editable?.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertLineBreak", data: null }));
      }
      return;
    }
    if (command === "typograph") {
      const range = savedRange?.cloneRange();
      const selected = range?.toString() || "";
      if (range && selected) {
        const editable = (range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement)?.closest("[data-rich]");
        const editedBlock = email.blocks.find((item) => item.id === editable?.closest("[data-block-id]")?.dataset.blockId);
        const editPath = editable?.dataset.editPath;
        const currentValue = editedBlock && editPath ? editPath.split(".").reduce((value, key) => value?.[key], editedBlock) : "";
        if (typeof currentValue === "string" && currentValue.includes("%%")) {
          setPath(editedBlock, editPath, typographText(currentValue, true));
          updatePreviewBlock(editedBlock);
          renderBlockList();
          renderBlockEditor();
          return;
        }
        const selection = previewDocument.getSelection();
        const selectedElement = selection?.anchorNode?.nodeType === 1 ? selection.anchorNode : selection?.anchorNode?.parentElement;
        const rangeElement = range.commonAncestorContainer?.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer?.parentElement;
        const delaParent = selectedElement?.closest("[data-dela]") || rangeElement?.closest("[data-dela]");
        const strongParent = selectedElement?.closest("strong,b") || rangeElement?.closest("strong,b");
        range.deleteContents();
        const formatted = delaParent ? previewDocument.createElement("span") : strongParent ? previewDocument.createElement("strong") : null;
        if (formatted) {
          if (delaParent) {
            formatted.dataset.dela = "1";
            formatted.style.cssText = "font-family:'Dela Gothic One','Arial Black',Arial,sans-serif;font-weight:400;letter-spacing:.02em;text-transform:uppercase;";
          }
          formatted.textContent = typographText(selected, Boolean(delaParent));
          range.insertNode(formatted);
        } else {
          range.insertNode(previewDocument.createTextNode(typographText(selected)));
        }
        editable?.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: selected }));
        if (editedBlock) {
          updatePreviewBlock(editedBlock);
          renderBlockList();
          renderBlockEditor();
        }
      }
    }
    if (command === "dela") {
      const selection = previewDocument.getSelection();
      const selected = selection?.toString().trim();
      if (selected) {
        const range = savedRange?.cloneRange();
        const selectedElement = selection.anchorNode?.nodeType === 1 ? selection.anchorNode : selection.anchorNode?.parentElement;
        const rangeElement = range?.commonAncestorContainer?.nodeType === 1 ? range.commonAncestorContainer : range?.commonAncestorContainer?.parentElement;
        const delaParent = selectedElement?.closest("[data-dela]") || rangeElement?.closest("[data-dela]");
        if (delaParent) {
          const editable = delaParent.closest("[data-rich]");
          const block = email.blocks.find((item) => item.id === editable?.closest("[data-block-id]")?.dataset.blockId);
          if (block && editable?.dataset.editPath) {
            const plain = richToMarkdown(editable).replace(/%%([\s\S]*?)%%/g, "$1");
            setPath(block, editable.dataset.editPath, plain);
            updatePreviewBlock(block);
            renderBlockList();
            renderBlockEditor();
            persistSoon();
          }
          return;
        }
        if (range) {
          const span = previewDocument.createElement("span");
          span.dataset.dela = "1";
          span.style.cssText = "font-family:'Dela Gothic One','Arial Black',Arial,sans-serif;font-weight:400;letter-spacing:.02em;text-transform:uppercase;";
          span.textContent = selected;
          const editable = (range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement)?.closest("[data-rich]");
          range.deleteContents();
          range.insertNode(span);
          editable?.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: selected }));
        }
      }
    }
    if (command === "list") previewDocument.execCommand("insertUnorderedList");
    if (command === "link") {
      const range = savedRange?.cloneRange();
      const url = await askLinkUrl();
      if (!url || !range) return;
      const selection = previewDocument.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      previewDocument.execCommand("createLink", false, url);
    }
  });
  previewDocument.addEventListener("selectionchange", () => {
    const selection = previewDocument.getSelection();
    const anchor = selection?.anchorNode;
    const element = anchor ? (anchor.nodeType === 1 ? anchor : anchor.parentElement) : null;
    if (!selection || !element?.closest?.("[data-rich]")) {
      toolbar.style.display = "none";
      return;
    }
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (!rect.width && !rect.height) { toolbar.style.display = "none"; return; }
    savedRange = selection.getRangeAt(0).cloneRange();
    toolbar.style.display = "flex";
    toolbar.style.left = `${Math.max(rect.left + previewDocument.defaultView.scrollX, 8)}px`;
    toolbar.style.top = `${rect.bottom + previewDocument.defaultView.scrollY + 6}px`;
  });
}

// Биндинги узлов предпросмотра. Идемпотентно: узлы помечаются data-bound,
// поэтому функцию можно вызывать повторно после точечной замены блока.
function bindPreviewNodes(previewDocument) {
  if (!previewDocument.__editorBound) {
    previewDocument.__editorBound = true;
    const style = previewDocument.createElement("style");
    style.textContent = `[data-block-id]{cursor:pointer;transition:filter .12s ease}[data-block-id]:hover{filter:brightness(.96)}[data-block-id].is-selected>td{outline:3px solid #24b8dc;outline-offset:0}[data-edit-path]{cursor:text;border-radius:4px;outline:1px dashed transparent;outline-offset:4px}[data-edit-path]:hover,[data-edit-path]:focus{outline-color:rgba(36,184,220,.8);background:rgba(255,255,255,.08)}[data-edit-path]:focus{outline-width:2px}[data-rich] b,[data-rich] strong{font-weight:700}[data-rich] ul{margin:0;padding:0 0 0 16px}[data-rich] li{padding:0 0 8px}[data-rich] li::marker{color:#24B8DC}`;
    previewDocument.head.append(style);
    previewDocument.addEventListener("click", (event) => {
      const link = event.target.closest("a[href]");
      if (!link) return;
      event.preventDefault();
      showToast("Ссылки в предпросмотре не открываются.");
    }, true);
    ensureEditToolbar(previewDocument);
    // Крестик удаления выбранного блока — в правом верхнем углу, чуть за пределами блока.
    const deleteButton = previewDocument.createElement("button");
    deleteButton.type = "button";
    deleteButton.id = "emailBlockDelete";
    deleteButton.title = "Удалить блок";
    deleteButton.textContent = "×";
    deleteButton.style.cssText = "position:absolute;z-index:55;display:none;width:24px;height:24px;padding:0;border:0;border-radius:50%;background:#084E7D;color:#fff;font:700 15px/24px Arial,sans-serif;text-align:center;cursor:pointer;box-shadow:0 4px 12px rgba(31,40,44,.3);";
    previewDocument.body.append(deleteButton);
    deleteButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (selectedBlockId) deleteBlock(selectedBlockId);
    });
  }
  $$('[data-edit-path]', previewDocument).forEach((node) => {
    if (node.dataset.bound) return;
    node.dataset.bound = "1";
    const rich = isRichEditNode(node);
    node.contentEditable = rich ? "true" : "plaintext-only";
    if (rich) node.dataset.rich = "1";
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
      setPath(block, node.dataset.editPath, rich ? richToMarkdown(node) : node.innerText.replace(/\n{3,}/g, "\n\n").trim());
      persistSoon();
    });
    // Перерендериваем только изменённый блок и только если текст реально изменился —
    // иначе каждый клик-выделение перезагружает iframe и мерцает белым.
    node.addEventListener("blur", () => {
      if (node.innerText === node.dataset.editStart) return;
      const block = email.blocks.find((item) => item.id === node.closest("[data-block-id]")?.dataset.blockId);
      if (!block) return;
      updatePreviewBlock(block);
      renderBlockList();
      renderBlockEditor();
      persistSoon();
    });
  });
  $$('[data-footnote-edit]', previewDocument).forEach((node) => {
    if (node.dataset.bound) return;
    node.dataset.bound = "1";
    node.contentEditable = "plaintext-only";
    node.classList.add("is-inline-editable");
    node.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); node.focus(); });
    node.addEventListener("input", () => {
      const note = email.footnotes.find((item) => item.id === node.dataset.footnoteId);
      if (!note) return;
      note.text = node.innerText.replace(/^\*+\s*/, "").trim();
      persistSoon();
    });
  });
  $$('[data-block-id]', previewDocument).forEach((node) => {
    node.classList.toggle("is-selected", node.dataset.blockId === selectedBlockId);
    if (node.dataset.bound) return;
    node.dataset.bound = "1";
    node.addEventListener("click", (event) => {
      event.preventDefault();
      selectedBlockId = node.dataset.blockId;
      renderBlockList();
      renderBlockEditor();
      bindPreviewSelection();
    });
  });
}

// Точечно перерендеривает один блок в предпросмотре без перезагрузки iframe (без белой вспышки).
function updatePreviewBlock(block) {
  const previewDocument = elements.preview.contentDocument;
  if (!previewDocument) return;
  const row = previewDocument.querySelector(`[data-block-id="${block.id}"]`);
  if (!row) {
    renderPreview();
    return;
  }
  const host = previewDocument.createElement("tbody");
  host.innerHTML = renderBlock(block, true, email.settings.theme === "editorial").trim();
  const next = host.firstElementChild;
  if (next) row.replaceWith(next);
  else row.remove();
  bindPreviewNodes(previewDocument);
  bindPreviewSelection();
  syncPreviewHeight(previewDocument);
}

function bindPreviewInteractions() {
  const previewDocument = elements.preview.contentDocument;
  if (!previewDocument) return;
  if (email.blocks.length && !previewDocument.querySelector("[data-block-id]")) {
    renderPreview({ preservePosition: false });
    return;
  }
  bindPreviewNodes(previewDocument);
  bindPreviewSelection();
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
  const deleteButton = previewDocument.getElementById("emailBlockDelete");
  if (deleteButton) {
    const row = selectedBlockId ? previewDocument.querySelector(`[data-block-id="${selectedBlockId}"]`) : null;
    if (!row) {
      deleteButton.style.display = "none";
    } else {
      const rect = row.getBoundingClientRect();
      deleteButton.style.display = "block";
      deleteButton.style.left = `${rect.right + previewDocument.defaultView.scrollX - 10}px`;
      deleteButton.style.top = `${rect.top + previewDocument.defaultView.scrollY - 10}px`;
    }
  }
}

function renderBlockList() {
  elements.blockList.innerHTML = email.blocks.map((block, index) => {
    const definition = getDefinition(block.type);
    const hidden = Boolean(block.settings?.hidden);
    return `<div class="email-block-row${block.id === selectedBlockId ? " is-selected" : ""}${hidden ? " is-hidden" : ""}" draggable="true" data-block-id="${escapeAttr(block.id)}"><i class="email-block-row__grip" data-lucide="grip-vertical" aria-hidden="true"></i><div><strong>${escapeAttr(definition?.label || block.type)}</strong><small>${hidden ? "Скрыт из письма" : escapeAttr(block.content.heading || block.content.text || block.content.body || "Системный интервал")}</small></div><div class="email-block-row__actions"><button type="button" data-action="up" title="Выше" ${index === 0 ? "disabled" : ""}><i data-lucide="chevron-up"></i></button><button type="button" data-action="down" title="Ниже" ${index === email.blocks.length - 1 ? "disabled" : ""}><i data-lucide="chevron-down"></i></button><button type="button" data-action="toggle-visibility" title="${hidden ? "Показать блок" : "Скрыть блок"}"><i data-lucide="${hidden ? "eye-off" : "eye"}"></i></button><button type="button" data-action="duplicate" title="Дублировать"><i data-lucide="copy"></i></button><button type="button" data-action="delete" title="Удалить"><i data-lucide="trash-2"></i></button></div></div>`;
  }).join("");
  iconRefresh(elements.blockList);
}

function field(label, path, value, { type = "text", rows = 0, hint = "", options = null } = {}) {
  let control = "";
  if (options) control = `<select data-field="${path}">${options.map(([optionValue, optionLabel]) => `<option value="${optionValue}"${value === optionValue ? " selected" : ""}>${optionLabel}</option>`).join("")}</select>`;
  else if (rows) control = `<div class="email-format"><span class="email-format__bar"><button type="button" data-fmt="bold" title="Жирный (Ctrl+B)" aria-label="Жирный">${formatIcon("bold")}</button><button type="button" data-fmt="dela" title="Шрифт Dela" aria-label="Шрифт Dela">${formatIcon("dela")}</button><button type="button" data-fmt="cyan" title="Циановый текст" aria-label="Циановый текст">${formatIcon("cyan")}</button><button type="button" data-fmt="purple" title="Пурпурный текст" aria-label="Пурпурный текст">${formatIcon("purple")}</button><button type="button" data-fmt="link" title="Ссылка" aria-label="Ссылка">${formatIcon("link")}</button><button type="button" data-fmt="list" title="Список с пунктами" aria-label="Список с пунктами">${formatIcon("list")}</button><button type="button" data-fmt="break" title="Ручной перенос строки" aria-label="Перенос строки">${formatIcon("break")}</button><button type="button" data-fmt="typograph" title="Типограф" aria-label="Типограф">${formatIcon("typograph")}</button></span><textarea data-field="${path}" rows="${rows}">${escapeAttr(value)}</textarea></div>`;
  else control = `<input data-field="${path}" type="${type}" value="${escapeAttr(value)}">`;
  return `<label class="email-field"><span>${label}</span>${control}${hint ? `<small class="email-field__hint">${hint}</small>` : ""}</label>`;
}

function buttonTonePicker(value) {
  const current = value === "secondary" ? "secondary" : "primary";
  return `<div class="email-button-tone-picker"><span>Цвет кнопки</span><div role="radiogroup" aria-label="Цвет кнопки"><button type="button" role="radio" data-button-tone="primary" aria-checked="${current === "primary"}" class="${current === "primary" ? "is-active" : ""}"><i class="email-tone-dot email-tone-dot--purple"></i>Фиолетовый</button><button type="button" role="radio" data-button-tone="secondary" aria-checked="${current === "secondary"}" class="${current === "secondary" ? "is-active" : ""}"><i class="email-tone-dot email-tone-dot--cyan"></i>Голубой</button></div></div>`;
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
  if (block.type === "title") controls = `${field("Композиция", "variant", block.variant, { options: [["plain", "Обычный"], ["subtitle", "С подзаголовком"], ["accent", "С акцентной плашкой"]] })}${field("Фоновая плашка", "content.plate", block.content.plate, { options: [["", "Без плашки"], ["1", "Белая плашка с отступами"]] })}${field("Заголовок", "content.heading", block.content.heading, { rows: 3, hint: "Рекомендуется до 90 символов" })}${field("Подзаголовок", "content.subtitle", block.content.subtitle, { rows: 3 })}${field("Фрагмент в плашке", "content.accent", block.content.accent)}`;
  if (block.type === "text") controls = `${field("Фоновая плашка", "content.plate", block.content.plate, { options: [["", "Без плашки"], ["1", "Белая плашка с отступами"]] })}${field("Стиль списка", "content.listStyle", block.content.listStyle || "bullet", { options: [["bullet", "Маркеры"], ["number", "Цифры в кружках"]] })}${field("Текст", "content.body", block.content.body, { rows: 8, hint: "Пустая строка — абзац, дефис — пункт, **текст** — жирный, [ссылка](https://…) — ссылка" })}<button class="email-button email-button--quiet" type="button" data-insert-image-after>+ Вставить картинку после текста</button>`;
  if (block.type === "promo") controls = `${field("Лейбл", "content.eyebrow", block.content.eyebrow)}${field("Цвет лейбла", "content.eyebrowTone", block.content.eyebrowTone || "purple", { options: [["purple", "Фиолетовый"], ["cyan", "Голубой"]] })}${field("Заголовок", "content.heading", block.content.heading, { rows: 3 })}${field("Оффер / цифра", "content.offer", block.content.offer, { rows: 2 })}${field("Описание", "content.body", block.content.body, { rows: 5 })}${field("Размер описания", "content.bodySize", block.content.bodySize || "14", { options: [["16", "Обычный · 16 px"], ["14", "Компактный · 14 px"]] })}${field("Фон", "content.gradient", block.content.gradient === false ? "false" : "true", { options: [["true", "Радиальный градиент"], ["false", "Тёмно-синий без градиента"]] })}${assetField(block)}${field("Ссылка на весь блок", "content.linkUrl", block.content.linkUrl || "", { type: "url", hint: "Кнопка остаётся отдельной ссылкой" })}${field("Текст кнопки", "content.ctaText", block.content.ctaText)}${field("Ссылка кнопки", "content.ctaUrl", block.content.ctaUrl, { type: "url" })}`;
  if (block.type === "image") controls = `${assetField(block)}${field("Описание картинки", "content.alt", block.content.alt, { rows: 2, hint: "Виден, если картинки отключены" })}${field("Ссылка на весь блок", "content.linkUrl", block.content.linkUrl, { type: "url", hint: "При клике открывается весь блок" })}`;
  if (["imageText", "featureCard"].includes(block.type)) controls = `${field("Картинка", "variant", block.variant, { options: [["image-left", "Слева"], ["image-right", "Справа"]] })}${field("Заголовок", "content.heading", block.content.heading, { rows: 2 })}${field("Описание", "content.body", block.content.body, { rows: 5 })}${assetField(block)}${block.type === "imageText" ? `${field("Текст ссылки", "content.linkText", block.content.linkText)}${field("Адрес ссылки", "content.linkUrl", block.content.linkUrl, { type: "url" })}` : ""}`;
  if (block.type === "brandTitle") controls = `${field("Цветовая схема", "variant", block.variant, { options: [["light-cyan", "Светло-голубая"], ["cyan", "Циановая"], ["navy", "Тёмно-синяя"], ["purple", "Фиолетовая"], ["magenta", "Розовая"], ["custom", "Свой цвет"]] })}${block.variant === "custom" ? field("Цвет фона", "content.backgroundColor", block.content.backgroundColor, { type: "color" }) : ""}${block.variant === "cyan" ? "" : field("Цвет текста", "content.textTone", block.content.textTone, { options: [["auto", "Автоматически"], ["dark", "Тёмно-синий"], ["light", "Белый"]] })}${field("Заголовок Dela", "content.heading", block.content.heading, { rows: 3, hint: "Размер шрифта подстроится под длину" })}${brandImageStatus(block)}<button class="email-button email-button--primary email-brand-publish" type="button" data-brand-publish>${block.content.renderedUrl ? "Обновить изображение" : "Создать изображение"}</button>`;
  if (block.type === "brandScene") controls = `${field("Цветовая тема", "variant", block.variant, { options: [["navy-purple", "Синий — фиолетовый"], ["cyan-navy", "Циановый — синий"], ["purple-cyan", "Фиолетовый — циановый"]] })}${field("Заголовок Dela", "content.heading", block.content.heading, { rows: 3, hint: "До 70 символов" })}${field("Тезисы", "content.body", block.content.body, { rows: 5, hint: "Каждый тезис — с новой строки" })}${assetField(block, "content.background", "Фон или пятно")}${assetField(block, "content.image", "Вылезающая иллюстрация")}${field("Ссылка со всего блока", "content.linkUrl", block.content.linkUrl, { type: "url" })}${field("Описание картинки", "content.alt", block.content.alt, { rows: 2 })}${brandImageStatus(block)}<button class="email-button email-button--primary email-brand-publish" type="button" data-brand-publish>${block.content.renderedUrl ? "Обновить изображение" : "Создать изображение"}</button>`;
  if (block.type === "iconGrid") controls = `${field("Заголовок блока", "content.heading", block.content.heading || "", { rows: 2 })}${field("Сетка преимуществ", "content.columns", block.content.columns || "2", { options: [["2", "По 2 в ряд"], ["1", "По 1 на всю ширину"]] })}<div class="email-icon-items">${block.content.items.map((item, index) => `<div class="email-icon-item"><div class="email-icon-item__head"><strong>Преимущество ${index + 1}</strong>${block.content.items.length > 1 ? `<button type="button" data-icon-remove="${index}" title="Удалить преимущество">×</button>` : ""}</div><div class="email-icon-heading-field"><input data-field="content.items.${index}.heading" value="${escapeAttr(item.heading)}" placeholder="Заголовок"><button type="button" data-icon-dela="${index}" title="Шрифт Dela" aria-label="Шрифт Dela">${formatIcon("dela")}</button></div><input data-field="content.items.${index}.body" value="${escapeAttr(item.body)}" placeholder="Короткое описание"><button class="email-icon-picker" type="button" data-icon-pick="${index}"><img src="${escapeAttr(window.CALLTOUCH_ASSETS.essentials[item.iconId]?.previewSource || "")}" alt=""><span>${escapeAttr(window.CALLTOUCH_ASSETS.essentials[item.iconId]?.label || "Выбрать иконку")}</span></button><button class="email-button email-button--quiet email-icon-auto" type="button" data-icon-auto="${index}" title="Подобрать иконку по тексту"><i data-lucide="sparkles"></i><span>Подобрать по тексту</span></button></div>`).join("")}</div>${block.content.items.length < 6 ? `<button class="email-button email-button--quiet" type="button" data-icon-add>+ Добавить преимущество</button>` : ""}`;
  if (block.type === "ctaCard") controls = `${field("Тема", "variant", block.variant, { options: [["dark", "Тёмно-синяя"], ["dark-gradient", "Тёмно-синяя с пурпурным свечением"], ["light", "Светлая"]] })}${field("Заголовок", "content.heading", block.content.heading, { rows: 3 })}${field("Пояснение", "content.subtitle", block.content.subtitle, { rows: 3 })}${field("Текст кнопки", "content.ctaText", block.content.ctaText)}${field("Ссылка", "content.ctaUrl", block.content.ctaUrl, { type: "url" })}`;
  if (block.type === "button") controls = `${buttonTonePicker(block.variant)}${field("Выравнивание", "content.align", block.content.align || "center", { options: [["center", "По центру"], ["left", "По левому краю"]] })}${field("Текст", "content.text", block.content.text)}${field("Ссылка", "content.url", block.content.url, { type: "url" })}`;
  if (block.type === "divider") controls = field("Интервал", "variant", block.variant, { options: [["s", "S — компактный"], ["m", "M — обычный"], ["l", "L — большой"], ["xl", "XL — очень большой"]] });
  elements.blockEditor.innerHTML = `<div class="email-block-editor__header"><h2>${escapeAttr(definition?.label || block.type)}</h2><span>ЗАЩИЩЁННЫЙ ВАРИАНТ</span></div>${controls}`;
  iconRefresh(elements.blockEditor);
}

function renderFootnotes() {
  elements.footnoteList.innerHTML = email.footnotes.map((note, index) => `<div class="email-footnote-row" data-footnote-id="${escapeAttr(note.id)}"><span>${"*".repeat(index + 1)}</span><textarea rows="2" data-footnote-field="text">${escapeAttr(note.text)}</textarea><div class="email-footnote-row__actions"><button type="button" data-footnote-action="up" title="Выше">↑</button><button type="button" data-footnote-action="down" title="Ниже">↓</button><button type="button" data-footnote-action="delete" title="Удалить">×</button></div></div>`).join("");
}

function syncPreviewMode() {
  const mobile = email.settings.preview === "mobile";
  elements.previewStage.classList.toggle("is-mobile", mobile);
  elements.preview.width = mobile ? 390 : 760;
  elements.preview.style.width = `${mobile ? 390 : 760}px`;
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
  const measure = () => {
    // scrollHeight не бывает меньше текущего вьюпорта iframe,
    // поэтому перед замером сбрасываем высоту — иначе карточка не ужимается.
    elements.preview.style.height = "0px";
    const height = Math.max(
      previewDocument.body.scrollHeight,
      previewDocument.body.offsetHeight,
      previewDocument.documentElement.scrollHeight,
      previewDocument.documentElement.offsetHeight
    );
    elements.preview.style.height = `${height}px`;
    if (canvasState.fitMode) fitCanvas();
  };
  measure();
  window.setTimeout(measure, 120);
  previewDocument.querySelectorAll("img").forEach((image) => image.addEventListener("load", measure, { once: true }));
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
  const brandTypes = ["brandTitle", "brandScene"];
  const item = (definition) => `<button class="email-library-item" type="button" data-add-type="${definition.type}"><i data-lucide="${definition.icon}"></i><span><strong>${definition.label}</strong><span>${definition.description}</span></span></button>`;
  const brandItems = BLOCK_DEFINITIONS.filter((definition) => brandTypes.includes(definition.type));
  const plainItems = BLOCK_DEFINITIONS.filter((definition) => !brandTypes.includes(definition.type));
  elements.blockLibrary.innerHTML = `<div class="email-library-brand"><span class="email-library-brand__badge">Фирменные блоки · готовый дизайн картинкой</span>${brandItems.map(item).join("")}</div>${plainItems.map(item).join("")}`;
  iconRefresh(elements.blockLibrary);
}

function renderAssetGrid() {
  if (assetTargetPath === "content.icon") {
    const assets = Object.entries(window.CALLTOUCH_ASSETS.essentials).map(([id, asset]) => ({ ...asset, id }));
    elements.assetGrid.innerHTML = assets.map((asset) => `<button class="email-asset-card email-icon-card" type="button" data-icon-id="${asset.id}"><img src="${escapeAttr(asset.previewSource)}" alt=""><span>${escapeAttr(asset.label)}</span></button>`).join("");
    return;
  }
  const assets = assetTargetPath === "content.background" ? window.CALLTOUCH_ASSETS.backgrounds : window.CALLTOUCH_ASSETS.visuals;
  elements.assetGrid.innerHTML = assets.map((asset) => `<button class="email-asset-card" type="button" data-asset-id="${asset.id}"><img src="${escapeAttr(asset.previewSource)}" alt=""><span>${escapeAttr(asset.label)}</span></button>`).join("");
}

function openAssetDialog(blockId, path = "content.image") {
  assetTargetId = blockId;
  assetTargetPath = path;
  iconTargetIndex = -1;
  elements.assetDialog.querySelector("h2").textContent = "Выберите изображение";
  elements.assetDialog.querySelector(".email-custom-asset").hidden = false;
  customPreviewSource = "";
  elements.customAssetFile.value = "";
  elements.customAssetFileName.textContent = "Файл не выбран";
  elements.customAssetPreview.hidden = true;
  elements.customAssetPreview.removeAttribute("src");
  elements.customAssetUrl.value = "";
  renderAssetGrid();
  elements.assetDialog.showModal();
}

function openIconDialog(blockId, index) {
  assetTargetId = blockId;
  assetTargetPath = "content.icon";
  iconTargetIndex = index;
  renderAssetGrid();
  elements.assetDialog.querySelector("h2").textContent = "Выберите иконку";
  elements.assetDialog.querySelector(".email-custom-asset").hidden = true;
  elements.assetDialog.showModal();
}

function autoPickIcon(block, index) {
  const item = block.content.items[index];
  const text = `${item.heading || ""} ${item.body || ""}`.toLowerCase();
  const semantic = {
    chart: ["аналит", "сквоз", "метрик", "данн", "показател", "отчёт", "отчет", "график"], graph: ["аналит", "рост", "динамик", "данн", "показател"], diagram: ["аналит", "процесс", "схем", "воронк", "структур"], "clipboard-tick": ["задач", "план", "контрол", "провер"], calendar: ["дат", "срок", "расписан", "встреч"], clock: ["врем", "быстр", "срок", "скорост", "эконом"], message: ["сообщ", "поддерж", "клиент", "обратн", "связ"], call: ["звон", "телефон", "колл"], "call-incoming": ["входящ", "звон", "обращен"], "call-outgoing": ["исходящ", "звон", "обзвон"], people: ["команд", "клиент", "аудитор", "люд"], "profile-circle": ["клиент", "пользовател", "профил"], moneys: ["деньг", "бюджет", "стоим", "оплат", "доход"], "empty-wallet": ["эконом", "бюджет", "расход", "деньг"], "discount-shape": ["скид", "выгод", "акци", "предложен"], verify: ["результат", "качеств", "надёж", "надеж", "провер", "точност"], send: ["старт", "начал", "запуск", "отправ", "рассыл"], "shield-tick": ["безопас", "защит", "надёж", "надеж"], gps: ["адрес", "мест", "географ", "локац"], house: ["дом", "строител", "недвиж", "офис"], car: ["авто", "машин", "автомобил"], heart: ["любов", "лоял", "забот"], star: ["важн", "избран", "лучший", "премиум"]
  };
  const matches = Object.entries(window.CALLTOUCH_ASSETS.essentials).map(([id, asset]) => ({ id, score: [...(asset.keywords || []), ...(semantic[id] || [])].filter((word) => text.includes(word)).length }));
  const best = matches.sort((a, b) => b.score - a.score)[0];
  if (best?.score) item.iconId = best.id;
  commitChange({ rerenderEditor: true });
}

function autoPickIconSilently(block, index) {
  const item = block.content.items[index];
  const text = `${item.heading || ""} ${item.body || ""}`.toLowerCase();
  const semantic = { chart: ["аналит", "сквоз", "метрик", "данн", "показател", "отчёт", "отчет", "график"], graph: ["аналит", "рост", "динамик", "данн", "показател"], diagram: ["аналит", "процесс", "схем", "воронк", "структур"], calendar: ["дат", "срок", "расписан", "встреч"], clock: ["врем", "быстр", "срок", "скорост", "эконом"], message: ["сообщ", "поддерж", "клиент", "обратн", "связ"], call: ["звон", "телефон", "колл"], people: ["команд", "клиент", "аудитор", "люд"], moneys: ["деньг", "бюджет", "стоим", "оплат", "доход"], verify: ["результат", "качеств", "надёж", "надеж", "провер", "точност"], send: ["старт", "начал", "запуск", "отправ", "рассыл"] };
  const best = Object.entries(window.CALLTOUCH_ASSETS.essentials).map(([id, asset]) => ({ id, score: [...(asset.keywords || []), ...(semantic[id] || [])].filter((word) => text.includes(word)).length })).sort((a, b) => b.score - a.score)[0];
  if (best?.score && item.iconId !== best.id) {
    item.iconId = best.id;
    updatePreviewBlock(block);
  }
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
    const imported = await readImportedFile(file);
    buildVariants(imported);
  } catch (error) {
    showToast(error.message || "Не удалось прочитать файл.");
  } finally {
    elements.fileInput.value = "";
  }
}

function buildVariants(source) {
  const text = typeof source === "string" ? source : source?.text || "";
  if (!text.trim()) {
    showToast("Добавьте текст письма.");
    return;
  }
  autoVariants = buildAutoVariants(source);
  elements.variantFrames.forEach((frame, index) => { frame.srcdoc = renderEmailDocument(autoVariants[index], { preview: true }); });
  showScreen("variants");
}

function delaTexts() {
  const result = new Set();
  const grouped = new Set();
  email.blocks.forEach((block) => {
    if (/%%[\s\S]*?%%/.test(String(block.content?.heading || ""))) grouped.add(block.content.heading);
    (block.content?.items || []).forEach((item) => { if (/%%[\s\S]*?%%/.test(String(item.heading || ""))) grouped.add(item.heading); });
  });
  grouped.forEach((text) => result.add(text));
  const collect = (value) => {
    if (typeof value === "string") {
      if (grouped.has(value)) return;
      for (const match of value.matchAll(/%%([\s\S]*?)%%/g)) if (match[1].trim()) result.add(match[1].trim());
    } else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === "object") Object.values(value).forEach(collect);
  };
  email.blocks.forEach((block) => collect(block.content));
  return [...result];
}

function isDelaGroup(text) {
  return email.blocks.some((block) => String(block.content?.heading || "") === text || (block.content?.items || []).some((item) => String(item.heading || "") === text));
}

function delaGroupMarkup(value) {
  const source = String(value || "");
  const pattern = /\{\{(cyan|purple)\|%%([\s\S]*?)%%\}\}|%%([\s\S]*?)%%/g;
  let html = "";
  let cursor = 0;
  for (const match of source.matchAll(pattern)) {
    html += escapeAttr(source.slice(cursor, match.index).replace(/\*\*/g, ""));
    html += match[1]
      ? `<span style="color:${match[1] === "cyan" ? "#33bfe2" : "#BA6DE7"};">${escapeAttr(match[2])}</span>`
      : escapeAttr(match[3]);
    cursor = match.index + match[0].length;
  }
  return html + escapeAttr(source.slice(cursor).replace(/\*\*/g, ""));
}

function delaPlainText(value) {
  return String(value || "").replace(/\{\{(?:cyan|purple)\|%%([\s\S]*?)%%\}\}/g, "$1").replace(/%%/g, "").replace(/\*\*/g, "");
}

async function renderDelaPng(text) {
  const style = delaStyle(text);
  const group = isDelaGroup(text);
  const previewNode = group
    ? [...(elements.preview.contentDocument?.querySelectorAll("[data-dela-text]") || [])].find((node) => node.textContent?.trim() === delaPlainText(text).trim())
    : [...(elements.preview.contentDocument?.querySelectorAll("[data-dela]") || [])].find((node) => node.textContent?.trim() === text.trim());
  const previewContentWidth = (group ? previewNode : previewNode?.closest("[data-rich]"))?.getBoundingClientRect().width || 560;
  const desktopRatio = email.settings.preview === "mobile" ? 660 / 390 : 1;
  const targetWidth = Math.min(560, Math.max(100, Math.ceil(previewContentWidth * desktopRatio)));
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${targetWidth}px;padding:8px 0;pointer-events:none;`;
  host.innerHTML = `<div style="display:${group ? "block;width:100%" : "inline-block;width:max-content;max-width:100%"};font-family:'Dela Gothic One','Arial Black',Arial,sans-serif;font-size:${style.size}px;line-height:1.2;font-weight:400;letter-spacing:.02em;text-transform:uppercase;word-break:break-word;overflow-wrap:anywhere;white-space:pre-line;color:${style.color};">${group ? delaGroupMarkup(text) : escapeAttr(text)}</div>`;
  document.body.append(host);
  try {
    if (document.fonts?.ready) await document.fonts.ready;
    const element = host.firstElementChild;
    const width = Math.min(560, Math.max(100, Math.ceil(element.getBoundingClientRect().width)));
    const height = Math.max(24, Math.ceil(element.getBoundingClientRect().height));
    const canvas = await window.DomExport.toCanvas(element, { width, height, pixelRatio: 2, cacheBust: location.protocol !== "file:", backgroundColor: "transparent", fontFaces: location.protocol === "file:" ? [] : [{ family: "Dela Gothic One", src: "fonts/DelaGothicOne-Regular.ttf", format: "truetype", weight: "400" }] });
    return { blob: await canvasToPngBlob(canvas), width, height };
  } finally { host.remove(); }
}

function delaStyle(text) {
  const darkDefault = email.settings.theme === "editorial";
  for (const block of email.blocks) {
    const content = block.content || {};
    const contentText = JSON.stringify(content);
    const color = contentText.includes(`{{cyan|%%${text}%%}}`) ? "#33bfe2" : contentText.includes(`{{purple|%%${text}%%}}`) ? "#BA6DE7" : "";
    if (String(content.heading || "") === text) {
      const light = ["imageText", "featureCard", "iconGrid"].includes(block.type) || (block.type === "ctaCard" && block.variant === "light");
      const defaultColor = block.type === "title" ? (darkDefault ? "#ffffff" : "#084E7D") : light ? "#1F282C" : "#ffffff";
      return { size: ["promo", "title", "ctaCard", "iconGrid"].includes(block.type) ? DELA_FONT_SIZES.large : DELA_FONT_SIZES.small, color: defaultColor };
    }
    if ((content.items || []).some((item) => String(item.heading || "") === text)) return { size: DELA_FONT_SIZES.small, color: "#1F282C" };
    if (block.type === "ctaCard" && String(content.heading || "").includes(`%%${text}%%`)) return { size: DELA_FONT_SIZES.large, color: color || (block.variant === "light" ? "#084E7D" : "#ffffff") };
    if (block.type === "promo" && String(content.heading || "").includes(`%%${text}%%`)) return { size: DELA_FONT_SIZES.large, color: color || "#ffffff" };
    if (block.type === "promo" && contentText.includes(`%%${text}%%`)) return { size: DELA_FONT_SIZES.small, color: color || "#ffffff" };
    if (block.type === "iconGrid" && (content.items || []).some((item) => String(item.heading || "").includes(`%%${text}%%`))) return { size: DELA_FONT_SIZES.small, color: color || "#1F282C" };
    if (contentText.includes(`%%${text}%%`)) return { size: DELA_FONT_SIZES.small, color: color || (darkDefault ? "#ffffff" : "#1F282C") };
  }
  return { size: DELA_FONT_SIZES.small, color: darkDefault ? "#ffffff" : "#1F282C" };
}

async function publishDelaAssets() {
  const texts = delaTexts();
  if (!texts.length) return {};
  const config = window.CALLTOUCH_EMAIL_CONFIG || {};
  if (!config.brandAssetUploadEndpoint) throw new Error("Для экспорта Dela нужна подключённая облачная функция.");
  const map = {};
  for (const [index, text] of texts.entries()) {
    const rendered = await renderDelaPng(text);
    const headers = { "Content-Type": "application/json" };
    if (config.uploadToken) headers["X-Generator-Token"] = config.uploadToken;
    const response = await fetch(config.brandAssetUploadEndpoint, { method: "POST", headers, body: JSON.stringify({ imageBase64: await blobToBase64(rendered.blob), blockId: `dela-${index}`, kind: "dela" }) });
    const raw = await response.json().catch(() => ({}));
    const result = typeof raw.body === "string" ? JSON.parse(raw.body) : raw;
    if (!response.ok || !result.url) throw new Error(result.error || "Не удалось загрузить фрагмент Dela.");
    map[text] = { url: result.url, width: rendered.width, height: rendered.height };
  }
  return map;
}

// Перед финальной проверкой догружает в облако всё неопубликованное:
// бренд-блоки с устаревшим PNG и свои картинки без публичной ссылки.
async function publishPendingAssets() {
  const stubButton = { disabled: false, textContent: "" };
  let uploaded = 0;
  const failed = [];
  for (const [index, block] of email.blocks.entries()) {
    const content = block.content || {};
    try {
      if (block.type === "brandTitle" && !isBrandTitlePublished(block)) {
        await publishBrandImage(block, stubButton);
        if (isBrandTitlePublished(block)) uploaded += 1; else failed.push(`Блок ${index + 1}: заголовок Dela`);
      } else if (block.type === "brandScene" && !isBrandScenePublished(block)) {
        await publishBrandImage(block, stubButton);
        if (isBrandScenePublished(block)) uploaded += 1; else failed.push(`Блок ${index + 1}: фирменная композиция`);
      } else if (content.image && /^data:/i.test(content.image.previewSource || "") && !/^https:\/\//i.test(content.image.exportUrl || "")) {
        const blob = await (await fetch(content.image.previewSource)).blob();
        if (blob.size > 2 * 1024 * 1024) {
          failed.push(`Блок ${index + 1}: файл больше 2 МБ, нужна публичная ссылка`);
        } else {
          content.image = { ...content.image, exportUrl: await uploadCustomAssetFile(blob) };
          uploaded += 1;
        }
      }
    } catch {
      failed.push(`Блок ${index + 1}: не удалось загрузить изображение`);
    }
  }
  if (uploaded) {
    renderBlockEditor();
    renderPreview();
    persistSoon();
  }
  return { uploaded, failed };
}

async function openQualityDialog() {
  if (!email) return;
  const hasPendingUploads = email.blocks.some((block) => {
    const content = block.content || {};
    return (block.type === "brandTitle" && !isBrandTitlePublished(block))
      || (block.type === "brandScene" && !isBrandScenePublished(block))
      || (content.image && /^data:/i.test(content.image.previewSource || "") && !/^https:\/\//i.test(content.image.exportUrl || ""));
  });
  let uploadNote = "";
  if (hasPendingUploads) {
    showToast("Сначала загружаем изображения в облако…");
    const { uploaded, failed } = await publishPendingAssets();
    if (uploaded || failed.length) {
      uploadNote = `<section class="email-quality-group"><h3>Загрузка в облако</h3><ul>${uploaded ? `<li>Автоматически загружено изображений: ${uploaded}. Публичные ссылки уже подставлены в письмо.</li>` : ""}${failed.map((item) => `<li>${escapeAttr(item)}.</li>`).join("")}</ul></section>`;
    }
  }
  try {
    if (delaTexts().length) {
      showToast("Готовим фрагменты Dela…");
      window.CALLTOUCH_DELA_ASSETS = await publishDelaAssets();
      renderPreview({ preservePosition: true });
    }
  } catch (error) {
    window.CALLTOUCH_DELA_ASSETS = {};
    showToast(error.message || "Не удалось подготовить Dela.");
    return;
  }
  const report = validateEmail(email);
  const brandingWarning = hasBrandedDelaHeading(email) ? "" : `<section class="email-quality-group"><h3>Брендинг</h3><ul><li>В письме нет Dela-заголовков. Добавьте фирменную подачу перед отправкой.</li></ul><button class="email-button email-button--brand" type="button" data-brand-and-publish>Забрендировать заголовки</button></section>`;
  const html = renderEmailDocument(email, { preview: false });
  elements.qualityTitle.textContent = report.errors.length ? `Нужно исправить: ${report.errors.length}` : report.warnings.length ? `Нужно проверить: ${report.warnings.length}` : "Письмо готово ✓";
  elements.qualityResults.innerHTML = `${uploadNote}${brandingWarning}${report.errors.length ? `<section class="email-quality-group"><h3>Ошибки</h3><ul>${report.errors.map((item) => `<li>${escapeAttr(item)}</li>`).join("")}</ul></section>` : ""}${report.warnings.length ? `<section class="email-quality-group"><h3>Предупреждения</h3><ul>${report.warnings.map((item) => `<li>${escapeAttr(item)}</li>`).join("")}</ul></section>` : ""}${!report.errors.length && !report.warnings.length ? `<section class="email-quality-group"><h3>Критических проблем не найдено</h3><ul><li>Проверьте ссылки и отправьте тестовое письмо в вашей системе рассылок.</li></ul></section>` : ""}`;
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

$$('[data-preview]').forEach((button) => button.addEventListener("click", () => { email.settings.preview = button.dataset.preview; syncPreviewMode(); renderPreview({ preservePosition: false }); persistSoon(); }));
elements.themePicker.addEventListener("click", (event) => {
  const button = event.target.closest("[data-theme-option]");
  if (!button || button.dataset.themeOption === email.settings.theme) return;
  email.settings.theme = button.dataset.themeOption;
  commitChange({ rerenderEditor: true });
});
$("#normalizeButton").addEventListener("click", () => { email = typographEmail(normalizeEmailDesign(email)); commitChange({ rerenderEditor: true }); showToast("Письмо приведено в порядок: стили и типографика обновлены."); });
$("#brandButton").addEventListener("click", () => { email = brandEmail(email); commitChange({ rerenderEditor: true }); showToast("Письмо забрендировано: заголовки переведены в Dela, текстовые блоки получили белые плашки."); });
elements.qualityResults.addEventListener("click", async (event) => {
  if (!event.target.closest("[data-brand-and-publish]")) return;
  email = brandEmail(email);
  commitChange({ rerenderEditor: true });
  showToast("Брендируем письмо и готовим Dela-PNG…");
  await openQualityDialog();
});

elements.blockList.addEventListener("click", (event) => {
  const row = event.target.closest("[data-block-id]");
  if (!row) return;
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "up") return moveBlock(row.dataset.blockId, -1);
  if (action === "down") return moveBlock(row.dataset.blockId, 1);
  if (action === "toggle-visibility") {
    const block = email.blocks.find((item) => item.id === row.dataset.blockId);
    if (!block) return;
    block.settings = { ...(block.settings || {}), hidden: !block.settings?.hidden };
    commitChange({ rerenderEditor: true });
    return;
  }
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
  updatePreviewBlock(block);
  const iconMatch = control.dataset.field.match(/^content\.items\.(\d+)\.(heading|body)$/);
  if (block.type === "iconGrid" && iconMatch) {
    const timerKey = `${block.id}:${iconMatch[1]}`;
    window.clearTimeout(iconAutoTimers.get(timerKey));
    iconAutoTimers.set(timerKey, window.setTimeout(() => autoPickIconSilently(block, Number(iconMatch[1])), 420));
  }
  persistSoon();
});
elements.blockEditor.addEventListener("change", (event) => {
  const control = event.target.closest("[data-field]");
  const block = getSelectedBlock();
  if (!control || !block) return;
  updatePreviewBlock(block);
  renderBlockList();
  renderBlockEditor();
  persistSoon();
});
elements.blockEditor.addEventListener("click", async (event) => {
  const toneButton = event.target.closest("[data-button-tone]");
  if (toneButton) {
    const block = getSelectedBlock();
    if (block?.type === "button" && block.variant !== toneButton.dataset.buttonTone) {
      block.variant = toneButton.dataset.buttonTone;
      commitChange({ rerenderEditor: true });
    }
    return;
  }
  // Кнопки форматирования в боковой панели: оборачивают выделенный текст в markdown.
  const fmtButton = event.target.closest("[data-fmt]");
  if (fmtButton) {
    const textarea = fmtButton.closest(".email-format")?.querySelector("textarea");
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end);
    let replacement = "";
    if (!selected.trim() && fmtButton.dataset.fmt !== "typograph") {
      textarea.focus();
      return;
    }
    if (fmtButton.dataset.fmt === "bold") {
      const trimmed = selected.trim();
      replacement = /^\*\*[\s\S]*\*\*$/.test(trimmed) ? trimmed.slice(2, -2) : `**${selected}**`;
    } else if (fmtButton.dataset.fmt === "dela") {
      const colored = selected.match(/^\{\{(cyan|purple)\|([\s\S]*)\}\}$/);
      replacement = colored ? `{{${colored[1]}|%%${colored[2]}%%}}` : `%%${selected}%%`;
    } else if (fmtButton.dataset.fmt === "cyan" || fmtButton.dataset.fmt === "purple") {
      const tone = fmtButton.dataset.fmt;
      const colored = selected.match(/^\{\{(cyan|purple)\|([\s\S]*)\}\}$/);
      replacement = colored?.[1] === tone ? colored[2] : `{{${tone}|${selected}}}`;
    } else if (fmtButton.dataset.fmt === "list") {
      // Тоггл: если все выделенные строки уже пункты — снимаем маркеры, иначе добавляем.
      const lines = selected.split("\n");
      const allList = lines.every((line) => !line.trim() || /^\s*[-–—•]\s*/.test(line));
      replacement = lines.map((line) => allList ? line.replace(/^\s*[-–—•]\s*/, "") : line.trim() ? `- ${line}` : line).join("\n");
    } else if (fmtButton.dataset.fmt === "break") {
      replacement = "\n";
    } else if (fmtButton.dataset.fmt === "typograph") {
      replacement = typographText(selected || textarea.value);
      textarea.setRangeText(replacement, selected ? start : 0, selected ? end : textarea.value.length, "select");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.focus();
      return;
    } else {
      const url = await askLinkUrl();
      if (!url) return;
      replacement = `[${selected || "текст ссылки"}](${url})`;
    }
    textarea.setRangeText(replacement, start, end, "select");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.focus();
    return;
  }
  const iconAdd = event.target.closest("[data-icon-add]");
  if (iconAdd) {
    const block = getSelectedBlock();
    if (block?.type === "iconGrid" && block.content.items.length < 6) {
      block.content.items.push({ heading: "Новое преимущество", body: "Короткое описание", iconId: ["send", "verify", "clock", "message"][block.content.items.length % 4] });
      commitChange({ rerenderEditor: true });
    }
    return;
  }
  const insertImage = event.target.closest("[data-insert-image-after]");
  if (insertImage) {
    const block = getSelectedBlock();
    if (block?.type === "text") {
      const imageBlock = createBlock("image");
      const index = email.blocks.findIndex((item) => item.id === block.id);
      email.blocks.splice(index + 1, 0, imageBlock);
      selectedBlockId = imageBlock.id;
      commitChange({ rerenderEditor: true });
    }
    return;
  }
  const iconDela = event.target.closest("[data-icon-dela]");
  if (iconDela) {
    const block = getSelectedBlock();
    const item = block?.content.items[Number(iconDela.dataset.iconDela)];
    if (item) { const value = String(item.heading || "").trim(); const unwrapped = value.replace(/^%+|%+$/g, ""); item.heading = unwrapped !== value ? unwrapped : `%%${value || "Заголовок"}%%`; commitChange({ rerenderEditor: true }); }
    return;
  }
  const iconPick = event.target.closest("[data-icon-pick]");
  if (iconPick) return openIconDialog(getSelectedBlock()?.id, Number(iconPick.dataset.iconPick));
  const iconAuto = event.target.closest("[data-icon-auto]");
  if (iconAuto) {
    const block = getSelectedBlock();
    if (block?.type === "iconGrid") autoPickIcon(block, Number(iconAuto.dataset.iconAuto));
    return;
  }
  const iconRemove = event.target.closest("[data-icon-remove]");
  if (iconRemove) {
    const block = getSelectedBlock();
    if (block?.type === "iconGrid" && block.content.items.length > 1) {
      block.content.items.splice(Number(iconRemove.dataset.iconRemove), 1);
      commitChange({ rerenderEditor: true });
    }
    return;
  }
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
  const iconButton = event.target.closest("[data-icon-id]");
  if (iconButton) {
    const block = email.blocks.find((item) => item.id === assetTargetId);
    if (block?.type === "iconGrid" && iconTargetIndex >= 0) block.content.items[iconTargetIndex].iconId = iconButton.dataset.iconId;
    elements.assetDialog.close();
    elements.assetDialog.querySelector(".email-custom-asset").hidden = false;
    commitChange({ rerenderEditor: true });
    return;
  }
  const button = event.target.closest("[data-asset-id]");
  const assets = assetTargetPath === "content.background" ? window.CALLTOUCH_ASSETS.backgrounds : window.CALLTOUCH_ASSETS.visuals;
  const asset = assets.find((item) => item.id === button?.dataset.assetId);
  if (asset) applyAsset(asset);
});
elements.customAssetFile.addEventListener("change", () => {
  const file = elements.customAssetFile.files?.[0];
  if (!file) return;
  elements.customAssetFileName.textContent = file.name;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    customPreviewSource = String(reader.result || "");
    elements.customAssetPreview.src = customPreviewSource;
    elements.customAssetPreview.hidden = false;
  });
  reader.readAsDataURL(file);
});
async function uploadCustomAssetFile(file) {
  const config = window.CALLTOUCH_EMAIL_CONFIG || {};
  if (!config.brandAssetUploadEndpoint) throw new Error("Функция загрузки не подключена: укажите публичную ссылку вручную.");
  const headers = { "Content-Type": "application/json" };
  if (config.uploadToken) headers["X-Generator-Token"] = config.uploadToken;
  const response = await fetch(config.brandAssetUploadEndpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ imageBase64: await blobToBase64(file), blockId: "custom", kind: "asset" })
  });
  const rawResult = await response.json().catch(() => ({}));
  const result = typeof rawResult.body === "string" ? JSON.parse(rawResult.body) : rawResult;
  if (!response.ok || !result.url) throw new Error(result.error || "Облако не вернуло ссылку на изображение.");
  return result.url;
}

$("#applyCustomAssetButton").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const file = elements.customAssetFile.files?.[0];
  let exportUrl = elements.customAssetUrl.value.trim();
  if (file && !exportUrl) {
    if (file.size > 2 * 1024 * 1024) {
      showToast("Файл больше 2 МБ: сожмите его или укажите публичную ссылку.");
      return;
    }
    button.disabled = true;
    button.textContent = "Загружаем в облако…";
    try {
      exportUrl = await uploadCustomAssetFile(file);
    } catch (error) {
      showToast(error.message || "Не удалось загрузить изображение в облако.");
      return;
    } finally {
      button.disabled = false;
      button.textContent = "Использовать";
    }
  }
  applyAsset({ id: createId("asset"), label: file?.name || "Своё изображение", previewSource: customPreviewSource || exportUrl, exportUrl, keywords: [] });
});

$("#qualityButton").addEventListener("click", openQualityDialog);
elements.copyButton.addEventListener("click", copyHtml);
elements.downloadButton.addEventListener("click", downloadHtml);
elements.undoButton.addEventListener("click", undo);
elements.redoButton.addEventListener("click", redo);
elements.exportDraftButton.addEventListener("click", downloadDraft);
$("#importDraftButton").addEventListener("click", () => elements.importDraftInput.click());
elements.importDraftInput.addEventListener("change", () => importDraft(elements.importDraftInput.files?.[0]));
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
  if ((event.ctrlKey || event.metaKey) && !event.altKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) {
    if (event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
    if (event.key.toLowerCase() === "y") { event.preventDefault(); redo(); return; }
  }
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
