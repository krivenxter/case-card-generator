const API = location.origin === "https://calltouch-dsgn.website.yandexcloud.net"
  ? "https://case-carder.vercel.app/api/creative-ai"
  : "/api/creative-ai";
export const EMAIL_HANDOFF_KEY = "calltouch-ai-email-handoff-v1";
let accessToken = "";

async function requestAi(input, signal) {
  let response;
  try {
    response = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(accessToken && { Authorization: "Bearer " + accessToken }) },
      body: JSON.stringify(input),
      signal
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw Object.assign(new Error("Связь с генератором прервалась."), { status: 503 });
  }
  if (response.ok && response.headers.get("Content-Type")?.startsWith("image/")) return response.blob();
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !Object.keys(result).length) {
    const message = result.error || (response.status === 404 || response.status === 405
      ? "ИИ не подключён на этом адресе."
      : "Не удалось получить ответ генератора.");
    throw Object.assign(new Error(message), { status: response.status });
  }
  return result;
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}

async function pollIllustration(jobId, signal) {
  const deadline = Date.now() + 240_000;
  let delay = 4000;
  while (Date.now() < deadline) {
    await wait(delay, signal);
    try {
      const result = await requestAi({ action: "status", jobId }, signal);
      if (result instanceof Blob) return result;
    } catch (error) {
      if (signal.aborted || ![429, 502, 503, 504].includes(error.status)) throw error;
    }
    delay = Math.min(Math.round(delay * 1.35), 16000);
  }
  throw new Error("Иллюстрация ещё не готова. Можно продолжить ожидание той же задачи.");
}

function fileAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Не удалось прочитать иллюстрацию."));
    reader.readAsDataURL(blob);
  });
}

