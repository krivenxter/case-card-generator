import { createBlock, cloneEmail, createDefaultEmail } from "./email-model.js";

export function parseDocument(source) {
  const normalized = String(source || "").replace(/\r\n?/g, "\n").trim();
  if (!normalized) return { title: "", sections: [], urls: [] };
  const groups = normalized.split(/\n\s*\n/).map((group) => group.split("\n").map((line) => line.trim()).filter(Boolean)).filter(Boolean);
  const lines = groups.flat();
  const title = lines.find((line) => !isList(line) && !isUrl(line)) || lines[0] || "";
  const urls = lines.flatMap((line) => line.match(/https?:\/\/[^\s)]+/g) || []);
  const sections = groups.map((group) => {
    const list = group.filter(isList).map((line) => line.replace(/^\s*(?:[-–—•*]|\d+[.)])\s*/, ""));
    const plain = group.filter((line) => !isList(line) && !isUrl(line));
    const heading = plain[0] && plain[0].length <= 72 ? plain[0] : "";
    const bodyLines = heading ? plain.slice(1) : plain;
    return { heading, body: bodyLines.join("\n"), list, urls: group.flatMap((line) => line.match(/https?:\/\/[^\s)]+/g) || []) };
  });
  return { title, sections, urls };
}

function isList(line) {
  return /^\s*(?:[-–—•*]|\d+[.)])\s+/.test(line);
}

function isUrl(line) {
  return /^https?:\/\/\S+$/.test(line);
}

export function normalizeContent(parsed) {
  const sections = parsed.sections.filter((section, index) => index > 0 || section.heading !== parsed.title || section.body || section.list.length);
  return {
    title: parsed.title.slice(0, 180) || "ЗАГОЛОВОК ПИСЬМА",
    intro: sections.find((section) => section.body)?.body || "",
    sections,
    primaryUrl: parsed.urls[0] || "{{cta_url}}",
    ctaCandidate: findCtaCandidate(sections)
  };
}

function findCtaCandidate(sections) {
  const candidates = sections.flatMap((section) => [section.heading, ...section.list]).filter(Boolean);
  return candidates.reverse().find((line) => line.length <= 34 && /узна|подключ|заяв|регистр|получ|попроб|смотр|читать/i.test(line)) || "УЗНАТЬ БОЛЬШЕ";
}

function sectionBlocks(content, editorial = false) {
  const assetList = window.CALLTOUCH_ASSETS.visuals;
  const sourceSections = content.sections.filter((section) => section.heading !== content.title).slice(0, 4);
  if (!sourceSections.length && content.intro) return [createBlock("text", { content: { body: content.intro } })];
  return sourceSections.map((section, index) => {
    const body = [section.body, section.list.map((item) => `— ${item}`).join("\n")].filter(Boolean).join("\n");
    if (editorial) {
      return createBlock(index % 2 ? "featureCard" : "imageText", {
        variant: index % 2 ? "image-right" : "image-left",
        content: { heading: section.heading || `РАЗДЕЛ ${index + 1}`, body: body || "Добавьте описание.", image: assetList[index % assetList.length] }
      });
    }
    if (section.list.length >= 2) {
      const items = section.list.slice(0, 4).map((item, itemIndex) => ({ heading: item.length < 44 ? item : `ПРЕИМУЩЕСТВО ${itemIndex + 1}`, body: item.length < 44 ? "" : item }));
      while (items.length < 4) items.push({ heading: "", body: "" });
      return createBlock("iconGrid", { content: { items } });
    }
    return createBlock("featureCard", { variant: index % 2 ? "image-right" : "image-left", content: { heading: section.heading || `РАЗДЕЛ ${index + 1}`, body: body || "Добавьте описание.", image: assetList[index % assetList.length] } });
  });
}

export function buildLayoutVariantA(content) {
  const email = createDefaultEmail();
  email.meta.title = content.title;
  email.blocks = [
    createBlock("title", { variant: "accent", content: { heading: content.title, subtitle: content.intro, accent: "" } }),
    createBlock("promo", { variant: "dark", content: { eyebrow: "Calltouch", heading: content.title, body: content.intro || "Главное предложение письма", offer: "", ctaText: content.ctaCandidate, ctaUrl: content.primaryUrl, image: window.CALLTOUCH_ASSETS.visuals[0] } }),
    ...sectionBlocks(content, false),
    createBlock("ctaCard", { content: { heading: content.ctaCandidate, subtitle: "Узнайте подробности на сайте Calltouch.", ctaText: content.ctaCandidate, ctaUrl: content.primaryUrl } })
  ];
  return email;
}

export function buildLayoutVariantB(content) {
  const email = createDefaultEmail();
  email.settings.theme = "editorial";
  email.meta.title = content.title;
  email.blocks = [
    createBlock("title", { variant: "plain", content: { heading: content.title, subtitle: "", accent: "" } }),
    ...(content.intro ? [createBlock("text", { content: { body: content.intro } })] : []),
    ...sectionBlocks(content, true),
    createBlock("button", { content: { text: content.ctaCandidate, url: content.primaryUrl } })
  ];
  return email;
}

export function buildAutoVariants(text) {
  const content = normalizeContent(parseDocument(text));
  return [buildLayoutVariantA(content), buildLayoutVariantB(content)].map(cloneEmail);
}

export async function readImportedFile(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "txt") return file.text();
  if (extension !== "docx") throw new Error("Поддерживаются только DOCX и TXT.");
  if (!window.JSZip) throw new Error("Модуль чтения DOCX не загрузился.");
  const archive = await window.JSZip.loadAsync(await file.arrayBuffer());
  const documentFile = archive.file("word/document.xml");
  if (!documentFile) throw new Error("В DOCX не найден текст документа.");
  const xml = await documentFile.async("string");
  const documentXml = new DOMParser().parseFromString(xml, "application/xml");
  return [...documentXml.getElementsByTagNameNS("http://schemas.openxmlformats.org/wordprocessingml/2006/main", "p")]
    .map((paragraph) => {
      const text = [...paragraph.getElementsByTagNameNS("http://schemas.openxmlformats.org/wordprocessingml/2006/main", "t")].map((node) => node.textContent || "").join("");
      const isNumbered = paragraph.getElementsByTagNameNS("http://schemas.openxmlformats.org/wordprocessingml/2006/main", "numPr").length > 0;
      return isNumbered ? `- ${text}` : text;
    })
    .filter(Boolean)
    .join("\n\n");
}
