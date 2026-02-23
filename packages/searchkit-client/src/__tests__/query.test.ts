import { afterEach, describe, expect, it } from "vitest";

import { clearSearchCache, createSearch } from "../index";

const base = "https://example.test/search/index.meta.json";

const fixtureMeta = {
  version: 1,
  generatedAt: "2026-01-01T00:00:00.000Z",
  baseUrl: "/",
  docCount: 2,
  inv: { path: "index.inv.json" },
  docs: { path: "docs.json" }
};

const fixtureDocs = [
  { id: 0, url: "/intro/", title: "Intro", headings: [], excerpt: "Welcome to Search Kit" },
  { id: 1, url: "/advanced/", title: "Advanced", headings: [], excerpt: "Ranking and scoring" }
];

const fixtureInv = {
  terms: {
    search: [
      [0, 5],
      [1, 1]
    ],
    ranking: [[1, 5]],
    scoring: [[1, 3]]
  }
};

afterEach(() => {
  clearSearchCache();
});

describe("createSearch", () => {
  it("loads index and ranks by score", async () => {
    const calls: string[] = [];

    const fetcher = (async (url: string) => {
      calls.push(url);
      if (url.endsWith("index.meta.json")) {
        return new Response(JSON.stringify(fixtureMeta));
      }
      if (url.endsWith("docs.json")) {
        return new Response(JSON.stringify(fixtureDocs));
      }
      return new Response(JSON.stringify(fixtureInv));
    }) as typeof fetch;

    const engine = await createSearch({ metaUrl: base, fetcher });
    const results = await engine.query("search ranking", { limit: 5 });

    expect(results[0]?.url).toBe("/advanced/");
    expect(results[1]?.url).toBe("/intro/");
    expect(calls).toHaveLength(3);

    await createSearch({ metaUrl: base, fetcher });
    expect(calls).toHaveLength(3);
  });

  it("can highlight query tokens", async () => {
    const fetcher = (async (url: string) => {
      if (url.endsWith("index.meta.json")) {
        return new Response(JSON.stringify(fixtureMeta));
      }
      if (url.endsWith("docs.json")) {
        return new Response(JSON.stringify(fixtureDocs));
      }
      return new Response(JSON.stringify(fixtureInv));
    }) as typeof fetch;

    const engine = await createSearch({ metaUrl: base, fetcher });
    const [result] = await engine.query("search", { highlight: true });

    expect(result.excerpt).toContain("<mark>Search</mark>");
  });
});
