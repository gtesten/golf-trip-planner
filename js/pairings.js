// js/pairings.js
// Self-contained Pairings & Scores module that renders its own DOM into #pairingsRoot
// and binds safely (no null addEventListener / value errors).

export function renderPairingsFromModel(model) {
  renderPairings(model);
}

export function renderPairings(model) {
  const root = document.querySelector("#pairingsRoot");
  if (!root) return;

  const players = Array.isArray(model?.players) ? model.players : [];
  const rounds = Array.isArray(model?.rounds) ? model.rounds : [];

  root.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <h2 class="panel-title">Pairings & Scores</h2>
        <div class="panel-actions">
          <button id="pairingsAddRoundBtn" class="btn" type="button">+ Add Round</button>
          <button id="pairingsSaveBtn" class="btn btn-primary" type="button">Save</button>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:12px">
        <div class="card">
          <div class="field">
            <div class="field-label">Players (one per line)</div>
            <textarea id="playersInput" class="textarea" rows="10" placeholder="Glenn&#10;Cristina&#10;Grant&#10;Paul">${escapeHtml(players.join("\n"))}</textarea>
          </div>
          <div class="muted" style="margin-top:10px">
            Tip: Keep it simple—first & last name is enough.
          </div>
        </div>

        <div class="card">
          <div class="grid grid-2">
            <label class="field">
              <span class="field-label">Default Holes</span>
              <select id="defaultHoles" class="input">
                ${selectOption(model?.defaultHoles ?? 18, 9)}
                ${selectOption(model?.defaultHoles ?? 18, 18)}
              </select>
            </label>

            <label class="field">
              <span class="field-label">Players per group</span>
              <select id="playersPerGroup" class="input">
                ${selectOption(model?.playersPerGroup ?? 4, 2)}
                ${selectOption(model?.playersPerGroup ?? 4, 3)}
                ${selectOption(model?.playersPerGroup ?? 4, 4)}
              </select>
            </label>
          </div>

          <div class="muted" style="margin-top:10px">
            Rounds will auto-generate groups based on your player list.
          </div>
        </div>
      </div>

      <div id="roundsContainer" class="stack" style="margin-top:14px">
        ${rounds.length ? rounds.map((r, idx) => renderRoundCard(r, idx, model)).join("") : renderEmptyRounds()}
      </div>
    </section>
  `;
}

export function bindPairingsUI(model, { onChange } = {}) {
  const root = document.querySelector("#pairingsRoot");
  if (!root) return;

  const playersInput = root.querySelector("#playersInput");
  const addRoundBtn = root.querySelector("#pairingsAddRoundBtn");
  const saveBtn = root.querySelector("#pairingsSaveBtn");
  const defaultHolesEl = root.querySelector("#defaultHoles");
  const playersPerGroupEl = root.querySelector("#playersPerGroup");
  const roundsContainer = root.querySelector("#roundsContainer");

  if (!playersInput || !addRoundBtn || !saveBtn || !defaultHolesEl || !playersPerGroupEl || !roundsContainer) return;

  const normalizeModel = (m) => {
    const players = parsePlayers(playersInput.value);
    const rounds = Array.isArray(m?.rounds) ? m.rounds : [];
    return {
      ...m,
      players,
      rounds,
      defaultHoles: Number(defaultHolesEl.value) || 18,
      playersPerGroup: Number(playersPerGroupEl.value) || 4,
    };
  };

  const emit = (nextModel) => {
    onChange?.(nextModel);
    return nextModel;
  };

  // Update players/settings live
  playersInput.addEventListener("input", () => {
    const next = normalizeModel(model);
    model = next;
    emit(next);
  });

  defaultHolesEl.addEventListener("change", () => {
    const next = normalizeModel(model);
    model = next;
    emit(next);
    // Re-render to apply to existing rounds that have no explicit holes set
    renderPairings(model);
    bindPairingsUI(model, { onChange });
  });

  playersPerGroupEl.addEventListener("change", () => {
    const next = normalizeModel(model);
    model = next;
    emit(next);
  });

  // Add Round
  addRoundBtn.addEventListener("click", () => {
    model = normalizeModel(model);

    const holes = model.defaultHoles ?? 18;
    const round = makeNewRound(model.players, holes, model.playersPerGroup);

    const next = {
      ...model,
      rounds: [...(model.rounds ?? []), round],
    };

    model = next;
    emit(next);

    renderPairings(model);
    bindPairingsUI(model, { onChange });
  });

  // Save button (cosmetic + emit)
  saveBtn.addEventListener("click", () => {
    model = normalizeModel(model);
    emit(model);
    saveBtn.textContent = "Saved ✓";
    window.setTimeout(() => (saveBtn.textContent = "Save"), 900);
  });

  // Delegated handlers inside rounds
  roundsContainer.addEventListener("click", (e) => {
    const btnRemove = e.target.closest("[data-remove-round]");
    if (btnRemove) {
      const idx = Number(btnRemove.getAttribute("data-remove-round"));
      if (Number.isFinite(idx)) {
        model = normalizeModel(model);
        const nextRounds = (model.rounds ?? []).filter((_, i) => i !== idx);
        const next = { ...model, rounds: nextRounds };
        model = next;
        emit(next);
        renderPairings(model);
        bindPairingsUI(model, { onChange });
      }
      return;
    }

    const btnAuto = e.target.closest("[data-autogroup-round]");
    if (btnAuto) {
      const idx = Number(btnAuto.getAttribute("data-autogroup-round"));
      if (Number.isFinite(idx)) {
        model = normalizeModel(model);
        const rounds = [...(model.rounds ?? [])];
        const r = rounds[idx];
        if (r) {
          const holes = r.holes ?? model.defaultHoles ?? 18;
          rounds[idx] = { ...r, groups: autoGroups(model.players, model.playersPerGroup), holes };
          const next = { ...model, rounds };
          model = next;
          emit(next);
          renderPairings(model);
          bindPairingsUI(model, { onChange });
        }
      }
      return;
    }
  });

  roundsContainer.addEventListener("input", (e) => {
    const el = e.target;

    // Round meta edits
    const roundIdx = el.closest("[data-round-card]")?.getAttribute("data-round-card");
    if (roundIdx == null) return;
    const rIdx = Number(roundIdx);
    if (!Number.isFinite(rIdx)) return;

    model = normalizeModel(model);
    const rounds = [...(model.rounds ?? [])];
    const r = rounds[rIdx];
    if (!r) return;

    // Title
    if (el.matches("[data-round-title]")) {
      rounds[rIdx] = { ...r, title: el.value };
      const next = { ...model, rounds };
      model = next;
      emit(next);
      return;
    }

    // Course
    if (el.matches("[data-round-course]")) {
      rounds[rIdx] = { ...r, course: el.value };
      const next = { ...model, rounds };
      model = next;
      emit(next);
      return;
    }

    // Hole score inputs
    if (el.matches("[data-score]")) {
      const gIdx = Number(el.getAttribute("data-g"));
      const pIdx = Number(el.getAttribute("data-p"));
      const hIdx = Number(el.getAttribute("data-h"));

      if (![gIdx, pIdx, hIdx].every(Number.isFinite)) return;

      const val = toIntOrBlank(el.value);
      const groups = Array.isArray(r.groups) ? [...r.groups] : [];
      const group = groups[gIdx];
      if (!group) return;

      const players = Array.isArray(group.players) ? [...group.players] : [];
      const pl = players[pIdx];
      if (!pl) return;

      const scores = Array.isArray(pl.scores) ? [...pl.scores] : new Array(r.holes ?? model.defaultHoles ?? 18).fill("");
      scores[hIdx] = val;

      players[pIdx] = { ...pl, scores };
      groups[gIdx] = { ...group, players };

      rounds[rIdx] = { ...r, groups };
      const next = { ...model, rounds };
      model = next;
      emit(next);

      // update totals in-place (lightweight)
      updateTotalsForRoundCard(el.closest("[data-round-card]"));
      return;
    }
  });

  // Initial totals compute
  roundsContainer.querySelectorAll("[data-round-card]").forEach(updateTotalsForRoundCard);
}

/* -----------------------
   Rendering helpers
------------------------ */

function renderRoundCard(round, idx, model) {
  const holes = round?.holes ?? model?.defaultHoles ?? 18;
  const title = round?.title ?? `Round ${idx + 1}`;
  const course = round?.course ?? "";
  const groups = Array.isArray(round?.groups) ? round.groups : autoGroups(model?.players ?? [], model?.playersPerGroup ?? 4);

  return `
    <div class="round-card card" data-round-card="${idx}">
      <div class="panel-header" style="padding:0;margin-bottom:10px">
        <div style="flex:1">
          <div class="grid grid-3">
            <label class="field">
              <span class="field-label">Round Name</span>
              <input class="input" data-round-title type="text" value="${escapeHtml(title)}" />
            </label>
            <label class="field" style="grid-column: span 2;">
              <span class="field-label">Course</span>
              <input class="input" data-round-course type="text" value="${escapeHtml(course)}" placeholder="e.g., Forest Dunes" />
            </label>
          </div>
        </div>

        <div class="panel-actions" style="align-items:flex-end">
          <button class="btn" type="button" data-autogroup-round="${idx}">Auto-group</button>
          <button class="btn" type="button" data-remove-round="${idx}">Remove</button>
        </div>
      </div>

      ${groups.map((g, gIdx) => renderGroup(g, gIdx, holes)).join("")}
    </div>
  `;
}

function renderGroup(group, gIdx, holes) {
  const players = Array.isArray(group?.players) ? group.players : [];
  const headerHoles = Array.from({ length: holes }, (_, i) => `<th class="hole">${i + 1}</th>`).join("");

  const rows = players.map((p, pIdx) => {
    const scores = Array.isArray(p?.scores) ? p.scores : new Array(holes).fill("");
    const tds = Array.from({ length: holes }, (_, hIdx) => {
      const v = scores[hIdx] ?? "";
      return `
        <td class="hole">
          <input class="score-input" inputmode="numeric" pattern="[0-9]*"
            data-score="1" data-g="${gIdx}" data-p="${pIdx}" data-h="${hIdx}"
            value="${escapeHtml(v)}" />
        </td>
      `;
    }).join("");

    return `
      <tr>
        <td class="player">${escapeHtml(p?.name ?? "")}</td>
        ${tds}
        <td class="total"><span data-total="1">0</span></td>
      </tr>
    `;
  }).join("");

  return `
    <div class="card" style="margin-top:10px">
      <div class="muted" style="margin-bottom:8px"><b>Group ${gIdx + 1}</b></div>
      <div class="table-scroll">
        <table class="score-table">
          <thead>
            <tr>
              <th class="player">Player</th>
              ${headerHoles}
              <th class="total">Total</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderEmptyRounds() {
  return `
    <div class="card">
      <div class="muted">No rounds yet. Click <b>+ Add Round</b> to generate groups and start scoring.</div>
    </div>
  `;
}

/* -----------------------
   Model helpers
------------------------ */

function parsePlayers(text) {
  return String(text ?? "")
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean);
}

