import { ENGLISH_STOPWORDS } from "./stopwords";

export const FIELD_TOKEN_LIMITS = {
  title: 50,
  headings: 200,
  body: 5000
} as const;

export interface TokenizeOptions {
  dedupe?: boolean;
  limit?: number;
}

export function tokenize(text: string, options: TokenizeOptions = {}): string[] {
  const { dedupe = false, limit } = options;
  const matches = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const tokens: string[] = [];
  const seen = new Set<string>();

  for (const token of matches) {
    if (token.length < 2 || ENGLISH_STOPWORDS.has(token)) {
      continue;
    }

    if (dedupe) {
      if (seen.has(token)) {
        continue;
      }
      seen.add(token);
    }

    tokens.push(token);
    if (limit && tokens.length >= limit) {
      break;
    }
  }

  return tokens;
}

export function tokenizeField(text: string, limit: number): string[] {
  return tokenize(text, { dedupe: true, limit });
}
