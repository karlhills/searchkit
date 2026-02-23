# Vanilla Example

This example creates a simple static site, runs Search Kit indexing, and serves the output with Vite.

## Run

```bash
pnpm install
pnpm build
pnpm --filter examples-vanilla build
pnpm dev:vanilla
```

Then open [http://localhost:4173](http://localhost:4173).

## What build does

1. Copies `site/*` into `dist/`
2. Copies widget browser bundle into `dist/assets/`
3. Runs `searchkit build --input ./dist --output ./dist/search --baseUrl /`

The generated search files are:

- `dist/search/index.meta.json`
- `dist/search/docs.json`
- `dist/search/index.inv.json`
