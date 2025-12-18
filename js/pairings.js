// js/pairings.js
// Pairings & Scores (v2):
// - No rounds until Players are applied
// - Per-hole PAR inputs per round (stored on round.par[])
// - Front/Back/Total breakdown
// - Score vs Par (+n / E / -n)
// - Printable scorecard (print-to-PDF)

export function renderPairingsFromModel(model) {
  renderPairings(model);
}

export function renderPairings(model) {
  const root = document.querySelector("#pairingsRoot");
  if (!root) return;

  const players = Array.isArray(model?.players) ? model.players : [];
  const rounds = Array.isArray(model?.rounds) ? model.rounds : [];

  const playersApplied = players.length > 0;
  const roundsUi = playersApplied
    ? (rounds.length ? rounds.map((r, idx) => renderRoundCard(r, idx, model)).join("") : renderEmptyRounds())
    : renderPlayersGate();

  root.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <h2 class="panel-title">Pairings & Scores</h2>
        <div class="panel-actions">
          <button id="pairingsAddRoundBtn" class="btn" type="button" ${playersApplied ? "" : "disabled"}>+ Add Round</button>
          <button id="pairingsSaveBtn" class="btn btn-primary" type="button">Save</button>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:12px">
        <div class="card">
          <div class="field">
            <div class="field-label">Players (one per line)</div>
            <textarea id="playersInput" class="textarea" rows="10"
              placeholder="Glenn&#10;Cristina&#10;Grant&#10;Paul">${escapeHtml(players.join("\n"))}</textarea>
          </div>

          <div class="row" style="margin-top:10px; display:flex; gap:10px; align-items:center;">
            <button id="applyPlayersBtn" class="btn btn-primary" type="button">Apply Players</button>
            <div class="muted">Rounds unlock after players are applied.</div>
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
            Scorecards are shown as <b>Front 9</b> + <b>Back 9</b> so the inputs fit the page.
          </div>
        </div>
      </div>

      <div id="roundsContainer" class="stack" style="margin-top:14px">
        ${roundsUi}
      </div>
    </section>
  `;
}

export function bindPairingsUI(model, { onChange } = {}) {
  const root = document.querySelector("#pairingsRoot");
  if (!root) return;

  const playersInput = root.querySelector("#playersInput");
  const applyPlayersBtn = root.querySelector("#applyPlayersBtn");
  const addRoundBtn = root.querySelector("#pairingsAddRoundBtn");
  const saveBtn = root.querySelector("#pairingsSaveBtn");
  const defaultHolesEl = root.querySelector("#defaultHoles");
  const playersPerGroupEl = root.querySelector("#playersPerGroup");
  const roundsContainer = root.querySelector("#roundsContainer");

  if (!playersInput || !applyPlayersBtn || !addRoundBtn || !saveBtn || !defaultHolesEl || !playersPerGroupEl || !roundsContainer) return;

  const emit = (next) => {
    onChange?.(next);
    return next;
  };

  const parsePlayersFromTextarea = () =>
    String(playersInput.value ?? "")
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean);

  // Apply players (gate)
  applyPlayersBtn.addEventListener("click", () => {
    const players = parsePlayersFromTextarea();
    const next = {
      ...model,
      players,
      defaultHoles: Number(defaultHolesEl.value) || 18,
      playersPerGroup: Number(playersPerGroupEl.value) || 4,
      rounds: Array.isArray(model?.rounds) ? model.rounds : [],
    };

    model = next;
    emit(next);

    renderPairings(model);
    bindPairingsUI(model, { onChange });
  });

  // Settings changes
  defaultHolesEl.addEventListener("change", () => {
    const next = { ...model, defaultHoles: Number(defaultHolesEl.value) || 18 };
    model = next;
    emit(next);
    renderPairings(model);
    bindPairingsUI(model, { onChange });
  });

  playersPerGroupEl.addEventListener("change", () => {
    const next = { ...model, playersPerGroup: Number(playersPerGroupEl.value) || 4 };
    model = next;
    emit(next);
  });

  // Add Round
  addRoundBtn.addEventListener("click", () => {
    const players = Array.isArray(model?.players) ? model.players : [];
    if (!players.length) return;

    const holes = Number(model?.defaultHoles) || 18;
    const ppg = Number(model?.playersPerGroup) || 4;
    const round = makeNewRound(players, holes, ppg);

    const next = {
      ...model,
      rounds: [...(Array.isArray(model?.rounds) ? model.rounds : []), round],
    };

    model = next;
    emit(next);

    renderPairings(model);
    bindPairingsUI(model, { onChange });
  });

  // Save button (cosmetic)
  saveBtn.addEventListener("click", () => {
    emit(model);
    saveBtn.textContent = "Saved ✓";
    window.setTimeout(() => (saveBtn.textContent = "Save"), 900);
  });

  // Click handlers inside rounds
  roundsContainer.addEventListener("click", (e) => {
    const removeBtn = e.target.closest("[data-remove-round]");
    if (removeBtn) {
      const idx = Number(removeBtn.getAttribute("data-remove-round"));
      if (!Number.isFinite(idx)) return;

      const rounds = (Array.isArray(model?.rounds) ? model.rounds : []).filter((_, i) => i !== idx);
      const next = { ...model, rounds };
      model = next;
      emit(next);

      renderPairings(model);
      bindPairingsUI(model, { onChange });
      return;
    }

    const autoBtn = e.target.closest("[data-autogroup-round]");
    if (autoBtn) {
      const idx = Number(autoBtn.getAttribute("data-autogroup-round"));
      if (!Number.isFinite(idx)) return;

      const rounds = [...(Array.isArray(model?.rounds) ? model.rounds : [])];
      const r = rounds[idx];
      if (!r) return;

      const players = Array.isArray(model?.players) ? model.players : [];
      const ppg = Number(model?.playersPerGroup) || 4;
      const holes = Number(r.holes) || Number(model?.defaultHoles) || 18;

      rounds[idx] = {
        ...r,
        holes,
        par: normalizePar(r.par, holes),
        groups: autoGroups(players, ppg, holes),
      };

      const next = { ...model, rounds };
      model = next;
      emit(next);

      renderPairings(model);
      bindPairingsUI(model, { onChange });
      return;
    }

    const printBtn = e.target.closest("[data-print-round]");
    if (printBtn) {
      const idx = Number(printBtn.getAttribute("data-print-round"));
      if (!Number.isFinite(idx)) return;
      printRound(idx);
      return;
    }
  });

  // Input handlers inside rounds
  roundsContainer.addEventListener("input", (e) => {
    const el = e.target;
    const roundCard = el.closest("[data-round-card]");
    if (!roundCard) return;

    const rIdx = Number(roundCard.getAttribute("data-round-card"));
    if (!Number.isFinite(rIdx)) return;

    const rounds = [...(Array.isArray(model?.rounds) ? model.rounds : [])];
    const r = rounds[rIdx];
    if (!r) return;

    // Round meta
    if (el.matches("[data-round-title]")) {
      rounds[rIdx] = { ...r, title: el.value };
      model = { ...model, rounds };
      emit(model);
      return;
    }
    if (el.matches("[data-round-course]")) {
      rounds[rIdx] = { ...r, course: el.value };
      model = { ...model, rounds };
      emit(model);
      return;
    }

    const holes = Number(r.holes) || Number(model?.defaultHoles) || 18;

    // Par edits
    if (el.matches("[data-par]")) {
      const hIdx = Number(el.getAttribute("data-h"));
      if (!Number.isFinite(hIdx)) return;

      const par = normalizePar(r.par, holes);
      par[hIdx] = clampPar(el.value);
      rounds[rIdx] = { ...r, holes, par };
      model = { ...model, rounds };
      emit(model);

      // update computed fields in-place
      updateRoundComputed(roundCard, holes, par);
      return;
    }

    // Score edits
    if (el.matches("[data-score]")) {
      const gIdx = Number(el.getAttribute("data-g"));
      const pIdx = Number(el.getAttribute("data-p"));
      const hIdx = Number(el.getAttribute("data-h"));
      if (![gIdx, pIdx, hIdx].every(Number.isFinite)) return;

      const groups = Array.isArray(r.groups) ? [...r.groups] : [];
      const group = groups[gIdx];
      if (!group) return;

      const pls = Array.isArray(group.players) ? [...group.players] : [];
      const pl = pls[pIdx];
      if (!pl) return;

      const scores = normalizeScores(pl.scores, holes);
      scores[hIdx] = toIntOrBlank(el.value);

      pls[pIdx] = { ...pl, scores };
      groups[gIdx] = { ...group, players: pls };

      // ensure par normalized too
      const par = normalizePar(r.par, holes);

      rounds[rIdx] = { ...r, holes, par, groups };
      model = { ...model, rounds };
      emit(model);

      updateRoundComputed(roundCard, holes, par);
      return;
    }
  });

  // initial compute pass
  roundsContainer.querySelectorAll("[data-round-card]").forEach(card => {
    const rIdx = Number(card.getAttribute("data-round-card"));
    const r = (Array.isArray(model?.rounds) ? model.rounds : [])[rIdx];
    const holes = Number(r?.holes) || Number(model?.defaultHoles) || 18;
    const par = normalizePar(r?.par, holes);
    updateRoundComputed(card, holes, par);
  });
}

/* ---------------------------
   Rendering
---------------------------- */

function renderPlayersGate() {
  return `
    <div class="card">
      <div style="font-weight:800; margin-bottom:6px">Players required</div>
      <div class="muted">Enter your players and click <b>Apply Players</b> to unlock rounds and scorecards.</div>
    </div>
  `;
}

function renderEmptyRounds() {
  return `
    <div class="card">
      <div class="muted">No rounds yet. Click <b>+ Add Round</b> to generate a scorecard.</div>
    </div>
  `;
}

function renderRoundCard(round, idx, model) {
  const holes = Number(round?.holes) || Number(model?.defaultHoles) || 18;
  const title = round?.title ?? `Round ${idx + 1}`;
  const course = round?.course ?? "";
  const players = Array.isArray(model?.players) ? model.players : [];
  const ppg = Number(model?.playersPerGroup) || 4;

  const par = normalizePar(round?.par, holes);
  const groups = Array.isArray(round?.groups) && round.groups.length
    ? round.groups
    : autoGroups(players, ppg, holes);

  const showBack = holes === 18;

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
          <button class="btn" type="button" data-print-round="${idx}">Print scorecard</button>
          <button class="btn" type="button" data-autogroup-round="${idx}">Auto-group</button>
          <button class="btn" type="button" data-remove-round="${idx}">Remove</button>
        </div>
      </div>

      ${groups.map((g, gIdx) => renderGroupScorecards(g, gIdx, holes, par, showBack)).join("")}
    </div>
  `;
}

