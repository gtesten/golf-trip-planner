// /js/pairings.js
// Pairings & Scores v4
// Adds:
// - Round selector (renders one round at a time)
// - Quick stats ribbon (players/groups/holes/par/status)
// Keeps:
// - Players gate + Apply Players
// - Per-hole PAR inputs per round
// - Front/Back/Total + Vs Par
// - Print scorecard per round
// - Correct handling of blank scoring (— instead of -par)

export function renderPairingsFromModel(model) {
  renderPairings(model);
}

export function renderPairings(model) {
  const root = document.querySelector("#pairingsRoot");
  if (!root) return;

  const players = Array.isArray(model?.players) ? model.players : [];
  const rounds = Array.isArray(model?.rounds) ? model.rounds : [];

  const playersApplied = players.length > 0;

  // Selected round index (store on model so it persists across tabs/saves)
  const selectedIdx =
    Number.isFinite(Number(model?.ui?.pairingsRoundIndex))
      ? Number(model.ui.pairingsRoundIndex)
      : 0;

  const safeSelectedIdx = Math.min(Math.max(selectedIdx, 0), Math.max(0, rounds.length - 1));

  const selectedRound = rounds[safeSelectedIdx];

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

          <div style="display:flex; gap:10px; align-items:center; margin-top:10px;">
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
            Tip: Use the round picker below to keep the page clean.
          </div>
        </div>
      </div>

      <div id="roundsContainer" class="stack" style="margin-top:14px">
        ${
          playersApplied
            ? renderRoundPickerAndSelected(rounds, safeSelectedIdx, selectedRound, model)
            : renderPlayersGate()
        }
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

  const selectedIdx = Number.isFinite(Number(model?.ui?.pairingsRoundIndex)) ? Number(model.ui.pairingsRoundIndex) : 0;

  // Apply players
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

  // Round picker change
  const picker = roundsContainer.querySelector("#pairingsRoundSelect");
  if (picker) {
    picker.addEventListener("change", () => {
      const idx = Number(picker.value);
      const next = {
        ...model,
        ui: { ...(model.ui ?? {}), pairingsRoundIndex: Number.isFinite(idx) ? idx : 0 },
      };
      model = next;
      emit(next);

      renderPairings(model);
      bindPairingsUI(model, { onChange });
    });
  }

  // Add round
  addRoundBtn.addEventListener("click", () => {
    const players = Array.isArray(model?.players) ? model.players : [];
    if (!players.length) return;

    const holes = Number(model?.defaultHoles) || 18;
    const ppg = Number(model?.playersPerGroup) || 4;
    const round = makeNewRound(players, holes, ppg);

    const nextRounds = [...(Array.isArray(model?.rounds) ? model.rounds : []), round];
    const nextIdx = nextRounds.length - 1;

    const next = {
      ...model,
      rounds: nextRounds,
      ui: { ...(model.ui ?? {}), pairingsRoundIndex: nextIdx },
    };

    model = next;
    emit(next);

    renderPairings(model);
    bindPairingsUI(model, { onChange });
  });

  // Save (cosmetic)
  saveBtn.addEventListener("click", () => {
    emit(model);
    saveBtn.textContent = "Saved ✓";
    window.setTimeout(() => (saveBtn.textContent = "Save"), 900);
  });

  // Delegated clicks within selected round
  roundsContainer.addEventListener("click", (e) => {
    const removeBtn = e.target.closest("[data-remove-round]");
    if (removeBtn) {
      const idx = Number(removeBtn.getAttribute("data-remove-round"));
      if (!Number.isFinite(idx)) return;

      const rounds = (Array.isArray(model?.rounds) ? model.rounds : []).filter((_, i) => i !== idx);
      const nextIdx = Math.min(Number(model?.ui?.pairingsRoundIndex ?? 0), Math.max(0, rounds.length - 1));

      const next = {
        ...model,
        rounds,
        ui: { ...(model.ui ?? {}), pairingsRoundIndex: nextIdx },
      };
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
    }
  });

  // Delegated inputs within selected round
  roundsContainer.addEventListener("input", (e) => {
    const el = e.target;
    const roundCard = el.closest("[data-round-card]");
    if (!roundCard) return;

    const rIdx = Number(roundCard.getAttribute("data-round-card"));
    if (!Number.isFinite(rIdx)) return;

    const rounds = [...(Array.isArray(model?.rounds) ? model.rounds : [])];
    const r = rounds[rIdx];
    if (!r) return;

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

    if (el.matches("[data-par]")) {
      const hIdx = Number(el.getAttribute("data-h"));
      if (!Number.isFinite(hIdx)) return;

      const par = normalizePar(r.par, holes);
      par[hIdx] = clampPar(el.value);

      rounds[rIdx] = { ...r, holes, par };
      model = { ...model, rounds };
      emit(model);

      updateRoundComputed(roundCard, holes, par);
      updateStatsRibbon(roundsContainer, rounds[rIdx], model);
      return;
    }

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

      const par = normalizePar(r.par, holes);

      rounds[rIdx] = { ...r, holes, par, groups };
      model = { ...model, rounds };
      emit(model);

      updateRoundComputed(roundCard, holes, par);
      updateStatsRibbon(roundsContainer, rounds[rIdx], model);
    }
  });

  // Initial compute for selected round (if present)
  const selectedCard = roundsContainer.querySelector("[data-round-card]");
  if (selectedCard) {
    const rIdx = Number(selectedCard.getAttribute("data-round-card"));
    const r = (Array.isArray(model?.rounds) ? model.rounds : [])[rIdx];
    const holes = Number(r?.holes) || Number(model?.defaultHoles) || 18;
    const par = normalizePar(r?.par, holes);
    updateRoundComputed(selectedCard, holes, par);
    updateStatsRibbon(roundsContainer, r, model);
  }
}

