import { createSearch, type SearchResult } from "@searchkit/client";

import { BASE_STYLES } from "./baseStyles";

type Hotkey = string;

export interface WidgetTheme {
  bg?: string;
  fg?: string;
  border?: string;
  shadow?: string;
  accent?: string;
  muted?: string;
}

export interface SearchWidgetOptions {
  metaUrl: string;
  placeholder?: string;
  hotkeys?: Hotkey[];
  maxResults?: number;
  theme?: WidgetTheme;
}

export interface SearchWidgetHandle {
  destroy(): void;
  open(): void;
  close(): void;
}

const DEFAULT_HOTKEYS: Hotkey[] = ["Meta+K", "/"];
const INPUT_DEBOUNCE_MS = 100;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function ensureStyles(): void {
  if (document.getElementById("searchkit-widget-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "searchkit-widget-styles";
  style.textContent = BASE_STYLES;
  document.head.append(style);
}

function resolveContainer(containerOrSelector?: string | Element): Element {
  if (typeof containerOrSelector === "string") {
    return document.querySelector(containerOrSelector) ?? document.body;
  }
  return containerOrSelector ?? document.body;
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]')
  );
}

function keyMatchesHotkey(event: KeyboardEvent, hotkey: string): boolean {
  const normalized = hotkey.toLowerCase();
  if (normalized === "/") {
    return event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey;
  }

  const parts = normalized.split("+");
  const key = parts.at(-1);
  if (!key) {
    return false;
  }

  const wantsMeta = parts.includes("meta");
  const wantsCtrl = parts.includes("ctrl") || parts.includes("control");
  const wantsAlt = parts.includes("alt");
  const wantsShift = parts.includes("shift");

  if (wantsMeta && !(event.metaKey || event.ctrlKey)) {
    return false;
  }
  if (wantsCtrl && !event.ctrlKey) {
    return false;
  }
  if (wantsAlt && !event.altKey) {
    return false;
  }
  if (wantsShift && !event.shiftKey) {
    return false;
  }

  return event.key.toLowerCase() === key;
}

function applyTheme(host: HTMLElement, theme?: WidgetTheme): void {
  if (!theme) {
    return;
  }

  if (theme.bg) host.style.setProperty("--sk-bg", theme.bg);
  if (theme.fg) host.style.setProperty("--sk-fg", theme.fg);
  if (theme.border) host.style.setProperty("--sk-border", theme.border);
  if (theme.shadow) host.style.setProperty("--sk-shadow", theme.shadow);
  if (theme.accent) host.style.setProperty("--sk-accent", theme.accent);
  if (theme.muted) host.style.setProperty("--sk-muted", theme.muted);
}

