import { describe, expect, it } from "vitest";

import { mapHtmlFileToUrl, normalizeBaseUrl } from "../url";

describe("normalizeBaseUrl", () => {
  it("normalizes path-style base URLs", () => {
    expect(normalizeBaseUrl("/")).toBe("/");
    expect(normalizeBaseUrl("docs")).toBe("/docs/");
    expect(normalizeBaseUrl("/docs")).toBe("/docs/");
  });

  it("accepts absolute URLs and keeps only the pathname", () => {
    expect(normalizeBaseUrl("https://www.84boxes.com/")).toBe("/");
    expect(normalizeBaseUrl("https://www.84boxes.com/docs")).toBe("/docs/");
    expect(normalizeBaseUrl("https://www.84boxes.com/docs/")).toBe("/docs/");
  });
});

describe("mapHtmlFileToUrl", () => {
  it("maps files correctly when baseUrl is an absolute URL", () => {
    const inputRoot = "/tmp/dist";
    expect(
      mapHtmlFileToUrl("/tmp/dist/matchforge/index.html", inputRoot, "https://www.84boxes.com/")
    ).toBe("/matchforge/");

    expect(
      mapHtmlFileToUrl(
        "/tmp/dist/matchforge/index.html",
        inputRoot,
        "https://www.84boxes.com/docs/"
      )
    ).toBe("/docs/matchforge/");
  });
});
