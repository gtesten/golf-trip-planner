// js/overview.js

export function renderOverview(model) {
  const root = document.querySelector("#overviewRoot");
  if (!root) return;

  const tripName = model?.tripName ?? "My Golf Trip";
  const dates = model?.dates ?? "";
  const location = model?.location ?? "";

  root.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <h2 class="panel-title">Overview</h2>
        <div class="panel-actions">
          <button id="overviewSaveBtn" class="btn btn-primary" type="button">Save</button>
        </div>
      </div>

      <div class="grid grid-3">
        <label class="field">
          <span class="field-label">Trip Name</span>
          <input id="tripNameInput" class="input" type="text" value="${escapeHtml(tripName)}" />
        </label>

        <label class="field">
          <span class="field-label">Dates</span>
          <input id="tripDatesInput" class="input" type="text" value="${escapeHtml(dates)}" placeholder="e.g., June 12–15" />
        </label>

        <label class="field">
          <span class="field-label">Location</span>
          <input id="tripLocationInput" class="input" type="text" value="${escapeHtml(location)}" placeholder="e.g., Boyne / Forest Dunes" />
        </label>
      </div>

      <div class="muted" style="margin-top:12px">
        Tip: Fill this out first — it drives the header and share/export later.
      </div>
    </section>
  `;
}

export function bindOverviewUI(model, { onChange } = {}) {
  // All selectors guarded to prevent your exact "null addEventListener" error
  const saveBtn = document.querySelector("#overviewSaveBtn");
  const nameEl = document.querySelector("#tripNameInput");
  const datesEl = document.querySelector("#tripDatesInput");
  const locEl = document.querySelector("#tripLocationInput");

  if (!saveBtn || !nameEl || !datesEl || !locEl) return;

  const emit = () => {
    const next = {
      ...model,
      tripName: nameEl.value.trim(),
      dates: datesEl.value.trim(),
      location: locEl.value.trim(),
    };
    onChange?.(next);
    return next;
  };

  // live update
  [nameEl, datesEl, locEl].forEach(el => {
    el.addEventListener("input", () => emit());
  });

  // save click (app.mjs decides what "save" means)
  saveBtn.addEventListener("click", () => {
    emit();
    saveBtn.textContent = "Saved ✓";
    window.setTimeout(() => (saveBtn.textContent = "Save"), 900);
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
