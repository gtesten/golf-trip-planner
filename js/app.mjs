import { initTabs } from "./tabs.js";
import { loadModel, saveModel, resetModel, loadSupabaseConfig, saveSupabaseConfig, clearSupabaseConfig } from "./storage.js";
import { bindItineraryUI, renderItinerary } from "./itinerary.js";
import { bindPairingsUI, renderPairings } from "./pairings.js";
import { getSupabaseClient } from "./supabaseClient.js";
import { bindTripUI, renderTrip } from "./tripDetails.js";
import { bindOverviewUI, renderOverview } from "./overview.js";

const DEFAULT_MODEL = {
  ui: { playersApplied: false },
  trip: {
    name: "",
    dates: "",
    location: "",
    lodging: "",
    mapLink: "",
    notes: "",
    roster: ""
  },
  itinerary: [],
  players: [],
  rounds: []
};

const model = loadModel() ?? structuredClone(DEFAULT_MODEL);
saveModel(model);

document.getElementById("year").textContent = new Date().getFullYear();

initTabs({ defaultTab: "itinerary" });

// ---- Itinerary ----
bindItineraryUI(model);
renderItinerary(model);
bindTripUI(model);
renderTrip(model);
bindOverviewUI(model);
renderOverview(model);

// ---- Pairings/Scores ----
bindPairingsUI(model);
renderPairings(model);

// ---- Settings: Supabase + import/export ----
const sbUrl = document.getElementById("sbUrl");
const sbAnon = document.getElementById("sbAnon");
const btnSaveSupabase = document.getElementById("btnSaveSupabase");
const btnClearSupabase = document.getElementById("btnClearSupabase");
const btnExport = document.getElementById("btnExport");
const importFile = document.getElementById("importFile");

function setStatus(text, ok = true) {
  document.getElementById("statusText").textContent = text;
  const dot = document.querySelector("#statusPill .dot");
  dot.style.background = ok ? "var(--green)" : "rgba(239,68,68,1)";
  dot.style.boxShadow = ok ? "0 0 0 6px rgba(24,196,124,.15)" : "0 0 0 6px rgba(239,68,68,.15)";
}

function refreshSupabaseInputs() {
  const cfg = loadSupabaseConfig();
  sbUrl.value = cfg.url;
  sbAnon.value = cfg.anon;
}
refreshSupabaseInputs();

// Keep Overview in sync with edits anywhere (Trip Details, Itinerary, Pairings, etc.)
window.addEventListener("gtp:model:changed", (e) => {
  renderOverview(e.detail);
});

btnSaveSupabase.addEventListener("click", async () => {
  saveSupabaseConfig({ url: sbUrl.value.trim(), anon: sbAnon.value.trim() });
  refreshSupabaseInputs();
  const client = await getSupabaseClient();
  setStatus(client ? "Supabase configured" : "Local mode", !!client);
});

btnClearSupabase.addEventListener("click", () => {
  clearSupabaseConfig();
  refreshSupabaseInputs();
  setStatus("Local mode", true);
});

btnExport.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(model, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "golf-trip-planner-export.json";
  a.click();
  URL.revokeObjectURL(url);
});

importFile.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  try {
    const data = JSON.parse(text);
    // basic shape guard
    model.itinerary = Array.isArray(data.itinerary) ? data.itinerary : [];
    model.players = Array.isArray(data.players) ? data.players : [];
    model.rounds = Array.isArray(data.rounds) ? data.rounds : [];
    saveModel(model);
    renderItinerary(model);
    renderPairings(model);
    setStatus("Imported (local)", true);
  } catch {
    setStatus("Import failed (invalid JSON)", false);
  } finally {
    importFile.value = "";
  }
});

// Initial status
getSupabaseClient().then(c => setStatus(c ? "Supabase configured" : "Local mode", true));

// Extra: emergency reset via console if needed:
// window.__GTP_RESET__ = () => { resetModel(); location.reload(); };
window.__GTP_RESET__ = () => { resetModel(); location.reload(); };
