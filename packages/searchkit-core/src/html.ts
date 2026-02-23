import path from "node:path";
import { load } from "cheerio";

import type { ExtractedDocument, ExtractHtmlOptions } from "./types";
import { mapHtmlFileToUrl } from "./url";

const EXCLUDE_SELECTORS = [
  "nav",
  "footer",
  "aside",
  "script",
  "style",
  "noscript",
  "svg",
  "[data-search-exclude]",
  ".no-search"
].join(",");

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function makeExcerpt(bodyText: string, maxLength = 200): string {
  if (bodyText.length <= maxLength) {
    return bodyText;
  }

  const snippet = bodyText.slice(0, maxLength);
  const cutoff = snippet.lastIndexOf(" ");
  const trimmed = cutoff > 100 ? snippet.slice(0, cutoff) : snippet;
  return `${trimmed}…`;
}

function filenameFallback(filePath: string): string {
  const name = path.basename(filePath, ".html").replace(/[-_]/g, " ").trim();
  return name || "Untitled";
}

export function extractDocumentFromHtml(options: ExtractHtmlOptions): ExtractedDocument | null {
  const { filePath, html, inputRoot, baseUrl, urlMode = "pretty" } = options;
  const $ = load(html);

  const contentRoot = $("main").first().length
    ? $("main").first()
    : $("article").first().length
      ? $("article").first()
      : $("body").first();

  if (!contentRoot.length) {
    return null;
  }

  contentRoot.find(EXCLUDE_SELECTORS).remove();

  const firstH1 = normalizeText(contentRoot.find("h1").first().text());
  const titleTag = normalizeText($("title").first().text());
  const titleSource = firstH1 ? "h1" : titleTag ? "title" : "filename";

  const title = firstH1 || titleTag || filenameFallback(filePath);
  if (/\b404\b/i.test(title)) {
    return null;
  }

  const headings: string[] = [];
  const headingSet = new Set<string>();
  contentRoot.find("h2, h3").each((_, el) => {
    if (headings.length >= 20) {
      return;
    }

    const value = normalizeText($(el).text());
    if (!value || headingSet.has(value)) {
      return;
    }

    headingSet.add(value);
    headings.push(value);
  });

  const bodyText = normalizeText(contentRoot.text());
  if (bodyText.length < 50 && headings.length === 0 && titleSource === "filename") {
    return null;
  }

  return {
    url: mapHtmlFileToUrl(filePath, inputRoot, baseUrl, urlMode),
    title,
    headings,
    bodyText,
    excerpt: makeExcerpt(bodyText),
    titleSource
  };
}
