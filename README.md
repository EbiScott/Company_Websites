# Company Websites

Six standalone, fictional company websites built as front-end portfolio pieces.
Each one has its own design language, copy, and responsive layout. There is no
build step: every folder is plain HTML, CSS, and JavaScript.

## The sites

| Folder | Company | Sector | Direction |
|--------|---------|--------|-----------|
| `nocturne-hotel/` | Nocturne Hotel | Hospitality | Warm, nocturnal, editorial |
| `herbarium-house/` | Herbarium House | Hotel and spa | Paper, sage, botanical |
| `atlas-foundry/` | Atlas Foundry | Design and build | Brutalist, oversized, orange |
| `monarch-markets/` | Monarch Markets | Fintech | Dark terminal, amber and cyan |
| `overprint-studio/` | Overprint Studio | Creative studio | Risograph, blue and pink |
| `lagos-ledger/` | The Lagos Ledger | Media | Broadsheet, columns, drop caps |

All companies, people, quotes, prices, and market data are fictional and exist
only for demonstration.

## Preview locally

Open any folder's `index.html` in a browser, or serve the repo root:

```bash
npx serve .
```

Then visit `/nocturne-hotel/`, `/herbarium-house/`, and so on.

## Edit all six in one place

```bash
npm run edit
```

This opens a local editor at http://localhost:4331. Pick a site, turn on Edit
mode, change the copy directly in the preview, and upload replacement pictures
into the marked image slots. Save writes the site's `index.html`; Publish
commits the site folders and pushes to GitHub.

The editor is local-only and is never deployed.

## Check

```bash
npm run check
```

## Deploy on Vercel

One repository is enough. Create six Vercel projects from this same repo and set
the **Root Directory** for each one:

| Vercel project | Root Directory |
|----------------|----------------|
| nocturne-hotel | `nocturne-hotel` |
| herbarium-house | `herbarium-house` |
| atlas-foundry | `atlas-foundry` |
| monarch-markets | `monarch-markets` |
| overprint-studio | `overprint-studio` |
| lagos-ledger | `lagos-ledger` |

Framework preset: **Other**. Build command: none. Output directory: the project
root. Each site then gets its own URL.

## Structure

```
<site>/
  index.html
  css/style.css
  js/main.js
  images/            optional pictures added through the editor
editor/              local editor (never deployed)
tools/check.mjs      repository check
```

## Notes

- No external images by default. The built-in visuals are CSS, inline SVG, and
  type; optional photographs can be added through the editor.
- Fonts load from Google Fonts with system fallbacks.
- Each site includes a skip link, keyboard focus styles, reduced-motion
  handling, and a mobile menu.
- Contact forms are front-end demonstrations. They show a confirmation message
  and do not send anything.
