// js/itinerary.js

export function renderItinerary(model) {
  const root = document.querySelector("#itineraryRoot");
  if (!root) return;

  const days = Array.isArray(model?.itineraryDays) ? model.itineraryDays : [];

  root.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <h2 class="panel-title">Itinerary</h2>
        <div class="panel-actions">
          <button id="addDayBtn" class="btn" type="button">+ Add Day</button>
          <button id="itinerarySaveBtn" class="btn btn-primary" type="button">Save</button>
        </div>
      </div>

      <div id="daysList" class="stack" style="margin-top:12px">
        ${days.length ? days.map(renderDay).join("") : renderEmpty()}
      </div>
    </section>
  `;
}

export function bindItineraryUI(model, { onChange } = {}) {
  const addBtn = document.querySelector("#addDayBtn");
  const saveBtn = document.querySelector("#itinerarySaveBtn");
  const list = document.querySelector("#daysList");

  if (!addBtn || !saveBtn || !list) return;

  const getDaysFromDOM = () => {
    const cards = list.querySelectorAll("[data-day-card]");
    return Array.from(cards).map(card => {
      const date = card.querySelector("[data-day-date]")?.value ?? "";
      const title = card.querySelector("[data-day-title]")?.value ?? "";
      const notes = card.querySelector("[data-day-notes]")?.value ?? "";
      return { date: date.trim(), title: title.trim(), notes: notes.trim() };
    });
  };

  const emit = () => {
    const next = {
      ...model,
      itineraryDays: getDaysFromDOM(),
    };
    onChange?.(next);
    return next;
  };

  addBtn.addEventListener("click", () => {
    const current = getDaysFromDOM();
    current.push({ date: "", title: "", notes: "" });
    const next = { ...model, itineraryDays: current };
    onChange?.(next);
    renderItinerary(next);
    bindItineraryUI(next, { onChange });
  });

  // delegate input changes
  list.addEventListener("input", () => emit());

  saveBtn.addEventListener("click", () => {
    emit();
    saveBtn.textContent = "Saved ✓";
    window.setTimeout(() => (saveBtn.textContent = "Save"), 900);
  });
}

function renderDay(d, idx) {
  const date = escapeHtml(d?.date ?? "");
  const title = escapeHtml(d?.title ?? "");
  const notes = escapeHtml(d?.notes ?? "");

  return `
    <div class="card" data-day-card="1">
      <div class="grid grid-3">
        <label class="field">
          <span class="field-label">Date</span>
          <input class="input" data-day-date type="text" value="${date}" placeholder="e.g., Thu" />
        </label>

        <label class="field" style="grid-column: span 2;">
          <span class="field-label">Title</span>
          <input class="input" data-day-title type="text" value="${title}" placeholder="e.g., Travel + Practice Round" />
        </label>
      </div>

      <label class="field" style="margin-top:10px">
        <span class="field-label">Notes</span>
        <textarea class="textarea" data-day-notes rows="3" placeholder="Tee times, dinners, transportation...">${notes}</textarea>
      </label>
    </div>
  `;
}

function renderEmpty() {
  return `
    <div class="card">
      <div class="muted">No days yet. Click <b>+ Add Day</b> to start building your schedule.</div>
    </div>
  `;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