function renderGroupScorecards(group, gIdx, holes, par, showBack) {
  const players = Array.isArray(group?.players) ? group.players : [];

  // Ensure each player has scores array length holes
  const normalizedPlayers = players.map(p => ({
    name: p?.name ?? "",
    scores: normalizeScores(p?.scores, holes),
  }));

  return `
    <div class="card" style="margin-top:10px">
      <div class="scorecard-header">
        <div class="muted"><b>Group ${gIdx + 1}</b></div>
        <div class="muted">Front / Back / Total + vs Par</div>
      </div>

      ${renderNineTable("Front 9", 0, 9, normalizedPlayers, par)}
      ${showBack ? renderNineTable("Back 9", 9, 18, normalizedPlayers, par) : ""}

      <div class="scorecard-summary">
        <div class="muted">Totals update automatically as you type.</div>
      </div>
    </div>
  `;
}

function renderNineTable(label, start, end, players, par) {
  const holes = Array.from({ length: end - start }, (_, i) => start + i);

  const headHoles = holes.map(h => `<th class="hole">${h + 1}</th>`).join("");

  const parInputs = holes.map(h => {
    const v = par[h] ?? "";
    return `
      <td class="hole">
        <input class="par-input" inputmode="numeric" pattern="[0-9]*"
          data-par="1" data-h="${h}" value="${escapeHtml(v)}" />
      </td>
    `;
  }).join("");

  const rows = players.map((p, pIdx) => {
    const scoreTds = holes.map(h => {
      const v = p.scores[h] ?? "";
      return `
        <td class="hole">
          <input class="score-input" inputmode="numeric" pattern="[0-9]*"
            data-score="1" data-g="__G__" data-p="${pIdx}" data-h="${h}"
            value="${escapeHtml(v)}" />
        </td>
      `;
    }).join("");

    return `
      <tr data-player-row="1" data-player="${pIdx}">
        <td class="player">${escapeHtml(p.name)}</td>
        ${scoreTds}
        <td class="subtotal"><span data-subtotal="${label}">0</span></td>
      </tr>
    `;
  }).join("");

  // we patch data-g later in postprocess (per group) by replace
  const html = `
    <div class="table-block">
      <div class="table-title">${label}</div>
      <div class="table-scroll">
        <table class="score-table">
          <thead>
            <tr>
              <th class="player">Player</th>
              ${headHoles}
              <th class="subtotal">${label.includes("Front") ? "Front" : "Back"}</th>
            </tr>
            <tr class="par-row">
              <th class="player">PAR</th>
              ${parInputs}
              <th class="subtotal"><span data-par-subtotal="${label}">0</span></th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    </div>
  `;

  return html;
}

