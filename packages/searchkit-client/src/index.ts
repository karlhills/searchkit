import {
  highlightText,
  resolveShardPathForToken,
  tokenize,
  type IndexMeta,
  type IndexMetaV1,
  type IndexMetaV2,
  type InvertedIndex,
  type SearchDocument
} from "@searchkit/core";

interface LoadedBundle {
  meta: IndexMeta;
  docsById: Map<number, SearchDocument>;
  fetcher: typeof fetch;
  metaUrl: string;
  maxShardCache: number;

  // v1 single inverted index cache.
  invV1?: InvertedIndex;
  invV1Promise?: Promise<InvertedIndex>;

  // v2 shard cache.
  shardData: Map<string, InvertedIndex>;
  shardPromises: Map<string, Promise<InvertedIndex>>;
  shardLru: string[];
}

export interface CreateSearchOptions {
  metaUrl: string;
  fetcher?: typeof fetch;
  maxShardCache?: number;
}

export interface QueryOptions {
  limit?: number;
  highlight?: boolean;
  maxTokens?: number;
}

export interface SearchResult {
  url: string;
  title: string;
  excerpt: string;
  score: number;
}

export interface SearchEngine {
  query(queryText: string, options?: QueryOptions): Promise<SearchResult[]>;
  prewarm(queryOrTokens: string | string[]): Promise<void>;
}

const bundleCache = new Map<string, Promise<LoadedBundle>>();

function getFetch(fetcher?: typeof fetch): typeof fetch {
  const fn = fetcher ?? globalThis.fetch;
  if (!fn) {
    throw new Error("fetch is required in this environment");
  }
  return fn;
}

function resolveUrl(base: string, value: string): string {
  const origin = typeof window !== "undefined" ? window.location.href : "http://localhost/";
  return new URL(value, new URL(base, origin)).toString();
}

function absoluteUrl(value: string): string {
  const origin = typeof window !== "undefined" ? window.location.href : "http://localhost/";
  return new URL(value, origin).toString();
}

async function fetchJson<T>(url: string, fetcher: typeof fetch): Promise<T> {
  const response = await fetcher(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }
  return (await response.json()) as T;
}

function touchShard(bundle: LoadedBundle, shardUrl: string): void {
  const index = bundle.shardLru.indexOf(shardUrl);
  if (index >= 0) {
    bundle.shardLru.splice(index, 1);
  }
  bundle.shardLru.push(shardUrl);

  while (bundle.shardData.size > bundle.maxShardCache) {
    const oldest = bundle.shardLru.shift();
    if (!oldest) {
      break;
    }
    bundle.shardData.delete(oldest);
  }
}

async function loadV1Index(bundle: LoadedBundle): Promise<InvertedIndex> {
  if (bundle.invV1) {
    return bundle.invV1;
  }

  if (bundle.invV1Promise) {
    return bundle.invV1Promise;
  }

  const meta = bundle.meta as IndexMetaV1;
  const invUrl = resolveUrl(bundle.metaUrl, meta.inv.path);
  const promise = fetchJson<InvertedIndex>(invUrl, bundle.fetcher)
    .then((inv) => {
      bundle.invV1 = inv;
      bundle.invV1Promise = undefined;
      return inv;
    })
    .catch((error) => {
      bundle.invV1Promise = undefined;
      throw error;
    });

  bundle.invV1Promise = promise;
  return promise;
}

async function loadShard(bundle: LoadedBundle, shardPath: string): Promise<InvertedIndex> {
  const shardUrl = resolveUrl(bundle.metaUrl, shardPath);

  const cached = bundle.shardData.get(shardUrl);
  if (cached) {
    touchShard(bundle, shardUrl);
    return cached;
  }

  const pending = bundle.shardPromises.get(shardUrl);
  if (pending) {
    return pending;
  }

  const promise = fetchJson<InvertedIndex>(shardUrl, bundle.fetcher)
    .then((shard) => {
      bundle.shardData.set(shardUrl, shard);
      touchShard(bundle, shardUrl);
      bundle.shardPromises.delete(shardUrl);
      return shard;
    })
    .catch((error) => {
      bundle.shardPromises.delete(shardUrl);
      throw error;
    });

  bundle.shardPromises.set(shardUrl, promise);
  return promise;
}

async function loadBundle(
  metaUrl: string,
  fetcher: typeof fetch,
  maxShardCache: number
): Promise<LoadedBundle> {
  const meta = await fetchJson<IndexMeta>(metaUrl, fetcher);

  const docsUrl = resolveUrl(metaUrl, meta.docs.path);
  const docs = await fetchJson<SearchDocument[]>(docsUrl, fetcher);

  return {
    meta,
    docsById: new Map(docs.map((doc) => [doc.id, doc])),
    fetcher,
    metaUrl,
    maxShardCache,
    shardData: new Map(),
    shardPromises: new Map(),
    shardLru: []
  };
}

