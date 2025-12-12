// js/supabaseClient.js
// Supabase client + auth helpers

'use strict';

// ✅ Replace these with your Supabase Project Settings → API values
const SUPABASE_URL = 'https://qnfwckmwbudvuijqlkns.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_y5qYE-uYPTtNrdM0vI5tJA_V8IA29U1';

const LS_SESSION_KEY = 'gtp_supabase_session_v1';

if (!window.supabase) {
  console.error('[GolfTripPlanner] Supabase JS not loaded. Check index.html script tag.');
}

const { createClient } = window.supabase;

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function persistSession(session) {
  try {
    if (!session) return;
    localStorage.setItem(
      LS_SESSION_KEY,
      JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      })
    );
  } catch {}
}

async function restoreSessionIfPresent() {
  try {
    const raw = localStorage.getItem(LS_SESSION_KEY);
    if (!raw) return false;
    const session = JSON.parse(raw);
    if (!session?.access_token || !session?.refresh_token) return false;

    const { data, error } = await supabaseClient.auth.setSession(session);
    if (error) return false;
    if (data?.session) {
      persistSession(data.session);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function ensureAnonymousSession(setStatus) {
  try {
    if (setStatus) setStatus('Checking session…', 'loading');

    await restoreSessionIfPresent();

    const { data: sessionData, error: sessionError } =
      await supabaseClient.auth.getSession();

    if (sessionError) {
      console.error('[GolfTripPlanner] getSession error:', sessionError);
    }

    if (sessionData?.session) {
      persistSession(sessionData.session);
      if (setStatus) setStatus('Anonymous session active', 'ok');
      return true;
    }

    if (setStatus) setStatus('Signing in anonymously…', 'loading');

    const { data, error } = await supabaseClient.auth.signInAnonymously();

    if (error) {
      console.error('[GolfTripPlanner] signInAnonymously error:', error);
      if (setStatus) setStatus('Anon auth failed – see console.', 'error');
      return false;
    }

    persistSession(data?.session);

    supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (session) persistSession(session);
    });

    if (setStatus) setStatus('Anonymous session active', 'ok');
    return true;
  } catch (e) {
    console.error('[GolfTripPlanner] ensureAnonymousSession exception:', e);
    if (setStatus) setStatus('Anon auth exception – see console.', 'error');
    return false;
  }
}
