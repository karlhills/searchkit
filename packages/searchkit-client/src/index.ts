import {
  highlightText,
  tokenize,
  type IndexMeta,
  type InvertedIndex,
  type SearchDocument
} from "@searchkit/core";

interface LoadedBundle {
  meta: IndexMeta;
  docs: SearchDocument[];
  inv: InvertedIndex;
  docsById: Map<number, SearchDocument>;
}

export interface CreateSearchOptions {
  metaUrl: string;
  fetcher?: typeof fetch;
}

export interface QueryOptions {
  limit?: number;
  highlight?: boolean;
}

export interface SearchResult {
  url: string;
  title: string;
  excerpt: string;
  score: number;
}

export interface SearchEngine {
  query(queryText: string, options?: QueryOptions): Promise<SearchResult[]>;
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

async function loadBundle(metaUrl: string, fetcher: typeof fetch): Promise<LoadedBundle> {
  const meta = await fetchJson<IndexMeta>(metaUrl, fetcher);
  const docsUrl = resolveUrl(metaUrl, meta.docs.path);
  const invUrl = resolveUrl(metaUrl, meta.inv.path);

  const [docs, inv] = await Promise.all([
    fetchJson<SearchDocument[]>(docsUrl, fetcher),
    fetchJson<InvertedIndex>(invUrl, fetcher)
  ]);

  return {
    meta,
    docs,
    inv,
    docsById: new Map(docs.map((doc) => [doc.id, doc]))
  };
}

function scoreDocuments(
  bundle: LoadedBundle,
  queryTokens: string[]
): Array<{ docId: number; score: number }> {
  const scoreMap = new Map<number, { score: number; matches: number }>();

  for (const token of queryTokens) {
    const postings = bundle.inv.terms[token];
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

      const left = bundle.docsById.get(a.docId)?.title ?? "";
      const right = bundle.docsById.get(b.docId)?.title ?? "";
      return left.localeCompare(right);
    });
}

export async function createSearch(options: CreateSearchOptions): Promise<SearchEngine> {
  const { metaUrl, fetcher } = options;
  const fetchImpl = getFetch(fetcher);
  const cacheKey = absoluteUrl(metaUrl);

  let bundlePromise = bundleCache.get(cacheKey);
  if (!bundlePromise) {
    bundlePromise = loadBundle(cacheKey, fetchImpl);
    bundleCache.set(cacheKey, bundlePromise);
    bundlePromise.catch(() => {
      bundleCache.delete(cacheKey);
    });
  }

  return {
    async query(queryText: string, queryOptions: QueryOptions = {}): Promise<SearchResult[]> {
      const tokens = tokenize(queryText, { dedupe: true, limit: 20 });
      if (!tokens.length) {
        return [];
      }

      const bundle = await bundlePromise;
      const scored = scoreDocuments(bundle, tokens);
      const limit = queryOptions.limit ?? 10;
      const highlight = queryOptions.highlight ?? false;

      return scored.slice(0, limit).flatMap(({ docId, score }) => {
        const doc = bundle.docsById.get(docId);
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
  };
}

export function clearSearchCache(): void {
  bundleCache.clear();
}
