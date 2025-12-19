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

export function getActiveTripId() {
  return localStorage.getItem(LS_TRIP_ID);
}

export function setActiveTripId(tripId) {
  localStorage.setItem(LS_TRIP_ID, tripId);
}

/* ---------------------------
   Load / Save
---------------------------- */

export async function loadModel() {
  const user = await ensureSession();
  const tripId = getActiveTripId();

  if (tripId) {
    const { data, error } = await supabase
      .from("trips")
      .select("id, name, model, updated_at")
      .eq("id", tripId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!error && data?.model) return normalizeModel(data.model, data.id, data.name);
  }

  const { data: latest, error: latestErr } = await supabase
    .from("trips")
    .select("id, name, model, updated_at")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestErr && latest?.model) {
    setActiveTripId(latest.id);
    return normalizeModel(latest.model, latest.id, latest.name);
  }

  const starter = normalizeModel({
    itineraryDays: [],
    players: [],
    rounds: [],
    defaultHoles: 18,
    playersPerGroup: 4,
  });

  return await createTrip({ name: "My Golf Trip", model: starter });
}

export async function saveModel(model) {
  const user = await ensureSession();
  const tripId = model?._tripId || getActiveTripId();
  if (!tripId) throw new Error("Missing trip id");

  const cleaned = { ...model };
  delete cleaned._tripId;
  delete cleaned._tripName;

  const { error } = await supabase
    .from("trips")
    .update({ model: cleaned })
    .eq("id", tripId)
    .eq("owner_id", user.id);

  if (error) throw error;
}

/* ---------------------------
   Trips: create / list / switch / rename
---------------------------- */

export async function createTrip({ name, model }) {
  const user = await ensureSession();

  const cleaned = { ...(model ?? {}) };
  delete cleaned._tripId;
  delete cleaned._tripName;

  const tripName = String(name ?? "New Trip").trim() || "New Trip";

  const { data, error } = await supabase
    .from("trips")
    .insert({
      owner_id: user.id,
      name: tripName,
      model: cleaned,
    })
    .select("id, name, model")
    .single();

  if (error) throw error;

  setActiveTripId(data.id);
  return normalizeModel(data.model, data.id, data.name);
}

export async function listTrips({ limit = 25 } = {}) {
  const user = await ensureSession();

  const { data, error } = await supabase
    .from("trips")
    .select("id, name, updated_at")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function loadTripById(tripId) {
  const user = await ensureSession();
  const { data, error } = await supabase
    .from("trips")
    .select("id, name, model")
    .eq("id", tripId)
    .eq("owner_id", user.id)
    .single();

  if (error) throw error;

  setActiveTripId(data.id);
  return normalizeModel(data.model, data.id, data.name);
}

export async function renameTrip(tripId, newName) {
  const user = await ensureSession();
  const name = String(newName ?? "").trim();
  if (!name) throw new Error("Trip name required");

  const { data, error } = await supabase
    .from("trips")
    .update({ name })
    .eq("id", tripId)
    .eq("owner_id", user.id)
    .select("id, name")
    .single();

  if (error) throw error;
  return data;
}

/* ---------------------------
   Normalize
---------------------------- */

function normalizeModel(model, tripId, tripName) {
  const m = model && typeof model === "object" ? model : {};
  return {
    itineraryDays: Array.isArray(m.itineraryDays) ? m.itineraryDays : [],
    players: Array.isArray(m.players) ? m.players : [],
    rounds: Array.isArray(m.rounds) ? m.rounds : [],
    defaultHoles: Number(m.defaultHoles ?? 18) || 18,
    playersPerGroup: Number(m.playersPerGroup ?? 4) || 4,
    ...m,
    _tripId: tripId ?? m._tripId,
    _tripName: tripName ?? m._tripName ?? "Golf Trip",
  };
}
