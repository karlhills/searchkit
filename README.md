# Search Kit

Search Kit is an OSS MVP for static-site search:

- `searchkit` CLI builds a compact JSON index during your build.
- `@searchkit/client` is a headless browser search engine.
- `@searchkit/widget` provides a drop-in modal search UI (`Cmd+K` or `/`).

## Install

```bash
pnpm install
pnpm build
```

Node `18+` is required.

## Quickstart (CLI)

```bash
pnpm searchkit build --input ./dist --output ./dist/search --baseUrl /
```

Generated files:

- `dist/search/index.meta.json`
- `dist/search/docs.json`
- `dist/search/index.inv.json`

### CLI options

```bash
searchkit build --input <dir> --output <dir> --baseUrl /
```

Optional:

- `--include "**/*.html"`
- `--exclude "**/search/**"`
- `--urlMode pretty|html` (default: `pretty`)
- `--verbose`

Use `--urlMode html` if your host does not support extensionless pretty URLs. This emits links like
`/about.html` and `/guide/intro/index.html` instead of `/about` and `/guide/intro/`.

## Widget usage (drop-in)

Install package:

```bash
pnpm add @searchkit/widget @searchkit/client
```

Use in browser:

```html
<script src="/assets/searchkit-widget.global.js"></script>
<script>
  SearchKitWidget.mountSearchWidget(document.body, {
    metaUrl: "/search/index.meta.json",
    placeholder: "Search docs..."
  });
</script>
```

Options:

- `metaUrl`
- `placeholder`
- `hotkeys` (defaults to `Meta+K` and `/`)
- `maxResults`
- `theme` via CSS variable values

Theme variables:

- `--sk-bg`
- `--sk-fg`
- `--sk-border`
- `--sk-shadow`
- `--sk-accent`
- `--sk-muted`

## Client usage (headless)

```ts
import { createSearch } from "@searchkit/client";

const engine = await createSearch({ metaUrl: "/search/index.meta.json" });
const results = await engine.query("hello world", { limit: 10, highlight: true });
```

Result shape:

```ts
{
  (url, title, excerpt, score);
}
```

## Index format (MVP)

`index.meta.json`

```json
{
  "version": 1,
  "generatedAt": "ISO-8601",
  "baseUrl": "/",
  "docCount": 3,
  "inv": { "path": "index.inv.json" },
  "docs": { "path": "docs.json" }
}
```

`docs.json` contains documents with `id`, `url`, `title`, `headings`, `excerpt`.

`index.inv.json` contains an inverted index:

```json
{
  "terms": {
    "token": [
      [0, 8],
      [2, 3]
    ]
  }
}
```

Weighting:

- title token: `+5`
- heading token: `+3`
- body token: `+1`

## Excluding content from indexing

Search Kit removes:

- `nav`, `footer`, `aside`, `script`, `style`, `noscript`, `svg`
- `[data-search-exclude]`
- `.no-search`

## Example (vanilla)

```bash
pnpm dev:vanilla
```

This runs the vanilla example under `/examples/vanilla`, builds search assets, and serves on `http://localhost:4173`.

## Scripts

- `pnpm build`
- `pnpm test`
- `pnpm lint`
- `pnpm dev:vanilla`
