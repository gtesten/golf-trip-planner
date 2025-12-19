// js/settings.js
import { getModel, setModel } from "./store.js";
import * as storage from "./storage.js";

export function renderSettings(model) {
  const root = document.querySelector("#settingsRoot");
  if (!root) return;

  root.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <h2 class="panel-title">Settings</h2>
      </div>

      <div class="card" style="margin-top:12px;">
        <div style="font-weight:900; margin-bottom:8px;">Export / Import</div>
        <div class="muted" style="margin-bottom:12px;">
          Export your trip as JSON for backup/sharing. Import can overwrite the current trip or create a new one.
        </div>

        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
          <button id="downloadTripBtn" class="btn btn-primary" type="button">Download current trip JSON</button>
          <label class="btn" style="cursor:pointer;">
            Import JSON file
            <input id="importFile" type="file" accept="application/json" style="display:none;">
          </label>
        </div>

        <div style="margin-top:14px;" class="grid grid-2">
          <div class="card" style="background:rgba(255,255,255,.04);">
            <div style="font-weight:900; margin-bottom:6px;">Paste JSON</div>
            <textarea id="importText" class="textarea" rows="10" placeholder='{"players":["Glenn"],"rounds":[...]}'></textarea>
            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;">
              <button id="importOverwriteBtn" class="btn" type="button">Import (overwrite current)</button>
              <button id="importNewBtn" class="btn" type="button">Import (create new trip)</button>
            </div>
          </div>

          <div class="card" style="background:rgba(255,255,255,.04);">
            <div style="font-weight:900; margin-bottom:6px;">What gets imported</div>
            <ul class="muted" style="margin:0; padding-left:18px; line-height:1.7;">
              <li>Players</li>
              <li>Rounds (groups, scores, par)</li>
              <li>Itinerary days</li>
              <li>Defaults (holes, players per group)</li>
            </ul>
            <div class="muted" style="margin-top:10px;">
              Tip: Overwrite keeps the same trip ID; Create new makes a brand new trip row in Supabase.
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

export function bindSettingsUI(model, { onChange } = {}) {
  const root = document.querySelector("#settingsRoot");
  if (!root) return;

  const downloadBtn = root.querySelector("#downloadTripBtn");
  const importFile = root.querySelector("#importFile");
  const importText = root.querySelector("#importText");
  const overwriteBtn = root.querySelector("#importOverwriteBtn");
  const newBtn = root.querySelector("#importNewBtn");

  if (!downloadBtn || !importFile || !importText || !overwriteBtn || !newBtn) return;

  downloadBtn.addEventListener("click", () => {
    const m = scrubModelForExport(getModel());
    downloadJson(m, `golf-trip-${new Date().toISOString().slice(0,10)}.json`);
  });

  importFile.addEventListener("change", async () => {
    const file = importFile.files?.[0];
    if (!file) return;
    const text = await file.text();
    importText.value = text;
  });

  overwriteBtn.addEventListener("click", async () => {
    const parsed = parseJson(importText.value);
    if (!parsed) return;

    // Keep current trip id, overwrite the model
    const current = getModel();
    const next = { ...normalizeImportedModel(parsed), _tripId: current._tripId };
    setModel(next, { meta: { source: "settings" } });

    // Force a save immediately
    await storage.saveModel(next);
    window.dispatchEvent(new CustomEvent("gtp:save:status", { detail: { status: "saved" } }));
  });

  newBtn.addEventListener("click", async () => {
    const parsed = parseJson(importText.value);
    if (!parsed) return;

    const name = window.prompt("Name for the new trip:", "Imported Trip");
    const created = await storage.createTrip({ name, model: normalizeImportedModel(parsed) });

    // Switch store to the new trip model
    setModel(created, { meta: { source: "settings" } });
    window.dispatchEvent(new CustomEvent("gtp:save:status", { detail: { status: "saved" } }));
  });
}

function parseJson(text) {
  try {
    const obj = JSON.parse(String(text ?? ""));
    if (!obj || typeof obj !== "object") throw new Error("JSON must be an object");
    return obj;
  } catch (e) {
    window.alert(`Invalid JSON: ${e?.message || e}`);
    return null;
  }
}

function normalizeImportedModel(m) {
  const obj = m && typeof m === "object" ? m : {};
  const out = {
    itineraryDays: Array.isArray(obj.itineraryDays) ? obj.itineraryDays : [],
    players: Array.isArray(obj.players) ? obj.players : [],
    rounds: Array.isArray(obj.rounds) ? obj.rounds : [],
    defaultHoles: Number(obj.defaultHoles ?? 18) || 18,
    playersPerGroup: Number(obj.playersPerGroup ?? 4) || 4,
    ui: { ...(obj.ui ?? {}) },
  };
  // never import trip id
  delete out._tripId;
  return out;
}

function scrubModelForExport(model) {
  const m = { ...(model ?? {}) };
  delete m._tripId;
  // optional: remove ephemeral UI cache flags if you want
  if (m.ui) {
    const ui = { ...m.ui };
    delete ui._coursePresetsLoaded;
    m.ui = ui;
  }
  return m;
}

function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
