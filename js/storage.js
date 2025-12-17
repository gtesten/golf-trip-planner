const KEY = "gtp:model:v2";
const SB_KEY = "gtp:supabase:v1";

export function loadModel() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveModel(model) {
  localStorage.setItem(KEY, JSON.stringify(model));
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
