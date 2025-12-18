// js/supabaseClient.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// IMPORTANT: Must be an absolute URL like "https://YOUR-PROJECT-REF.supabase.co"
const SUPABASE_URL = "https://qnfwckmwbudvuijqlkns.supabase.co";

// IMPORTANT: Your anon/public key from Supabase -> Project Settings -> API
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuZndja213YnVkdnVpanFsa25zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzOTI4MzksImV4cCI6MjA4MDk2ODgzOX0.dwMCVUoOsk2RxEeOI93pvmejaKwGDM9k6hxbrfPHgFs";

function assertValidSupabaseConfig() {
  if (!SUPABASE_URL || !/^https:\/\/.+\.supabase\.co\/?$/.test(SUPABASE_URL)) {
    throw new Error(
      `Supabase URL is not set correctly. Expected "https://<project-ref>.supabase.co" but got: ${SUPABASE_URL}`
    );
  }
  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes("YOUR_")) {
    throw new Error("Supabase anon key is not set. Paste your anon/public key into supabaseClient.js");
  }
}

assertValidSupabaseConfig();

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
