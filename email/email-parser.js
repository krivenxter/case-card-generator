import { createBlock, cloneEmail, createDefaultEmail } from "./email-model.js";

const URL_RE = /https?:\/\/[^\s)]+/gi;
const LABEL_RE = /^(тема|прехедер|прехидер|subject|preheader)\s*:\s*/i;
const HEADING_RE = /^(что будем делать|обсудим|преимущества?.*|как .*\?|спецпредложение.*|.*акция.*|.*кешбэк.*|.*ассистент.*|подключить|узнать больше|открыть трансляцию)$/i;
const CTA_RE = /^(подключить|узнать больше|открыть трансляцию|смотреть трансляцию|программа встречи|зарегистрироваться|оставить заявку)$/i;
const CLOSING_RE = /^(?:старт(?:\s|$).*(?:онлайн|увидимся)|подключайтесь(?:\s|$)|смотрите(?:\s|$)|жд[её]м(?:\s|$)|до встречи(?:\s|$))/i;
const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

function cleanLine(value) {
  return String(value || "").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
}

function semanticText(value) {
  return cleanLine(value).replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/gi, "$1").replace(/\*\*/g, "").replace(/__/g, "").trim();
}

function markdownLink(value) {
  const match = String(value || "").match(/^\[([^\]]+)\]\((https:\/\/[^)\s]+)\)$/i);
  return match ? { label: match[1], url: match[2] } : null;
}

function normalizeKey(value) {
  return semanticText(value).toLowerCase().replace(/[«»"'.,:;!?()\[\]{}]/g, "").replace(/\s+/g, " ");
}

function isList(line) {
  return /^\s*(?:[-–—•]\s+|\*\s+|\d+[.)]\s+)/.test(line);
}

function listValue(line) {
  return cleanLine(line).replace(/^\s*(?:[-–—•]\s+|\*\s+|\d+[.)]\s+)/, "");
}

function isUrl(line) {
  return /^https?:\/\/\S+$/i.test(line);
}

function isHeading(line, index, lines) {
  const plain = semanticText(line);
  if (!plain || isList(line) || isUrl(line) || LABEL_RE.test(plain)) return false;
  if (CTA_RE.test(plain) || CLOSING_RE.test(plain)) return true;
  if (HEADING_RE.test(plain)) return true;
  if (/:$/.test(plain)) return true;
  const next = lines[index + 1] || "";
  return plain.length <= 72 && next && !isList(line) && !/[.!?;]$/.test(plain) && /[А-ЯЁA-Z]/.test(plain);
}

function withoutHeadingColon(value) {
  return cleanLine(value).replace(/:(?=\*{2}$)|:$/, "");
}

export function parseDocument(source) {
  const lines = String(source || "")
    .replace(/\r\n?/g, "\n")
    .replace(/(тема\s*:\s*.+?)(?=(?:прехедер|прехидер|preheader)\s*:)/gi, "$1\n")
    .split("\n")
    .map(cleanLine)
    .filter(Boolean);
  const urls = [...new Set(lines.flatMap((line) => line.match(URL_RE) || []))];
  const meta = { subject: "", preheader: "" };
  const contentLines = [];
  const footnotes = [];
  lines.forEach((line) => {
    const match = line.match(LABEL_RE);
    if (match) {
      const value = line.slice(match[0].length).trim();
      if (/тема|subject/i.test(match[1])) meta.subject = value;
      else meta.preheader = value;
    } else if (/^\*(?!\*)\S/.test(line)) {
      footnotes.push(line);
    } else {
      const inlineSection = line.match(/^([^:]{2,72}):\s+(.+)$/) || line.match(/^((?:место|дата и время|с собой))\s+[—–-]\s+(.+)$/i);
      if (inlineSection) contentLines.push(`${inlineSection[1]}:`, inlineSection[2]);
      else contentLines.push(line);
    }
  });

  const sections = [];
  let current = { heading: "", body: [], list: [], urls: [] };
  const push = () => {
    if (current.heading || current.body.length || current.list.length) sections.push({ ...current, body: current.body.join("\n") });
    current = { heading: "", body: [], list: [], urls: [] };
  };
  contentLines.forEach((line, index) => {
    if (isHeading(line, index, contentLines)) {
      if (current.heading || current.body.length || current.list.length) push();
      current.heading = withoutHeadingColon(line);
      return;
    }
    if (isList(line)) current.list.push(listValue(line));
    else if (current.heading && /что будем делать|обсудим|преимств/i.test(semanticText(current.heading)) && (/;$/.test(line) || current.list.length)) current.list.push(line);
    else {
      current.body.push(line);
      current.urls.push(...(line.match(URL_RE) || []));
    }
  });
  push();

  const title = meta.subject || "";
  const intro = sections.find((section) => !section.heading && section.body)?.body || "";
  return { title: title.slice(0, 180), preheader: meta.preheader, intro, sections, footnotes, urls, primaryUrl: urls[0] || "{{cta_url}}" };
}

