import { describe, expect, it } from "vitest";

import { buildInvertedIndex } from "../indexer";

describe("buildInvertedIndex", () => {
  it("applies title/headings/body weights with field dedupe", () => {
    const { inv } = buildInvertedIndex([
      {
        id: 0,
        url: "/intro/",
        title: "Search Search Intro",
        headings: ["Search Basics"],
        excerpt: "",
        bodyText: "search search intro basics tokens"
      }
    ]);

    expect(inv.terms.search).toEqual([[0, 9]]);
    expect(inv.terms.intro).toEqual([[0, 6]]);
    expect(inv.terms.basics).toEqual([[0, 4]]);
  });
});
