import path from "node:path";
import type { UrlMode } from "./types";

function stripOrigin(baseUrl: string): string {
  if (baseUrl.startsWith("http://") || baseUrl.startsWith("https://")) {
    try {
      return new URL(baseUrl).pathname || "/";
    } catch {
      return baseUrl;
    }
  }

  if (baseUrl.startsWith("//")) {
    try {
      return new URL(`https:${baseUrl}`).pathname || "/";
    } catch {
      return baseUrl;
    }
  }

  return baseUrl;
}

export function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = stripOrigin(baseUrl.trim());
  if (!trimmed || trimmed === "/") {
    return "/";
  }

  const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
}

export function mapHtmlFileToUrl(
  filePath: string,
  inputRoot: string,
  baseUrl: string,
  urlMode: UrlMode = "pretty"
): string {
  const rel = path.relative(inputRoot, filePath).split(path.sep).join("/");
  let routePath = "/";

  if (rel === "index.html") {
    routePath = urlMode === "html" ? "/index.html" : "/";
  } else if (rel.endsWith("/index.html")) {
    routePath = urlMode === "html" ? `/${rel}` : `/${rel.slice(0, -"index.html".length)}`;
  } else if (rel.endsWith(".html")) {
    routePath = urlMode === "html" ? `/${rel}` : `/${rel.slice(0, -".html".length)}`;
  }

  const normalizedBase = normalizeBaseUrl(baseUrl);
  if (normalizedBase === "/") {
    return routePath;
  }

  const suffix = routePath === "/" ? "" : routePath.slice(1);
  return `${normalizedBase}${suffix}`;
}