/* ---------------------------
   Model helpers
---------------------------- */

function makeNewRound(players, holes, playersPerGroup) {
  const defaultPar = holes === 9
    ? [4,4,3,4,5,4,3,4,5]
    : [4,4,3,4,5,4,3,4,5, 4,4,3,4,5,4,3,4,5];

  return {
    title: `Round ${Date.now()}`,
    course: "",
    holes,
    par: defaultPar.slice(0, holes),
    groups: autoGroups(players, playersPerGroup, holes),
  };
}

function autoGroups(players, playersPerGroup, holes) {
  const ppl = Array.isArray(players) ? players : [];
  const size = Number(playersPerGroup) || 4;
  const groups = [];

  for (let i = 0; i < ppl.length; i += size) {
    const slice = ppl.slice(i, i + size);
    groups.push({
      players: slice.map(name => ({ name, scores: new Array(holes).fill("") })),
    });
  }
  if (!groups.length) groups.push({ players: [] });
  return groups;
}

function normalizeScores(scores, holes) {
  const arr = Array.isArray(scores) ? scores.slice(0, holes) : [];
  while (arr.length < holes) arr.push("");
  return arr;
}

function normalizePar(par, holes) {
  const arr = Array.isArray(par) ? par.slice(0, holes) : [];
  while (arr.length < holes) arr.push("");
  return arr;
}

