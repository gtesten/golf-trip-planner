// js/tripDetails.js
// Renders into #tripRoot and binds safely.

export function renderTripDetails(model) {
  renderTrip(model);
}

export function renderTrip(model) {
  const root = document.querySelector("#tripRoot");
  if (!root) return;

  const lodging = model?.lodging ?? "";
  const address = model?.lodgingAddress ?? "";
  const budget = model?.budget ?? "";
  const notes = model?.tripNotes ?? "";

  root.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <h2 class="panel-title">Trip Details</h2>
        <div class="panel-actions">
          <button id="tripSaveBtn" class="btn btn-primary" type="button">Save</button>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:12px">
        <label class="field">
          <span class="field-label">Lodging</span>
          <input id="lodgingInput" class="input" type="text" value="${escapeHtml(lodging)}" placeholder="Hotel / Airbnb name" />
        </label>

        <label class="field">
          <span class="field-label">Budget (optional)</span>
          <input id="budgetInput" class="input" type="text" value="${escapeHtml(budget)}" placeholder="e.g., $3,000" />
        </label>

        <label class="field" style="grid-column: span 2;">
          <span class="field-label">Address</span>
          <input id="addressInput" class="input" type="text" value="${escapeHtml(address)}" placeholder="Street, City, State" />
        </label>

        <label class="field" style="grid-column: span 2;">
          <span class="field-label">Notes</span>
          <textarea id="tripNotesInput" class="textarea" rows="6" placeholder="Check-in time, groceries, transportation, tee time policies...">${escapeHtml(notes)}</textarea>
        </label>
      </div>
    </section>
  `;
}

export function bindTripUI(model, { onChange } = {}) {
  const root = document.querySelector("#tripRoot");
  if (!root) return;

  const lodgingEl = root.querySelector("#lodgingInput");
  const budgetEl = root.querySelector("#budgetInput");
  const addressEl = root.querySelector("#addressInput");
  const notesEl = root.querySelector("#tripNotesInput");
  const saveBtn = root.querySelector("#tripSaveBtn");

  if (!lodgingEl || !budgetEl || !addressEl || !notesEl || !saveBtn) return;

  const emit = () => {
    const next = {
      ...model,
      lodging: lodgingEl.value.trim(),
      budget: budgetEl.value.trim(),
      lodgingAddress: addressEl.value.trim(),
      tripNotes: notesEl.value,
    };
    onChange?.(next);
    return next;
  };

  [lodgingEl, budgetEl, addressEl, notesEl].forEach(el => {
    el.addEventListener("input", () => emit());
  });

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
