// js/storage.js
import { supabase } from "./supabaseClient.js";

const LS_TRIP_ID = "gtp_trip_id_v1";

export async function ensureSession() {
  const { data: sess } = await supabase.auth.getSession();
  if (sess?.session?.user) return sess.session.user;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.user;
}

export function setActiveTripId(tripId) {
  localStorage.setItem(LS_TRIP_ID, tripId);
}

export async function loadModel() {
  const user = await ensureSession();

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

  const { data: latest, error: latestErr } = await supabase
    .from("trips")
    .select("id, name, model")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestErr && latest?.model) {
    setActiveTripId(latest.id);
    return normalizeModel(latest.model, latest.id);
  }

  // Create new trip
  const starter = normalizeModel({
    itineraryDays: [],
    players: [],
    rounds: [],
    defaultHoles: 18,
    playersPerGroup: 4,
  });

  const created = await createTrip({ name: "My Golf Trip", model: starter });
  return created;
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
    .eq("owner_id", user.id);

  if (error) throw error;
}

export async function createTrip({ name, model }) {
  const user = await ensureSession();

  const cleaned = { ...(model ?? {}) };
  delete cleaned._tripId;

  const { data, error } = await supabase
    .from("trips")
    .insert({
      owner_id: user.id,
      name: String(name ?? "Imported Trip").trim() || "Imported Trip",
      model: cleaned,
    })
    .select("id, model")
    .single();

  if (error) throw error;

  setActiveTripId(data.id);
  return normalizeModel(data.model, data.id);
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
