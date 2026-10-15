// Local preview of dist/ at http://localhost:8080  (npm start builds first, then runs this).
//
//   PORT=3000 npm start                     use another port
//   SIPERP_API=http://localhost:5000/api/public/demo-requests npm start
//                                           point the Book a Demo form at a local backend
//                                           instead of the live API
//
// Plain Node, no packages. This is only for previewing; the live site is just the
// files in dist/ uploaded to Hostinger.

import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const dist = join(dirname(fileURLToPath(import.meta.url)), "dist");
const port = Number(process.env.PORT) || 8080;
const apiOverride = process.env.SIPERP_API || "";

if (!existsSync(join(dist, "index.html"))) {
  console.error("dist/ is empty. Run `npm run build` first (or use `npm start`, which builds for you).");
  process.exit(1);
}

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
};

createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  let file = normalize(join(dist, urlPath));
  if (!file.startsWith(dist)) {
    res.statusCode = 403;
    return res.end("Forbidden");
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");

  if (!existsSync(file)) {
    res.statusCode = 404;
    res.setHeader("Content-Type", types[".html"]);
    return res.end(readFileSync(join(dist, "404.html")));
  }

  res.setHeader("Content-Type", types[extname(file)] || "application/octet-stream");
  let body = readFileSync(file);
  if (apiOverride && extname(file) === ".html") {
    body = Buffer.from(
      body.toString("utf8").replace("</head>", `<script>window.SIPERP_API=${JSON.stringify(apiOverride)};</script>\n</head>`)
    );
  }
  res.end(body);
}).listen(port, () => {
  console.log(`SIPERP site preview: http://localhost:${port}`);
  if (apiOverride) console.log(`Forms post to: ${apiOverride}`);
});
