import { timingSafeEqual } from "node:crypto";
import { ILLUSTRATION_PROMPT } from "./illustration-prompt.mjs";

const PROVIDER_ORIGIN = "https://gw.plusvibeapi.ru";
const PROVIDER_HOSTS = new Set(["gw.plusvibeapi.ru", "plusvibeapi.ru"]);
const MIRROR_ORIGIN = "https://calltouch-dsgn.website.yandexcloud.net";
const PROMPT_FIELDS = [
  "SCENE", "VIEW", "HERO OBJECT", "SUPPORTING OBJECTS", "INTERACTION", "COMPOSITION",
  "FORM AND PROPORTIONS", "UI CONSTRUCTION", "PALETTE", "ACCENT", "MATERIALS",
  "OBJECT SEPARATION", "LIGHTING", "SHADOWS", "BACKGROUND", "ASPECT RATIO", "NEGATIVE CONSTRAINTS"
];
const COPY_RULES = `Ты арт-директор Calltouch. Собери редактируемый черновик из брифа. Ответ только валидным JSON без Markdown-обёртки.
Если в ТЗ есть готовые тексты, CTA, даты, цифры, названия, условия и ссылки, сохрани их. Если ТЗ состоит из указаний, напиши нужный текст на его языке. Не выдумывай цены, сроки, статистику, условия и URL. Не включай служебные комментарии ТЗ в готовый текст. Верстку делает редактор, HTML запрещён.
visualIdea — короткое описание одной узнаваемой метафоры для фирменной 3D-иллюстрации, без букв, цифр, логотипов и служебных деталей ТЗ.`;
const DRAFT_PROMPTS = {
  banner: `Собери один комплект текста для семи форматов баннера, от квадрата до компактных вертикальных и горизонтальных. Короткий заголовок и только нужные элементы. Не сокращай готовый текст произвольно. Тема и схема зависят от ТЗ.
Формат {"title":"","subtitle":"","labels":["",""],"cta":"","additionalText":"","theme":"light|dark","composition":"classic|alternate","accent":"","visualIdea":""}.
accent — точная короткая подстрока заголовка для цветового акцента или пустая строка. Служебный текст, например erid, перенеси в additionalText.`,
  email: `Собери письмо из упорядоченных модулей. В начале заголовок или промо, где есть явный оффер; далее 1–2 разных типа осмысленных блоков. Набор преимуществ верстай сеткой только при 2–6 коротких тезисах, длинные списки оставляй текстом. Сохрани все смысловые секции, сноски, абзацы и ссылки. Не дублируй тезисы ради оформления. Для ссылок внутри текста используй [текст](https://...). CTA без URL оставь с пустым url. Болванки полей не выводи как текст.
Формат {"subject":"","preheader":"","theme":"classic|editorial","visualIdea":"","blocks":[{"type":"title|promo|text|benefits|cta","heading":"","body":"","eyebrow":"","offer":"","cta":"","url":"","items":[{"heading":"","body":""}]}],"footnotes":[""]}.
body в type title — подзаголовок, в type cta — пояснение. Поля можно опускать, когда они не нужны. Сноски передавай в исходном порядке, сохрани маркеры.`
};
const CAMPAIGN_PROMPT = `Из одного ТЗ собери согласованный комплект. Верни единый объект {"banner":{...},"email":{...},"visualIdea":""}, где banner и email следуют форматам ниже. Одна общая метафора visualIdea для обоих материалов.

Баннеры
${DRAFT_PROMPTS.banner}

Письмо
${DRAFT_PROMPTS.email}`;

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function field(value, limit) {
  const result = typeof value === "string" ? value.trim() : "";
  if (result.length > limit) throw new RequestError(422, "Текст слишком длинный для выбранного формата. Уточните ТЗ.");
  return result;
}

function modelObject(text) {
  try {
    const value = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/gi, ""));
    if (!value || Array.isArray(value) || typeof value !== "object") throw new Error();
    return value;
  } catch {
    throw new RequestError(502, "PlusVibe не вернул корректный JSON. Уточните ТЗ и повторите.");
  }
}