function makeNewRound(players, holes, playersPerGroup) {
  return {
    title: `Round ${Date.now()}`, // app can rename; stable unique
    course: "",
    holes,
    groups: autoGroups(players, playersPerGroup),
  };
}

function autoGroups(players, playersPerGroup) {
  const ppl = Array.isArray(players) ? players : [];
  const size = Number(playersPerGroup) || 4;
  const groups = [];

  for (let i = 0; i < ppl.length; i += size) {
    const slice = ppl.slice(i, i + size);
    groups.push({
      players: slice.map(name => ({ name, scores: [] })),
    });
  }

  if (!groups.length) {
    groups.push({ players: [] });
  }

  return groups;
}

/* -----------------------
   DOM helpers
------------------------ */

function updateTotalsForRoundCard(roundCardEl) {
  if (!roundCardEl) return;

  const rows = roundCardEl.querySelectorAll("tbody tr");
  rows.forEach(row => {
    const inputs = row.querySelectorAll("input.score-input");
    let total = 0;
    inputs.forEach(inp => {
      const n = Number(String(inp.value).trim());
      if (Number.isFinite(n)) total += n;
    });
    const totalSpan = row.querySelector("[data-total]");
    if (totalSpan) totalSpan.textContent = String(total);
  });
}

function toIntOrBlank(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  const n = Number(s);
  if (!Number.isFinite(n)) return "";
  return String(Math.max(0, Math.floor(n)));
}

function selectOption(current, value) {
  const sel = Number(current) === Number(value) ? "selected" : "";
  return `<option value="${value}" ${sel}>${value}</option>`;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
