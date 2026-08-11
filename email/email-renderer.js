import { DELA_FONT_SIZES, EMAIL_TOKENS, SYSTEM_LINKS } from "./email-model.js";
import { BRAND_SCENE_WIDTH, renderBrandSceneMarkup } from "./email-brand-scene.js";
import { BRAND_TITLE_WIDTH, renderBrandTitleMarkup } from "./email-brand-title.js";

const C = EMAIL_TOKENS.colors;
const textPurple = "#BA6DE7";
const fontBody = "Arial, Helvetica, sans-serif";
const fontDisplay = "Arial, Helvetica, sans-serif";

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));
}

// У части почтовых клиентов в подменённом Arial нет глифа ₽ (U+20BD) — он приезжает
// из случайного запасного шрифта и выбивается по весу. Оборачиваем знак в span со
// стеком шрифтов, где глиф точно есть и поддерживает жирное начертание.
function rubleSafe(value = "") {
  return escapeHtml(value).replace(/₽/g, `<span style="font-family:Arial,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;">₽</span>`);
}

function footnoteMarkup(value = "") {
  return rubleSafe(value).replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/gi, '<a href="$2" target="_blank" style="color:#68757B;text-decoration:underline;">$1</a>');
}

function safeUrl(value = "") {
  const url = String(value).trim();
  return /^(https:\/\/|\{\{[a-z0-9_]+\}\}$)/i.test(url) ? escapeHtml(url) : "#";
}

function assetSource(asset, preview) {
  if (!asset) return "";
  return escapeHtml(preview ? asset.previewSource : asset.exportUrl);
}

