import { createServer } from "node:http";
import { mkdir } from "node:fs/promises";
import { Readable } from "node:stream";
import { openDemoDatabase } from "../server/local-db.mjs";
import "./build.mjs";

const { default: worker } = await import("../dist/server/index.js");
const localData = new URL("../outputs/local/", import.meta.url);
await mkdir(localData, { recursive: true });
const DB = openDemoDatabase(new URL("demo.sqlite", localData));
const server = createServer(async (incoming, outgoing) => {
  try {
    const options = { method: incoming.method, headers: incoming.headers };
    if (!["GET", "HEAD"].includes(incoming.method)) {
      options.body = Readable.toWeb(incoming);
      options.duplex = "half";
    }
    const request = new Request(new URL(incoming.url, "http://" + incoming.headers.host), options);
    const response = await worker.fetch(request, { DB });
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) Readable.fromWeb(response.body).pipe(outgoing);
    else outgoing.end();
  } catch {
    outgoing.writeHead(500).end();
  }
});
server.listen(Number(process.env.DEMO_PORT ?? 4173), "127.0.0.1", () => {
  console.log("http://127.0.0.1:" + server.address().port);
});
