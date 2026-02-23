export const BASE_STYLES = `
:root {
  --sk-bg: #ffffff;
  --sk-fg: #111827;
  --sk-border: #d1d5db;
  --sk-shadow: 0 20px 45px rgba(15, 23, 42, 0.28);
  --sk-accent: #2563eb;
  --sk-muted: #6b7280;
}

.sk-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: none;
  align-items: flex-start;
  justify-content: center;
  padding: 7vh 1rem 1rem;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(3px);
}

.sk-overlay[data-open="true"] {
  display: flex;
}

.sk-modal {
  width: min(760px, 100%);
  background: var(--sk-bg);
  color: var(--sk-fg);
  border: 1px solid var(--sk-border);
  border-radius: 14px;
  box-shadow: var(--sk-shadow);
  overflow: hidden;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
}

.sk-input-wrap {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  border-bottom: 1px solid var(--sk-border);
  padding: 0.75rem 1rem;
}

.sk-input-wrap span {
  color: var(--sk-muted);
  font-size: 0.85rem;
  letter-spacing: 0.02em;
}

.sk-input {
  width: 100%;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--sk-fg);
  font-size: 1rem;
}

.sk-results {
  max-height: 60vh;
  overflow: auto;
  padding: 0.3rem;
}

.sk-empty {
  color: var(--sk-muted);
  font-size: 0.95rem;
  padding: 1.25rem 1rem;
}

.sk-item {
  border: 1px solid transparent;
  border-radius: 10px;
  display: block;
  padding: 0.7rem 0.8rem;
  text-align: left;
  width: 100%;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.sk-item mark {
  background: color-mix(in srgb, var(--sk-accent) 24%, transparent);
  color: inherit;
  padding: 0 0.1em;
  border-radius: 3px;
}

.sk-item[data-selected="true"] {
  border-color: color-mix(in srgb, var(--sk-accent) 40%, var(--sk-border));
  background: color-mix(in srgb, var(--sk-accent) 9%, transparent);
}

.sk-title {
  font-weight: 600;
  margin-bottom: 0.2rem;
}

.sk-excerpt {
  color: var(--sk-muted);
  font-size: 0.9rem;
  line-height: 1.35;
}

@media (max-width: 640px) {
  .sk-overlay {
    padding-top: 1rem;
  }

  .sk-results {
    max-height: 70vh;
  }
}
`;
