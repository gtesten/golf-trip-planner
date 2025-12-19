// js/tripsUI.js
import * as storage from "./storage.js";
import { setModel, getModel } from "./store.js";

export async function initTripsUI() {
  const select = document.querySelector("#tripSelect");
  const newBtn = document.querySelector("#newTripBtn");
  const renameBtn = document.querySelector("#renameTripBtn");
  if (!select || !newBtn || !renameBtn) return;

  async function refreshList() {
    const trips = await storage.listTrips({ limit: 50 });
    const activeId = storage.getActiveTripId() || getModel()?._tripId;

    select.innerHTML = trips
      .map(t => `<option value="${t.id}" ${t.id === activeId ? "selected" : ""}>${escapeHtml(t.name || "Untitled")}</option>`)
      .join("");
  }

  await refreshList();

  select.addEventListener("change", async () => {
    const id = select.value;
    if (!id) return;
    const loaded = await storage.loadTripById(id);
    setModel(loaded, { meta: { source: "trip-switch" } });
    await refreshList();
  });

  newBtn.addEventListener("click", async () => {
    const name = window.prompt("New trip name:", "New Golf Trip");
    if (!name) return;
    const created = await storage.createTrip({ name, model: getModel() });
    setModel(created, { meta: { source: "trip-switch" } });
    await refreshList();
  });

  renameBtn.addEventListener("click", async () => {
    const current = getModel();
    const id = current?._tripId;
    if (!id) return;

    const name = window.prompt("Rename trip:", current?._tripName || "Golf Trip");
    if (!name) return;

    await storage.renameTrip(id, name);

    // Keep same model but update local name
    setModel({ ...current, _tripName: name }, { meta: { source: "trip-switch" } });
    await refreshList();
  });
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
