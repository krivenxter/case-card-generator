import { createBlock, createDefaultEmail, createId } from "./email-model.js";
import { pickIconId } from "./email-parser.js";
import { forceDelaMarkup } from "./email-rich-text.js";

const joinParagraphs = (...parts) => parts.filter(Boolean).join("\n\n");

export function createIllustrationAsset(source, label) {
  return {
    id: createId("asset"),
    label: label || "Фирменная иллюстрация",
    previewSource: source,
    exportUrl: "",
    keywords: []
  };
}

export function buildAiEmail(draft, illustration) {
  const email = createDefaultEmail();
  email.meta.title = draft.subject || draft.blocks[0].heading || "Письмо Calltouch";
  email.meta.preheader = draft.preheader;
  email.settings.theme = draft.theme;
  email.footnotes = draft.footnotes.map((text) => ({ id: createId("note"), text: text.replace(/^\*+\s*/, "") }));

  const editorial = draft.theme === "editorial";
  email.blocks = draft.blocks.map(({ type, heading, body, eyebrow, offer, cta, url, items }) => {
    const destination = cta ? url || "{{cta_url}}" : "";
    if (type === "title" && heading) {
      return createBlock("title", {
        variant: editorial ? "plain" : "accent",
        content: { heading: forceDelaMarkup(heading), subtitle: body, accent: "" }
      });
    }
    if (type === "promo") {
      return createBlock("promo", {
        content: { heading: forceDelaMarkup(heading), eyebrow, offer: forceDelaMarkup(offer), body, ctaText: cta, ctaUrl: destination, image: null }
      });
    }
    if (type === "cta") {
      return createBlock("ctaCard", {
        variant: editorial ? "light" : "dark-gradient",
        content: { heading: forceDelaMarkup(heading), subtitle: body, ctaText: cta, ctaUrl: destination }
      });
    }
    if (type === "benefits" && !body && items.length >= 2 && items.length <= 6
      && items.every((item) => item.heading.length <= 80 && item.body.length <= 110)) {
      return createBlock("iconGrid", {
        content: {
          heading: forceDelaMarkup(heading),
          columns: items.length % 2 ? "1" : "2",
          items: items.map((item) => ({
            ...item,
            heading: forceDelaMarkup(item.heading),
            iconId: pickIconId(`${item.heading} ${item.body}`)
          }))
        }
      });
    }
    const list = items.map((item) => `- ${[item.heading, item.body].filter(Boolean).join(" — ")}`).join("\n");
    return createBlock("text", {
      content: { body: joinParagraphs(heading && `**${heading}**`, body, list) }
    });
  });

  if (illustration) {
    const asset = createIllustrationAsset(illustration, draft.visualIdea);
    const promo = email.blocks.find((block, index) => index < 2 && block.type === "promo");
    if (promo) {
      promo.content.image = asset;
    } else {
      const imageBlock = createBlock("image", { content: { image: asset, alt: asset.label } });
      email.blocks.splice(1, 0, imageBlock);
    }
  }
  return email;
}
