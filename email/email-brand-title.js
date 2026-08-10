import { DELA_FONT_SIZES, EMAIL_TOKENS } from "./email-model.js";

const THEMES = Object.freeze({
  "light-cyan": EMAIL_TOKENS.colors.lightCyan,
  cyan: "#24B8DC",
  navy: "#084E7D",
  purple: "#9C2EDD",
  magenta: "#D958E5"
});

const DARK_TEXT = "#084E7D";
const LIGHT_TEXT = "#FFFFFF";

export const BRAND_TITLE_WIDTH = 604;
export const BRAND_TITLE_MIN_HEIGHT = 104;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));
}

function normalizeHex(value) {
  const hex = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(hex) ? hex.toUpperCase() : THEMES["light-cyan"];
}

function luminance(hex) {
  const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((channel) => channel <= .03928 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
  return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
}

function contrast(first, second) {
  const light = Math.max(luminance(first), luminance(second));
  const dark = Math.min(luminance(first), luminance(second));
  return (light + .05) / (dark + .05);
}

export function resolveBrandTitleColors(block) {
  const background = block?.variant === "custom"
    ? normalizeHex(block?.content?.backgroundColor)
    : THEMES[block?.variant] || THEMES["light-cyan"];
  // На циановой схеме текст всегда белый, иначе авто-контраст ставит тёмно-синий.
  if (block?.variant === "cyan") return { background, text: LIGHT_TEXT };
  const tone = block?.content?.textTone || "auto";
  const text = tone === "light" ? LIGHT_TEXT : tone === "dark" ? DARK_TEXT : contrast(background, LIGHT_TEXT) > contrast(background, DARK_TEXT) ? LIGHT_TEXT : DARK_TEXT;
  return { background, text };
}

export function brandTitleSignature(block) {
  const content = block?.content || {};
  return JSON.stringify({
    variant: block?.variant || "light-cyan",
    heading: content.heading || "",
    backgroundColor: content.backgroundColor || "",
    textTone: content.textTone || "auto"
  });
}

export function isBrandTitlePublished(block) {
  return Boolean(block?.content?.renderedUrl && block.content.renderedSignature === brandTitleSignature(block));
}

export function renderBrandTitleMarkup(block, { editable = false } = {}) {
  const content = block?.content || {};
  const { background, text } = resolveBrandTitleColors(block);
  const length = String(content.heading || "").length;
  const fontSize = length > 38 ? DELA_FONT_SIZES.small : DELA_FONT_SIZES.large;
  const headingAttrs = editable ? ' data-edit-path="content.heading"' : "";
  return `<div data-brand-title style="display:flex;width:${BRAND_TITLE_WIDTH}px;align-items:center;box-sizing:border-box;overflow:hidden;background:${background};color:${text};">
    <div${headingAttrs} style="width:100%;font-family:'Dela Gothic One','Arial Black',Arial,sans-serif;font-size:${fontSize}px;line-height:1.12;font-weight:400;text-transform:uppercase;letter-spacing:.02em;word-break:break-word;">${escapeHtml(content.heading || "ЗАГОЛОВОК DELA").replace(/\r?\n/g, "<br>")}</div>
  </div>`;
}