function removeWhiteBackdrop(pixels, width, height) {
  const visited = new Uint8Array(width * height);
  const queue = new Uint32Array(width * height);
  let head = 0;
  let length = 0;
  const visit = (index) => {
    if (visited[index]) return;
    visited[index] = 1;
    const offset = index * 4;
    const min = Math.min(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
    const max = Math.max(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
    if (pixels[offset + 3] !== 0 && (min < 241 || max - min > 12)) return;
    pixels[offset + 3] = min >= 249 ? 0 : Math.min(pixels[offset + 3], Math.round((249 - min) * 28));
    queue[length++] = index;
  };
  for (let x = 0; x < width; x++) {
    visit(x);
    visit((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    visit(y * width);
    visit((y + 1) * width - 1);
  }
  while (head < length) {
    const index = queue[head++];
    const x = index % width;
    if (x > 0) visit(index - 1);
    if (x < width - 1) visit(index + 1);
    if (index >= width) visit(index - width);
    if (index < (height - 1) * width) visit(index + width);
  }
}

export async function prepareIllustration(blob, target) {
  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, (target === "email" ? 768 : 1152) / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    removeWhiteBackdrop(image.data, canvas.width, canvas.height);
    context.putImageData(image, 0, 0);
    const format = target === "email" ? "image/png" : "image/webp";
    const result = await new Promise((resolve) => canvas.toBlob(resolve, format, 0.92));
    if (!result) throw new Error("Не удалось подготовить иллюстрацию.");
    return fileAsDataUrl(result);
  } finally {
    bitmap.close();
  }
}

export function openCreativeAi({ target, mode, initialText = "", apply }) {
  const isImage = mode === "illustration";
  const title = isImage ? "Создать иллюстрацию" : target === "banner" ? "Собрать баннеры из ТЗ" : "Собрать письмо из ТЗ";
  const dialog = document.createElement("dialog");
  dialog.className = "creative-ai-dialog";
  dialog.setAttribute("aria-labelledby", "creativeAiTitle");
  dialog.innerHTML = `
    <form class="creative-ai-form">
      <h2 id="creativeAiTitle">${title}</h2>
      <label class="creative-ai-field">
        <span>${isImage ? "Что изобразить" : "Текст ТЗ"}</span>
        <textarea name="text" rows="${isImage ? 4 : 7}" maxlength="${isImage ? 900 : 24000}" required autofocus
          placeholder="${isImage ? "Например, сквозная аналитика как монитор с диаграммой" : "Тема, готовые тексты, оффер, ссылки и требования к оформлению"}"></textarea>
      </label>
      ${isImage ? `<label class="creative-ai-field"><span>Формат иллюстрации</span><select name="aspect">
        <option value="1:1">Квадрат, 1:1</option><option value="4:3">Горизонтальный, 4:3</option>
        <option value="3:4">Вертикальный, 3:4</option><option value="16:9">Широкий, 16:9</option><option value="9:16">Вертикальный, 9:16</option>
      </select></label>` : `<label class="creative-ai-check"><input name="withImage" type="checkbox" checked><span>Сгенерировать фирменную иллюстрацию</span></label>
      ${target === "banner" ? `<label class="creative-ai-check"><input name="withEmail" type="checkbox"><span>Также собрать письмо по этому ТЗ</span></label>
      <p class="creative-ai-note">Черновик заменит текущие баннеры. Изменения можно отменить.</p>` : ""}`}
      <label class="creative-ai-field" hidden><span>Код доступа к ИИ</span><input name="token" type="password" autocomplete="off" maxlength="256"></label>
      <p class="creative-ai-status" role="status" aria-live="polite" hidden></p>
      <div class="creative-ai-actions">
        <button class="panel-button panel-button--quiet" type="button" data-close>Отмена</button>
        <button class="panel-button" type="button" data-skip hidden>Открыть без картинки</button>
        <button class="panel-button panel-button--primary" type="submit">${isImage ? "Сгенерировать" : "Собрать из ТЗ"}</button>
      </div>
    </form>`;
  document.body.append(dialog);

  const form = dialog.querySelector("form");
  const { text, token, withImage, withEmail, aspect } = form.elements;
  const status = form.querySelector("[role=status]");
  const submit = form.querySelector('[type="submit"]');
  const skip = form.querySelector("[data-skip]");
  const submitLabel = submit.textContent;
  const controller = new AbortController();
  let draft;
  let compiledPrompt;
  let requestId;
  let jobId;
  let resultImage;
  let emailImage;
  let generatedImage;
  let running = false;

  const report = (message, error = false) => {
    status.hidden = !message;
    status.textContent = message;
    status.classList.toggle("is-error", error);
  };
  const finish = async (image, emailIllustration) => {
    await apply({ draft, image, emailIllustration, idea: isImage ? text.value.trim() : draft?.visualIdea });
    dialog.close();
  };
  const setBusy = (busy) => {
    running = busy;
    submit.disabled = busy;
    token.disabled = busy;
    text.readOnly = busy || Boolean(draft || compiledPrompt);
    if (withImage) withImage.disabled = busy || Boolean(draft);
    if (withEmail) withEmail.disabled = busy || Boolean(draft);
    if (aspect) aspect.disabled = busy || Boolean(compiledPrompt);
    skip.hidden = busy || !draft;
    submit.textContent = busy ? "Генерация…" : jobId ? "Проверить задачу" : draft ? "Повторить генерацию картинки" : submitLabel;
    form.setAttribute("aria-busy", String(busy));
  };

  text.value = initialText;
  dialog.addEventListener("close", () => {
    controller.abort();
    dialog.remove();
  }, { once: true });
  form.querySelector("[data-close]").addEventListener("click", () => dialog.close());
  skip.addEventListener("click", async () => {
    setBusy(true);
    try {
      await finish();
    } catch (error) {
      report(error.message, true);
    } finally {
      if (dialog.open) setBusy(false);
    }
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (running) return;
    const input = text.value.trim();
    if (!input) return report("Добавьте текст.", true);
    if (!token.closest("label").hidden) accessToken = token.value.trim();
    const signal = controller.signal;
    setBusy(true);
    try {
      if (!isImage && !draft) {
        report("ИИ собирает структуру и текст…");
        draft = await requestAi({ action: "draft", target: withEmail?.checked ? "campaign" : target, text: input }, signal);
      }
      if (isImage || withImage?.checked) {
        if (!resultImage) {
          if (!jobId) {
            const ratio = aspect?.value || "1:1";
            if (!compiledPrompt) {
              report("Готовим промпт для Nano Banana 2.1…");
              const idea = isImage ? input : draft.visualIdea || draft.title || draft.banner?.title || draft.subject || draft.blocks?.[0]?.heading;
              if (!idea) throw new Error("Для иллюстрации нужна короткая идея.");
              ({ prompt: compiledPrompt } = await requestAi({ action: "compile", text: idea.slice(0, 900), aspect: ratio }, signal));
            }
            report("Отправляем иллюстрацию в Nano Banana 2.1…");
            requestId ||= crypto.randomUUID();
            ({ jobId } = await requestAi({ action: "illustration", prompt: compiledPrompt, aspect: ratio, requestId }, signal));
            if (!jobId) throw new Error("Генератор не вернул номер задачи.");
          }
          report("Nano Banana 2.1 рисует иллюстрацию…");
          generatedImage ??= await pollIllustration(jobId, signal);
          resultImage = await prepareIllustration(generatedImage, target);
        }
        if (draft?.email && !emailImage) emailImage = await prepareIllustration(generatedImage, "email");
      }
      signal.throwIfAborted();
      await finish(resultImage, emailImage);
    } catch (error) {
      if (signal.aborted) return;
      if (error.status === 401) {
        token.closest("label").hidden = false;
        token.required = true;
        token.value = "";
      }
      if (jobId && (error.status === 404 || error.status === 422)) {
        jobId = undefined;
        requestId = undefined;
      }
      report(error.message || "Не удалось завершить генерацию.", true);
    } finally {
      if (!signal.aborted) {
        setBusy(false);
        if (!token.closest("label").hidden && !token.value) token.focus();
      }
    }
  });
  dialog.showModal();
}
