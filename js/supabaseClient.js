// js/supabaseClient.js
// Supabase client + auth helpers

'use strict';

// ✅ Replace these with your Supabase Project Settings → API values
const SUPABASE_URL = 'https://qnfwckmwbudvuijqlkns.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_y5qYE-uYPTtNrdM0vI5tJA_V8IA29U1';

if (!window.supabase) {
  console.error('[GolfTripPlanner] Supabase JS not loaded. Check index.html script tag.');
}

const { createClient } = window.supabase;

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function ensureAnonymousSession(setStatus) {
  try {
    if (setStatus) setStatus('Checking session…', 'loading');

    const { data: sessionData, error: sessionError } =
      await supabaseClient.auth.getSession();

    if (sessionError) {
      console.error('[GolfTripPlanner] getSession error:', sessionError);
    }

    if (sessionData?.session) {
      if (setStatus) setStatus('Anonymous session active', 'ok');
      return true;
    }

    if (setStatus) setStatus('Signing in anonymously…', 'loading');

    const { error } = await supabaseClient.auth.signInAnonymously();

    if (error) {
      console.error('[GolfTripPlanner] signInAnonymously error:', error);
      if (setStatus) setStatus('Anon auth failed – see console.', 'error');
      return false;
    }

    if (setStatus) setStatus('Anonymous session active', 'ok');
    return true;
  } catch (e) {
    console.error('[GolfTripPlanner] ensureAnonymousSession exception:', e);
    if (setStatus) setStatus('Anon auth exception – see console.', 'error');
    return false;
  }
}