/* ---------------------------
   Computations + DOM updates
---------------------------- */

function updateRoundComputed(roundCardEl, holes, par) {
  if (!roundCardEl) return;

  // Patch group indexes into score inputs (because renderNineTable used "__G__")
  // We do it once per update pass.
  const groupCards = roundCardEl.querySelectorAll(".card");
  // Only patch inside the group cards that contain score tables
  // We'll locate tables and walk back up to find group index by order
  const groupTables = roundCardEl.querySelectorAll(".score-table");
  // Each group has 1 or 2 tables; we patch via nearest group card index
  const groupEls = Array.from(roundCardEl.querySelectorAll(".scorecard-header")).map(h => h.closest(".card"));
  groupEls.forEach((gEl, gIdx) => {
    if (!gEl) return;
    gEl.querySelectorAll('input.score-input[data-g="__G__"]').forEach(inp => {
      inp.setAttribute("data-g", String(gIdx));
    });
  });

  // Par subtotals + total
  const parFront = sumRange(par, 0, Math.min(9, holes));
  const parBack = holes === 18 ? sumRange(par, 9, 18) : 0;
  roundCardEl.querySelectorAll('[data-par-subtotal="Front 9"]').forEach(el => (el.textContent = String(parFront)));
  roundCardEl.querySelectorAll('[data-par-subtotal="Back 9"]').forEach(el => (el.textContent = String(parBack)));

  // For each player row across both tables: compute front/back and update
  // We'll compute by scanning inputs within roundCardEl for each (g,p) combo
  const scoreInputs = roundCardEl.querySelectorAll("input.score-input");
  const byGP = new Map(); // key `${g}|${p}` -> scores array

  scoreInputs.forEach(inp => {
    const g = Number(inp.getAttribute("data-g"));
    const p = Number(inp.getAttribute("data-p"));
    const h = Number(inp.getAttribute("data-h"));
    if (![g, p, h].every(Number.isFinite)) return;

    const key = `${g}|${p}`;
    if (!byGP.has(key)) byGP.set(key, new Array(holes).fill(""));
    const arr = byGP.get(key);
    arr[h] = toIntOrBlank(inp.value);
  });

  // Update subtotals displayed in each table row
  roundCardEl.querySelectorAll('tr[data-player-row="1"]').forEach(row => {
    const p = Number(row.getAttribute("data-player"));
    if (!Number.isFinite(p)) return;

    // find group by looking at any score input in this row
    const any = row.querySelector("input.score-input");
    const g = any ? Number(any.getAttribute("data-g")) : NaN;
    if (!Number.isFinite(g)) return;

    const key = `${g}|${p}`;
    const scores = byGP.get(key) ?? new Array(holes).fill("");

    const front = sumRange(scores, 0, Math.min(9, holes));
    const back = holes === 18 ? sumRange(scores, 9, 18) : 0;

    const label = row.closest(".table-block")?.querySelector(".table-title")?.textContent?.trim() ?? "";
    const subtotalSpan = row.querySelector("[data-subtotal]");
    if (subtotalSpan) subtotalSpan.textContent = String(label.startsWith("Front") ? front : back);
  });

  // Add an overall totals strip per group card (Front / Back / Total / vs Par)
  groupEls.forEach((gEl, gIdx) => {
    if (!gEl) return;

    // build summary table
    const players = Array.from(gEl.querySelectorAll('tr[data-player-row="1"]'))
      .filter((row, i, arr) => row.closest(".table-block")?.querySelector(".table-title")?.textContent?.trim().startsWith("Front"))
      .map(row => ({
        name: row.querySelector("td.player")?.textContent ?? "",
        pIdx: Number(row.getAttribute("data-player")),
      }))
      .filter(x => Number.isFinite(x.pIdx));

    // remove old summary if exists
    const old = gEl.querySelector(".scorecard-totals");
    if (old) old.remove();

    if (!players.length) return;

    const rows = players.map(p => {
      const key = `${gIdx}|${p.pIdx}`;
      const scores = byGP.get(key) ?? new Array(holes).fill("");

      const front = sumRange(scores, 0, Math.min(9, holes));
      const back = holes === 18 ? sumRange(scores, 9, 18) : 0;
      const total = front + back;

      const vs = total - (parFront + parBack);
      const vsTxt = formatVsPar(vs);

      return `
        <tr>
          <td class="player">${escapeHtml(p.name)}</td>
          <td class="num">${front}</td>
          <td class="num">${holes === 18 ? back : "-"}</td>
          <td class="num"><b>${total}</b></td>
          <td class="num ${vsClass(vs)}">${vsTxt}</td>
        </tr>
      `;
    }).join("");

    const totalsHtml = `
      <div class="scorecard-totals">
        <div class="table-scroll">
          <table class="totals-table">
            <thead>
              <tr>
                <th class="player">Totals</th>
                <th class="num">Front</th>
                <th class="num">Back</th>
                <th class="num">Total</th>
                <th class="num">Vs Par</th>
              </tr>
              <tr class="par-row">
                <th class="player">Par</th>
                <th class="num">${parFront}</th>
                <th class="num">${holes === 18 ? parBack : "-"}</th>
                <th class="num">${parFront + parBack}</th>
                <th class="num">—</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
    `;

    gEl.insertAdjacentHTML("beforeend", totalsHtml);
  });
}

function sumRange(arr, start, end) {
  let t = 0;
  for (let i = start; i < end; i++) {
    const n = Number(String(arr[i] ?? "").trim());
    if (Number.isFinite(n)) t += n;
  }
  return t;
}

function formatVsPar(v) {
  if (!Number.isFinite(v)) return "—";
  if (v === 0) return "E";
  return v > 0 ? `+${v}` : `${v}`;
}

function vsClass(v) {
  if (v === 0) return "vs-even";
  return v > 0 ? "vs-over" : "vs-under";
}

/* ---------------------------
   Print (print-to-PDF)
---------------------------- */

function printRound(roundIdx) {
  // Hide everything except this round while printing
  document.body.setAttribute("data-print-round", String(roundIdx));
  window.setTimeout(() => {
    window.print();
    window.setTimeout(() => document.body.removeAttribute("data-print-round"), 250);
  }, 50);
}

/* ---------------------------
   Small helpers
---------------------------- */

function clampPar(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  const n = Math.max(3, Math.min(6, Math.floor(Number(s))));
  return Number.isFinite(n) ? String(n) : "";
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
