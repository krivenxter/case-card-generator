import { EMAIL_TOKENS, SYSTEM_LINKS } from "./email-model.js";
import { BRAND_SCENE_WIDTH, renderBrandSceneMarkup } from "./email-brand-scene.js";
import { BRAND_TITLE_WIDTH, renderBrandTitleMarkup } from "./email-brand-title.js";

const C = EMAIL_TOKENS.colors;
const fontBody = "Arial, Helvetica, sans-serif";
const fontDisplay = "'Arial Black', Arial, sans-serif";

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));
}

function safeUrl(value = "") {
  const url = String(value).trim();
  return /^(https:\/\/|\{\{[a-z0-9_]+\}\}$)/i.test(url) ? escapeHtml(url) : "#";
}

function assetSource(asset, preview) {
  if (!asset) return "";
  return escapeHtml(preview ? asset.previewSource : asset.exportUrl);
}

function img(asset, alt, preview, width = 176) {
  const source = assetSource(asset, preview);
  if (!source) return "";
  return `<img src="${source}" width="${width}" alt="${escapeHtml(alt || asset.label || "")}" style="display:block;width:100%;max-width:${width}px;height:auto;border:0;outline:none;text-decoration:none;margin:0 auto;">`;
}

function td(content, style = "", attributes = "") {
  return `<td ${attributes} style="${style}">${content}</td>`;
}

function table(content, style = "", attributes = "") {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ${attributes} style="width:100%;border-collapse:collapse;${style}">${content}</table>`;
}

function editAttrs(preview, path) {
  return preview && path ? ` data-edit-path="${escapeHtml(path)}"` : "";
}

function displayText(value, color = C.navy, size = 30, align = "left", path = "", preview = false) {
  return `<div${editAttrs(preview, path)} style="font-family:${fontDisplay};font-size:${size}px;line-height:1.12;font-weight:900;text-transform:uppercase;color:${color};text-align:${align};word-break:break-word;">${escapeHtml(value)}</div>`;
}

function bodyText(value, color = C.ink, size = 17, path = "", preview = false) {
  const lines = String(value || "").split("\n").filter(Boolean);
  const html = lines.map((line) => {
    const list = /^\s*[-–—•]\s*/.test(line);
    const text = escapeHtml(line.replace(/^\s*[-–—•]\s*/, ""))
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)]\((https:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" style="color:#084E7D;">$1</a>');
    return list ? `<div style="padding:0 0 8px 18px;">•&nbsp; ${text}</div>` : `<div style="padding:0 0 10px;">${text}</div>`;
  }).join("");
  return `<div${editAttrs(preview, path)} style="font-family:${fontBody};font-size:${size}px;line-height:1.5;color:${color};">${html}</div>`;
}

function button(text, url, variant = "primary", path = "", preview = false) {
  const background = variant === "secondary" ? C.cyan : `linear-gradient(90deg,${C.magenta},${C.purple})`;
  const fallback = variant === "secondary" ? C.cyan : C.purple;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;width:auto;"><tr><td bgcolor="${fallback}" style="background:${background};border-radius:999px;text-align:center;"><a href="${safeUrl(url)}" target="_blank" style="display:inline-block;padding:15px 28px;font-family:${fontDisplay};font-size:15px;line-height:18px;font-weight:900;color:#ffffff;text-decoration:none;text-transform:uppercase;min-width:160px;"><span${editAttrs(preview, path)}>${escapeHtml(text || "ПОДРОБНЕЕ")}</span></a></td></tr></table>`;
}

function wrapBlock(block, content, background = "transparent", padding = "0 0 20px") {
  return `<tr data-block-id="${escapeHtml(block.id)}"><td style="padding:${padding};background:${background};">${content}</td></tr>`;
}

function renderTitle(block, preview) {
  const { heading, subtitle, accent } = block.content;
  const highlighted = block.variant === "accent" && accent && heading.includes(accent)
    ? escapeHtml(heading).replace(escapeHtml(accent), `<span style="display:inline-block;background:${C.navy};color:#ffffff;border-radius:999px;padding:1px 12px 4px;">${escapeHtml(accent)}</span>`)
    : escapeHtml(heading);
  return wrapBlock(block, `<div${editAttrs(preview, "content.heading")} style="font-family:${fontDisplay};font-size:34px;line-height:1.1;font-weight:900;text-transform:uppercase;color:${C.navy};word-break:break-word;">${highlighted}</div>${subtitle && block.variant !== "plain" ? `<div style="padding-top:18px;">${bodyText(subtitle, C.navy, 17, "content.subtitle", preview)}</div>` : ""}`, "transparent", "4px 0 24px");
}