function briefLinks(brief) {
  return new Set((brief.match(/https:\/\/[^\s<>"'\])]+/gi) ?? []).map((url) => url.replace(/[.,;!?]+$/, "")));
}

function withBriefLinks(text, links) {
  return text.replace(/\[([^\]\n]+)\]\((https:\/\/[^\s)]+)\)|(https:\/\/[^\s<>"'\])]+)/gi, (match, label, markdownUrl, rawUrl) => {
    const url = markdownUrl || rawUrl.replace(/[.,;!?]+$/, "");
    return links.has(url) ? match : label || "";
  });
}

export function normalizeDraft(value, target, brief) {
  const visualIdea = field(value.visualIdea, 700);
  if (target === "campaign") {
    if (!value.banner || !value.email) throw new RequestError(502, "PlusVibe не вернул оба материала.");
    const banner = normalizeDraft(value.banner, "banner", brief);
    const email = normalizeDraft(value.email, "email", brief);
    return { banner, email, visualIdea: visualIdea || banner.visualIdea || email.visualIdea };
  }
  if (target === "banner") {
    const title = field(value.title, 160);
    if (!title) throw new RequestError(502, "В черновике баннера отсутствует заголовок.");
    const accent = field(value.accent, 48);
    return {
      title, accent: title.includes(accent) ? accent : "",
      subtitle: field(value.subtitle, 280),
      cta: field(value.cta, 48),
      additionalText: field(value.additionalText, 180),
      labels: Array.isArray(value.labels) ? value.labels.slice(0, 2).map((label) => field(label, 48)) : [],
      theme: value.theme === "dark" ? "dark" : "light",
      composition: value.composition === "alternate" ? "alternate" : "classic",
      visualIdea
    };
  }

  const links = briefLinks(brief);
  const types = new Set(["title", "promo", "text", "benefits", "cta"]);
  const clean = (input, max) => withBriefLinks(field(input, max), links);
  const blocks = (Array.isArray(value.blocks) ? value.blocks : []).filter((block) => types.has(block?.type)).map((block) => ({
    type: block.type,
    heading: clean(block.heading, 500),
    body: clean(block.body, 16000),
    eyebrow: clean(block.eyebrow, 150),
    offer: clean(block.offer, 2000),
    cta: clean(block.cta, 150),
    url: links.has(block.url) ? block.url : "",
    items: (Array.isArray(block.items) ? block.items : []).map((item) => ({
      heading: clean(item?.heading, 350), body: clean(item?.body, 5000)
    })).filter(({ heading, body }) => heading || body)
  })).filter(({ heading, body, eyebrow, offer, cta, items }) => heading || body || eyebrow || offer || cta || items.length);
  if (!blocks.length || blocks.length > 40) throw new RequestError(502, "PlusVibe не смог собрать структуру письма.");
  const footnotes = (Array.isArray(value.footnotes) ? value.footnotes : []).map((note) => clean(note, 3000)).filter(Boolean);
  return {
    subject: clean(value.subject, 180),
    preheader: clean(value.preheader, 500),
    theme: value.theme === "editorial" ? "editorial" : "classic",
    blocks, footnotes, visualIdea
  };
}

function authorizationMatches(header, token) {
  if (typeof header !== "string") return false;
  const supplied = Buffer.from(header);
  const expected = Buffer.from("Bearer " + token);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

async function providerCall(fetcher, key, path, body) {
  const timeout = path.startsWith("/api/media/") ? 10000 : 45000;
  const response = await fetcher(PROVIDER_ORIGIN + path, {
    method: body ? "POST" : "GET",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: body && JSON.stringify(body),
    redirect: "error",
    signal: AbortSignal.timeout(timeout)
  });
  const result = await response.json().catch(() => ({}));
  if (response.ok && !result.error && result.ok !== false) return result;
  if (response.status === 402) throw new RequestError(402, "На балансе PlusVibe недостаточно средств.");
  if (response.status === 429) throw new RequestError(429, "PlusVibe временно ограничил число запросов.");
  if (response.status === 404) throw new RequestError(404, "Задача PlusVibe не найдена или срок хранения истёк.");
  throw new RequestError(502, "PlusVibe не выполнил запрос. Проверьте настройки или повторите позже.");
}

async function textCompletion(fetcher, env, instructions, input, maxTokens) {
  const response = await providerCall(fetcher, env.PLUSVIBE_API_KEY, "/v1/chat/completions", {
    model: env.PLUSVIBE_TEXT_MODEL || "gpt-5.6-luna",
    messages: [{ role: "system", content: instructions }, { role: "user", content: input }],
    max_tokens: maxTokens
  });
  const choice = response.choices?.[0];
  const text = choice?.message?.content;
  if (choice?.finish_reason === "length" || typeof text !== "string" || !text.trim()) {
    throw new RequestError(502, "PlusVibe вернул неполный ответ. Уточните ТЗ или сократите его.");
  }
  return text.trim();
}

async function startIllustration(fetcher, env, idea, aspect) {
  const compiled = await textCompletion(fetcher, env, ILLUSTRATION_PROMPT,
    `Requested aspect ratio: ${aspect}\nVisual brief: ${idea}`, 2400);
  let fieldIndex = 0;
  for (const line of compiled.split("\n")) {
    if (line.startsWith(PROMPT_FIELDS[fieldIndex] + ":")) fieldIndex++;
  }
  if (!compiled.startsWith("SCENE:") || fieldIndex !== PROMPT_FIELDS.length || compiled.length > 12000) {
    throw new RequestError(502, "PlusVibe не собрал промпт иллюстрации по метапромпту.");
  }
  const task = await providerCall(fetcher, env.PLUSVIBE_API_KEY, "/api/media/generate", {
    model: "nano-banana-2.1",
    prompt: compiled,
    opts: { aspect_ratio: aspect, resolution: "1K", output_format: "png" }
  });
  if (typeof task.jobId !== "string" || !/^[\w-]{1,128}$/.test(task.jobId)) {
    throw new RequestError(502, "PlusVibe не вернул номер задачи изображения.");
  }
  return task.jobId;
}

async function illustrationStatus(fetcher, key, jobId) {
  if (typeof jobId !== "string" || !/^[\w-]{1,128}$/.test(jobId)) {
    throw new RequestError(400, "Некорректный номер задачи изображения.");
  }
  const job = await providerCall(fetcher, key, "/api/media/jobs/" + jobId);
  if (job.status === "processing" || job.status === "submitting") return null;
  if (job.status === "fail") throw new RequestError(422, "PlusVibe не смог сгенерировать картинку.");
  if (job.status !== "success" || typeof job.resultUrls?.[0] !== "string") {
    throw new RequestError(502, "PlusVibe не вернул готовую картинку.");
  }
  const url = new URL(job.resultUrls[0], PROVIDER_ORIGIN);
  if (url.protocol !== "https:" || !PROVIDER_HOSTS.has(url.host) || url.username || url.password
      || !url.pathname.startsWith("/api/media/file/")) {
    throw new RequestError(502, "PlusVibe вернул неизвестный адрес картинки.");
  }
  const response = await fetcher(url, { redirect: "error", signal: AbortSignal.timeout(20000) });
  const mime = response.headers.get("content-type")?.split(";")[0];
  if (!response.ok || !/^image\/(png|jpeg|webp)$/.test(mime)) throw new RequestError(502, "Не удалось скачать картинку PlusVibe.");
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 4_300_000) throw new RequestError(502, "Картинка превышает допустимый размер.");
    chunks.push(chunk);
  }
  if (!size) throw new RequestError(502, "PlusVibe вернул пустой файл.");
  return { bytes: Buffer.concat(chunks), mime };
}

function send(res, status, data, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(Buffer.isBuffer(data) ? data : JSON.stringify(data));
}

async function requestJson(req) {
  let value = req.body;
  if (value === undefined) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 128_000) throw new RequestError(413, "ТЗ превышает допустимый размер.");
      chunks.push(chunk);
    }
    value = Buffer.concat(chunks).toString("utf8");
  }
  try {
    if (typeof value === "string" || Buffer.isBuffer(value)) value = JSON.parse(value);
    if (!value || Array.isArray(value) || typeof value !== "object") throw new Error();
    return value;
  } catch {
    throw new RequestError(400, "Некорректный запрос.");
  }
}

