import { cloneEmail, createBlock, createDefaultEmail, createId } from "./email-model.js";
import { pickIconId } from "./email-parser.js";
import { forceDelaMarkup } from "./email-rich-text.js";

const joinParagraphs = (...parts) => parts.filter(Boolean).join("\n\n");
const collections = ["agenda", "resources", "comparison", "steps"];

function brandedHeading(heading, accent) {
  const text = accent && heading.includes(accent)
    ? heading.replace(accent, () => `{{cyan|${accent}}}`) : heading;
  return forceDelaMarkup(text);
}

export async function renderEmailBannerCover(draft, illustration) {
  if (draft.cover !== "banner" || !draft.coverBanner || !illustration) return "";
  const frame = document.createElement("iframe");
  frame.title = "Рендер обложки письма";
  frame.setAttribute("aria-hidden", "true");
  frame.inert = true;
  frame.style.cssText = "position:fixed;left:-2000px;top:0;width:1480px;height:900px;border:0;pointer-events:none;";
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Баннерный редактор не успел загрузиться.")), 20000);
      frame.addEventListener("load", () => { clearTimeout(timeout); resolve(); }, { once: true });
      frame.src = new URL("../index.html?tool=banners&embedded=1&email-cover=1", import.meta.url);
      document.body.append(frame);
    });
    if (typeof frame.contentWindow?.renderEmailBannerJpg !== "function") throw new Error("Баннерный редактор недоступен.");
    return await frame.contentWindow.renderEmailBannerJpg(draft.coverBanner, illustration);
  } finally {
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

export function buildAiEmail(draft, illustration, coverImage = "") {
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
    if (type === "title" && heading) {
      return createBlock("title", {
        variant: "accent",
        content: { heading: headingMarkup, subtitle: body, accent: "", plate: tone === "white" ? "1" : "" }
      });
    }
    if (type === "promo") {
      return createBlock("promo", {
        content: { heading: headingMarkup, eyebrow, offer: forceDelaMarkup(offer), body, bodySize: "16", ctaText: cta, ctaUrl: destination, image: null }
      });
    }
    if (type === "cta") {
      return createBlock("ctaCard", {
        variant: editorial ? "light" : "dark-gradient",
        content: { heading: headingMarkup, subtitle: body, ctaText: cta, ctaUrl: destination }
      });
    }
    if (type === "button") return createBlock("button", { variant: "secondary", content: { text: cta, url: destination, align: "left" } });
    if (type === "feature") {
      return createBlock("imageText", {
        variant: featured++ % 2 ? "image-right" : "image-left",
        content: { heading: headingMarkup, body, linkText: cta, linkUrl: destination, image: null, plate: tone === "plain" && !editorial ? "0" : "1" }
      });
    }
    if (type === "panel" || (collections.includes(type) && items.length)) {
      return createBlock(type === "panel" ? "panel" : "collection", {
        variant: type === "panel" ? "default" : type,
        content: {
          heading: headingMarkup, eyebrow, body, ctaText: cta, ctaUrl: destination, tone: tone || "white",
          ...(type !== "panel" && { items: items.map((item) => ({
            heading: brandedHeading(item.heading, ""), eyebrow: item.eyebrow || "", body: item.body,
            ctaText: item.cta || "", ctaUrl: item.cta ? item.url || "{{cta_url}}" : ""
          })) })
        }
      });
    }
    if (type === "benefits" && !body && items.length >= 2 && items.length <= 6
      && items.every((item) => item.heading.length <= 80 && item.body.length <= 110)) {
      return createBlock("iconGrid", {
        content: {
          heading: headingMarkup,
          columns: items.length % 2 ? "1" : "2",
          items: items.map((item) => ({
            ...item,
            heading: forceDelaMarkup(item.heading),
            iconId: pickIconId(`${item.heading} ${item.body}`)
          }))
        }
      });
    }
    const list = items.map((item) => `- ${[item.eyebrow, item.heading, item.body,
      item.cta && (item.url ? `[${item.cta}](${item.url})` : item.cta)].filter(Boolean).join(" — ")}`).join("\n");
    return createBlock("text", {
      content: { body: joinParagraphs(heading && `**${heading}**`, body, list), plate: tone === "white" ? "1" : "" }
    });
  });

  if (coverImage) {
    const alt = draft.coverAlt || draft.coverBanner?.title || draft.subject;
    email.blocks.unshift(createBannerEmailBlock(coverImage, alt));
  } else if (illustration && draft.cover !== "none") {
    const asset = createIllustrationAsset(illustration, draft.coverAlt || draft.visualIdea);
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

export function buildAiEmailVariants(draft, illustration, coverImage) {
  const recommended = buildAiEmail(draft, illustration, coverImage);
  const alternateCover = draft.cover === "banner" ? "inline" : "banner";
  const alternate = illustration ? buildAiEmail({ ...draft, cover: alternateCover }, illustration) : cloneEmail(recommended);
  for (const block of alternate.blocks) {
    if (block.type === "collection" && block.variant === "comparison") block.content.stacked = true;
    if (block.type === "iconGrid") block.content.columns = "1";
    if (block.type === "imageText") block.variant = "image-top";
    if (block.type === "panel" && block.content.tone !== "plain") block.content.tone = "white";
  }
  return [recommended, alternate];
}
