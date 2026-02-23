import type { BuildIndexResult, IndexableDocument } from "./types";
import { FIELD_TOKEN_LIMITS, tokenizeField } from "./tokenize";

export function buildInvertedIndex(documents: IndexableDocument[]): BuildIndexResult {
  const terms: Record<string, Array<[number, number]>> = {};

  for (const doc of documents) {
    const docWeights = new Map<string, number>();

    for (const token of tokenizeField(doc.title, FIELD_TOKEN_LIMITS.title)) {
      docWeights.set(token, (docWeights.get(token) ?? 0) + 5);
    }

    for (const token of tokenizeField(doc.headings.join(" "), FIELD_TOKEN_LIMITS.headings)) {
      docWeights.set(token, (docWeights.get(token) ?? 0) + 3);
    }

    for (const token of tokenizeField(doc.bodyText, FIELD_TOKEN_LIMITS.body)) {
      docWeights.set(token, (docWeights.get(token) ?? 0) + 1);
    }

    for (const [token, score] of docWeights) {
      const postings = terms[token] ?? (terms[token] = []);
      postings.push([doc.id, score]);
    }
  }

  const sortedTerms = Object.fromEntries(
    Object.entries(terms)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([token, postings]) => [token, postings.sort((a, b) => a[0] - b[0])])
  );

  return {
    docs: documents.map(({ id, url, title, headings, excerpt }) => ({
      id,
      url,
      title,
      headings,
      excerpt
    })),
    inv: {
      terms: sortedTerms
    }
  };
}
