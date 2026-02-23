export interface SearchDocument {
  id: number;
  url: string;
  title: string;
  headings: string[];
  excerpt: string;
}

export type UrlMode = "pretty" | "html";
export type Posting = [number, number];

export interface InvertedIndex {
  terms: Record<string, Posting[]>;
}

export interface IndexMetaBase {
  version: number;
  generatedAt: string;
  baseUrl: string;
  docCount: number;
  docs: { path: string };
}

export interface IndexMetaV1 extends IndexMetaBase {
  version: 1;
  inv: { path: string };
}

export interface ShardingConfig {
  strategy: "prefix2";
  shardPrefixLen: number;
  fallbackShard: string;
  map: Record<string, string>;
}

export interface IndexMetaV2 extends IndexMetaBase {
  version: 2;
  inv: {
    sharding: ShardingConfig;
  };
}

export type IndexMeta = IndexMetaV1 | IndexMetaV2;

export interface BuildShardResult {
  shards: Record<string, InvertedIndex>;
  totalTerms: number;
  shardCount: number;
  largestShardTerms: number;
}

export interface BuildShardsOptions {
  shardPrefixLen?: number;
  fallbackShard?: string;
}

export interface IndexableDocument {
  id: number;
  url: string;
  title: string;
  headings: string[];
  bodyText: string;
  excerpt: string;
}

export interface BuildIndexResult {
  docs: SearchDocument[];
  inv: InvertedIndex;
}

export interface ExtractedDocument {
  url: string;
  title: string;
  headings: string[];
  bodyText: string;
  excerpt: string;
  titleSource: "h1" | "title" | "filename";
}

export interface ExtractHtmlOptions {
  filePath: string;
  html: string;
  inputRoot: string;
  baseUrl: string;
  urlMode?: UrlMode;
}