export function normalizeContent(parsed) {
  const seen = new Set();
  const sections = parsed.sections.map((section) => ({
    ...section,
    heading: cleanLine(section.heading),
    body: cleanLine(section.body),
    list: section.list.map(cleanLine).filter(Boolean)
  })).filter((section) => {
    const key = normalizeKey([section.heading, section.body, ...section.list].join("|"));
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const ctaCandidate = findCtaCandidate(sections);
  const links = sections.flatMap((section) => [section.heading, section.body, ...section.list]).map(markdownLink).filter(Boolean);
  const ctaLink = links.find((link) => CTA_RE.test(semanticText(link.label)) || /смотр|открыт|подключ|регист|заяв/i.test(link.label)) || null;
  return { ...parsed, sections, title: parsed.title || "", ctaCandidate, ctaLink };
}

function findCtaCandidate(sections) {
  const candidates = sections.flatMap((section) => [section.heading, section.body, ...section.list]).filter(Boolean);
  return candidates.find((line) => CTA_RE.test(semanticText(line)) || CLOSING_RE.test(semanticText(line)) || /^(зарегистр|попробовать)/i.test(semanticText(line)))
    || candidates.find((line) => semanticText(line).length <= 70 && /подключ|заяв|регистр|получ|попроб|смотр|читать|открыть/i.test(semanticText(line)))
    || "";
}

function sectionText(section) {
  return [section.heading, section.body, section.list.map((item) => `- ${item}`).join("\n")].filter(Boolean).join("\n\n");
}

function isOfferSection(section) {
  return /акци|спецпредлож|кешбэк|0\s*₽|бесплатн|без затрат/i.test(semanticText(`${section.heading} ${section.body}`));
}

function isBenefitsSection(section) {
  return /преимуществ|поможет|почему|что будем делать|обсудим/i.test(semanticText(section.heading)) && section.list.length >= 2;
}

function isLogistics(section) {
  return /^(место|дата и время)$/i.test(semanticText(section.heading));
}

function isCtaSection(section, ctaCandidate) {
  return !section.list.length && !section.body && (normalizeKey(section.heading) === normalizeKey(ctaCandidate) || CTA_RE.test(semanticText(section.heading)) || markdownLink(section.heading));
}

function importedImageBlocks(images) {
  return images.map((image, index) => createBlock("image", { id: `imported-image-${index + 1}`, content: { image, alt: image.label || `Изображение ${index + 1}`, linkUrl: "" } }));
}

function sectionBlocks(content, editorial = false) {
  const assetList = window.CALLTOUCH_ASSETS.visuals || [];
  const blocks = [];
  const used = new Set();
  const logistics = content.sections.filter(isLogistics);
  content.sections.forEach((section, index) => {
    const text = sectionText(section);
    const key = normalizeKey(text);
    if (!text || used.has(key)) return;
    used.add(key);
    if (!section.heading && section.body === content.intro) return;
    if (isCtaSection(section, content.ctaCandidate)) return;
    if (isLogistics(section)) return;
    if (isOfferSection(section)) {
      blocks.push(createBlock("promo", { variant: "dark", content: { eyebrow: section.heading || "Специальное предложение", heading: section.heading || content.title, offer: section.list[0] || "", body: section.body, ctaText: content.ctaCandidate, ctaUrl: content.primaryUrl, image: assetList[0] } }));
    } else if (!editorial && isBenefitsSection(section)) {
      blocks.push(createBlock("text", { content: { plate: "1", listStyle: "number", body: sectionText(section) } }));
    } else if (editorial) {
      blocks.push(createBlock("text", { content: { plate: index % 2 ? "1" : "", listStyle: section.list.length ? "bullet" : "bullet", body: text } }));
    } else {
      blocks.push(createBlock("text", { content: { body: text } }));
    }
  });
  if (!editorial && logistics.length) {
    blocks.push(createBlock("iconGrid", { content: { items: logistics.slice(0, 4).map((section) => ({ heading: section.heading, body: section.body, iconId: /дата/i.test(semanticText(section.heading)) ? "clock" : "house" })) } }));
  }
  return blocks;
}

function addOnce(blocks, block, key) {
  if (!key) return;
  if (!blocks.some((item) => normalizeKey(item.content?.heading || item.content?.body) === normalizeKey(key))) blocks.push(block);
}

function addImportedTitle(blocks, content, subtitle = "") {
  if (content.title) blocks.push(createBlock("title", { variant: "plain", content: { heading: content.title, subtitle, accent: "" } }));
}

function addImportedCta(blocks, content, variant = "dark-gradient") {
  if (!content.ctaCandidate && !content.ctaLink) return;
  const heading = content.ctaCandidate && !markdownLink(content.ctaCandidate) ? semanticText(content.ctaCandidate) : "";
  if (content.ctaLink) {
    addOnce(blocks, createBlock("ctaCard", { variant, content: { heading, subtitle: "", ctaText: content.ctaLink.label, ctaUrl: content.ctaLink.url } }), `${heading}|${content.ctaLink.url}`);
  } else {
    addOnce(blocks, createBlock("ctaCard", { variant, content: { heading, subtitle: "", ctaText: "", ctaUrl: content.primaryUrl } }), content.ctaCandidate);
  }
}

export function buildLayoutVariantA(content, images = []) {
  const email = createDefaultEmail();
  email.meta.title = content.title || "Письмо";
  email.meta.preheader = content.preheader;
  email.footnotes = (content.footnotes || []).map((text, index) => ({ id: `imported-footnote-${index + 1}`, text: text.replace(/^\*+\s*/, "") }));
  const blocks = [];
  addImportedTitle(blocks, content, content.intro);
  blocks.push(...importedImageBlocks(images));
  if (!content.title && content.intro) blocks.push(createBlock("text", { content: { body: content.intro } }));
  sectionBlocks(content, false).forEach((block) => addOnce(blocks, block, block.content?.heading || block.content?.body));
  addImportedCta(blocks, content);
  email.blocks = blocks;
  return email;
}

export function buildLayoutVariantB(content, images = []) {
  const email = createDefaultEmail();
  email.settings.theme = "editorial";
  email.meta.title = content.title || "Письмо";
  email.meta.preheader = content.preheader;
  email.footnotes = (content.footnotes || []).map((text, index) => ({ id: `imported-footnote-${index + 1}`, text: text.replace(/^\*+\s*/, "") }));
  const blocks = [];
  addImportedTitle(blocks, content);
  blocks.push(...importedImageBlocks(images));
  if (!content.title && content.intro) blocks.push(createBlock("text", { content: { body: content.intro, plate: "1" } }));
  sectionBlocks(content, true).forEach((block) => addOnce(blocks, block, block.content?.heading || block.content?.body));
  addImportedCta(blocks, content, "light");
  email.blocks = blocks;
  return email;
}

export function buildAutoVariants(source) {
  const payload = typeof source === "string" ? { text: source, images: [] } : source;
  const content = normalizeContent(parseDocument(payload.text));
  return [buildLayoutVariantA(content, payload.images || []), buildLayoutVariantB(content, payload.images || [])].map(cloneEmail);
}

export async function readImportedFile(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "txt") return { text: await file.text(), images: [] };
  if (extension !== "docx") throw new Error("Поддерживаются только DOCX и TXT.");
  if (!window.JSZip) throw new Error("Модуль чтения DOCX не загрузился.");
  const archive = await window.JSZip.loadAsync(await file.arrayBuffer());
  const documentFile = archive.file("word/document.xml");
  if (!documentFile) throw new Error("В DOCX не найден текст документа.");
  const xml = await documentFile.async("string");
  const documentXml = new DOMParser().parseFromString(xml, "application/xml");
  const relsFile = archive.file("word/_rels/document.xml.rels");
  const relationships = {};
  if (relsFile) {
    const relsXml = new DOMParser().parseFromString(await relsFile.async("string"), "application/xml");
    [...relsXml.getElementsByTagName("Relationship")].forEach((relation) => {
      const id = relation.getAttribute("Id");
      const target = relation.getAttribute("Target");
      if (id && target && /^https?:\/\//i.test(target)) relationships[id] = target;
    });
  }
  const readRun = (run) => {
    const runText = [...run.getElementsByTagNameNS(WORD_NS, "t")].map((node) => node.textContent || "").join("");
    if (!runText) return "";
    const bold = run.getElementsByTagNameNS(WORD_NS, "b").length > 0 || run.getElementsByTagNameNS(WORD_NS, "bCs").length > 0;
    return bold ? `**${runText}**` : runText;
  };
  const text = [...documentXml.getElementsByTagNameNS(WORD_NS, "p")]
    .map((paragraph) => {
      const value = [...paragraph.childNodes].filter((node) => node.nodeType === 1).map((node) => {
        if (node.localName === "hyperlink") {
          const label = [...node.getElementsByTagNameNS(WORD_NS, "r")].map(readRun).join("");
          const url = relationships[node.getAttribute("r:id") || node.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id")];
          return url && label ? `[${label.replace(/\*\*/g, "")}](${url})` : label;
        }
        return node.localName === "r" ? readRun(node) : "";
      }).join("");
      const isNumbered = paragraph.getElementsByTagNameNS(WORD_NS, "numPr").length > 0;
      return isNumbered ? `- ${value}` : value;
    })
    .map(cleanLine)
    .filter(Boolean)
    .join("\n");
  const mimeByExtension = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };
  const images = await Promise.all(Object.keys(archive.files)
    .filter((path) => /^word\/media\//i.test(path))
    .map(async (path, index) => {
      const imageExtension = path.split(".").pop()?.toLowerCase();
      const base64 = await archive.file(path).async("base64");
      return { id: `imported-docx-image-${index + 1}`, label: `Изображение из ${file.name}`, previewSource: `data:${mimeByExtension[imageExtension] || "application/octet-stream"};base64,${base64}`, exportUrl: "" };
    }));
  return { text, images };
}