function tokenizeQuery(queryOrTokens: string | string[], maxTokens = 10): string[] {
  if (typeof queryOrTokens === "string") {
    return tokenize(queryOrTokens, { dedupe: true, limit: maxTokens });
  }

  return tokenize(queryOrTokens.join(" "), { dedupe: true, limit: maxTokens });
}

async function ensureShardsLoaded(bundle: LoadedBundle, tokens: string[]): Promise<void> {
  if (bundle.meta.version !== 2) {
    return;
  }

  const meta = bundle.meta as IndexMetaV2;
  const shardPaths = new Set<string>();
  for (const token of tokens) {
    const shardPath = resolveShardPathForToken(token, meta.inv.sharding);
    if (shardPath) {
      shardPaths.add(shardPath);
    }
  }

  await Promise.all([...shardPaths].map((shardPath) => loadShard(bundle, shardPath)));
}

function scoreDocuments(
  docsById: Map<number, SearchDocument>,
  getPostings: (token: string) => Array<[number, number]> | undefined,
  queryTokens: string[]
): Array<{ docId: number; score: number }> {
  const scoreMap = new Map<number, { score: number; matches: number }>();

  for (const token of queryTokens) {
    const postings = getPostings(token);
    if (!postings) {
      continue;
    }

    for (const [docId, weight] of postings) {
      const entry = scoreMap.get(docId) ?? { score: 0, matches: 0 };
      entry.score += weight;
      entry.matches += 1;
      scoreMap.set(docId, entry);
    }
  }

  return [...scoreMap.entries()]
    .map(([docId, entry]) => ({
      docId,
      score: entry.score + Math.max(0, entry.matches - 1) * 2
    }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      const left = docsById.get(a.docId)?.title ?? "";
      const right = docsById.get(b.docId)?.title ?? "";
      return left.localeCompare(right);
    });
}

function toResults(
  docsById: Map<number, SearchDocument>,
  scored: Array<{ docId: number; score: number }>,
  limit: number,
  highlight: boolean,
  tokens: string[]
): SearchResult[] {
  return scored.slice(0, limit).flatMap(({ docId, score }) => {
    const doc = docsById.get(docId);
    if (!doc) {
      return [];
    }

    return [
      {
        url: doc.url,
        title: doc.title,
        excerpt: highlight ? highlightText(doc.excerpt, tokens) : doc.excerpt,
        score
      }
    ];
  });
}

export async function createSearch(options: CreateSearchOptions): Promise<SearchEngine> {
  const { metaUrl, fetcher, maxShardCache = 30 } = options;
  const fetchImpl = getFetch(fetcher);
  const cacheKey = absoluteUrl(metaUrl);

  let bundlePromise = bundleCache.get(cacheKey);
  if (!bundlePromise) {
    bundlePromise = loadBundle(cacheKey, fetchImpl, maxShardCache);
    bundleCache.set(cacheKey, bundlePromise);
    bundlePromise.catch(() => {
      bundleCache.delete(cacheKey);
    });
  }

  // Load and cache meta + docs eagerly.
  await bundlePromise;

  const runQuery = async (
    queryText: string,
    queryOptions: QueryOptions = {}
  ): Promise<SearchResult[]> => {
    const maxTokens = queryOptions.maxTokens ?? 10;
    const tokens = tokenizeQuery(queryText, maxTokens);
    if (!tokens.length) {
      return [];
    }

    const bundle = await bundlePromise;

    if (bundle.meta.version === 1) {
      const inv = await loadV1Index(bundle);
      const scored = scoreDocuments(bundle.docsById, (token) => inv.terms[token], tokens);
      return toResults(
        bundle.docsById,
        scored,
        queryOptions.limit ?? 10,
        queryOptions.highlight ?? false,
        tokens
      );
    }

    await ensureShardsLoaded(bundle, tokens);
    const meta = bundle.meta as IndexMetaV2;
    const scored = scoreDocuments(
      bundle.docsById,
      (token) => {
        const shardPath = resolveShardPathForToken(token, meta.inv.sharding);
        if (!shardPath) {
          return undefined;
        }
        const shardUrl = resolveUrl(bundle.metaUrl, shardPath);
        return bundle.shardData.get(shardUrl)?.terms[token];
      },
      tokens
    );

    return toResults(
      bundle.docsById,
      scored,
      queryOptions.limit ?? 10,
      queryOptions.highlight ?? false,
      tokens
    );
  };

  return {
    query: runQuery,
    async prewarm(queryOrTokens: string | string[]): Promise<void> {
      const tokens = tokenizeQuery(queryOrTokens, 10);
      if (!tokens.length) {
        return;
      }

      const bundle = await bundlePromise;
      if (bundle.meta.version === 1) {
        await loadV1Index(bundle);
        return;
      }

      await ensureShardsLoaded(bundle, tokens);
    }
  };
}

export function clearSearchCache(): void {
  bundleCache.clear();
}
