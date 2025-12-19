// js/coursesStorage.js
import { supabase } from "./supabaseClient.js";
import { ensureSession } from "./storage.js";

// Returns [{id, name, par}]
export async function listCourses() {
  const user = await ensureSession();
  const { data, error } = await supabase
    .from("courses")
    .select("id, name, par, updated_at")
    .eq("owner_id", user.id)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    par: Array.isArray(c.par) ? c.par : [],
    updated_at: c.updated_at,
  }));
}

export async function upsertCourseByName({ name, par }) {
  const user = await ensureSession();
  const cleanName = String(name ?? "").trim();
  if (!cleanName) throw new Error("Course name is required");

  const cleanPar = Array.isArray(par) ? par : [];

  const { data, error } = await supabase
    .from("courses")
    .upsert(
      { owner_id: user.id, name: cleanName, par: cleanPar },
      { onConflict: "owner_id,name" }
    )
    .select("id, name, par")
    .single();

  if (error) throw error;
  return data;
}
