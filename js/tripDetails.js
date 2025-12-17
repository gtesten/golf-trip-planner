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
