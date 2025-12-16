import { saveModel } from "./storage.js";

export function ensureItinerary(model) {
  model.itinerary ??= [];
}

export function renderItinerary(model) {
  ensureItinerary(model);

  const list = document.getElementById("itineraryList");
  list.innerHTML = "";

  model.itinerary.forEach((day, idx) => {
    const card = document.createElement("div");
    card.className = "card";

    const row = document.createElement("div");
    row.className = "itin-day";

    const dayInput = document.createElement("input");
    dayInput.className = "input";
    dayInput.value = day.label || `Day ${idx + 1}`;
    dayInput.placeholder = `Day ${idx + 1}`;
    dayInput.addEventListener("input", () => {
      model.itinerary[idx].label = dayInput.value.trim();
      saveModel(model);
    });

    const notes = document.createElement("textarea");
    notes.className = "textarea";
    notes.style.minHeight = "110px";
    notes.placeholder = "Plans, tee times, dinner, notes...";
    notes.value = day.notes || "";
    notes.addEventListener("input", () => {
      model.itinerary[idx].notes = notes.value;
      saveModel(model);
    });

    const actions = document.createElement("div");
    actions.className = "itin-actions";

    const up = document.createElement("button");
    up.className = "icon-btn";
    up.textContent = "↑";
    up.title = "Move up";
    up.disabled = idx === 0;
    up.addEventListener("click", () => {
      const tmp = model.itinerary[idx - 1];
      model.itinerary[idx - 1] = model.itinerary[idx];
      model.itinerary[idx] = tmp;
      saveModel(model);
      renderItinerary(model);
    });

    const down = document.createElement("button");
    down.className = "icon-btn";
    down.textContent = "↓";
    down.title = "Move down";
    down.disabled = idx === model.itinerary.length - 1;
    down.addEventListener("click", () => {
      const tmp = model.itinerary[idx + 1];
      model.itinerary[idx + 1] = model.itinerary[idx];
      model.itinerary[idx] = tmp;
      saveModel(model);
      renderItinerary(model);
    });

    const del = document.createElement("button");
    del.className = "icon-btn";
    del.textContent = "🗑";
    del.title = "Delete day";
    del.addEventListener("click", () => {
      model.itinerary.splice(idx, 1);
      saveModel(model);
      renderItinerary(model);
    });

    actions.append(up, down, del);
    row.append(dayInput, notes, actions);
    card.append(row);
    list.append(card);
  });
}

export function bindItineraryUI(model) {
  document.getElementById("btnAddDay").addEventListener("click", () => {
    ensureItinerary(model);
    model.itinerary.push({ label: `Day ${model.itinerary.length + 1}`, notes: "" });
    saveModel(model);
    renderItinerary(model);
  });

  document.getElementById("btnClearItinerary").addEventListener("click", () => {
    model.itinerary = [];
    saveModel(model);
    renderItinerary(model);
  });
}
