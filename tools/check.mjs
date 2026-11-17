import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NOT_A_SITE = new Set(["editor", "tools", "node_modules", ".git"]);
const sites = readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !NOT_A_SITE.has(entry.name) && existsSync(join(root, entry.name, "index.html")))
  .map((entry) => entry.name)
  .sort();

const errors = [];

function checkSite(site) {
  const dir = join(root, site);
  const htmlPath = join(dir, "index.html");
  const cssPath = join(dir, "css", "style.css");
  const jsPath = join(dir, "js", "main.js");

  for (const file of [cssPath, jsPath]) {
    if (!existsSync(file)) errors.push(`${site}: missing ${file.replace(root, ".")}`);
  }

  const html = readFileSync(htmlPath, "utf-8");
  const required = [
    ["<title>", "title"],
    ['name="viewport"', "viewport meta"],
    ['name="description"', "description meta"],
    ["<h1", "h1"],
    ['class="skip"', "skip link"],
    ["css/style.css", "stylesheet link"],
    ["js/main.js", "script tag"],
    ["data-year", "dynamic year"],
    ["data-edit-image", "replaceable image slot"],
  ];

  if (!html.includes("data-edit-image")) errors.push(`${site}: no replaceable image slot`);

  for (const [needle, label] of required) {
    if (!html.includes(needle)) errors.push(`${site}: missing ${label}`);
  }

  if ((html.match(/<h1/g) || []).length !== 1) {
    errors.push(`${site}: expected exactly one h1`);
  }

  const localRefs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((ref) => !/^(https?:|mailto:|tel:|data:|#)/.test(ref));

  for (const ref of localRefs) {
    const target = ref.startsWith("/") ? join(root, ref) : join(dir, ref);
    if (!existsSync(target)) errors.push(`${site}: broken local reference ${ref}`);
  }

  if (existsSync(cssPath)) {
    const css = readFileSync(cssPath, "utf-8");
    const open = (css.match(/{/g) || []).length;
    const close = (css.match(/}/g) || []).length;
    if (open !== close) errors.push(`${site}: unbalanced CSS braces (${open} open, ${close} close)`);
    if (!css.includes("@media")) errors.push(`${site}: no responsive @media rules`);
    if (!css.includes("[hidden]")) {
      errors.push(`${site}: missing [hidden] rule (mobile menu will stay open)`);
    }
    if (!css.includes(".art-img")) {
      errors.push(`${site}: missing .art-img rule for uploaded pictures`);
    }
    if (!/\[hidden\]\s*\{[^}]*display:\s*none\s*!important/.test(css)) {
      errors.push(`${site}: [hidden] rule must set display: none !important`);
    }
  }

  if (existsSync(jsPath)) {
    try {
      execFileSync(process.execPath, ["--check", jsPath], { stdio: "pipe" });
    } catch {
      errors.push(`${site}: JavaScript syntax error in js/main.js`);
    }
  }
}

if (sites.length === 0) {
  console.error("No sites found.");
  process.exit(1);
}

for (const site of sites) checkSite(site);

if (errors.length) {
  console.error("Company site check failed:");
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`Company site check passed: ${sites.length} sites (${sites.join(", ")}).`);
