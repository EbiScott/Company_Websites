let sites = [];
let site = null;
let dirty = false;
let editMode = false;
let syncingMeta = false;

const NAMES = {
  "nocturne-hotel": "Nocturne Hotel",
  "herbarium-house": "Herbarium House",
  "atlas-foundry": "Atlas Foundry",
  "monarch-markets": "Monarch Markets",
  "overprint-studio": "Overprint Studio",
  "lagos-ledger": "The Lagos Ledger",
};

const $ = (id) => document.getElementById(id);
const iframe = $("preview");
const fileInput = $("file");
const statusEl = $("status");
const dirtyEl = $("dirty");
const titleInput = $("meta-title");
const descInput = $("meta-description");
const editButton = $("edit");
const currentSiteEl = $("current-site");

const pretty = (slug) => NAMES[slug] || slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function setStatus(text, kind = "") {
  statusEl.textContent = text;
  statusEl.dataset.kind = kind;
}

function markDirty() {
  dirty = true;
  dirtyEl.hidden = false;
  setStatus("Unsaved changes. Click Save.", "dirty");
}

const readAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

async function api(path, method = "GET", body) {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

function renderSites() {
  const list = $("site-list");
  list.innerHTML = "";
  for (const item of sites) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = pretty(item);
    button.setAttribute("aria-current", item === site ? "true" : "false");
    button.addEventListener("click", () => selectSite(item));
    list.append(button);
  }
}

function selectSite(next, force = false) {
  if (!force && dirty && !confirm("You have unsaved changes. Switch site and lose them?")) return;
  site = next;
  dirty = false;
  dirtyEl.hidden = true;
  editMode = false;
  editButton.setAttribute("aria-pressed", "false");
  currentSiteEl.textContent = `${pretty(site)} · ${site}/index.html`;
  setStatus(`Loading ${pretty(site)}…`);
  iframe.src = `/preview/${site}/?v=${Date.now()}`;
  renderSites();
}

function syncMeta() {
  const doc = iframe.contentDocument;
  if (!doc) return;
  syncingMeta = true;
  titleInput.value = doc.title || "";
  const meta = doc.querySelector('meta[name="description"]');
  descInput.value = meta?.getAttribute("content") || "";
  syncingMeta = false;
}

function injectStyle(doc) {
  if (doc.getElementById("editor-style")) return;
  const style = doc.createElement("style");
  style.id = "editor-style";
  style.textContent = `
    [contenteditable="true"] {
      outline: 1px dashed rgba(255, 90, 54, 0.65);
      outline-offset: 2px;
      cursor: text;
    }
    [contenteditable="true"]:hover { background: rgba(255, 90, 54, 0.06); }
    .editor-image-tools {
      position: absolute; top: 6px; right: 6px; z-index: 60;
      display: flex; gap: 4px;
    }
    .editor-image-tools button {
      background: #14171c; color: #fff; border: 1px solid #ff5a36;
      padding: 4px 7px; font: 600 10px/1 ui-monospace, monospace;
      letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer;
    }
    .editor-image-tools button:hover { background: #ff5a36; color: #111; }
  `;
  doc.head.append(style);
}

function addEditorGuards(doc) {
  if (doc.body.dataset.editorGuards) return;
  doc.body.dataset.editorGuards = "true";
  doc.addEventListener("input", markDirty);
  doc.addEventListener("click", (event) => {
    if (!editMode) return;
    const target = event.target.closest("a, button, summary");
    if (target && !target.closest(".editor-image-tools")) event.preventDefault();
  }, true);
  doc.addEventListener("submit", (event) => {
    if (editMode) event.preventDefault();
  }, true);
}

function makeEditable(doc) {
  const selector = "h1,h2,h3,p,li,cite,address,blockquote,figcaption,label,summary,dt,dd,a,button,span";
  for (const el of doc.querySelectorAll(selector)) {
    if (el.closest(".editor-image-tools") || el.closest("svg")) continue;
    if (el.isContentEditable) continue;
    if (el.querySelector("*") && !/^H[123]$/.test(el.tagName)) continue;
    el.setAttribute("contenteditable", "true");
  }
}

function chooseImage(img) {
  fileInput.value = "";
  fileInput.onchange = async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    setStatus(`Uploading ${file.name}…`);
    try {
      const dataUrl = await readAsDataURL(file);
      const result = await api("/api/upload", "POST", {
        site,
        name: file.name,
        dataUrl,
        key: img.dataset.editImage || "image",
      });
      if (!result.ok) {
        setStatus(result.error || "Upload failed", "err");
        return;
      }
      img.src = `${result.path}?v=${Date.now()}`;
      img.hidden = false;
      addImageTools(iframe.contentDocument);
      markDirty();
      setStatus(`Image uploaded to ${result.path}. Save to keep it.`, "ok");
    } catch (err) {
      setStatus(String(err), "err");
    }
  };
  fileInput.click();
}

