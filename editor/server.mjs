import { createServer } from "node:http";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, extname, resolve, relative, sep } from "node:path";

/* ---------------------------------------------------------------------------
   Local editor for the six company websites.

   Runs on your machine only (`npm run edit`). It serves a same-origin preview of
   each static site, makes the text editable in place, uploads replacement
   images into the site's images/ folder, and saves the edited HTML. Publish
   commits the site folders and pushes, so Vercel rebuilds.

   No external dependencies. Binds to localhost only.
--------------------------------------------------------------------------- */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const PORT = 4331;
const RESERVED = new Set(["editor", "tools", "node_modules", ".git", "images"]);
const IMG_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif"]);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
};

let SITES = [];

async function loadSites() {
  const entries = await readdir(ROOT, { withFileTypes: true });
  const names = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || RESERVED.has(entry.name)) continue;
    try {
      await readFile(join(ROOT, entry.name, "index.html"));
      names.push(entry.name);
    } catch {
      /* not a site */
    }
  }
  SITES = names.sort();
  return SITES;
}

function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 20 * 1024 * 1024) {
        reject(new Error("Body too large (20MB limit)."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolveBody(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function git(args) {
  return new Promise((resolveGit) => {
    execFile("git", args, { cwd: ROOT, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolveGit({ ok: !err, out: (stdout || "") + (stderr || "") });
    });
  });
}

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "image";
}

function validSite(name) {
  return typeof name === "string" && SITES.includes(name);
}

async function serveSiteFile(res, site, restPath) {
  if (!validSite(site)) return send(res, 404, "Unknown site", "text/plain");
  const siteDir = join(ROOT, site);
  const rel = restPath && restPath.length ? restPath : "index.html";
  const target = resolve(siteDir, rel);
  const inside = relative(siteDir, target);
  if (inside.startsWith("..") || inside.includes(`..${sep}`) || resolve(target) === resolve(siteDir)) {
    return send(res, 403, "Forbidden", "text/plain");
  }
  try {
    const body = await readFile(target);
    return send(res, 200, body, MIME[extname(target)] ?? "application/octet-stream");
  } catch {
    return send(res, 404, "Not found", "text/plain");
  }
}

async function serveEditorFile(res, name) {
  try {
    const body = await readFile(join(HERE, name));
    return send(res, 200, body, MIME[extname(name)] ?? "application/octet-stream");
  } catch {
    return send(res, 404, "Not found", "text/plain");
  }
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = decodeURIComponent(url.pathname);

  if (req.method === "GET" && (path === "/" || path === "/index.html")) {
    return serveEditorFile(res, "index.html");
  }
  if (req.method === "GET" && (path === "/editor.js" || path === "/editor.css")) {
    return serveEditorFile(res, path.slice(1));
  }

  if (req.method === "GET" && path === "/api/sites") {
    const sites = await loadSites();
    return send(res, 200, JSON.stringify({ ok: true, sites }));
  }

  if (req.method === "GET" && path.startsWith("/preview/")) {
    const rest = path.slice("/preview/".length);
    const slash = rest.indexOf("/");
    const site = slash === -1 ? rest : rest.slice(0, slash);
    const filePath = slash === -1 ? "" : rest.slice(slash + 1);
    return serveSiteFile(res, site, filePath);
  }

  if (req.method === "GET" && path === "/api/git-status") {
    const args = ["status", "--porcelain", "--", ...SITES];
    const result = await git(args);
    return send(res, 200, JSON.stringify({ ok: result.ok, pending: result.out.trim() }));
  }

  if (req.method === "POST" && path === "/api/save") {
    let payload;
    try {
      payload = JSON.parse((await readBody(req)).toString("utf-8"));
    } catch {
      return send(res, 400, JSON.stringify({ ok: false, error: "Invalid JSON." }));
    }
    const { site, html, title, description } = payload;
    if (!validSite(site)) return send(res, 400, JSON.stringify({ ok: false, error: "Unknown site." }));
    if (typeof html !== "string" || !html.includes("<html") || !html.includes("</html>")) {
      return send(res, 400, JSON.stringify({ ok: false, error: "Page HTML looks incomplete." }));
    }

    let clean = html
      .replace(/<div class="editor-image-tools"[\s\S]*?<\/div>/g, "")
      .replace(/<style id="editor-style">[\s\S]*?<\/style>/g, "")
      .replace(/\scontenteditable="[^"]*"/g, "")
      .replace(/\sdata-editor-[a-z-]+="[^"]*"/g, "");

    if (typeof title === "string" && title.trim()) {
      clean = clean.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title.trim())}</title>`);
    }
    if (typeof description === "string") {
      const meta = `<meta name="description" content="${esc(description.trim())}" />`;
      if (/<meta name="description"[^>]*>/.test(clean)) {
        clean = clean.replace(/<meta name="description"[^>]*>/, meta);
      } else {
        clean = clean.replace("</title>", `</title>\n  ${meta}`);
      }
    }

    await writeFile(join(ROOT, site, "index.html"), clean, "utf-8");
    return send(res, 200, JSON.stringify({ ok: true, site }));
  }

  if (req.method === "POST" && path === "/api/upload") {
    let payload;
    try {
      payload = JSON.parse((await readBody(req)).toString("utf-8"));
    } catch {
      return send(res, 400, JSON.stringify({ ok: false, error: "Invalid JSON." }));
    }
    const { site, name, dataUrl, key } = payload;
    if (!validSite(site)) return send(res, 400, JSON.stringify({ ok: false, error: "Unknown site." }));

    const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl || "");
    if (!match) return send(res, 400, JSON.stringify({ ok: false, error: "Bad file data." }));

    let ext = extname(name || "").toLowerCase();
    if (!IMG_EXT.has(ext)) ext = ".jpg";
    const file = `${slug(key || name || "image")}-${Date.now().toString(36)}${ext}`;
    const dir = join(ROOT, site, "images");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, file), Buffer.from(match[2], "base64"));

    return send(res, 200, JSON.stringify({ ok: true, path: `images/${file}` }));
  }

  if (req.method === "POST" && path === "/api/publish") {
    const add = await git(["add", "--", ...SITES]);
    if (!add.ok) return send(res, 200, JSON.stringify({ ok: false, step: "add", out: add.out }));

    const staged = await git(["diff", "--cached", "--name-only", "--", ...SITES]);
    if (!staged.out.trim()) {
      return send(res, 200, JSON.stringify({ ok: false, step: "nothing", out: "Nothing to publish." }));
    }

    const msg = `Update company site content (${new Date().toISOString().slice(0, 16).replace("T", " ")})`;
    const commit = await git(["commit", "-m", msg]);
    if (!commit.ok) return send(res, 200, JSON.stringify({ ok: false, step: "commit", out: commit.out }));

    const push = await git(["push"]);
    return send(res, 200, JSON.stringify({
      ok: push.ok,
      step: push.ok ? "done" : "push",
      out: commit.out + "\n" + push.out,
    }));
  }

  return send(res, 404, JSON.stringify({ ok: false, error: "Not found" }));
}

const server = createServer((req, res) => {
  handle(req, res).catch((err) => {
    send(res, 500, JSON.stringify({ ok: false, error: String(err?.message ?? err) }));
  });
});

loadSites().then(() => {
  server.listen(PORT, "127.0.0.1", () => {
    const link = `http://localhost:${PORT}`;
    console.log(`\n  Company websites editor running at  ${link}\n  Editing: ${SITES.join(", ")}\n  Stop with Ctrl+C.\n`);
    const opener = process.platform === "win32"
      ? ["cmd", ["/c", "start", "", link]]
      : process.platform === "darwin"
        ? ["open", [link]]
        : ["xdg-open", [link]];
    try {
      execFile(opener[0], opener[1], () => {});
    } catch {
      /* the URL is printed above */
    }
  });
});
