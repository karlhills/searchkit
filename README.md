# Search Kit

Search Kit is an OSS toolkit for static-site search:

- `searchkit` CLI builds a compact search index during your build.
- `@searchkit/client` is a headless browser engine with lazy shard loading.
- `@searchkit/widget` is a drop-in modal search UI (`Cmd+K` or `/`).

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

Sharded output (default):

- `dist/search/index.meta.json`
- `dist/search/docs.json`
- `dist/search/inv/*.json`

## CLI usage

```bash
searchkit build --input <dir> --output <dir> [options]
```

Flags:

- `--input <dir>` (required): input HTML directory (for example `./dist`)
- `--output <dir>` (required): output directory for search files (for example `./dist/search`)
- `--baseUrl <url>` (default: `/`): site base path
- `--[no-]shard` (default: `true`): enable/disable sharded output (`v2` / `v1`)
- `--shardPrefixLen <n>` (default: `2`): shard key prefix length (currently only `2` supported)
- `--maxShardTerms <n>` (default: `50000`): soft warning threshold for largest shard size
- `--urlMode <mode>` (default: `pretty`): `pretty | html`
- `--include <glob>` (default: `'**/*.html'`): included files glob
- `--exclude <glob>` (default: `'**/search/**'`): excluded files glob
- `--verbose` (default: `false`): print skipped files
- `-h, --help`: show command help
- `-V, --version`: show CLI version

`baseUrl` can be a path (`/`, `/docs/`) or a full URL (`https://example.com/docs/`); full URLs are normalized to pathname.

Use `--urlMode html` if your host does not support extensionless routes. This emits links like
`/about.html` and `/guide/intro/index.html` instead of `/about` and `/guide/intro/`.

## Widget usage (drop-in)

Install:

```bash
pnpm add @searchkit/widget @searchkit/client
```

Browser/global usage:

```html
<script src="/assets/searchkit-widget.global.js"></script>
<script>
  const widget = SearchKitWidget.mountSearchWidget(document.body, {
    metaUrl: "/search/index.meta.json",
    placeholder: "Search docs..."
  });
</script>
```

Open widget via a button:

```html
<button id="open-search" type="button">Search</button>
<script src="/assets/searchkit-widget.global.js"></script>
<script>
  const widget = SearchKitWidget.mountSearchWidget(document.body, {
    metaUrl: "/search/index.meta.json"
  });

  document.getElementById("open-search")?.addEventListener("click", () => {
    widget.open();
  });
</script>
```

### `mountSearchWidget` API

```ts
mountSearchWidget(containerOrSelector?, options?)
```

- `containerOrSelector` (optional): `string | Element` (default: `document.body`)
- `options.metaUrl` (default: `'/search/index.meta.json'`)
- `options.placeholder` (default: `'Search docs...'`)
- `options.hotkeys` (default: `['Meta+K', '/']`)
- `options.maxResults` (default: `8`)
- `options.theme` (optional):
- `options.theme.bg`
- `options.theme.fg`
- `options.theme.border`
- `options.theme.shadow`
- `options.theme.accent`
- `options.theme.muted`

Return value:

- `handle.open()`
- `handle.close()`
- `handle.destroy()`

Behavior notes:

- On open/focus, widget prewarms shard loads for current input.
- Input search is debounced (~100ms).
- Existing results stay visible while new shard requests are loading.

Theme CSS variables:

- `--sk-bg`
- `--sk-fg`
- `--sk-border`
- `--sk-shadow`
- `--sk-accent`
- `--sk-muted`

The widget footer includes a built-in `Powered by SearchKit` link to `https://github.com/karlhills/searchkit`.

## Client usage (headless)

```ts
import { createSearch } from "@searchkit/client";

const engine = await createSearch({
  metaUrl: "/search/index.meta.json",
  maxShardCache: 30
});

const results = await engine.query("hello world", {
  limit: 10,
  highlight: true,
  maxTokens: 10
});

await engine.prewarm("hello world");
```

### `createSearch` API

- `createSearch({ metaUrl, fetcher?, maxShardCache? })`
- `metaUrl` (required): URL to `index.meta.json`
- `fetcher` (optional): custom fetch implementation
- `maxShardCache` (default: `30`): number of loaded shards to retain in memory (LRU)

### `engine.query` options

- `limit` (default: `10`)
- `highlight` (default: `false`)
- `maxTokens` (default: `10`)

Result shape:

```ts
{
  (url, title, excerpt, score);
}
```

## Index format

### `index.meta.json` v2 (sharded)

```json
{
  "version": 2,
  "generatedAt": "ISO-8601",
  "baseUrl": "/",
  "docCount": 3,
  "docs": { "path": "docs.json" },
  "inv": {
    "sharding": {
      "strategy": "prefix2",
      "shardPrefixLen": 2,
      "fallbackShard": "_other",
      "map": {
        "ab": "inv/ab.json",
        "ze": "inv/ze.json",
        "_other": "inv/_other.json"
      }
    }
  }
}
```

### Shard file format

`inv/ab.json`:

```json
{
  "terms": {
    "abacus": [[0, 8]],
    "ability": [[1, 3]]
  }
}
```

### v1 backward compatibility

If `version` is `1`, client falls back to single-file inverted index via `inv.path`.

## Scoring

- title token: `+5`
- heading token: `+3`
- body token: `+1`
- multi-token match bonus: `+2` per additional matched query token

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
