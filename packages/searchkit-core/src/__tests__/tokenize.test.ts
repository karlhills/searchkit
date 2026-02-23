import { describe, expect, it } from "vitest";

import { tokenize } from "../tokenize";

describe("tokenize", () => {
  it("lowercases, splits and removes stopwords/short tokens", () => {
    const tokens = tokenize("The Quick, brown fox jumps over a lazy dog in 2024!");
    expect(tokens).toEqual(["quick", "brown", "fox", "jumps", "lazy", "dog", "2024"]);
  });

  it("dedupes and respects limits", () => {
    const tokens = tokenize("Alpha alpha beta gamma", { dedupe: true, limit: 2 });
    expect(tokens).toEqual(["alpha", "beta"]);
  });
});
