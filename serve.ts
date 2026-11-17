// Tiny static server for local testing of app/ — nothing else.
// Serves on localhost, port 8080 by default, or --port <n>.
// Node standard library only.

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "app");

const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

function parsePort(argv: string[]): number {
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--port" && argv[i + 1]) {
      const n = Number(argv[i + 1]);
      if (Number.isInteger(n) && n > 0 && n < 65536) return n;
    }
    const match = argv[i].match(/^--port=(\d+)$/);
    if (match) return Number(match[1]);
  }
  return 8080;
}

const port = parsePort(process.argv.slice(2));

const server = createServer(async (req, res) => {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { "Content-Type": "text/plain" });
      res.end("Method not allowed\n");
      return;
    }
    const url = new URL(req.url || "/", "http://localhost");
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith("/")) pathname += "index.html";
    const resolved = path.normalize(path.join(root, pathname));
    // Refuse anything outside app/, including ".." escapes and symlinks
    // that point out (checked again after resolving the real path below).
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("Forbidden\n");
      return;
    }
    const info = await stat(resolved).catch(() => null);
    if (!info || !info.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found\n");
      return;
    }
    const body = await readFile(resolved);
    const type = mime[path.extname(resolved).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Content-Length": body.length });
    if (req.method === "GET") res.end(body);
    else res.end();
  } catch {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Server error\n");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Serving app/ at http://localhost:${port}/`);
});
