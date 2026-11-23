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
  banner: `Собери редактируемый комплект баннеров Calltouch. Короткий заголовок, живой подзаголовок и крупный кей-вижуал. Сохрани готовые тексты из ТЗ. CTA добавляй только по прямому указанию, а для рекламы без кнопки оставь cta пустым.
Формат {"title":"","subtitle":"","labels":["",""],"cta":"","additionalText":"","offer":{"value":"","caption":"","style":"cyan|purple|cyanPlate|purplePlate"},"theme":"light|dark","composition":"classic|alternate|campaign","profile":"split|reverse|editorial|offer|center","density":"auto|airy|compact","framing":"auto|contain|bleed","copyBackdrop":false,"backdrop":"library|violet|blue","backgroundIndex":"1","placements":false,"logo":true,"limitTextCoverage":false,"accent":"","visualIdea":""}.
Выбери profile под главную мысль. offer для ведущего числового оффера, editorial для сильного заголовка или объёмного текста со сносками, split или reverse для диалога текста и предмета, center для короткой симметричной композиции. Учитывай в том же решении объём текста и место под визуал. Для длинных сносок и сложного заголовка выбери compact, для короткой рекламы airy, в остальных случаях auto. contain сохраняет силуэт целиком, bleed разрешает обрезать его краями кадра. copyBackdrop включай, если тексту нужна контрастная подложка из-за сложного фона.
Для рекламной кампании выбери campaign. Если в ТЗ есть явно выделяемая скидка, бонус или цена, перенеси точное значение в offer.value, а его пояснение в offer.caption. Не повторяй их в subtitle. Не выделяй скидку или число, которого нет в ТЗ. В additionalText помести сноски, условия акции и ERID целиком, сохрани переносы между сносками. Accent — точная короткая подстрока заголовка. В placements поставь true, если в ТЗ есть 240 × 400, 960 × 150, 2184 × 270 или просьба включить допформаты. Logo false только по требованию ТЗ. LimitTextCoverage true только при явном ограничении площади текста до 20%. Для светлого фона используй library и backgroundIndex 1–6. Для тёмного фона с фиолетовым или синим пятном снизу используй violet или blue, для остальных фирменных фонов library и backgroundIndex 1–6.`,
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
    const offer = {
      value: field(value.offer?.value, 24),
      caption: field(value.offer?.caption, 100),
      style: ["cyan", "purple", "cyanPlate", "purplePlate"].includes(value.offer?.style) ? value.offer.style : "cyan"
    };
    return {
      title, accent: title.includes(accent) ? accent : "",
      subtitle: field(value.subtitle, 280),
      cta: field(value.cta, 48),
      additionalText: field(value.additionalText, 420),
      offer,
      labels: Array.isArray(value.labels) ? value.labels.slice(0, 2).map((label) => field(label, 48)) : [],
      theme: value.theme === "dark" ? "dark" : "light",
      composition: ["alternate", "campaign"].includes(value.composition) ? value.composition : "classic",
      profile: ["split", "reverse", "editorial", "offer", "center"].includes(value.profile) ? value.profile : "auto",
      density: ["airy", "compact"].includes(value.density) ? value.density : "auto",
      framing: ["contain", "bleed"].includes(value.framing) ? value.framing : "auto",
      copyBackdrop: value.copyBackdrop === true,
      backdrop: ["violet", "blue"].includes(value.backdrop) && value.theme === "dark" ? value.backdrop : "library",
      backgroundIndex: /^[1-6]$/.test(String(value.backgroundIndex)) ? String(value.backgroundIndex) : "1",
      placements: value.placements === true || /(?:240\s*[×xх]\s*400|960\s*[×xх]\s*150|2184\s*[×xх]\s*270)/iu.test(brief),
      logo: value.logo !== false,
      limitTextCoverage: value.limitTextCoverage === true,
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

async function providerCall(fetcher, key, path, body, signal, idempotencyKey) {
  const timeout = path.startsWith("/api/media/") ? 15000 : 135000;
  let response;
  try {
    response = await fetcher(PROVIDER_ORIGIN + path, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: "Bearer " + key, "Content-Type": "application/json",
        ...(idempotencyKey && { "Idempotency-Key": idempotencyKey })
      },
      body: body && JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.any([signal, AbortSignal.timeout(timeout)])
    });
  } catch (error) {
    if (signal.aborted || error.name === "TimeoutError") throw error;
    throw new RequestError(502, "Соединение с PlusVibe прервалось. Повторите запрос позже.");
  }
  const streamed = body?.stream && response.ok && response.headers.get("content-type")?.includes("text/event-stream");
  const result = streamed ? await readCompletionStream(response.body) : await response.json().catch(() => ({}));
  if (response.ok && !result.error && result.ok !== false) return result;
  if (response.status === 402) throw new RequestError(402, "На балансе PlusVibe недостаточно средств.");
  if (response.status === 429) throw new RequestError(429, "PlusVibe временно ограничил число запросов.");
  if (response.status === 404) throw new RequestError(404, "Задача PlusVibe не найдена или срок хранения истёк.");
  if (response.status === 403 && path === "/api/media/generate" && String(result.error).includes("список разрешённых моделей")) {
    throw new RequestError(403, "Добавьте Nano Banana 2.1 в список разрешённых моделей ключа PlusVibe.");
  }
  const code = result.error?.code ?? result.errorCode ?? result.code;
  const detail = typeof code === "string" && /^[a-z_0-9-]{1,70}$/i.test(code) ? ", " + code : "";
  const action = path === "/api/media/generate" ? "запуск иллюстрации" : "запрос";
  throw new RequestError(502, `PlusVibe отклонил ${action} (HTTP ${response.status}${detail}).`);
}

