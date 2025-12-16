import { loadSupabaseConfig } from "./storage.js";

let _client = null;

export async function getSupabaseClient() {
  const cfg = loadSupabaseConfig();
  if (!cfg.url || !cfg.anon) return null;

  if (_client) return _client;

  // ESM build from CDN (no React/Babel needed)
  const mod = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
  _client = mod.createClient(cfg.url, cfg.anon, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  return _client;
}
