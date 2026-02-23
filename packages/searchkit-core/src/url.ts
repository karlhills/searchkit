import path from "node:path";

export function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed || trimmed === "/") {
    return "/";
  }

  const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
}

export function mapHtmlFileToUrl(filePath: string, inputRoot: string, baseUrl: string): string {
  const rel = path.relative(inputRoot, filePath).split(path.sep).join("/");
  let routePath = "/";

  if (rel === "index.html") {
    routePath = "/";
  } else if (rel.endsWith("/index.html")) {
    routePath = `/${rel.slice(0, -"index.html".length)}`;
  } else if (rel.endsWith(".html")) {
    routePath = `/${rel.slice(0, -".html".length)}`;
  }

  const normalizedBase = normalizeBaseUrl(baseUrl);
  if (normalizedBase === "/") {
    return routePath;
  }

  const suffix = routePath === "/" ? "" : routePath.slice(1);
  return `${normalizedBase}${suffix}`;
}
