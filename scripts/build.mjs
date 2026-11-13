import { mkdir, readFile, writeFile } from "node:fs/promises";

const files = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/styles.css": ["styles.css", "text/css; charset=utf-8"],
  "/postal-codes.js": ["postal-codes.js", "text/javascript; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
  "/assets/pickup-doorstep.webp": ["assets/pickup-doorstep.webp", "image/webp"],
  "/assets/pickup-evening.webp": ["assets/pickup-evening.webp", "image/webp"],
  "/assets/bricolage-grotesque-latin.woff2": ["assets/bricolage-grotesque-latin.woff2", "font/woff2"],
  "/assets/bricolage-grotesque-OFL.txt": ["assets/bricolage-grotesque-OFL.txt", "text/plain; charset=utf-8"],
};

const root = new URL("../", import.meta.url);
const read = (file, encoding) => readFile(new URL(file, root), encoding);
const assets = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([url, [file, type]]) =>
  [url, [type, (await read(file)).toString("base64")]]
)));
const [districts, worker] = await Promise.all([read("postal-codes.js", "utf8"), read("server/worker.js", "utf8")]);

await mkdir(new URL("dist/server/", root), { recursive: true });
await mkdir(new URL("dist/.openai/", root), { recursive: true });
await writeFile(new URL("dist/server/index.js", root), `const assets = ${JSON.stringify(assets)};\n${districts}\n${worker}`);
await writeFile(new URL("dist/.openai/hosting.json", root), await read(".openai/hosting.json"));
