export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function highlightText(text: string, tokens: string[]): string {
  if (!tokens.length) {
    return escapeHtml(text);
  }

  const escaped = escapeHtml(text);
  const uniqueTokens = [...new Set(tokens)].sort((a, b) => b.length - a.length);
  const pattern = uniqueTokens
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");

  if (!pattern) {
    return escaped;
  }

  const re = new RegExp(`\\b(${pattern})\\b`, "gi");
  return escaped.replace(re, "<mark>$1</mark>");
}