function renderText(block, preview) {
  return wrapBlock(block, bodyText(block.content.body, C.ink, 17, "content.body", preview), "transparent", "0 0 24px");
}

function renderPromo(block, preview) {
  const content = block.content;
  const visual = img(content.image, content.heading, preview, 180);
  const lower = table(`<tr>${td(`<div${editAttrs(preview, "content.offer")} style="font-family:${fontDisplay};font-size:18px;line-height:1.2;color:#ffffff;text-transform:uppercase;">${escapeHtml(content.offer || "")}</div>${bodyText(content.body, "#D6E8F2", 15, "content.body", preview)}`, "width:62%;padding:20px;vertical-align:middle;", 'class="stack-column"')}${td(visual, "width:38%;padding:12px;vertical-align:middle;", 'class="stack-column"')}</tr>`);
  const contentHtml = `${content.eyebrow ? `<div${editAttrs(preview, "content.eyebrow")} style="display:inline-block;padding:9px 16px;background:${C.magenta};border-radius:14px 14px 0 0;font-family:${fontBody};font-size:14px;font-weight:700;color:#ffffff;">${escapeHtml(content.eyebrow)}</div>` : ""}<div style="padding:26px;background:${C.navy};border-radius:0 28px 28px 28px;"><div style="padding-bottom:18px;">${displayText(content.heading, "#ffffff", 28, "left", "content.heading", preview)}</div><div style="background:rgba(255,255,255,.16);border-radius:18px;overflow:hidden;">${lower}</div>${content.ctaText ? `<div style="padding-top:22px;">${button(content.ctaText, content.ctaUrl, "secondary", "content.ctaText", preview)}</div>` : ""}</div>`;
  return wrapBlock(block, contentHtml, "transparent", "0 0 28px");
}

function renderImageText(block, preview, feature = false) {
  const content = block.content;
  const imageCell = td(img(content.image, content.heading, preview, feature ? 150 : 190), `width:${feature ? 34 : 38}%;padding:${feature ? 18 : 22}px;vertical-align:middle;`, 'class="stack-column"');
  const textCell = td(`${displayText(content.heading, C.ink, feature ? 19 : 23, "left", "content.heading", preview)}<div style="padding-top:10px;">${bodyText(content.body, C.muted, 15, "content.body", preview)}</div>${content.linkText ? `<a${editAttrs(preview, "content.linkText")} href="${safeUrl(content.linkUrl)}" target="_blank" style="font-family:${fontBody};font-weight:700;color:${C.navy};">${escapeHtml(content.linkText)}</a>` : ""}`, `width:${feature ? 66 : 62}%;padding:${feature ? 22 : 26}px;vertical-align:middle;`, 'class="stack-column"');
  const cells = block.variant === "image-right" ? textCell + imageCell : imageCell + textCell;
  return wrapBlock(block, table(`<tr>${cells}</tr>`, `background:#ffffff;border-radius:${feature ? 22 : 28}px;overflow:hidden;`), "transparent", `0 0 ${feature ? 12 : 20}px`);
}

function renderBrandScene(block, preview) {
  if (preview) return wrapBlock(block, renderBrandSceneMarkup(block, { preview: true, editable: true }), "transparent", "0 0 24px");
  const source = safeUrl(block.content.renderedUrl);
  const image = `<img src="${source}" width="${BRAND_SCENE_WIDTH}" alt="${escapeHtml(block.content.alt || block.content.heading || "Фирменный блок Calltouch")}" style="display:block;width:100%;max-width:${BRAND_SCENE_WIDTH}px;height:auto;border:0;outline:none;text-decoration:none;">`;
  const linked = block.content.linkUrl ? `<a href="${safeUrl(block.content.linkUrl)}" target="_blank" style="display:block;text-decoration:none;">${image}</a>` : image;
  return wrapBlock(block, linked, "transparent", "0 0 24px");
}

