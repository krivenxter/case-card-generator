import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createCreativeHandler } from "./generate.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const port = Number(process.env.CREATIVE_AI_PORT || 8781);
const origin = "http://127.0.0.1:" + port;
const handler = createCreativeHandler({ localOrigin: origin });
const roots = /^(?:shared|email|backgrounds(?:-light)?|essentials|favicon|fonts|icons|logos|vendor|visuals)\//;
const pages = /^(?:index\.html|banners\.html|cases\.html|email(?:-editor)?\.html|styles\.css|script\.js|og-cover\.jpg|badge-no-text\.jpg)$/;
const types = new Map(Object.entries({
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript",
  ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".jpg": "image/jpeg",
  ".ico": "image/x-icon", ".woff2": "font/woff2", ".ttf": "font/ttf", ".webmanifest": "application/manifest+json"
}));

createServer(async (req, res) => {
  if (req.headers.host !== new URL(origin).host) {
    res.writeHead(403).end();
    return;
  }
  const url = new URL(req.url, origin);
  if (url.pathname === "/api/creative-ai") return handler(req, res);
  try {
    const path = decodeURIComponent(url.pathname.slice(1)) || "index.html";
    const file = resolve(root, path);
    const type = types.get(extname(path));
    if (!(roots.test(path) || pages.test(path)) || !type || !file.startsWith(root)
        || path.split(sep).some((segment) => segment.startsWith("."))) throw new Error();
    if (!["GET", "HEAD"].includes(req.method)) return res.writeHead(405).end();
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": type, "Content-Length": data.length, "X-Content-Type-Options": "nosniff" });
    res.end(req.method === "HEAD" ? undefined : data);
  } catch {
    res.writeHead(404).end();
  }
}).listen(port, "127.0.0.1", () => console.log(origin));
