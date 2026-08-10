import { DELA_FONT_SIZES } from "./email-model.js";

const THEMES = Object.freeze({
  "navy-purple": { outer: "linear-gradient(125deg,#064b79 0%,#075482 42%,#a52bd9 100%)", inner: "linear-gradient(110deg,rgba(255,255,255,.18),rgba(255,255,255,.08))" },
  "cyan-navy": { outer: "linear-gradient(125deg,#20b8dc 0%,#0877a7 45%,#06466f 100%)", inner: "rgba(5,71,119,.72)" },
  "purple-cyan": { outer: "linear-gradient(125deg,#932bd5 0%,#5358c9 48%,#20b8dc 100%)", inner: "rgba(31,40,44,.36)" }
});

export const BRAND_SCENE_WIDTH = 604;
export const BRAND_SCENE_MIN_HEIGHT = 270;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));
}

function assetSource(asset, preview) {
  if (!asset) return "";
  return escapeHtml(preview ? asset.previewSource : asset.exportUrl);
}

export function brandSceneSignature(block) {
  const content = block?.content || {};
  return JSON.stringify({
    variant: block?.variant || "navy-purple",
    heading: content.heading || "",
    body: content.body || "",
    image: content.image?.id || content.image?.exportUrl || content.image?.previewSource || "",
    background: content.background?.id || content.background?.exportUrl || content.background?.previewSource || "",
    alt: content.alt || ""
  });
}

export function isBrandScenePublished(block) {
  return Boolean(block?.content?.renderedUrl && block.content.renderedSignature === brandSceneSignature(block));
}

export function renderBrandSceneMarkup(block, { preview = true, editable = false } = {}) {
  const content = block?.content || {};
  const theme = THEMES[block?.variant] || THEMES["navy-purple"];
  const image = assetSource(content.image, preview);
  const background = assetSource(content.background, preview);
  const outerBackground = background ? `linear-gradient(115deg,rgba(5,71,119,.9),rgba(150,42,213,.56)),url('${background}') center/cover no-repeat` : theme.outer;
  const headingAttrs = editable ? ' data-edit-path="content.heading"' : "";
  const bodyAttrs = editable ? ' data-edit-path="content.body"' : "";
  const body = String(content.body || "").split(/\n+/).map((line) => line.trim()).filter(Boolean)
    .map((line) => `<div style="padding:0 0 9px;">${escapeHtml(line.replace(/^[-–—•]\s*/, ""))}</div>`).join("");
  const visual = image ? `<div aria-hidden="true" style="position:absolute;z-index:3;right:10px;bottom:-4px;width:238px;height:238px;background-image:url('${image}');background-repeat:no-repeat;background-position:center;background-size:contain;filter:drop-shadow(0 18px 22px rgba(10,24,35,.22));"></div>` : "";

  return `<div data-brand-scene style="position:relative;width:${BRAND_SCENE_WIDTH}px;min-height:${BRAND_SCENE_MIN_HEIGHT}px;box-sizing:border-box;overflow:hidden;padding:34px;border-radius:30px;background:${outerBackground};color:#fff;">
    <div${headingAttrs} style="position:relative;z-index:4;max-width:540px;font-family:'Dela Gothic One','Arial Black',Arial,sans-serif;font-size:${DELA_FONT_SIZES.large}px;line-height:1.14;font-weight:400;text-transform:uppercase;letter-spacing:.02em;">${escapeHtml(content.heading || "ЗАГОЛОВОК ФИРМЕННОГО БЛОКА").replace(/\r?\n/g, "<br>")}</div>
    <div style="position:relative;z-index:1;min-height:142px;margin-top:20px;box-sizing:border-box;padding:22px 236px 16px 26px;border-radius:22px;background:${theme.inner};">
      <div${bodyAttrs} style="position:relative;z-index:4;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.35;font-weight:400;color:#fff;">${body}</div>
    </div>
    ${visual}
  </div>`;
}
