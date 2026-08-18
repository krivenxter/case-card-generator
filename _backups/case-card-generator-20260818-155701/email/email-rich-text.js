const WRAPPERS = [
  ["{{dela|", { type: "dela", close: "}}" }],
  ["{{cyan|", { type: "tone", value: "cyan", close: "}}" }],
  ["{{purple|", { type: "tone", value: "purple", close: "}}" }],
  ["{{pill|", { type: "pill", close: "}}" }]
];

export function parseRichMarkup(value = "") {
  const source = String(value)
    .replace(/%%\{\{(cyan|purple|pill)\|%%([\s\S]*?)%%\}\}%%/g, "{{$1|{{dela|$2}}}}")
    .replace(/\{\{(cyan|purple|pill)\|%%([\s\S]*?)\}\}%%/g, "{{$1|{{dela|$2}}}}")
    .replace(/\{\{(cyan|purple|pill)\|%%([\s\S]*?)%%\}\}/g, "{{$1|{{dela|$2}}}}");
  const stack = [];
  const runs = [];
  const state = () => ({
    bold: stack.some((item) => item.type === "bold"),
    dela: stack.some((item) => item.type === "dela"),
    pill: stack.some((item) => item.type === "pill"),
    tone: [...stack].reverse().find((item) => item.type === "tone")?.value || ""
  });
  const append = (text) => {
    if (!text) return;
    const next = state();
    const previous = runs.at(-1);
    if (previous && previous.bold === next.bold && previous.dela === next.dela && previous.pill === next.pill && previous.tone === next.tone) previous.text += text;
    else runs.push({ text, ...next });
  };
  const closeLast = (token) => {
    let index = stack.length - 1;
    while (index >= 0 && stack[index].close !== token) index -= 1;
    if (index < 0) return false;
    stack.splice(index, 1);
    return true;
  };

  for (let index = 0; index < source.length;) {
    const wrapper = WRAPPERS.find(([prefix]) => source.startsWith(prefix, index));
    if (wrapper) {
      stack.push({ ...wrapper[1] });
      index += wrapper[0].length;
      continue;
    }
    if (source.startsWith("}}", index) && closeLast("}}")) {
      index += 2;
      continue;
    }
    if (source.startsWith("**", index)) {
      if (!closeLast("**")) stack.push({ type: "bold", close: "**" });
      index += 2;
      continue;
    }
    if (source[index] === "%") {
      let end = index;
      while (source[end] === "%") end += 1;
      const count = end - index;
      if (count === 1) append("%");
      else {
        if (count % 2) append("%");
        for (let pair = 0; pair < Math.floor(count / 2); pair += 1) {
          if (!closeLast("%%")) stack.push({ type: "dela", close: "%%" });
        }
      }
      index = end;
      continue;
    }
    append(source[index]);
    index += 1;
  }
  return runs;
}

export function serializeRichRuns(runs) {
  return runs.map((run) => {
    let text = run.text;
    if (run.bold) text = `**${text}**`;
    if (run.dela) text = `{{dela|${text}}}`;
    if (run.pill) text = `{{pill|${text}}}`;
    if (run.tone) text = `{{${run.tone}|${text}}}`;
    return text;
  }).join("");
}

export function normalizeRichMarkup(value = "") {
  return serializeRichRuns(parseRichMarkup(value));
}

export function hasDelaMarkup(value = "") {
  return parseRichMarkup(value).some((run) => run.dela && run.text.trim());
}

export function richPlainText(value = "") {
  return parseRichMarkup(value).map((run) => run.text).join("");
}

// Денежные пороги должны переноситься целиком: «от 1 млн ₽*», «500 тыс. ₽*».
// Иначе браузер может разорвать выражение между числом и единицей измерения.
export function bindDelaAmountPhrases(value = "") {
  return String(value).replace(/(?<![\p{L}\d])((?:(?:от|до)\s+)?\d+(?:[.,]\s*\d+)?(?:\s+(?:млн|тыс|млрд|руб\.?)\.?)*(?:\s+₽)?\*?)/giu, (match) => match.replace(/\s+/g, "\u00a0"));
}

export function delaSegments(value = "") {
  return parseRichMarkup(value).filter((run) => run.dela && run.text.trim());
}

export function forceDelaMarkup(value = "") {
  return serializeRichRuns(parseRichMarkup(value).map((run) => ({ ...run, dela: true })));
}

export function toggleDelaMarkup(value = "") {
  const runs = parseRichMarkup(value);
  const enabled = !runs.filter((run) => run.text.trim()).every((run) => run.dela);
  return serializeRichRuns(runs.map((run) => ({ ...run, dela: enabled })));
}

export function toggleToneMarkup(value = "", tone = "cyan") {
  const runs = parseRichMarkup(value);
  const enabled = !runs.filter((run) => run.text.trim()).every((run) => run.tone === tone);
  return serializeRichRuns(runs.map((run) => ({ ...run, tone: enabled ? tone : "" })));
}

export function togglePillMarkup(value = "") {
  const runs = parseRichMarkup(value);
  const enabled = !runs.filter((run) => run.text.trim()).every((run) => run.pill);
  return serializeRichRuns(runs.map((run) => ({ ...run, pill: enabled })));
}
