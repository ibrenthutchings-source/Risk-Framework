// Zero-dependency static file server for the ChainProof frontend. Only
// used inside the Docker image built from Dockerfile.web, which COPYs in
// nothing but the specific frontend files below — backend/, .git, and
// debug.log never enter that image, so there's no allowlist logic needed
// here beyond a path-traversal guard.
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".jsx": "application/javascript",
  ".js": "application/javascript",
  ".css": "text/css",
};

const PORT = process.env.PORT || 8080;

http
  .createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p === "/" || p === "") p = "/Blockchain Audit System.html";
    const filePath = path.join(root, p);
    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      return res.end("forbidden");
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        return res.end("not found");
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      res.end(data);
    });
  })
  .listen(PORT, () => console.log(`chainproof frontend listening on :${PORT}`));
