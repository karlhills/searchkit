import { afterEach, describe, expect, it } from "vitest";

import { clearSearchCache, createSearch } from "../index";

const v2MetaUrl = "https://example.test/search/index.meta.json";
const v1MetaUrl = "https://legacy.test/search/index.meta.json";

const v2Meta = {
  version: 2,
  generatedAt: "2026-01-01T00:00:00.000Z",
  baseUrl: "/",
  docCount: 2,
  docs: { path: "docs.json" },
  inv: {
    sharding: {
      strategy: "prefix2" as const,
      shardPrefixLen: 2,
      fallbackShard: "_other",
      map: {
        ab: "inv/ab.json",
        ze: "inv/ze.json",
        _other: "inv/_other.json"
      }
    }
  }
};

const v1Meta = {
  version: 1,
  generatedAt: "2026-01-01T00:00:00.000Z",
  baseUrl: "/",
  docCount: 2,
  docs: { path: "docs.json" },
  inv: { path: "index.inv.json" }
};

const docs = [
  { id: 0, url: "/abacus/", title: "Abacus Guide", headings: [], excerpt: "Abacus basics" },
  { id: 1, url: "/zebra/", title: "Zebra Guide", headings: [], excerpt: "Zebra patterns" }
];

const shardAb = {
  terms: {
    abacus: [[0, 8]],
    ability: [[0, 3]]
  }
};

const shardZe = {
  terms: {
    zebra: [[1, 7]]
  }
};

const shardOther = {
  terms: {
    "42x": [[1, 1]]
  }
};

const v1Inv = {
  terms: {
    abacus: [[0, 8]],
    zebra: [[1, 7]]
  }
};

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), { status: 200 });
}

afterEach(() => {
  clearSearchCache();
});

describe("createSearch lazy loading", () => {
  it("loads only meta+docs initially and fetches needed shard on query", async () => {
    const calls: string[] = [];

    const fetcher = (async (url: string) => {
      calls.push(url);
      if (url === v2MetaUrl) return json(v2Meta);
      if (url === "https://example.test/search/docs.json") return json(docs);
      if (url === "https://example.test/search/inv/ab.json") return json(shardAb);
      if (url === "https://example.test/search/inv/ze.json") return json(shardZe);
      if (url === "https://example.test/search/inv/_other.json") return json(shardOther);
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const engine = await createSearch({ metaUrl: v2MetaUrl, fetcher });

    expect(calls).toEqual([v2MetaUrl, "https://example.test/search/docs.json"]);

    const abResults = await engine.query("abacus");
    expect(abResults[0]?.url).toBe("/abacus/");
    expect(calls).toContain("https://example.test/search/inv/ab.json");
    expect(calls).not.toContain("https://example.test/search/inv/ze.json");

    const zeResults = await engine.query("zebra");
    expect(zeResults[0]?.url).toBe("/zebra/");
    expect(calls).toContain("https://example.test/search/inv/ze.json");
  });

  it("coalesces concurrent shard fetches and can prewarm", async () => {
    const calls: string[] = [];

    const fetcher = (async (url: string) => {
      calls.push(url);
      if (url === v2MetaUrl) return json(v2Meta);
      if (url === "https://example.test/search/docs.json") return json(docs);
      if (url === "https://example.test/search/inv/ab.json") {
        await new Promise((resolve) => setTimeout(resolve, 30));
        return json(shardAb);
      }
      if (url === "https://example.test/search/inv/ze.json") return json(shardZe);
      if (url === "https://example.test/search/inv/_other.json") return json(shardOther);
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const engine = await createSearch({ metaUrl: v2MetaUrl, fetcher });
    await Promise.all([engine.query("abacus"), engine.query("ability")]);

    expect(calls.filter((url) => url === "https://example.test/search/inv/ab.json")).toHaveLength(
      1
    );

    await engine.prewarm("zebra");
    expect(calls.filter((url) => url === "https://example.test/search/inv/ze.json")).toHaveLength(
      1
    );
  });

  it("supports v1 meta fallback with lazy single-inv loading", async () => {
    const calls: string[] = [];

    const fetcher = (async (url: string) => {
      calls.push(url);
      if (url === v1MetaUrl) return json(v1Meta);
      if (url === "https://legacy.test/search/docs.json") return json(docs);
      if (url === "https://legacy.test/search/index.inv.json") return json(v1Inv);
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const engine = await createSearch({ metaUrl: v1MetaUrl, fetcher });
    expect(calls).toEqual([v1MetaUrl, "https://legacy.test/search/docs.json"]);

    const results = await engine.query("zebra", { highlight: true });
    expect(results[0]?.url).toBe("/zebra/");
    expect(results[0]?.excerpt).toContain("<mark>Zebra</mark>");
    expect(calls).toContain("https://legacy.test/search/index.inv.json");
  });
});
