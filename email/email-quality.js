import { isBrandScenePublished } from "./email-brand-scene.js";
import { isBrandTitlePublished } from "./email-brand-title.js";
import { delaSegments, forceDelaMarkup, hasDelaMarkup, richPlainText } from "./email-rich-text.js";

function visibleText(value = "") {
  return richPlainText(value)
    .replace(/\[([^\]]+)]\(https:\/\/[^)\s]+\)/g, "$1");
}

function delaAssetKeys(email) {
  const keys = new Set();
  const grouped = new Set();
  email.blocks.forEach((block) => {
    if (["title", "promo"].includes(block.type) && hasDelaMarkup(block.content?.bigNumber)) grouped.add(forceDelaMarkup(block.content.bigNumber));
    if (block.type === "promo" && hasDelaMarkup(block.content?.offer)) grouped.add(forceDelaMarkup(block.content.offer));
    const heading = String(block.content?.heading || "");
    if (["title", "promo", "imageText", "featureCard", "iconGrid", "ctaCard"].includes(block.type) && hasDelaMarkup(heading)) grouped.add(forceDelaMarkup(heading));
    (block.content?.items || []).forEach((item) => {
      const itemHeading = String(item.heading || "");
      if (hasDelaMarkup(itemHeading)) grouped.add(forceDelaMarkup(itemHeading));
    });
  });
  grouped.forEach((value) => keys.add(value));
  const collect = (value) => {
    if (typeof value === "string") {
      if (grouped.has(forceDelaMarkup(value))) return;
      delaSegments(value).forEach((run) => keys.add(run.text.trim()));
    } else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === "object") Object.values(value).forEach(collect);
  };
  email.blocks.forEach((block) => collect(block.content));
  return [...keys];
}

export function normalizeEmailDesign(email) {
  const normalized = JSON.parse(JSON.stringify(email));
  normalized.settings.theme = ["classic", "editorial"].includes(normalized.settings.theme) ? normalized.settings.theme : "classic";
  normalized.settings.logo = ["dark", "color"].includes(normalized.settings.logo) ? normalized.settings.logo : "dark";
  normalized.blocks = normalized.blocks.filter((block) => block?.type && block?.id).map((block) => {
    block.settings = { ...(block.settings || {}), hidden: Boolean(block.settings?.hidden) };
    if (["imageText", "featureCard"].includes(block.type)) block.variant = ["image-left", "image-right"].includes(block.variant) ? block.variant : "image-left";
    if (block.type === "brandTitle") block.variant = ["light-cyan", "cyan", "navy", "purple", "magenta", "custom"].includes(block.variant) ? block.variant : "light-cyan";
    if (block.type === "brandScene") block.variant = ["navy-purple", "cyan-navy", "purple-cyan"].includes(block.variant) ? block.variant : "navy-purple";
    if (block.type === "divider") block.variant = ["s", "m", "l", "xl"].includes(block.variant) ? block.variant : "m";
    if (["ctaCard", "button"].includes(block.type) && !block.variant) block.variant = "primary";
    if (block.type === "ctaCard") block.content.align = block.content.align === "left" ? "left" : "center";
    return block;
  });
  return normalized;
}

export function validateEmail(email) {
  const errors = [];
  const warnings = ["Перед отправкой eNkod заменит {{link_view_in_browser}} и {{link_unsubscribe}}."];
  const ctaBlocks = [];
  email.blocks.forEach((block, index) => {
    if (block.settings?.hidden) return;
    const label = `Блок ${index + 1}`;
    const content = block.content || {};
    if (["promo", "imageText", "brandTitle", "brandScene", "featureCard", "ctaCard"].includes(block.type) && !String(content.heading || "").trim()) errors.push(`${label}: пустой заголовок.`);
    if (visibleText(content.heading).length > 120) warnings.push(`${label}: заголовок длиннее 120 символов.`);
    if (String(content.body || "").length > 900) warnings.push(`${label}: текстовый блок слишком длинный.`);
    const url = content.ctaUrl || content.url || content.linkUrl;
    if (["promo", "ctaCard", "button"].includes(block.type)) {
      ctaBlocks.push(block);
      if (!String(url || "").trim()) errors.push(`${label}: у CTA нет ссылки.`);
    }
    if (url && !/^(https:\/\/[^\s]+|\{\{[a-z0-9_]+\}\})$/i.test(String(url).trim())) warnings.push(`${label}: ссылка содержит небезопасный протокол или неверный адрес.`);
    const image = content.image;
    if (image && block.type !== "brandScene" && (!image.exportUrl || /^(blob:|data:|file:|http:)/i.test(image.exportUrl))) errors.push(`${label}: у изображения нет публичного HTTPS URL.`);
    if (image && !String(image.label || content.heading || "").trim()) warnings.push(`${label}: проверьте alt изображения.`);
    if (block.type === "brandScene" && !isBrandScenePublished(block)) errors.push(`${label}: обновите изображение фирменной композиции.`);
    if (block.type === "brandTitle" && !isBrandTitlePublished(block)) errors.push(`${label}: создайте изображение заголовка Dela.`);
  });
  if (!email.blocks.length) errors.push("В письме нет пользовательских блоков.");
  if (ctaBlocks.length > 3) warnings.push("В письме больше трёх конкурирующих CTA.");
  const delaKeys = delaAssetKeys(email);
  const assets = typeof window !== "undefined" ? window.CALLTOUCH_DELA_ASSETS || {} : {};
  const missingDela = delaKeys.filter((key) => !assets[key]);
  if (missingDela.length) warnings.push(`Не удалось подготовить Dela-PNG: ${missingDela.length}. Нажмите «Проверить и экспортировать» ещё раз.`);
  if (email.blocks.some((block) => block.type === "promo") && email.blocks[0]?.type === "button") warnings.push("Основная кнопка стоит раньше заголовка.");
  return { errors, warnings };
}