function img(asset, alt, preview, width = 176, radius = 0, scale = 1) {
  const source = assetSource(asset, preview);
  if (!source) return "";
  return `<img src="${source}" width="${width}" alt="${escapeHtml(alt || asset.label || "")}" style="display:block;width:${scale * 100}%;max-width:${width}px;height:auto;border:0;outline:none;text-decoration:none;margin:0 auto;${radius ? `border-radius:${radius}px;` : ""}">`;
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

function displayText(value, color = C.navy, size = 24, align = "left", path = "", preview = false) {
  const hasDela = /%%[\s\S]*?%%/.test(String(value || ""));
  const displaySize = hasDela ? Math.min(size, DELA_FONT_SIZES.large) : size;
  const groupAsset = hasDela && window.CALLTOUCH_DELA_ASSETS?.[String(value || "")];
  const groupSource = typeof groupAsset === "string" ? groupAsset : groupAsset?.url;
  const groupWidth = typeof groupAsset === "object" && groupAsset?.width ? `width="${groupAsset.width}"` : "";
  const text = groupSource
    ? `<img src="${escapeHtml(groupSource)}" alt="${escapeHtml(delaPlainText(value))}" ${groupWidth} style="display:inline-block;max-width:100%;height:auto;vertical-align:middle;border:0;">`
    : inlineMarkup(value, preview, displaySize).replace(/\n/g, "<br>");
  return `<div${editAttrs(preview, path)}${hasDela ? ' data-dela-text="1"' : ""} style="font-family:Arial,Helvetica,sans-serif;font-size:${displaySize}px;line-height:1.2;font-weight:700;color:${color};text-align:${align};word-break:break-word;">${text}</div>`;
}

function delaPlainText(value = "") {
  return String(value).replace(/\{\{(?:cyan|purple)\|%%([\s\S]*?)%%\}\}/g, "$1").replace(/%%/g, "").replace(/\*\*/g, "");
}

function delaMarkup(value, preview, size = DELA_FONT_SIZES.small) {
  const text = String(value || "");
  if (/^\s+$/.test(text)) return `<span data-dela-space="1" style="font-family:'Dela Gothic One','Arial Black',Arial,sans-serif;font-size:${size}px;line-height:1.2;">${escapeHtml(text)}</span>`;
  const asset = window.CALLTOUCH_DELA_ASSETS?.[text.trim()];
  const source = typeof asset === "string" ? asset : asset?.url;
  const width = typeof asset === "object" && asset?.width ? `width="${asset.width}"` : "";
  return source ? `<img src="${escapeHtml(source)}" alt="${escapeHtml(text)}" ${width} style="display:inline-block;max-width:100%;height:auto;vertical-align:middle;border:0;">` : `<span data-dela="1" style="display:inline;font-family:'Dela Gothic One','Arial Black',Arial,sans-serif;font-size:${size}px;font-weight:400;letter-spacing:.02em;text-transform:uppercase;white-space:pre-line;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(text)}</span>`;
}

function inlineMarkup(value, preview, delaSize = DELA_FONT_SIZES.small) {
  return rubleSafe(value)
    .replace(/\{\{(cyan|purple)\|([\s\S]*?)\}\}/g, (_, tone, inner) => `<span data-color="${tone}" style="color:${tone === "cyan" ? C.cyan : textPurple};">${inner}</span>`)
    .replace(/\*\*([\s\S]*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\\\*/g, "*")
    .replace(/%%([\s\S]*?)%%/g, (_, inner) => delaMarkup(inner, preview, delaSize))
    .replace(/\[([^\]]+)]\((https:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" style="color:inherit;text-decoration:underline;">$1</a>');
}

function bodyText(value, color = C.ink, size = 16, path = "", preview = false, listStyle = "bullet") {
  const lines = String(value || "").split("\n").map((line) => line.trim()).filter(Boolean);
  let listIndex = 0;
  const html = lines.map((line, lineIndex) => {
    const numbered = listStyle === "number" && /^\s*\d+\s*/.test(line);
    const list = /^\s*[-–—•]\s*/.test(line) || numbered;
    const text = inlineMarkup(line.replace(/^\s*[-–—•]\s*/, "").replace(numbered ? /^\s*\d+\s*/ : /$^/, ""), preview);
    // Висячий отступ: переносы строк пункта выравниваются по тексту, а не под маркер.
    if (!list) return `<div style="padding:0 0 ${lineIndex === lines.length - 1 ? 0 : 16}px;">${text}</div>`;
    listIndex += 1;
    const marker = listStyle === "number" ? `<span style="display:inline-block;width:28px;height:28px;margin-right:16px;border-radius:50%;background:${C.cyan};color:#ffffff;font-size:16px;line-height:28px;text-align:center;text-indent:0;">${listIndex}</span>` : `<span style="color:${C.cyan};">•</span>&nbsp;`;
    return `<div style="display:flex;align-items:flex-start;padding:0 0 ${lineIndex === lines.length - 1 ? 0 : 12}px;"><span style="flex:0 0 auto;">${marker}</span><span>${text}</span></div>`;
  }).join("");
  return `<div${editAttrs(preview, path)} style="font-family:${fontBody};font-size:${size}px;line-height:1.5;color:${color};word-break:break-word;overflow-wrap:break-word;">${html}</div>`;
}

function button(text, url, variant = "primary", path = "", preview = false, align = "left") {
  const background = variant === "secondary" ? `linear-gradient(90deg,${C.cyan},${C.brightnavy})` : `linear-gradient(90deg,${C.magenta},${C.purple})`;
  const fallback = variant === "secondary" ? C.navy : C.purple;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;width:auto;margin:0 ${align === "center" ? "auto" : "0"};"><tr><td bgcolor="${fallback}" style="background:${background};border-radius:999px;text-align:center;"><a href="${safeUrl(url)}" target="_blank" style="display:inline-block;padding:15px 28px;font-family:${fontDisplay};font-size:16px;line-height:20px;font-weight:900;color:#ffffff;text-decoration:none;min-width:160px;"><span${editAttrs(preview, path)}>${rubleSafe(text || "Подробнее")}</span></a></td></tr></table>`;
}

function wrapBlock(block, content, background = "transparent", padding = "0 0 20px") {
  return `<tr data-block-id="${escapeHtml(block.id)}"><td style="padding:${padding};background:${background};">${content}</td></tr>`;
}

function hasText(value) {
  return String(value || "").trim().length > 0;
}

function renderTitle(block, preview, darkText = false) {
  const { heading, subtitle, accent } = block.content;
  // На циановом оформлении текст без собственной подложки делаем белым.
  const textColor = darkText ? "#ffffff" : C.navy;
  const bodyColor = darkText ? "#ffffff" : C.ink;
  const hasHeading = String(heading || "").trim().length > 0;
  const hasSubtitle = block.variant !== "plain" && String(subtitle || "").trim().length > 0;
  // Пустой блок не оставляет пустоты: в экспорте его нет, в редакторе — тонкая заглушка для выбора.
  if (!hasHeading && !hasSubtitle) return "";
  const hasRichHeading = /%%[\s\S]*?%%|\{\{(?:cyan|purple)\|/.test(heading);
  const highlighted = hasHeading && block.variant === "accent" && accent && heading.includes(accent) && !hasRichHeading
    ? rubleSafe(heading).replace(rubleSafe(accent), `<span style="display:inline-block;background:${C.navy};color:#ffffff;border-radius:999px;padding:1px 12px 4px;">${rubleSafe(accent)}</span>`).replace(/\*\*([\s\S]*?)\*\*/g, "<strong>$1</strong>").replace(/\\\*/g, "*").replace(/\[([^\]]+)]\((https:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" style="color:inherit;text-decoration:underline;">$1</a>')
    : inlineMarkup(heading, preview, DELA_FONT_SIZES.large).replace(/\n/g, "<br>");
  const headingHtml = hasHeading ? `<div${editAttrs(preview, "content.heading")} style="font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:1.2;font-weight:700;color:${textColor};word-break:break-word;">${highlighted}</div>` : "";
  const subtitleHtml = hasSubtitle ? `<div style="${hasHeading ? "padding-top:18px;" : ""}">${bodyText(subtitle, bodyColor, 16, "content.subtitle", preview)}</div>` : "";
  // Необязательная белая плашка с отступами под заголовком и подзаголовком.
  const inner = String(block.content.plate || "") === "1"
    ? `<div style="padding:22px;background:#ffffff;border-radius:22px;box-sizing:border-box;">${headingHtml}${subtitleHtml}</div>`
    : headingHtml + subtitleHtml;
  return wrapBlock(block, inner, "transparent", "4px 0 24px");
}

function renderText(block, preview, darkText = false) {
  if (!hasText(block.content.body)) return "";
  const hasPlate = String(block.content.plate || "") === "1";
  const body = bodyText(block.content.body, darkText && !hasPlate ? "#ffffff" : C.ink, 16, "content.body", preview, block.content.listStyle || "bullet");
  // Необязательная белая плашка с отступами под текстом.
  const inner = String(block.content.plate || "") === "1"
    ? `<div style="padding:22px;background:#ffffff;border-radius:22px;box-sizing:border-box;">${body}</div>`
    : body;
  return wrapBlock(block, inner, "transparent", "0 0 24px");
}

function renderPromo(block, preview) {
  const content = block.content;
  if (![content.eyebrow, content.heading, content.offer, content.body, content.ctaText, content.image?.exportUrl, content.image?.previewSource].some(hasText)) return "";
  const eyebrow = String(content.eyebrow || "").trim();
  const eyebrowColor = content.eyebrowTone === "cyan" ? C.cyan : C.magenta;
  const visual = img(content.image, content.heading, preview, 216, 16, 1.1);
  const hasLower = [content.offer, content.body, content.image?.exportUrl, content.image?.previewSource].some(hasText);
  const offerHtml = inlineMarkup(content.offer || "", preview);
  const bodySize = String(content.bodySize) === "16" ? 16 : 14;
  const lower = hasLower ? table(`<tr>${td(`<div${editAttrs(preview, "content.offer")} style="font-family:${fontDisplay};font-size:16px;line-height:1.2;color:#ffffff;padding-bottom:${hasText(content.body) ? "10px" : "0"};">${offerHtml}</div>${bodyText(content.body, "#D6E8F2", bodySize, "content.body", preview)}`, visual ? "width:62%;padding:20px;vertical-align:middle;" : "width:100%;padding:20px;vertical-align:middle;", 'class="stack-column"')}${visual ? td(visual, "width:38%;padding:12px 12px 12px 0;vertical-align:middle;", 'class="stack-column"') : ""}</tr>`) : "";
  const gradient = content.gradient === false || content.gradient === "false" ? C.navy : `radial-gradient(circle at 100% 100%,${C.purple} 0%,rgba(156,46,221,.72) 0%,${C.navy} 64%)`;
  const wholeLink = !preview && content.linkUrl ? `<a href="${safeUrl(content.linkUrl)}" target="_blank" aria-label="${escapeHtml(content.heading || content.eyebrow || "Открыть предложение")}" style="position:absolute;inset:0;z-index:1;display:block;text-decoration:none;">&nbsp;</a>` : "";
  const contentHtml = `<div style="position:relative;">${eyebrow ? `<div${editAttrs(preview, "content.eyebrow")} style="display:inline-block;max-width:80%;box-sizing:border-box;padding:9px 16px;background:${eyebrowColor};border-radius:14px 14px 0 0;font-family:${fontBody};font-size:14px;font-weight:700;color:#ffffff;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(eyebrow)}</div>` : ""}<div style="padding:26px;background:${C.navy};background:${gradient};border-radius:${eyebrow ? "0 28px 28px 28px" : "28px"};">${hasText(content.heading) ? `<div style="padding-bottom:18px;">${displayText(content.heading, "#ffffff", 24, "left", "content.heading", preview)}</div>` : ""}${hasLower ? `<div style="background:rgba(255,255,255,.16);border-radius:18px;overflow:hidden;">${lower}</div>` : ""}${content.ctaText ? `<div style="position:relative;z-index:2;padding-top:22px;">${button(content.ctaText, content.ctaUrl, "secondary", "content.ctaText", preview)}</div>` : ""}</div>${wholeLink}</div>`;
  return wrapBlock(block, contentHtml, "transparent", "0 0 28px");
}

function renderImageBlock(block, preview) {
  const content = block.content;
  if (!content.image?.previewSource && !content.image?.exportUrl) return "";
  const image = img(content.image, content.alt || content.image?.label, preview, 604, 18);
  const linked = content.linkUrl ? `<a href="${safeUrl(content.linkUrl)}" target="_blank" style="display:block;text-decoration:none;">${image}</a>` : image;
  return wrapBlock(block, linked, "transparent", "0 0 24px");
}

function renderImageText(block, preview, feature = false) {
  const content = block.content;
  if (![content.heading, content.body, content.linkText, content.image?.previewSource, content.image?.exportUrl].some(hasText)) return "";
  const imageCell = td(img(content.image, content.heading, preview, feature ? 150 : 190, 16), `width:${feature ? 34 : 38}%;padding:${feature ? 18 : 22}px;vertical-align:middle;`, 'class="stack-column"');
  const textCell = td(`${displayText(content.heading, C.ink, 24, "left", "content.heading", preview)}<div style="padding-top:10px;">${bodyText(content.body, C.muted, 16, "content.body", preview)}</div>${content.linkText ? `<a${editAttrs(preview, "content.linkText")} href="${safeUrl(content.linkUrl)}" target="_blank" style="font-family:${fontBody};font-weight:700;color:${C.navy};word-break:break-word;overflow-wrap:break-word;">${rubleSafe(content.linkText)}</a>` : ""}`, `width:${feature ? 66 : 62}%;padding:${feature ? 22 : 26}px;vertical-align:middle;`, 'class="stack-column"');
  const cells = block.variant === "image-right" ? textCell + imageCell : imageCell + textCell;
  return wrapBlock(block, table(`<tr>${cells}</tr>`, `background:#ffffff;border-radius:${feature ? 22 : 28}px;overflow:hidden;`), "transparent", `0 0 ${feature ? 12 : 20}px`);
}

function renderBrandScene(block, preview) {
  if (!hasText(block.content.renderedUrl) && !hasText(block.content.heading) && !hasText(block.content.body)) return "";
  if (preview) return wrapBlock(block, renderBrandSceneMarkup(block, { preview: true, editable: true }), "transparent", "0 0 24px");
  const source = safeUrl(block.content.renderedUrl);
  const image = `<img src="${source}" width="${BRAND_SCENE_WIDTH}" alt="${escapeHtml(block.content.alt || block.content.heading || "Фирменный блок Calltouch")}" style="display:block;width:100%;max-width:${BRAND_SCENE_WIDTH}px;height:auto;border:0;outline:none;text-decoration:none;">`;
  const linked = block.content.linkUrl ? `<a href="${safeUrl(block.content.linkUrl)}" target="_blank" style="display:block;text-decoration:none;">${image}</a>` : image;
  return wrapBlock(block, linked, "transparent", "0 0 24px");
}

function renderBrandTitle(block, preview) {
  if (!hasText(block.content.renderedUrl) && !hasText(block.content.heading)) return "";
  if (preview) return wrapBlock(block, renderBrandTitleMarkup(block, { editable: true }), "transparent", "0 0 24px");
  const source = safeUrl(block.content.renderedUrl);
  const image = `<img src="${source}" width="${BRAND_TITLE_WIDTH}" alt="${escapeHtml(block.content.heading || "Фирменный заголовок Calltouch")}" style="display:block;width:100%;max-width:${BRAND_TITLE_WIDTH}px;height:auto;border:0;outline:none;text-decoration:none;">`;
  return wrapBlock(block, image, "transparent", "0 0 24px");
}

function renderIconGrid(block, preview) {
  const items = (block.content.items || []).slice(0, 6);
  const columns = block.content.columns === "1" ? 1 : 2;
  if (!items.some((item) => [item.heading, item.body, item.iconId].some(hasText))) return "";
  const icons = window.CALLTOUCH_ASSETS.essentials || {};
  const fallbackIds = ["send", "verify", "clock", "message", "send", "verify"];
  const rows = [];
  // Размеры иконки с подложкой: картинка 35px, паддинг плашки 10px, радиус 14px.
  for (let start = 0; start < items.length; start += columns) {
    const rowItems = items.slice(start, start + columns);
    rows.push(`<tr class="benefits-row">${rowItems.map((item, index) => {
      const icon = icons[item.iconId] || icons[fallbackIds[start + index]];
      // Подложка под иконку — залитая ячейка таблицы: в старом Outlook border-radius
      // не сработает, подложка станет квадратной, но ничего не сломается.
      const iconMarkup = icon ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;width:auto;"><tr><td bgcolor="${C.pale}" style="background:${C.pale};border-radius:14px;padding:10px;"><img src="${assetSource(icon, preview)}" width="35" height="35" alt="${escapeHtml(icon.label)}" style="display:block;width:35px;height:35px;border:0;"></td></tr></table>` : "";
      const heading = String(item.heading || "").replace(/\*\*/g, "");
      const body = String(item.body || "").replace(/\*\*/g, "");
      const span = columns === 1 ? 2 : 1;
      return td(`${iconMarkup}<div style="padding-top:13px;">${displayText(heading, C.ink, 16, "left", `content.items.${start + index}.heading`, preview)}</div>${body ? `<div style="padding-top:5px;">${bodyText(body, C.ink, 16, `content.items.${start + index}.body`, preview)}</div>` : ""}`, `width:${span === 2 ? "100" : "50"}%;padding:18px;vertical-align:top;`, `class="grid-column" colspan="${span}"`);
    }).join("")}${columns === 2 && rowItems.length === 1 ? td("", "width:50%;padding:0;", 'class="grid-column grid-column--empty" aria-hidden="true"') : ""}</tr>`);
  }
  const heading = hasText(block.content.heading) ? `<tr><td colspan="2" style="padding:22px 22px 0;">${displayText(block.content.heading, C.ink, 24, "left", "content.heading", preview)}</td></tr>` : "";
  return wrapBlock(block, table(`${heading}${rows.join("")}`, "background:#ffffff;border-radius:28px;overflow:hidden;table-layout:fixed;", 'class="benefits-grid"'), "transparent", "0 0 24px");
}

function renderCtaCard(block, preview) {
  if (![block.content.heading, block.content.subtitle, block.content.ctaText].some(hasText)) return "";
  const light = block.variant === "light";
  const gradient = block.variant === "dark-gradient";
  const background = light ? "#ffffff" : gradient ? `radial-gradient(circle at 100% 100%,${C.purple} 0%,rgba(156,46,221,.72) 0%,${C.navy} 64%)` : C.navy;
  const color = light ? C.navy : "#ffffff";
  const fallbackBackground = light ? "#ffffff" : C.navy;
  return wrapBlock(block, `<div style="padding:30px;background:${fallbackBackground};background:${background};border-radius:28px;">${displayText(block.content.heading, color, 24, "left", "content.heading", preview)}${block.content.subtitle ? `<div style="padding:12px 0 18px;">${bodyText(block.content.subtitle, light ? C.ink : "#D6E8F2", 16, "content.subtitle", preview)}</div>` : ""}${block.content.ctaText ? `<div style="padding-top:22px;">${button(block.content.ctaText, block.content.ctaUrl, "primary", "content.ctaText", preview)}</div>` : ""}</div>`, "transparent", "0 0 24px");
}

function renderButton(block, preview) {
  if (!hasText(block.content.text)) return "";
  const align = block.content.align === "left" ? "left" : "center";
  return wrapBlock(block, table(`<tr>${td(button(block.content.text, block.content.url, block.variant, "content.text", preview, align), `text-align:${align};`, `align="${align}"`)}</tr>`), "transparent", "0 0 24px");
}

function renderDivider(block) {
  const height = { s: 8, m: 18, l: 28, xl: 42 }[block.variant] || 18;
  return wrapBlock(block, `<div style="height:${height}px;line-height:${height}px;">&nbsp;</div>`, "transparent", "0");
}

export function renderBlock(block, preview, darkText = false) {
  if (block.settings?.hidden) return "";
  if (block.type === "title") return renderTitle(block, preview, darkText);
  if (block.type === "text") return renderText(block, preview, darkText);
  if (block.type === "promo") return renderPromo(block, preview);
  if (block.type === "image") return renderImageBlock(block, preview);
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
    const icon = item.previewSource || item.exportUrl ? `<img src="${escapeHtml(preview ? item.previewSource : item.exportUrl)}" width="31" height="31" alt="${escapeHtml(item.label)}" style="display:block;width:31px;height:31px;border:0;filter:brightness(0) saturate(100%) invert(53%) sepia(79%) saturate(1100%) hue-rotate(157deg) brightness(91%);">` : `<span style="display:block;width:31px;height:31px;border-radius:50%;background:${C.cyan};font-family:${fontBody};font-size:10px;line-height:31px;color:#ffffff;text-align:center;">MAX</span>`;
    return td(`<a href="${safeUrl(item.url)}" target="_blank" style="display:block;padding:0 7px;text-decoration:none;">${icon}</a>`, "width:45px;");
  }).join("");
  return table(`<tr>${td("Подписывайтесь на нас", `font-family:${fontBody};font-size:14px;color:${C.muted};opacity:.72;text-align:center;padding-bottom:10px;`)}</tr><tr>${td(`<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 auto;"><tr>${links}</tr></table>`, "text-align:center;")}</tr>`, "width:100%;margin:0 auto;text-align:center;", 'align="center"');
}

function footerShell(content, padding = "") {
  return table(`<tr>${td(content, padding)}</tr>`, "width:604px;max-width:604px;margin:0 auto;", 'class="footer-shell" align="center"');
}

export function renderEmailDocument(email, { preview = false, mobile = false } = {}) {
  const logo = window.CALLTOUCH_ASSETS.logos.dark;
  const background = email.settings.theme === "editorial" ? C.cyan : C.lightCyan;
  const darkText = email.settings.theme === "editorial";
  const blocks = email.blocks.map((block) => renderBlock(block, preview, darkText)).join("");
  const footnotes = email.footnotes.map((note, index) => `<div data-footnote-id="${escapeHtml(note.id)}" data-footnote-edit style="padding:0 0 10px;font-family:${fontBody};font-size:14px;line-height:1.45;color:${C.muted};opacity:.72;word-break:break-word;overflow-wrap:break-word;">${"*".repeat(index + 1)} ${footnoteMarkup(note.text)}</div>`).join("");
  const mainContent = table(`${blocks}<tr><td style="padding:6px 0 0;font-family:${fontBody};font-size:16px;line-height:1.4;color:${darkText ? "#ffffff" : C.ink};text-align:center;">С уважением, Команда Calltouch</td></tr>`);
  const main = table(`<tr>${td(mainContent, "padding:28px;", 'class="email-main-pad"')}</tr>`, `background:${background};border-radius:30px;`, `bgcolor="${background}"`);
  const responsive = `@media only screen and (max-width:620px){.email-shell,.footer-shell{width:100%!important}.email-outer-pad{padding:0 12px 20px!important}.email-main-pad{padding:22px!important}.stack-column{display:block!important;width:100%!important;box-sizing:border-box!important}.benefits-grid{table-layout:auto!important}.benefits-grid .benefits-row,.benefits-grid td.grid-column{display:block!important;width:100%!important;box-sizing:border-box!important}.benefits-grid td.grid-column--empty{display:none!important}.grid-column{display:block!important;width:100%!important;box-sizing:border-box!important}h1{font-size:28px!important}[data-brand-title],[data-brand-scene]{width:100%!important}[data-brand-scene]{padding:22px!important}[data-brand-scene]>div:nth-of-type(2){padding:18px 100px 18px 18px!important}[data-brand-scene]>[aria-hidden="true"]{width:110px!important;height:110px!important;right:0!important}}`;
  const mobileOverrides = mobile ? `<style>html,body{width:100%!important;min-width:0!important;max-width:100%!important;overflow-x:hidden!important}body{box-sizing:border-box!important}.email-shell,.footer-shell{width:100%!important;max-width:100%!important}.email-outer-pad,.email-main-pad{width:100%!important;max-width:100%!important;box-sizing:border-box!important}.email-outer-pad{padding-left:12px!important;padding-right:12px!important}.email-main-pad{padding:22px!important}.stack-column,.grid-column,.benefits-grid .benefits-row,.benefits-grid td.grid-column{display:block!important;width:100%!important;max-width:100%!important;box-sizing:border-box!important}.benefits-grid td.grid-column--empty{display:none!important}.benefits-grid{table-layout:auto!important}[data-brand-title],[data-brand-scene]{width:100%!important;max-width:100%!important;box-sizing:border-box!important}[data-dela],[data-dela-space],[data-dela-text]{font-size:14px!important;line-height:1.2!important}img{max-width:100%!important;height:auto!important}</style>` : "";
  const footnotesBlock = footnotes ? `<tr>${td(footerShell(`<div style="text-align:center;">${footnotes}</div>`, "padding:20px 0 8px;"), "")}</tr>` : "";
  const unsubscribeBlock = `<tr>${td(footerShell(`<div style="font-family:${fontBody};font-size:14px;line-height:1.45;color:${C.muted};opacity:.72;text-align:center;">Чтобы перестать получать письма, достаточно просто <a href="${safeUrl(SYSTEM_LINKS.unsubscribe)}" style="color:${C.muted};text-decoration:underline;">отписаться</a>.</div>`, "padding:10px 0 4px;"), "")}</tr>`;
  const socialBlock = `<tr>${td(footerShell(renderSocial(preview), "padding:18px 0 10px;"), "")}</tr>`;
  const legalBlock = `<tr>${td(footerShell(`<div style="font-family:${fontBody};font-size:14px;line-height:1.45;color:${C.cyan};text-align:center;"><a href="${safeUrl(SYSTEM_LINKS.webVersion)}" style="color:${C.cyan};text-decoration:none;">Веб-версия</a></div>`, "padding:4px 0 30px;"), "")}</tr>`;
  const shellWidth = mobile ? "width:100%;max-width:100%;margin:0 auto;" : "width:660px;max-width:660px;margin:0 auto;";
  const viewport = mobile ? "width=390,initial-scale=1" : "width=device-width,initial-scale=1";
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="${viewport}"><meta name="x-apple-disable-message-reformatting"><title>${escapeHtml(email.meta.title)}</title><style>${responsive}</style>${mobileOverrides}</head><body style="margin:0;padding:0;background:#ffffff;-webkit-text-size-adjust:100%;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(email.meta.title)}</div>${table(`<tr>${td(table(`<tr>${td(`<a href="https://www.calltouch.ru/" target="_blank" style="display:inline-block;text-decoration:none;"><img src="${assetSource(logo, preview)}" width="220" height="39" alt="Calltouch" style="display:block;width:220px;max-width:100%;height:auto;border:0;margin:0 auto;"></a>`, "padding:28px 20px 22px;text-align:center;")}</tr><tr>${td(main, "padding:0 28px 28px;", 'class="email-outer-pad"')}</tr></table>`, shellWidth, 'class="email-shell" align="center"'), "padding:0;")}</tr>${footnotesBlock}${unsubscribeBlock}${socialBlock}${legalBlock}`)}</body></html>`;
}