export function mountSearchWidget(
  containerOrSelector?: string | Element,
  options?: SearchWidgetOptions
): SearchWidgetHandle {
  const {
    metaUrl = "/search/index.meta.json",
    placeholder = "Search docs...",
    maxResults = 8
  } = options ?? {};

  const hotkeys = options?.hotkeys?.length ? options.hotkeys : DEFAULT_HOTKEYS;

  ensureStyles();
  const container = resolveContainer(containerOrSelector);
  const host = document.createElement("div");
  host.className = "sk-host";
  container.append(host);

  applyTheme(host, options?.theme);

  host.innerHTML = `
    <div class="sk-overlay" data-open="false" role="dialog" aria-modal="true" aria-label="Search">
      <div class="sk-modal">
        <label class="sk-input-wrap">
          <span>Search</span>
          <input class="sk-input" type="search" autocomplete="off" />
          <span class="sk-status" aria-live="polite"></span>
        </label>
        <div class="sk-results"><div class="sk-empty">Type to search...</div></div>
        <div class="sk-footer">
          <a
            class="sk-powered-by"
            href="https://github.com/karlhills/searchkit"
            target="_blank"
            rel="noreferrer noopener"
            >Powered by SearchKit</a
          >
        </div>
      </div>
    </div>
  `;

  const overlay = host.querySelector<HTMLElement>(".sk-overlay");
  const input = host.querySelector<HTMLInputElement>(".sk-input");
  const resultsRoot = host.querySelector<HTMLElement>(".sk-results");
  const status = host.querySelector<HTMLElement>(".sk-status");

  if (!overlay || !input || !resultsRoot || !status) {
    throw new Error("Failed to initialize search widget");
  }
  input.placeholder = placeholder;

  const enginePromise = createSearch({ metaUrl });
  let open = false;
  let selectedIndex = 0;
  let results: SearchResult[] = [];
  let lastFocused: HTMLElement | null = null;
  let requestId = 0;
  let hasFocused = false;
  let debounceTimer: number | undefined;

  const navigate = (url: string): void => {
    window.location.href = url;
  };

  const renderResults = (): void => {
    if (!results.length) {
      resultsRoot.innerHTML = '<div class="sk-empty">No results</div>';
      return;
    }

    const items = results
      .map((result, index) => {
        const selected = index === selectedIndex ? "true" : "false";
        return `
          <button class="sk-item" data-index="${index}" data-selected="${selected}" type="button">
            <div class="sk-title">${escapeHtml(result.title)}</div>
            <div class="sk-excerpt">${result.excerpt}</div>
          </button>
        `;
      })
      .join("");

    resultsRoot.innerHTML = items;
  };

  const setLoadingState = (loading: boolean): void => {
    resultsRoot.dataset.loading = loading ? "true" : "false";
    status.textContent = loading ? "Loading…" : "";
  };

  const prewarmCurrentInput = async (): Promise<void> => {
    const value = input.value.trim();
    if (!value) {
      return;
    }

    const engine = await enginePromise;
    await engine.prewarm(value);
  };

  const runSearch = async (): Promise<void> => {
    const query = input.value.trim();
    if (!query) {
      results = [];
      selectedIndex = 0;
      resultsRoot.innerHTML = '<div class="sk-empty">Type to search...</div>';
      setLoadingState(false);
      return;
    }

    const current = ++requestId;
    setLoadingState(true);

    try {
      const engine = await enginePromise;
      const nextResults = await engine.query(query, {
        limit: maxResults,
        highlight: true
      });

      if (current !== requestId) {
        return;
      }

      results = nextResults;
      selectedIndex = 0;
      renderResults();
    } finally {
      if (current === requestId) {
        setLoadingState(false);
      }
    }
  };

  const scheduleSearch = (): void => {
    if (debounceTimer !== undefined) {
      window.clearTimeout(debounceTimer);
    }

    debounceTimer = window.setTimeout(() => {
      void runSearch();
    }, INPUT_DEBOUNCE_MS);
  };

  const openModal = (): void => {
    if (open) {
      return;
    }

    open = true;
    lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    overlay.dataset.open = "true";
    input.focus();
    input.select();
    void prewarmCurrentInput();
  };

  const closeModal = (): void => {
    if (!open) {
      return;
    }

    open = false;
    overlay.dataset.open = "false";
    if (lastFocused?.isConnected) {
      lastFocused.focus();
    }
  };

  const onDocumentKeyDown = (event: KeyboardEvent): void => {
    if (open) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
      }
      return;
    }

    const shouldOpen = hotkeys.some((hotkey) => keyMatchesHotkey(event, hotkey));
    if (!shouldOpen) {
      return;
    }

    if (keyMatchesHotkey(event, "/") && isEditableElement(event.target)) {
      return;
    }

    event.preventDefault();
    openModal();
  };

  const onInputKeyDown = (event: KeyboardEvent): void => {
    if (!open) {
      return;
    }

    if (event.key === "ArrowDown") {
      if (!results.length) {
        return;
      }
      event.preventDefault();
      selectedIndex = Math.min(results.length - 1, selectedIndex + 1);
      renderResults();
      return;
    }

    if (event.key === "ArrowUp") {
      if (!results.length) {
        return;
      }
      event.preventDefault();
      selectedIndex = Math.max(0, selectedIndex - 1);
      renderResults();
      return;
    }

    if (event.key === "Enter") {
      const selected = results[selectedIndex];
      if (!selected) {
        return;
      }

      event.preventDefault();
      navigate(selected.url);
    }
  };

  const onOverlayClick = (event: MouseEvent): void => {
    if (event.target === overlay) {
      closeModal();
    }
  };

  const onInputFocus = (): void => {
    if (hasFocused) {
      return;
    }

    hasFocused = true;
    void prewarmCurrentInput();
  };

  const onResultsClick = (event: MouseEvent): void => {
    const target =
      event.target instanceof Element ? event.target.closest<HTMLElement>(".sk-item") : null;
    if (!target) {
      return;
    }

    const index = Number.parseInt(target.dataset.index ?? "", 10);
    const selected = results[index];
    if (!selected) {
      return;
    }

    navigate(selected.url);
  };

  document.addEventListener("keydown", onDocumentKeyDown);
  overlay.addEventListener("click", onOverlayClick);
  input.addEventListener("keydown", onInputKeyDown);
  input.addEventListener("focus", onInputFocus);
  const onInput = () => {
    scheduleSearch();
  };
  input.addEventListener("input", onInput);
  resultsRoot.addEventListener("click", onResultsClick);

  return {
    destroy() {
      document.removeEventListener("keydown", onDocumentKeyDown);
      overlay.removeEventListener("click", onOverlayClick);
      input.removeEventListener("keydown", onInputKeyDown);
      input.removeEventListener("focus", onInputFocus);
      input.removeEventListener("input", onInput);
      resultsRoot.removeEventListener("click", onResultsClick);
      if (debounceTimer !== undefined) {
        window.clearTimeout(debounceTimer);
      }
      host.remove();
    },
    open: openModal,
    close: closeModal
  };
}

export { BASE_STYLES as widgetStyles };
