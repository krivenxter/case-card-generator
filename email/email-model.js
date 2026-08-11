export const EMAIL_STORAGE_KEY = "calltouch-email-project-v1";

export const EMAIL_TOKENS = Object.freeze({
  colors: Object.freeze({ navy: "#084E7D", deepNavy: "#20293D", cyan: "#33bfe2", lightCyan: "#c1ecfb", pale: "#E1F5FB", white: "#FFFFFF", ink: "#1F282C", muted: "#68757B", purple: "#9C2EDD", magenta: "#D958E5", brightnavy: "#0073ef" }),
  radius: Object.freeze({ small: 14, large: 28, pill: 999 }),
  spacing: Object.freeze({ s: 12, m: 20, l: 32, xl: 48 })
});

export const DELA_FONT_SIZES = Object.freeze({ small: 16, large: 22 });

export const SYSTEM_LINKS = Object.freeze({
  webVersion: "{{link_view_in_browser}}",
  unsubscribe: "{{link_unsubscribe}}"
});

export const BLOCK_DEFINITIONS = Object.freeze([
  { type: "title", label: "Заголовок", icon: "type", description: "Крупный заголовок или заголовок с пояснением" },
  { type: "text", label: "Текст", icon: "align-left", description: "Абзацы, ссылки и простой список" },
  { type: "promo", label: "Акция / Promo", icon: "badge-percent", description: "Продуктовый hero с оффером и CTA" },
  { type: "imageText", label: "Картинка + текст", icon: "panel-left", description: "Безопасная композиция в две колонки" },
  { type: "image", label: "Картинка", icon: "image", description: "Изображение на всю ширину сетки" },
  { type: "brandTitle", label: "Заголовок Dela", icon: "heading-1", description: "Фирменный заголовок на контрастном фоне" },
  { type: "brandScene", label: "Фирменная композиция", icon: "layers-3", description: "Dela, градиент и иллюстрация единым изображением" },
  { type: "featureCard", label: "Карточка", icon: "gallery-horizontal", description: "Изображение, заголовок и описание" },
  { type: "iconGrid", label: "Преимущества", icon: "layout-grid", description: "Четыре тезиса в сетке 2 × 2" },
  { type: "ctaCard", label: "Финальный CTA", icon: "megaphone", description: "Крупный финальный призыв" },
  { type: "button", label: "Кнопка", icon: "mouse-pointer-click", description: "Отдельная CTA-кнопка" },
  { type: "divider", label: "Разделитель", icon: "minus", description: "Системный вертикальный интервал" }
]);

let blockSequence = 0;
export function createId(prefix = "block") {
  blockSequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${blockSequence}`;
}

const firstAsset = () => window.CALLTOUCH_ASSETS.visuals[0];

export function createBlock(type, overrides = {}) {
  const asset = firstAsset();
  const base = {
    id: createId(),
    type,
    variant: "default",
    content: {},
    settings: {}
  };
  const presets = {
    title: { variant: "accent", content: { bigNumber: "", heading: "Заголовок письма", subtitle: "Коротко объясните, какую пользу получит читатель.", accent: "письма", plate: "" } },
    text: { content: { plate: "", listStyle: "bullet", body: "Добавьте основной текст. Разделяйте абзацы пустой строкой, а пункты списка начинайте с дефиса." } },
    promo: { variant: "dark", content: { eyebrow: "Специальное предложение", eyebrowTone: "purple", bigNumber: "", heading: "Решение для роста бизнеса", offer: "0 ₽", body: "Расскажите об условиях предложения и главной выгоде.", bodySize: "14", ctaText: "Подключить", ctaUrl: "https://calltouch.ru/", linkUrl: "", gradient: true, image: asset } },
    imageText: { variant: "image-left", content: { heading: "Как это работает", body: "Коротко опишите продукт, сценарий или преимущество.", linkText: "Подробнее", linkUrl: "https://calltouch.ru/", image: asset } },
    image: { content: { image: asset, alt: "", linkUrl: "" } },
    brandTitle: { variant: "light-cyan", content: { heading: "ЗАГОЛОВОК DELA", backgroundColor: EMAIL_TOKENS.colors.lightCyan, textTone: "auto", renderedUrl: "", renderedSignature: "", renderedAt: "" } },
    brandScene: { variant: "navy-purple", content: { heading: "ЗАГОЛОВОК ФИРМЕННОГО БЛОКА", body: "— Первый важный тезис\n— Второй важный тезис\n— Третий важный тезис", alt: "Фирменный информационный блок Calltouch", linkUrl: "https://calltouch.ru/", image: asset, background: null, renderedUrl: "", renderedSignature: "", renderedAt: "" } },
    featureCard: { variant: "image-left", content: { heading: "Преимущество", body: "Объясните пользу одним коротким абзацем.", image: asset } },
    iconGrid: { variant: "light", content: { heading: "", columns: "2", items: [
      { heading: "Быстрый старт", body: "Без сложной настройки", iconId: "send" },
      { heading: "Понятный результат", body: "Все важное перед глазами", iconId: "verify" },
      { heading: "Экономия времени", body: "Меньше ручной работы", iconId: "clock" },
      { heading: "Поддержка", body: "Команда всегда на связи", iconId: "message" }
    ] } },
    ctaCard: { variant: "dark-gradient", content: { heading: "Попробуйте Calltouch прямо сейчас", subtitle: "Оставьте заявку — мы поможем выбрать решение.", ctaText: "Оставить заявку", ctaUrl: "https://calltouch.ru/", align: "center" } },
    button: { variant: "primary", content: { text: "Подробнее", url: "https://calltouch.ru/", align: "center" } },
    divider: { variant: "m", content: {} }
  };
  const preset = presets[type] || presets.text;
  return {
    ...base,
    ...preset,
    ...overrides,
    content: { ...preset.content, ...(overrides.content || {}) },
    settings: { ...preset.settings, ...(overrides.settings || {}), hidden: Boolean(overrides.settings?.hidden || preset.settings?.hidden) }
  };
}

export function createDefaultEmail() {
  return {
    version: 1,
    settings: { theme: "classic", logo: "dark", preview: "desktop" },
    blocks: [
      createBlock("title"),
      createBlock("promo"),
      createBlock("iconGrid"),
      createBlock("ctaCard")
    ],
    footnotes: [],
    meta: { title: "Новое письмо Calltouch", createdAt: new Date().toISOString() }
  };
}

export function cloneEmail(email) {
  return JSON.parse(JSON.stringify(email));
}