function renderBrandTitle(block, preview) {
  if (preview) return wrapBlock(block, renderBrandTitleMarkup(block, { editable: true }), "transparent", "0 0 24px");
  const source = safeUrl(block.content.renderedUrl);
  const image = `<img src="${source}" width="${BRAND_TITLE_WIDTH}" alt="${escapeHtml(block.content.heading || "Фирменный заголовок Calltouch")}" style="display:block;width:100%;max-width:${BRAND_TITLE_WIDTH}px;height:auto;border:0;outline:none;text-decoration:none;">`;
  return wrapBlock(block, image, "transparent", "0 0 24px");
}

function renderIconGrid(block, preview) {
  const items = (block.content.items || []).slice(0, 4);
  const icons = window.CALLTOUCH_ASSETS.essentials || {};
  const rows = [0, 2].map((start) => `<tr>${items.slice(start, start + 2).map((item, index) => {
    const icon = icons[item.iconId] || icons[["send", "verify", "clock", "message"][start + index]];
    const iconMarkup = icon ? `<img src="${assetSource(icon, preview)}" width="44" height="44" alt="${escapeHtml(icon.label)}" style="display:block;width:44px;height:44px;border:0;">` : "";
    return td(`${iconMarkup}<div style="padding-top:13px;">${displayText(item.heading, C.ink, 17, "left", `content.items.${start + index}.heading`, preview)}</div>${item.body ? `<div style="padding-top:5px;">${bodyText(item.body, C.ink, 14, `content.items.${start + index}.body`, preview)}</div>` : ""}`, "width:50%;padding:18px;vertical-align:top;", 'class="grid-column"');
  }).join("")}</tr>`).join("");
  return wrapBlock(block, table(rows, "background:#ffffff;border-radius:28px;overflow:hidden;"), "transparent", "0 0 24px");
}

function renderCtaCard(block, preview) {
  const light = block.variant === "light";
  const background = light ? "#ffffff" : C.navy;
  const color = light ? C.navy : "#ffffff";
  return wrapBlock(block, `<div style="padding:30px;background:${background};border-radius:28px;">${displayText(block.content.heading, color, 27, "left", "content.heading", preview)}${block.content.subtitle ? `<div style="padding:12px 0 18px;">${bodyText(block.content.subtitle, light ? C.ink : "#D6E8F2", 16, "content.subtitle", preview)}</div>` : ""}${button(block.content.ctaText, block.content.ctaUrl, "primary", "content.ctaText", preview)}</div>`, "transparent", "0 0 24px");
}

function renderButton(block, preview) {
  return wrapBlock(block, table(`<tr>${td(button(block.content.text, block.content.url, block.variant, "content.text", preview), "text-align:center;", 'align="center"')}</tr>`), "transparent", "0 0 24px");
}

function renderDivider(block) {
  const height = { s: 8, m: 18, l: 28, xl: 42 }[block.variant] || 18;
  return wrapBlock(block, `<div style="height:${height}px;line-height:${height}px;">&nbsp;</div>`, "transparent", "0");
}

function renderBlock(block, preview) {
  if (block.type === "title") return renderTitle(block, preview);
  if (block.type === "text") return renderText(block, preview);
  if (block.type === "promo") return renderPromo(block, preview);
  if (block.type === "imageText") return renderImageText(block, preview);
  if (block.type === "brandTitle") return renderBrandTitle(block, preview);
  if (block.type === "brandScene") return renderBrandScene(block, preview);
  if (block.type === "featureCard") return renderImageText(block, preview, true);
  if (block.type === "iconGrid") return renderIconGrid(block, preview);
  if (block.type === "ctaCard") return renderCtaCard(block, preview);
  if (block.type === "button") return renderButton(block, preview);
  return renderDivider(block);
}

