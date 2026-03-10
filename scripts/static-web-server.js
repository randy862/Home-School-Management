const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = process.argv[2] || process.cwd();
const PORT = Number(process.argv[3] || 5500);
const HOST = "127.0.0.1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function safeJoin(root, requestPath) {
  const normalized = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
  return path.join(root, normalized);
}

function resolvePath(urlPath) {
  let target = urlPath.split("?")[0];
  if (target === "/" || !target) target = "/web/";
  const full = safeJoin(ROOT, target);

  try {
    const stat = fs.statSync(full);
    if (stat.isDirectory()) return path.join(full, "index.html");
    return full;
  } catch {
    return full;
  }
}

const server = http.createServer((req, res) => {
  const filePath = resolvePath(req.url || "/");
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Not Found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.statusCode = 200;
    res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Static server listening on http://${HOST}:${PORT}/web/`);
});
