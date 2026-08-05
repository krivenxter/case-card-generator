(function attachDomExport(global) {
  "use strict";

  const XHTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
  const URL_PATTERN = /url\((['"]?)(.*?)\1\)/g;
  const resourceCache = new Map();

  function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error("Не удалось прочитать ресурс"));
      reader.readAsDataURL(blob);
    });
  }

  async function urlToDataUrl(rawUrl, cacheBust) {
    if (!rawUrl || rawUrl.startsWith("data:") || rawUrl.startsWith("blob:") || rawUrl.startsWith("#")) {
      return rawUrl;
    }

    const absoluteUrl = new URL(rawUrl, document.baseURI).href;
    const cacheKey = `${absoluteUrl}|${cacheBust ? "fresh" : "cached"}`;

    if (resourceCache.has(cacheKey)) {
      return resourceCache.get(cacheKey);
    }

    const promise = (async () => {
      const requestUrl = cacheBust
        ? `${absoluteUrl}${absoluteUrl.includes("?") ? "&" : "?"}dom-export=${Date.now()}`
        : absoluteUrl;

      const response = await fetch(requestUrl, { cache: cacheBust ? "no-store" : "force-cache" });
      if (!response.ok) {
        throw new Error(`Не удалось загрузить ресурс: ${rawUrl}`);
      }

      return blobToDataUrl(await response.blob());
    })();

    resourceCache.set(cacheKey, promise);
    return promise;
  }

  async function inlineCssUrls(cssValue, cacheBust) {
    if (!cssValue || !cssValue.includes("url(")) {
      return cssValue;
    }

    const matches = [...cssValue.matchAll(URL_PATTERN)];
    let result = cssValue;

    for (const match of matches) {
      const original = match[0];
      const resourceUrl = match[2];

      try {
        const dataUrl = await urlToDataUrl(resourceUrl, cacheBust);
        result = result.replace(original, `url("${dataUrl}")`);
      } catch (error) {
        console.warn(error);
      }
    }

    return result;
  }

  function copyFormState(source, clone) {
    if (source instanceof HTMLTextAreaElement) {
      clone.textContent = source.value;
    }

    if (source instanceof HTMLInputElement) {
      clone.setAttribute("value", source.value);
      if (source.checked) {
        clone.setAttribute("checked", "");
      } else {
        clone.removeAttribute("checked");
      }
    }

    if (source instanceof HTMLSelectElement) {
      Array.from(clone.options).forEach((option, index) => {
        option.selected = source.options[index]?.selected ?? false;
      });
    }
  }

  async function copyComputedStyles(source, clone, cacheBust) {
    const computedStyle = getComputedStyle(source);

    for (const property of computedStyle) {
      let value = computedStyle.getPropertyValue(property);
      if (value.includes("url(")) {
        value = await inlineCssUrls(value, cacheBust);
      }
      clone.style.setProperty(property, value, computedStyle.getPropertyPriority(property));
    }

    clone.style.setProperty("animation", "none", "important");
    clone.style.setProperty("transition", "none", "important");
    copyFormState(source, clone);
  }

  async function cloneNodeWithStyles(source, cacheBust) {
    const clone = source.cloneNode(false);

    if (source.nodeType === Node.ELEMENT_NODE) {
      await copyComputedStyles(source, clone, cacheBust);
    }

    const sourceChildren = Array.from(source.childNodes);
    for (const child of sourceChildren) {
      if (child.nodeType === Node.TEXT_NODE) {
        clone.appendChild(child.cloneNode(true));
        continue;
      }

      if (child.nodeType === Node.ELEMENT_NODE) {
        clone.appendChild(await cloneNodeWithStyles(child, cacheBust));
      }
    }

    return clone;
  }

  async function buildFontCss(fontFaces, cacheBust) {
    if (!Array.isArray(fontFaces) || fontFaces.length === 0) {
      return "";
    }

    const declarations = [];

    for (const face of fontFaces) {
      try {
        const dataUrl = await urlToDataUrl(face.src, cacheBust);
        declarations.push(`
          @font-face {
            font-family: "${String(face.family).replaceAll('"', '\\"')}";
            src: url("${dataUrl}") format("${face.format || "woff2"}");
            font-style: ${face.style || "normal"};
            font-weight: ${face.weight || "400"};
          }
        `);
      } catch (error) {
        console.warn(`Шрифт ${face.family} не встроен в экспорт.`, error);
      }
    }

    return declarations.join("\n");
  }

  function serializeSvg(clone, width, height, fontCss) {
    clone.setAttribute("xmlns", XHTML_NAMESPACE);
    clone.style.setProperty("width", `${width}px`, "important");
    clone.style.setProperty("height", `${height}px`, "important");
    clone.style.setProperty("max-width", "none", "important");
    clone.style.setProperty("max-height", "none", "important");
    clone.style.setProperty("transform", "none", "important");

    const xhtml = `
      <div xmlns="${XHTML_NAMESPACE}" style="width:${width}px;height:${height}px;overflow:hidden;">
        <style>${fontCss}</style>
        ${clone.outerHTML}
      </div>
    `;

    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <foreignObject x="0" y="0" width="100%" height="100%">
          ${xhtml}
        </foreignObject>
      </svg>
    `;
  }

  function svgToImage(svgMarkup) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;

      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Браузер не смог отрисовать SVG-копию слайда"));
      image.src = dataUrl;
    });
  }

  async function toCanvas(node, options) {
    if (!(node instanceof HTMLElement)) {
      throw new TypeError("DomExport.toCanvas ожидает HTMLElement");
    }

    const settings = {
      width: Math.round(options?.width || node.offsetWidth),
      height: Math.round(options?.height || node.offsetHeight),
      pixelRatio: Math.max(1, Number(options?.pixelRatio) || 1),
      cacheBust: Boolean(options?.cacheBust),
      backgroundColor: options?.backgroundColor || null,
      fontFaces: options?.fontFaces || []
    };

    await document.fonts.ready;
    await nextFrame();

    const clone = await cloneNodeWithStyles(node, settings.cacheBust);
    const fontCss = await buildFontCss(settings.fontFaces, settings.cacheBust);
    const svgMarkup = serializeSvg(clone, settings.width, settings.height, fontCss);
    const image = await svgToImage(svgMarkup);

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(settings.width * settings.pixelRatio);
    canvas.height = Math.round(settings.height * settings.pixelRatio);

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) {
      throw new Error("Canvas 2D недоступен в этом браузере");
    }

    if (settings.backgroundColor) {
      context.fillStyle = settings.backgroundColor;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return canvas;
  }

  global.DomExport = Object.freeze({ toCanvas });
})(window);