export function createCreativeHandler({ env = process.env, localOrigin, fetcher = fetch } = {}) {
  return async (req, res) => {
    if (!localOrigin) {
      res.setHeader("Vary", "Origin");
      if (req.headers.origin === MIRROR_ORIGIN) {
        res.setHeader("Access-Control-Allow-Origin", MIRROR_ORIGIN);
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        if (req.method === "OPTIONS") {
          res.writeHead(204).end();
          return;
        }
      }
    }
    try {
      if (req.method !== "POST") throw new RequestError(405, "Используйте POST.");
      if (!req.headers["content-type"]?.toLowerCase().startsWith("application/json")) throw new RequestError(415, "Ожидается JSON.");
      const localAccess = localOrigin && req.headers.origin === localOrigin && req.headers.host === new URL(localOrigin).host;
      if (!env.PLUSVIBE_API_KEY || (!localOrigin && !env.AI_ACCESS_TOKEN)) {
        throw new RequestError(503, "ИИ не подключён на этом адресе.");
      }
      if (!localAccess && (!env.AI_ACCESS_TOKEN || !authorizationMatches(req.headers.authorization, env.AI_ACCESS_TOKEN))) {
        throw new RequestError(401, "Введите код доступа к генерации.");
      }
      const input = await requestJson(req);
      if (input.action === "status") {
        const image = await illustrationStatus(fetcher, env.PLUSVIBE_API_KEY, input.jobId);
        if (image) return send(res, 200, image.bytes, image.mime);
        return send(res, 202, { status: "processing" });
      }
      if (input.action === "illustration") {
        const idea = field(input.text, 900);
        if (!idea) throw new RequestError(400, "Опишите иллюстрацию.");
        const aspect = ["1:1", "4:3", "3:4", "16:9", "9:16"].includes(input.aspect) ? input.aspect : "1:1";
        return send(res, 202, { jobId: await startIllustration(fetcher, env, idea, aspect) });
      }
      if (input.action === "draft" && (input.target === "campaign" || Object.hasOwn(DRAFT_PROMPTS, input.target))) {
        const brief = field(input.text, 24000);
        if (!brief) throw new RequestError(400, "Добавьте текст ТЗ.");
        const instructions = input.target === "campaign" ? CAMPAIGN_PROMPT : DRAFT_PROMPTS[input.target];
        const text = await textCompletion(fetcher, env, COPY_RULES + "\n\n" + instructions, brief, input.target === "banner" ? 2600 : 12000);
        return send(res, 200, normalizeDraft(modelObject(text), input.target, brief));
      }
      throw new RequestError(400, "Выберите тип генерации.");
    } catch (error) {
      const message = error instanceof RequestError ? error.message : "Сервис PlusVibe временно недоступен.";
      send(res, error.status || 502, { error: message });
    }
  };
}
