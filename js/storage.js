// js/storage.js
import { supabase } from "./supabaseClient.js";

const LS_TRIP_ID = "gtp_trip_id_v1";

export async function ensureSession() {
  // If already signed in, keep it.
  const { data: sess } = await supabase.auth.getSession();
  if (sess?.session?.user) return sess.session.user;

  // Anonymous sign-in (requires Supabase Auth to allow anonymous)
  // If your SDK version uses a different name, we’ll adjust, but this is the modern approach.
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.user;
}

export async function loadModel() {
  const user = await ensureSession();

  // Try to load the selected trip id (cached locally)
  const tripId = localStorage.getItem(LS_TRIP_ID);

  if (tripId) {
    const { data, error } = await supabase
      .from("trips")
      .select("id, name, model")
      .eq("id", tripId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!error && data?.model) return normalizeModel(data.model, data.id);
  }

  // Otherwise load most recently updated trip
  const { data: latest, error: latestErr } = await supabase
    .from("trips")
    .select("id, name, model")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestErr && latest?.model) {
    localStorage.setItem(LS_TRIP_ID, latest.id);
    return normalizeModel(latest.model, latest.id);
  }

  // Create a new trip
  const starter = normalizeModel({
    itineraryDays: [],
    players: [],
    rounds: [],
    defaultHoles: 18,
    playersPerGroup: 4,
  });

  const { data: created, error: createErr } = await supabase
    .from("trips")
    .insert({
      user_id: user.id,
      name: "My Golf Trip",
      model: starter,
    })
    .select("id, model")
    .single();

  if (createErr) throw createErr;

  localStorage.setItem(LS_TRIP_ID, created.id);
  return normalizeModel(created.model, created.id);
}

export async function saveModel(model) {
  const user = await ensureSession();
  const tripId = model?._tripId || localStorage.getItem(LS_TRIP_ID);
  if (!tripId) throw new Error("Missing trip id");

  const cleaned = { ...model };
  delete cleaned._tripId;

  const { error } = await supabase
    .from("trips")
    .update({ model: cleaned })
    .eq("id", tripId)
    .eq("owner_id", user.id)

  if (error) throw error;
}

function normalizeModel(model, tripId) {
  const m = model && typeof model === "object" ? model : {};
  return {
    itineraryDays: Array.isArray(m.itineraryDays) ? m.itineraryDays : [],
    players: Array.isArray(m.players) ? m.players : [],
    rounds: Array.isArray(m.rounds) ? m.rounds : [],
    defaultHoles: Number(m.defaultHoles ?? 18) || 18,
    playersPerGroup: Number(m.playersPerGroup ?? 4) || 4,
    ...m,
    _tripId: tripId ?? m._tripId,
  };
}