/* ---------------------------
   UI render bits
---------------------------- */

function renderPlayersGate() {
  return `
    <div class="card">
      <div style="font-weight:900; margin-bottom:6px">Players required</div>
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

function renderRoundPickerAndSelected(rounds, selectedIdx, selectedRound, model) {
  if (!rounds.length) return renderEmptyRounds();

  const safeIdx = Math.min(Math.max(selectedIdx, 0), rounds.length - 1);
  const r = selectedRound ?? rounds[safeIdx];
  const holes = Number(r?.holes ?? model?.defaultHoles ?? 18) || 18;
  const par = normalizePar(r?.par, holes);
  const players = Array.isArray(model?.players) ? model.players : [];
  const ppg = Number(model?.playersPerGroup) || 4;
  const groups = Array.isArray(r?.groups) && r.groups.length ? r.groups : autoGroups(players, ppg, holes);

  const showBack = holes === 18;

  const roundLabel = (rr, i) => {
    const t = String(rr?.title ?? `Round ${i + 1}`).trim();
    const c = String(rr?.course ?? "").trim();
    return c ? `${t} — ${c}` : t;
  };

  return `
    <div class="pairings-sticky">
      <div class="pairings-toolbar card">
        <div class="toolbar-left">
          <label class="field" style="margin:0; min-width:280px;">
            <span class="field-label">Round</span>
            <select id="pairingsRoundSelect" class="input">
              ${rounds.map((rr, i) => `<option value="${i}" ${i===safeIdx?"selected":""}>${escapeHtml(roundLabel(rr, i))}</option>`).join("")}
            </select>
          </label>

          <div id="pairingsStats" class="stats-ribbon" aria-live="polite">
            <!-- filled in by JS -->
          </div>
        </div>

        <div class="toolbar-right">
          <button class="btn" type="button" data-print-round="${safeIdx}">Print scorecard</button>
          <button class="btn" type="button" data-autogroup-round="${safeIdx}">Auto-group</button>
          <button class="btn" type="button" data-remove-round="${safeIdx}">Remove</button>
        </div>
      </div>
    </div>

    ${renderSelectedRoundCard(r, safeIdx, holes, par, groups, showBack)}
  `;
}

function renderSelectedRoundCard(round, idx, holes, par, groups, showBack) {
  const title = round?.title ?? `Round ${idx + 1}`;
  const course = round?.course ?? "";

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
      </div>

      ${groups.map((g, gIdx) => renderGroupScorecards(g, gIdx, holes, par, showBack)).join("")}
    </div>
  `;
}

function renderGroupScorecards(group, gIdx, holes, par, showBack) {
  const players = Array.isArray(group?.players) ? group.players : [];
  const normalizedPlayers = players.map(p => ({
    name: p?.name ?? "",
    scores: normalizeScores(p?.scores, holes),
  }));

  return `
    <div class="card" style="margin-top:10px">
      <div class="scorecard-header" style="display:flex; justify-content:space-between; gap:10px; align-items:baseline; margin-bottom:8px;">
        <div class="muted"><b>Group ${gIdx + 1}</b></div>
        <div class="muted">Front / Back / Total + vs Par</div>
      </div>

      ${renderNineTable("Front 9", gIdx, 0, 9, normalizedPlayers, par, holes)}
      ${showBack ? renderNineTable("Back 9", gIdx, 9, 18, normalizedPlayers, par, holes) : ""}

      <div class="scorecard-totals"></div>
    </div>
  `;
}

