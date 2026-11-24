import { cloneEmail, createBlock, createDefaultEmail, createId } from "./email-model.js";
import { pickIconId } from "./email-parser.js";
import { forceDelaMarkup } from "./email-rich-text.js";

const joinParagraphs = (...parts) => parts.filter(Boolean).join("\n\n");
const collections = ["agenda", "resources", "comparison", "steps", "metrics", "faq"];

function brandedHeading(heading, accent) {
  const text = accent && heading.includes(accent)
    ? heading.replace(accent, () => `{{cyan|${accent}}}`) : heading;
  return forceDelaMarkup(text);
}

function cleanLayoutMetadata(body = "") {
  return body.replace(/(^|\n)(?:Связанная ссылка|URL кнопки|URL действия):[ \t]*\n?[ \t]*(https:\/\/[^\s]+)(?=\n|$)/gi,
    (_match, start, url) => body.includes("](" + url + ")") ? "" : `${start}[Открыть материал](${url})`).trim();
}

export async function renderEmailBannerCover(draft, illustration) {
  if (draft.cover !== "banner" || !draft.coverBanner || !illustration) return "";
  const frame = document.createElement("iframe");
  frame.title = "Рендер обложки письма";
  frame.setAttribute("aria-hidden", "true");
  frame.inert = true;
  frame.style.cssText = "position:fixed;left:-2000px;top:0;width:1480px;height:900px;border:0;pointer-events:none;";
  let ready;
  let timeout;
  try {
    await new Promise((resolve, reject) => {
      ready = (event) => {
        if (event.origin === location.origin && event.source === frame.contentWindow && event.data === "calltouch-email-banner-ready") resolve();
      };
      window.addEventListener("message", ready);
      timeout = setTimeout(() => reject(new Error("Баннерный редактор не успел загрузиться.")), 35000);
      frame.src = new URL("../index.html?tool=banners&embedded=1&email-cover=1", import.meta.url);
      document.body.append(frame);
    });
    if (typeof frame.contentWindow?.renderEmailBannerJpg !== "function") throw new Error("Баннерный редактор недоступен.");
    return await frame.contentWindow.renderEmailBannerJpg(draft.coverBanner, illustration);
  } finally {
    clearTimeout(timeout);
    window.removeEventListener("message", ready);
    frame.remove();
  }
}

export function createIllustrationAsset(source, label) {
  return {
    id: createId("asset"),
    label: label || "Фирменная иллюстрация",
    previewSource: source,
    exportUrl: "",
    keywords: []
  };
}

export function createBannerEmailBlock(source, alt, width = 1200) {
  return createBlock("image", {
    content: { image: { ...createIllustrationAsset(source, alt), width }, alt }
  });
}