async function readCompletionStream(body) {
  let buffer = "";
  let content = "";
  let finishReason = "";
  try {
    for await (const chunk of body.pipeThrough(new TextDecoderStream())) {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return { choices: [{ message: { content }, finish_reason: finishReason }] };
        const event = JSON.parse(data);
        if (event.error) return event;
        const choice = event.choices?.[0];
        content += choice?.delta?.content || "";
        finishReason = choice?.finish_reason || finishReason;
      }
    }
  } catch (error) {
    if (error.name === "TimeoutError") throw error;
    throw new RequestError(502, "Поток ответа PlusVibe прервался.");
  }
  if (!finishReason) throw new RequestError(502, "Поток ответа PlusVibe завершился без результата.");
  return { choices: [{ message: { content }, finish_reason: finishReason }] };
}

async function textCompletion(fetcher, env, instructions, input, maxTokens, signal, json = false) {
  const model = json ? "gpt-6-luna" : "gemini-3.8-flash";
  const response = await providerCall(fetcher, env.PLUSVIBE_API_KEY, "/v1/chat/completions", {
    model,
    messages: [{ role: "system", content: instructions }, { role: "user", content: input }],
    max_tokens: maxTokens,
    ...(json && {
      reasoning_effort: "high",
      response_format: { type: "json_object" }
    }),
    ...(!json && { stream: true })
  }, signal);
  const choice = response.choices?.[0];
  const text = choice?.message?.content;
  if (choice?.finish_reason === "length" || typeof text !== "string" || !text.trim()) {
    throw new RequestError(502, "PlusVibe вернул неполный ответ. Уточните ТЗ или сократите его.");
  }
  return text.trim();
}

function validateCompiledPrompt(compiled) {
  if (typeof compiled !== "string" || !compiled.startsWith("SCENE:") || compiled.length > 12000) {
    throw new RequestError(422, "Промпт иллюстрации не соответствует метапромпту.");
  }
  let fieldIndex = 0;
  for (const line of compiled.split("\n")) {
    if (line.startsWith(PROMPT_FIELDS[fieldIndex] + ":")) fieldIndex++;
  }
  if (fieldIndex !== PROMPT_FIELDS.length) {
    throw new RequestError(422, "Промпт иллюстрации не соответствует метапромпту.");
  }
  return compiled;
}