function renderNineTable(label, gIdx, start, end, players, par, holesTotal) {
  const endBound = Math.min(end, holesTotal);
  const holeIdxs = Array.from({ length: Math.max(0, endBound - start) }, (_, i) => start + i);

  const headHoles = holeIdxs.map(h => `<th class="hole">${h + 1}</th>`).join("");

  const parInputs = holeIdxs.map(h => {
    const v = par[h] ?? "";
    return `
      <td class="hole">
        <input class="par-input" inputmode="numeric" pattern="[0-9]*"
          data-par="1" data-h="${h}" value="${escapeHtml(v)}" />
      </td>
    `;
  }).join("");

  const rows = players.map((p, pIdx) => {
    const scoreTds = holeIdxs.map(h => {
      const v = p.scores[h] ?? "";
      return `
        <td class="hole">
          <input class="score-input" inputmode="numeric" pattern="[0-9]*"
            data-score="1" data-g="${gIdx}" data-p="${pIdx}" data-h="${h}"
            value="${escapeHtml(v)}" />
        </td>
      `;
    }).join("");

    return `
      <tr data-player-row="1" data-player="${pIdx}">
        <td class="player">${escapeHtml(p.name)}</td>
        ${scoreTds}
        <td class="subtotal"><span data-subtotal="${label}" data-g="${gIdx}" data-p="${pIdx}">—</span></td>
      </tr>
    `;
  }).join("");

  return `
    <div class="table-block">
      <div class="table-title">${label}</div>
      <div class="table-scroll">
        <table class="score-table">
          <thead>
            <tr>
              <th class="player">Player</th>
              ${headHoles}
              <th class="subtotal">${label.startsWith("Front") ? "Front" : "Back"}</th>
            </tr>
            <tr class="par-row">
              <th class="player">PAR</th>
              ${parInputs}
              <th class="subtotal"><span data-par-subtotal="${label}">—</span></th>
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

/* ---------------------------
   Stats ribbon (computed on the selected round)
---------------------------- */

function updateStatsRibbon(containerEl, round, model) {
  const host = containerEl.querySelector("#pairingsStats");
  if (!host || !round) return;

  const holes = Number(round?.holes ?? model?.defaultHoles ?? 18) || 18;
  const par = normalizePar(round?.par, holes);
  const parFront = sumRange(par, 0, Math.min(9, holes));
  const parBack = holes === 18 ? sumRange(par, 9, 18) : 0;
  const parTotal = parFront + parBack;

  const players = Array.isArray(model?.players) ? model.players : [];
  const groups = Array.isArray(round?.groups) ? round.groups : [];
  const groupCount = groups.length;

  const completion = computeCompletion(round, holes);
  const status = completion.done ? "Final" : (completion.started ? "In progress" : "Not started");

  host.innerHTML = `
    <div class="stat">
      <div class="k">${players.length}</div>
      <div class="l">Players</div>
    </div>
    <div class="stat">
      <div class="k">${groupCount}</div>
      <div class="l">Groups</div>
    </div>
    <div class="stat">
      <div class="k">${holes}</div>
      <div class="l">Holes</div>
    </div>
    <div class="stat">
      <div class="k">${parTotal || "—"}</div>
      <div class="l">Par</div>
    </div>
    <div class="stat">
      <div class="k">${status}</div>
      <div class="l">${completion.pct}% filled</div>
    </div>
  `;
}

function computeCompletion(round, holes) {
  const groups = Array.isArray(round?.groups) ? round.groups : [];
  let filled = 0;
  let total = 0;
  let any = false;

  groups.forEach(g => {
    const pls = Array.isArray(g?.players) ? g.players : [];
    pls.forEach(p => {
      const scores = normalizeScores(p?.scores, holes);
      scores.forEach(v => {
        total += 1;
        if (String(v ?? "").trim() !== "") {
          filled += 1;
          any = true;
        }
      });
    });
  });

  const pct = total ? Math.round((filled / total) * 100) : 0;
  const done = total > 0 && filled === total;
  return { pct, done, started: any };
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
   Totals + Vs Par rendering updates
---------------------------- */

function updateRoundComputed(roundCardEl, holes, par) {
  if (!roundCardEl) return;

  const parFront = sumRange(par, 0, Math.min(9, holes));
  const parBack = holes === 18 ? sumRange(par, 9, 18) : 0;
  const parTotal = parFront + parBack;

  const parFrontEl = roundCardEl.querySelector('[data-par-subtotal="Front 9"]');
  if (parFrontEl) parFrontEl.textContent = parFront ? String(parFront) : "—";
  const parBackEl = roundCardEl.querySelector('[data-par-subtotal="Back 9"]');
  if (parBackEl) parBackEl.textContent = parBack ? String(parBack) : "—";

  const byGP = new Map();
  roundCardEl.querySelectorAll("input.score-input").forEach(inp => {
    const g = Number(inp.getAttribute("data-g"));
    const p = Number(inp.getAttribute("data-p"));
    const h = Number(inp.getAttribute("data-h"));
    if (![g, p, h].every(Number.isFinite)) return;

    const key = `${g}|${p}`;
    if (!byGP.has(key)) byGP.set(key, new Array(holes).fill(""));
    byGP.get(key)[h] = toIntOrBlank(inp.value);
  });

  roundCardEl.querySelectorAll("[data-subtotal]").forEach(span => {
    const label = span.getAttribute("data-subtotal") || "";
    const g = Number(span.getAttribute("data-g"));
    const p = Number(span.getAttribute("data-p"));
    if (![g, p].every(Number.isFinite)) return;

    const scores = byGP.get(`${g}|${p}`) ?? new Array(holes).fill("");
    const hasAny = scores.some(v => String(v ?? "").trim() !== "");
    if (!hasAny) {
      span.textContent = "—";
      return;
    }

    const val = label.startsWith("Front")
      ? sumRange(scores, 0, Math.min(9, holes))
      : sumRange(scores, 9, 18);

    span.textContent = String(val);
  });

  const groupCards = Array.from(roundCardEl.querySelectorAll(".card"))
    .filter(c => c.querySelector(".scorecard-totals"));

  groupCards.forEach((groupCard, gIdx) => {
    const totalsHost = groupCard.querySelector(".scorecard-totals");
    if (!totalsHost) return;

    const frontBlock = Array.from(groupCard.querySelectorAll(".table-block"))
      .find(b => (b.querySelector(".table-title")?.textContent || "").trim().startsWith("Front"));

    const rows = frontBlock ? Array.from(frontBlock.querySelectorAll('tbody tr[data-player-row="1"]')) : [];
    const playersList = rows
      .map(r => ({
        pIdx: Number(r.getAttribute("data-player")),
        name: (r.querySelector("td.player")?.textContent ?? "").trim(),
      }))
      .filter(x => Number.isFinite(x.pIdx));

    if (!playersList.length) {
      totalsHost.innerHTML = "";
      return;
    }

    const rowsHtml = playersList.map(p => {
      const scores = byGP.get(`${gIdx}|${p.pIdx}`) ?? new Array(holes).fill("");
      const hasAnyScore = scores.some(v => String(v ?? "").trim() !== "");

      const front = hasAnyScore ? sumRange(scores, 0, Math.min(9, holes)) : null;
      const back = (holes === 18) ? (hasAnyScore ? sumRange(scores, 9, 18) : null) : null;
      const total = hasAnyScore ? (Number(front || 0) + Number(back || 0)) : null;

      const vs = (hasAnyScore && parTotal > 0) ? (total - parTotal) : null;
      const vsTxt = vs == null ? "—" : formatVsPar(vs);

      return `
        <tr>
          <td class="player">${escapeHtml(p.name)}</td>
          <td class="num ${front==null ? "not-started":""}">${front==null ? "—" : front}</td>
          <td class="num ${back==null ? "not-started":""}">${holes === 18 ? (back==null ? "—" : back) : "-"}</td>
          <td class="num ${total==null ? "not-started":""}"><b>${total==null ? "—" : total}</b></td>
          <td class="num ${vs==null ? "not-started": vsClass(vs)}">${vsTxt}</td>
        </tr>
      `;
    }).join("");

    totalsHost.innerHTML = `
      <div class="table-scroll" style="margin-top:10px;">
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
              <th class="num">${parFront ? parFront : "—"}</th>
              <th class="num">${holes === 18 ? (parBack ? parBack : "—") : "-"}</th>
              <th class="num">${parTotal ? parTotal : "—"}</th>
              <th class="num">—</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
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
   Print
---------------------------- */

function printRound(roundIdx) {
  document.body.setAttribute("data-print-round", String(roundIdx));
  window.setTimeout(() => {
    window.print();
    window.setTimeout(() => document.body.removeAttribute("data-print-round"), 250);
  }, 50);
}

/* ---------------------------
   Misc helpers
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
