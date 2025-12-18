// js/supabaseClient.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://gtesten.github.io/golf-trip-planner/";
const SUPABASE_ANON_KEY = "sb_publishable_y5qYE-uYPTtNrdM0vI5tJA_V8IA29U1";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