export function buildAiEmail(draft, illustration, coverImage = "", libraryAsset) {
  const email = createDefaultEmail();
  email.meta.title = draft.subject || draft.blocks[0].heading || "Письмо Calltouch";
  email.meta.preheader = draft.preheader;
  email.settings.theme = draft.theme;
  email.footnotes = draft.footnotes.map((text) => ({ id: createId("note"), text: text.replace(/^\*+\s*/, "") }));

  const editorial = draft.theme === "editorial";
  let featured = 0;
  email.blocks = draft.blocks.map(({ type, heading, accent, body, eyebrow, offer, cta, url, items = [], tone }) => {
    const destination = cta ? url || "{{cta_url}}" : "";
    const headingMarkup = brandedHeading(heading, accent);
    const list = items.map((item) => `- ${[item.eyebrow, item.heading, item.body,
      item.cta && (item.url ? `[${item.cta}](${item.url})` : item.cta)].filter(Boolean).join(" — ")}`).join("\n");
    const details = joinParagraphs(cleanLayoutMetadata(body), list);
    if (type === "title" && heading) {
      return createBlock("title", {
        variant: "accent",
        content: { heading: headingMarkup, subtitle: details, accent: "", plate: tone === "white" ? "1" : "" }
      });
    }
    if (type === "promo") {
      const bigNumber = offer?.length <= 18 && /^[+−-]?\d/.test(offer) ? forceDelaMarkup(offer) : "";
      return createBlock("promo", {
        content: { heading: headingMarkup, eyebrow, bigNumber, offer: bigNumber ? "" : forceDelaMarkup(offer), body: details, bodySize: "16", ctaText: cta, ctaUrl: destination, image: null }
      });
    }
    if (type === "cta") {
      return createBlock("ctaCard", {
        variant: editorial ? "light" : "dark-gradient",
        content: { heading: heading === cta ? "" : headingMarkup, subtitle: details, ctaText: cta, ctaUrl: destination }
      });
    }
    if (type === "button") return createBlock("button", { variant: "secondary", content: { text: cta, url: destination, align: "left" } });
    if (type === "feature") {
      return createBlock("imageText", {
        variant: featured++ % 2 ? "image-right" : "image-left",
        content: { heading: headingMarkup, body: details, linkText: cta, linkUrl: destination, image: null, tone, plate: tone === "plain" && !editorial ? "0" : "1" }
      });
    }
    if (type === "panel" || (collections.includes(type) && items.length)) {
      return createBlock(type === "panel" ? "panel" : "collection", {
        variant: type === "panel" ? "default" : type,
        content: {
          heading: headingMarkup, eyebrow, body: type === "panel" ? details : body, ctaText: cta, ctaUrl: destination, tone: tone || "white",
          ...(type !== "panel" && { items: items.map((item) => ({
            heading: brandedHeading(item.heading, ""), eyebrow: item.eyebrow || "", body: item.body,
            ctaText: item.cta || "", ctaUrl: item.cta ? item.url || "{{cta_url}}" : ""
          })) })
        }
      });
    }
    if (type === "benefits" && !body && items.length >= 2 && items.length <= 6
      && items.every((item) => item.heading.length <= 80 && item.body.length <= 110 && !item.cta && !item.eyebrow)) {
      return createBlock("iconGrid", {
        content: {
          heading: headingMarkup,
          columns: items.length % 2 ? "1" : "2",
          ctaText: cta, ctaUrl: destination,
          items: items.map((item) => ({
            ...item,
            heading: forceDelaMarkup(item.heading),
            iconId: pickIconId(`${item.heading} ${item.body}`)
          }))
        }
      });
    }
    return createBlock("text", {
      content: { body: joinParagraphs(heading && `**${heading}**`, details, cta && (url ? `[${cta}](${url})` : cta)), plate: tone === "white" ? "1" : "" }
    });
  }).filter((block, index, blocks) => {
    const previous = blocks[index - 1];
    return block.type !== "button" || !previous || block.content.text !== previous.content.ctaText
      || block.content.url !== previous.content.ctaUrl;
  });

  if (coverImage) {
    const alt = draft.coverAlt || draft.coverBanner?.title || draft.subject;
    const cover = createBannerEmailBlock(coverImage, alt);
    if (illustration) cover.content.sourceIllustration = libraryAsset || createIllustrationAsset(illustration, draft.visualIdea);
    email.blocks.unshift(cover);
  } else if (illustration && draft.cover !== "none") {
    const asset = libraryAsset || createIllustrationAsset(illustration, draft.coverAlt || draft.visualIdea);
    const placement = draft.cover === "inline" ? "imageText" : "promo";
    const pictureBlock = draft.cover === "banner" ? null
      : email.blocks.find((block, index) => index < (draft.cover ? 5 : 2) && block.type === placement);
    if (pictureBlock) {
      pictureBlock.content.image = asset;
    } else {
      const imageBlock = createBlock("image", {
        variant: draft.cover === "banner" ? "cover" : "default",
        content: { image: asset, alt: asset.label }
      });
      email.blocks.splice(draft.cover === "banner" ? 0 : 1, 0, imageBlock);
    }
  }
  return email;
}

export function buildAiEmailVariants(draft, illustration, coverImage, libraryAsset) {
  const recommended = buildAiEmail(draft, illustration, coverImage, libraryAsset);
  const alternateCover = draft.cover === "banner" ? "inline" : draft.cover === "none" ? "none" : "banner";
  const alternate = illustration ? buildAiEmail({ ...draft, cover: alternateCover }, illustration, "", libraryAsset) : cloneEmail(recommended);
  alternate.settings.theme = recommended.settings.theme === "mist" ? "classic" : "mist";
  for (const block of alternate.blocks) {
    if (block.type === "collection" && ["comparison", "metrics"].includes(block.variant)) block.content.stacked = true;
    if (block.type === "iconGrid") block.content.columns = "1";
    if (block.type === "imageText") block.variant = "image-top";
    if (block.type === "panel" && block.content.tone !== "plain") block.content.tone = "white";
  }
  return [recommended, alternate];
}