function renderSocial(preview) {
  const social = window.CALLTOUCH_ASSETS.social;
  const links = Object.values(social).map((item) => {
    const icon = item.previewSource || item.exportUrl ? `<img src="${escapeHtml(preview ? item.previewSource : item.exportUrl)}" width="24" height="24" alt="${escapeHtml(item.label)}" style="display:block;width:24px;height:24px;border:0;">` : `<span style="display:block;width:24px;height:24px;border-radius:50%;background:${C.ink};font-family:${fontBody};font-size:8px;line-height:24px;color:#ffffff;text-align:center;">MAX</span>`;
    return td(`<a href="${safeUrl(item.url)}" target="_blank" style="display:block;padding:0 6px;text-decoration:none;">${icon}</a>`, "width:36px;");
  }).join("");
  return table(`<tr>${td("Подписывайтесь на нас", `font-family:${fontBody};font-size:16px;color:${C.ink};padding-right:12px;white-space:nowrap;`)}${links}</tr>`, "width:auto;margin:0 auto;", 'align="center"');
}

function footerShell(content, padding = "") {
  return table(`<tr>${td(content, padding)}</tr>`, "width:604px;max-width:604px;margin:0 auto;", 'class="footer-shell" align="center"');
}

export function renderEmailDocument(email, { preview = false } = {}) {
  const logo = window.CALLTOUCH_ASSETS.logos.dark;
  const background = email.settings.theme === "editorial" ? C.cyan : C.lightCyan;
  const blocks = email.blocks.map((block) => renderBlock(block, preview)).join("");
  const footnotes = email.footnotes.map((note, index) => `<div data-footnote-id="${escapeHtml(note.id)}" style="padding:0 0 10px;font-family:${fontBody};font-size:13px;line-height:1.45;color:${C.muted};">${"*".repeat(index + 1)} ${escapeHtml(note.text)}</div>`).join("");
  const mainContent = table(`${blocks}<tr><td style="padding:6px 0 0;font-family:${fontBody};font-size:16px;line-height:1.4;color:${C.navy};text-align:center;">С уважением, Команда Calltouch</td></tr>`);
  const main = table(`<tr>${td(mainContent, "padding:28px;", 'class="email-main-pad"')}</tr>`, `background:${background};border-radius:30px;`, `bgcolor="${background}"`);
  const responsive = `@media only screen and (max-width:620px){.email-shell,.footer-shell{width:100%!important}.email-outer-pad{padding:0 12px 20px!important}.email-main-pad{padding:22px!important}.stack-column{display:block!important;width:100%!important;box-sizing:border-box!important}.grid-column{display:block!important;width:100%!important;box-sizing:border-box!important}h1{font-size:28px!important}}`;
  const footnotesBlock = footnotes ? `<tr>${td(footerShell(footnotes, "padding:20px 0 8px;"), "")}</tr>` : "";
  const socialBlock = `<tr>${td(footerShell(renderSocial(preview), "padding:18px 0;"), "")}</tr>`;
  const legalBlock = `<tr>${td(footerShell(`<div style="padding:22px;background:${C.pale};border-radius:28px;box-sizing:border-box;font-family:${fontBody};font-size:14px;line-height:1.45;color:${C.muted};">Если в письме не отображаются картинки, перейдите на <a href="${safeUrl(SYSTEM_LINKS.webVersion)}" style="color:${C.muted};">веб-версию</a>.<br>Чтобы перестать получать письма, достаточно просто отписаться.<div style="padding-top:16px;text-align:center;"><a href="${safeUrl(SYSTEM_LINKS.unsubscribe)}" style="display:inline-block;padding:8px 20px;border:1px solid ${C.muted};border-radius:999px;color:${C.muted};text-decoration:none;">Отписаться</a></div></div>`, "padding:0 0 30px;"), "")}</tr>`;
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>${escapeHtml(email.meta.title)}</title><style>${responsive}</style></head><body style="margin:0;padding:0;background:#ffffff;-webkit-text-size-adjust:100%;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(email.meta.title)}</div>${table(`<tr>${td(table(`<tr>${td(`<img src="${assetSource(logo, preview)}" width="220" height="39" alt="Calltouch" style="display:block;width:220px;max-width:100%;height:auto;border:0;margin:0 auto;">`, "padding:28px 20px 22px;text-align:center;")}</tr><tr>${td(main, "padding:0 28px 28px;", 'class="email-outer-pad"')}</tr></table>`, "width:660px;max-width:660px;margin:0 auto;", 'class="email-shell" align="center"'), "padding:0;")}</tr>${footnotesBlock}${socialBlock}${legalBlock}`)}</body></html>`;
}