function addImageTools(doc) {
  if (!doc) return;
  doc.querySelectorAll(".editor-image-tools").forEach((node) => node.remove());

  for (const img of doc.querySelectorAll("img[data-edit-image]")) {
    const parent = img.parentElement;
    if (!parent) continue;
    parent.style.position = "relative";

    const tools = doc.createElement("div");
    tools.className = "editor-image-tools";

    const replace = doc.createElement("button");
    replace.type = "button";
    replace.textContent = img.hidden ? "Add image" : "Replace image";
    replace.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      chooseImage(img);
    });
    tools.append(replace);

    if (!img.hidden) {
      const remove = doc.createElement("button");
      remove.type = "button";
      remove.textContent = "Remove";
      remove.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        img.removeAttribute("src");
        img.hidden = true;
        addImageTools(doc);
        markDirty();
      });
      tools.append(remove);
    }

    parent.append(tools);
  }
}

function enableEdit() {
  const doc = iframe.contentDocument;
  if (!doc || !doc.body) return;
  injectStyle(doc);
  doc.body.classList.add("editor-editing");
  addEditorGuards(doc);
  makeEditable(doc);
  addImageTools(doc);
  setStatus("Edit mode on. Click text to edit, or replace an image.", "ok");
}

function disableEdit() {
  const doc = iframe.contentDocument;
  if (!doc) return;
  doc.querySelectorAll("[contenteditable]").forEach((el) => el.removeAttribute("contenteditable"));
  doc.querySelectorAll(".editor-image-tools").forEach((el) => el.remove());
  doc.getElementById("editor-style")?.remove();
  doc.body.classList.remove("editor-editing");
  setStatus("Edit mode off.");
}

function toggleEdit() {
  editMode = !editMode;
  editButton.setAttribute("aria-pressed", String(editMode));
  if (editMode) enableEdit();
  else disableEdit();
}

async function save() {
  const doc = iframe.contentDocument;
  if (!doc || !site) return;

  const clone = doc.documentElement.cloneNode(true);
  clone.querySelectorAll(".editor-image-tools").forEach((el) => el.remove());
  clone.querySelector("#editor-style")?.remove();
  clone.querySelectorAll("[contenteditable]").forEach((el) => el.removeAttribute("contenteditable"));
  clone.querySelectorAll("[data-editor-ui]").forEach((el) => el.remove());
  clone.querySelector("body")?.classList.remove("editor-editing");
  clone.querySelectorAll("img[data-edit-image]").forEach((img) => {
    const src = img.getAttribute("src");
    if (src) img.setAttribute("src", src.split("?")[0]);
  });

  const html = `<!DOCTYPE html>\n${clone.outerHTML}`;
  setStatus("Saving…");
  const result = await api("/api/save", "POST", {
    site,
    html,
    title: titleInput.value,
    description: descInput.value,
  });

  if (!result.ok) {
    setStatus(result.error || "Save failed", "err");
    return;
  }

  dirty = false;
  dirtyEl.hidden = true;
  setStatus(`Saved ${site}/index.html`, "ok");
  const keepEditing = editMode;
  editMode = false;
  editButton.setAttribute("aria-pressed", "false");
  iframe.src = `/preview/${site}/?v=${Date.now()}`;
  iframe.addEventListener("load", function onLoad() {
    iframe.removeEventListener("load", onLoad);
    if (keepEditing) {
      editMode = true;
      editButton.setAttribute("aria-pressed", "true");
      enableEdit();
    }
  });
}

async function publish() {
  if (dirty && !confirm("You have unsaved changes. Publish will ship the last SAVED version. Continue?")) return;
  if (!confirm("Publish commits the site folders and pushes to GitHub. Vercel will rebuild. Continue?")) return;
  setStatus("Publishing…");
  const result = await api("/api/publish", "POST", {});
  if (result.ok) {
    setStatus("Published. Vercel is rebuilding, live in about a minute.", "ok");
  } else if (result.step === "nothing") {
    setStatus("Nothing to publish. Save a change first.", "dirty");
  } else {
    setStatus(`Publish failed at ${result.step}: ${(result.out || "").split("\n")[0]}`, "err");
    console.warn(result.out);
  }
}

iframe.addEventListener("load", () => {
  if (!site) return;
  const doc = iframe.contentDocument;
  if (!doc || !doc.location.pathname.startsWith("/preview/")) return;
  syncMeta();
  if (editMode) enableEdit();
  else setStatus(`Loaded ${pretty(site)}. Turn on Edit mode to change it.`);
});

titleInput.addEventListener("input", () => {
  if (!syncingMeta) markDirty();
});
descInput.addEventListener("input", () => {
  if (!syncingMeta) markDirty();
});

editButton.addEventListener("click", toggleEdit);
$("reload").addEventListener("click", () => {
  if (dirty && !confirm("Reload and lose unsaved changes?")) return;
  selectSite(site, true);
});
$("save").addEventListener("click", save);
$("publish").addEventListener("click", publish);

window.addEventListener("beforeunload", (event) => {
  if (dirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});

async function boot() {
  try {
    const result = await api("/api/sites");
    if (!result.ok) throw new Error("Could not load sites.");
    sites = result.sites;
    renderSites();
    if (sites.length) selectSite(sites[0], true);
  } catch (err) {
    setStatus(String(err), "err");
  }
}

boot();
