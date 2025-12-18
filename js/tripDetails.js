import { saveModel } from "./storage.js";

export function ensureTrip(model) {
  model.trip ??= {
    name: "",
    dates: "",
    location: "",
    lodging: "",
    mapLink: "",
    notes: "",
    roster: ""
  };
}

export function renderTrip(model) {
  ensureTrip(model);
const panel = document.querySelector('[data-panel="tripDetails"]') || document.querySelector('[data-panel="trip-details"]');
if (panel && !document.getElementById("tripRoster")) {
  panel.innerHTML = `
    <div class="card">
      <div class="card-title">Trip Details</div>

      <div class="row" style="gap:10px; flex-wrap:wrap;">
        <div style="flex:1; min-width:240px;">
          <label class="muted small">Trip name</label>
          <input id="tripName" class="input" placeholder="e.g., Boyne 2026" />
        </div>
        <div style="flex:1; min-width:240px;">
          <label class="muted small">Dates</label>
          <input id="tripDates" class="input" placeholder="e.g., Aug 14–17" />
        </div>
      </div>

      <div class="row" style="gap:10px; flex-wrap:wrap; margin-top:10px;">
        <div style="flex:1; min-width:240px;">
          <label class="muted small">Location</label>
          <input id="tripLocation" class="input" placeholder="City / Resort" />
        </div>
        <div style="flex:1; min-width:240px;">
          <label class="muted small">Lodging</label>
          <input id="tripLodging" class="input" placeholder="Hotel / House" />
        </div>
      </div>

      <div style="margin-top:10px;">
        <label class="muted small">Map link</label>
        <input id="tripMapLink" class="input" placeholder="Google Maps URL" />
      </div>

      <div style="margin-top:10px;">
        <label class="muted small">Notes</label>
        <textarea id="tripNotes" placeholder="Anything important…"></textarea>
      </div>

      <div style="margin-top:10px;">
        <label class="muted small">Roster / group notes</label>
        <textarea id="tripRoster" placeholder="Rooming assignments, arrival times, etc."></textarea>
      </div>

      <div class="row" style="gap:8px; margin-top:10px; flex-wrap:wrap;">
        <button id="btnTripClear" class="btn secondary">Clear Trip Details</button>
      </div>
    </div>
  `;
}

  const t = model.trip;
  const byId = (id) => document.getElementById(id);

  byId("tripName").value = t.name ?? "";
  byId("tripDates").value = t.dates ?? "";
  byId("tripLocation").value = t.location ?? "";
  byId("tripLodging").value = t.lodging ?? "";
  byId("tripMapLink").value = t.mapLink ?? "";
  byId("tripNotes").value = t.notes ?? "";
  byId("tripRoster").value = t.roster ?? "";
}

export function bindTripUI(model) {
  ensureTrip(model);

  const bind = (id, key) => {
    const el = document.getElementById(id);
    el.addEventListener("input", () => {
      model.trip[key] = el.value;
      saveModel(model);
    });
  };

  bind("tripName", "name");
  bind("tripDates", "dates");
  bind("tripLocation", "location");
  bind("tripLodging", "lodging");
  bind("tripMapLink", "mapLink");
  bind("tripNotes", "notes");
  bind("tripRoster", "roster");

  document.getElementById("btnTripClear").addEventListener("click", () => {
    model.trip = {
      name: "",
      dates: "",
      location: "",
      lodging: "",
      mapLink: "",
      notes: "",
      roster: ""
    };
    saveModel(model);
    renderTrip(model);
  });
}
