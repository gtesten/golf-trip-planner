const KEY = "gtp:model:v2";

export function loadModel(defaultModel) {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : structuredClone(defaultModel);
  } catch {
    return structuredClone(defaultModel);
  }
}

export function saveModel(model) {
  localStorage.setItem(KEY, JSON.stringify(model));
  queueMicrotask(() => {
    window.dispatchEvent(new CustomEvent("gtp:model:changed", { detail: model }));
  });
}

export function resetModel() {
  localStorage.removeItem(KEY);
}

export function loadSupabaseConfig() {
  try {
    const raw = localStorage.getItem(SB_KEY);
    if (!raw) return { url: "", anon: "" };
    const v = JSON.parse(raw);
    return { url: v.url || "", anon: v.anon || "" };
  } catch {
    return { url: "", anon: "" };
  }
}

export function saveSupabaseConfig(cfg) {
  localStorage.setItem(SB_KEY, JSON.stringify({ url: cfg.url || "", anon: cfg.anon || "" }));
}

export function clearSupabaseConfig() {
  localStorage.removeItem(SB_KEY);
}