async function startIllustration(fetcher, env, compiled, aspect, signal, requestId) {
  signal.throwIfAborted();
  const task = await providerCall(fetcher, env.PLUSVIBE_API_KEY, "/api/media/generate", {
    model: "nano-banana-2.1",
    prompt: compiled,
    opts: { aspect_ratio: aspect, resolution: "1K", output_format: "png" }
  }, signal, requestId);
  if (typeof task.jobId !== "string" || !/^[\w-]{1,128}$/.test(task.jobId)) {
    throw new RequestError(502, "PlusVibe не вернул номер задачи изображения.");
  }
  return task.jobId;
}

async function illustrationStatus(fetcher, key, jobId, signal) {
  if (typeof jobId !== "string" || !/^[\w-]{1,128}$/.test(jobId)) {
    throw new RequestError(400, "Некорректный номер задачи изображения.");
  }
  const job = await providerCall(fetcher, key, "/api/media/jobs/" + jobId, undefined, signal);
  if (job.status === "processing" || job.status === "submitting") return null;
  if (job.status === "fail") throw new RequestError(422, "PlusVibe не смог сгенерировать картинку.");
  if (job.status !== "success" || typeof job.resultUrls?.[0] !== "string") {
    throw new RequestError(502, "PlusVibe не вернул готовую картинку.");
  }
  const url = new URL(job.resultUrls[0], PROVIDER_ORIGIN);
  const resultPath = url.pathname.startsWith("/api/media/file/") || url.pathname.startsWith("/media/s3/results/");
  if (url.protocol !== "https:" || !PROVIDER_HOSTS.has(url.host) || url.username || url.password
      || !resultPath) {
    throw new RequestError(502, "PlusVibe вернул неизвестный адрес картинки.");
  }
  const response = await fetcher(url, { redirect: "error", signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]) });
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
    const client = new AbortController();
    res.once("close", () => { if (!res.writableFinished) client.abort(); });
    const { signal } = client;
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
        const image = await illustrationStatus(fetcher, env.PLUSVIBE_API_KEY, input.jobId, signal);
        if (image) return send(res, 200, image.bytes, image.mime);
        return send(res, 202, { status: "processing" });
      }
      const aspect = ["1:1", "4:3", "3:4", "16:9", "9:16"].includes(input.aspect) ? input.aspect : "1:1";
      if (input.action === "compile") {
        const idea = field(input.text, 900);
        if (!idea) throw new RequestError(400, "Опишите иллюстрацию.");
        const compiled = await textCompletion(fetcher, env, ILLUSTRATION_PROMPT,
          `Requested aspect ratio: ${aspect}\nVisual brief: ${idea}`, 2400, signal);
        return send(res, 200, { prompt: validateCompiledPrompt(compiled) });
      }
      if (input.action === "illustration") {
        if (typeof input.requestId !== "string" || !/^[\da-f-]{36}$/i.test(input.requestId)) {
          throw new RequestError(400, "Некорректный номер запроса иллюстрации.");
        }
        const compiled = validateCompiledPrompt(input.prompt);
        return send(res, 202, { jobId: await startIllustration(fetcher, env, compiled, aspect, signal, input.requestId) });
      }
      if (input.action === "draft" && (input.target === "campaign" || Object.hasOwn(DRAFT_PROMPTS, input.target))) {
        const brief = field(input.text, 24000);
        if (!brief) throw new RequestError(400, "Добавьте текст ТЗ.");
        const instructions = input.target === "campaign" ? CAMPAIGN_PROMPT : DRAFT_PROMPTS[input.target];
        const text = await textCompletion(fetcher, env, COPY_RULES + "\n\n" + instructions, brief, 12000, signal, true);
        return send(res, 200, normalizeDraft(modelObject(text), input.target, brief));
      }
      throw new RequestError(400, "Выберите тип генерации.");
    } catch (error) {
      if (signal.aborted) return;
      if (error.name === "TimeoutError") {
        send(res, 504, { error: "PlusVibe не успел ответить. Повторите запрос позже." });
        return;
      }
      const message = error instanceof RequestError ? error.message : "Сервис PlusVibe временно недоступен.";
      send(res, error.status || 502, { error: message });
    }
  };
}
