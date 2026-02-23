export interface SearchDocument {
  id: number;
  url: string;
  title: string;
  headings: string[];
  excerpt: string;
}

export type UrlMode = "pretty" | "html";

export interface InvertedIndex {
  terms: Record<string, Array<[number, number]>>;
}

export interface IndexMeta {
  version: number;
  generatedAt: string;
  baseUrl: string;
  docCount: number;
  inv: { path: string };
  docs: { path: string };
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
