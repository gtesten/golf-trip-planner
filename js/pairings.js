import { saveModel } from "./storage.js";

export function ensurePairings(model) {
  model.ui ??= { playersApplied: false };
  model.players ??= [];
  model.rounds ??= [];
}

export function parsePlayers(text) {
  return text
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 24);
}

function makeEmptyScores(players, holes) {
  const scores = {};
  for (const p of players) scores[p] = Array.from({ length: holes }, () => "");
  return scores;
}

function ensurePar(round, holes) {
  round.par ??= Array.from({ length: holes }, () => "");
  if (round.par.length !== holes) {
    round.par = Array.from({ length: holes }, (_, i) => round.par[i] ?? "");
  }
}

function sumNums(arr, fromIdx, toIdxExclusive) {
  let t = 0;
  for (let i = fromIdx; i < toIdxExclusive; i++) {
    const n = Number(arr[i]);
    if (!Number.isFinite(n)) continue;
    t += n;
  }
  return t;
}

function formatVsPar(delta) {
  if (!Number.isFinite(delta)) return "—";
  if (delta === 0) return "E";
  return delta > 0 ? `+${delta}` : `${delta}`;
}

export function renderPairings(model) {
  ensurePairings(model);

  // Players UI
  const ta = document.getElementById("playersInput");
  ta.value = model.players.join("\n");
  document.getElementById("playersCount").textContent = `${model.players.length} players`;

  const container = document.getElementById("roundsContainer");
  container.innerHTML = "";

  // Gate: no rounds visible until Apply Players has been clicked at least once
  const canShowRounds = model.ui.playersApplied && model.players.length > 0;

  // Disable/enable round controls
  const btnCreateRound = document.getElementById("btnCreateRound");
  const btnAddRound = document.getElementById("btnAddRound");
  const btnResetScores = document.getElementById("btnResetScores");
  btnCreateRound.disabled = !canShowRounds;
  btnAddRound.disabled = !canShowRounds;
  btnResetScores.disabled = !canShowRounds;

  if (!canShowRounds) {
    const empty = document.createElement("div");
    empty.className = "card";
    empty.innerHTML = `
      <div class="card-title">Add players first</div>
      <div class="muted">
        Enter players (one per line) and click <b>Apply players</b>.
        After that, you can add rounds and scorecards will appear here.
      </div>
    `;
    container.append(empty);
    saveModel(model);
    return;
  }

  // Render rounds
  for (let r = 0; r < model.rounds.length; r++) {
    const round = model.rounds[r];
    const holes = Number(round.holes || 18);

    round.hcp ??= {};
    round.scores ??= makeEmptyScores(model.players, holes);
    ensurePar(round, holes);

    // Ensure players exist
    for (const p of model.players) {
      round.hcp[p] ??= "";
      round.scores[p] ??= Array.from({ length: holes }, () => "");
      if (round.scores[p].length !== holes) {
        round.scores[p] = Array.from({ length: holes }, (_, i) => round.scores[p][i] ?? "");
      }
    }
    // Remove missing players
    for (const p of Object.keys(round.scores)) if (!model.players.includes(p)) delete round.scores[p];
    for (const p of Object.keys(round.hcp)) if (!model.players.includes(p)) delete round.hcp[p];

    const wrap = document.createElement("div");
    wrap.className = "round-card";

    const head = document.createElement("div");
    head.className = "round-head";

    const title = document.createElement("div");
    title.className = "round-title";
    title.textContent = round.name || `Round ${r + 1}`;

    const right = document.createElement("div");
    right.className = "actions";

    const btnPrint = document.createElement("button");
    btnPrint.className = "btn secondary";
    btnPrint.textContent = "Print scorecard";
    btnPrint.addEventListener("click", () => window.print());

    const del = document.createElement("button");
    del.className = "btn secondary";
    del.textContent = "Delete round";
    del.addEventListener("click", () => {
      model.rounds.splice(r, 1);
      saveModel(model);
      renderPairings(model);
    });

    right.append(btnPrint, del);
    head.append(title, right);

    const tableWrap = document.createElement("div");
    tableWrap.className = "table-wrap";

    const table = document.createElement("table");
    table.className = "score-table";

    // ---- Header ----
    const thead = document.createElement("thead");
    const hr = document.createElement("tr");

    const thPlayer = document.createElement("th");
    thPlayer.textContent = "Player";
    const thHcp = document.createElement("th");
    thHcp.textContent = "HCP";

    hr.append(thPlayer, thHcp);

    for (let i = 1; i <= holes; i++) {
      const th = document.createElement("th");
      th.textContent = i;
      hr.append(th);
      if (i === 9) {
        const thOut = document.createElement("th");
        thOut.textContent = "OUT";
        hr.append(thOut);
      }
    }

    if (holes === 18) {
      const thIn = document.createElement("th");
      thIn.textContent = "IN";
      hr.append(thIn);
    }

    const thTot = document.createElement("th");
    thTot.textContent = "TOTAL";
    hr.append(thTot);

    const thVs = document.createElement("th");
    thVs.textContent = "Vs PAR";
    hr.append(thVs);

    thead.append(hr);
    table.append(thead);

    // ---- Body ----
    const tbody = document.createElement("tbody");

    // PAR row
    const trPar = document.createElement("tr");
    const tdParLabel = document.createElement("td");
    tdParLabel.textContent = "PAR";
    const tdParBlank = document.createElement("td");
    tdParBlank.textContent = "";
    trPar.append(tdParLabel, tdParBlank);

    const parTotalSpan = document.createElement("span");
    const parOutSpan = document.createElement("span");
    const parInSpan = document.createElement("span");

    function refreshParTotals() {
      const out = sumNums(round.par, 0, Math.min(9, holes));
      const inn = holes === 18 ? sumNums(round.par, 9, 18) : 0;
      const tot = sumNums(round.par, 0, holes);
      parOutSpan.textContent = Number.isFinite(out) ? String(out) : "—";
      parInSpan.textContent = holes === 18 ? String(inn) : "—";
      parTotalSpan.textContent = String(tot);
    }

    for (let h = 0; h < holes; h++) {
      const td = document.createElement("td");
      const inp = document.createElement("input");
      inp.className = "score-input";
      inp.inputMode = "numeric";
      inp.value = round.par[h] ?? "";
      inp.addEventListener("input", () => {
        const cleaned = inp.value.replace(/[^\d]/g, "").slice(0, 2);
        inp.value = cleaned;
        round.par[h] = cleaned;
        refreshParTotals();
        saveModel(model);
        // re-render to refresh all vs-par cells (simple + reliable)
        renderPairings(model);
      });
      td.append(inp);
      trPar.append(td);

      if (h === 8) {
        const tdOut = document.createElement("td");
        tdOut.className = "total-cell";
        tdOut.append(parOutSpan);
        trPar.append(tdOut);
      }
    }

    if (holes === 18) {
      const tdIn = document.createElement("td");
      tdIn.className = "total-cell";
      tdIn.append(parInSpan);
      trPar.append(tdIn);
    }

    const tdTot = document.createElement("td");
    tdTot.className = "total-cell";
    tdTot.append(parTotalSpan);
    trPar.append(tdTot);

    const tdVsBlank = document.createElement("td");
    tdVsBlank.textContent = "";
    trPar.append(tdVsBlank);

    refreshParTotals();
    tbody.append(trPar);

    // Player rows
    model.players.forEach((pName) => {
      const scores = round.scores[pName];

      const tr = document.createElement("tr");

      const tdName = document.createElement("td");
      tdName.textContent = pName;

      const tdHcp = document.createElement("td");
      const hcpInput = document.createElement("input");
      hcpInput.className = "score-input";
      hcpInput.inputMode = "numeric";
      hcpInput.placeholder = "—";
      hcpInput.value = round.hcp[pName] ?? "";
      hcpInput.addEventListener("input", () => {
        round.hcp[pName] = hcpInput.value.replace(/[^\d-]/g, "").slice(0, 3);
        saveModel(model);
      });
      tdHcp.append(hcpInput);

      tr.append(tdName, tdHcp);

      const outSpan = document.createElement("span");
      const inSpan = document.createElement("span");
      const totSpan = document.createElement("span");
      const vsSpan = document.createElement("span");

      function refreshRowTotals() {
        const out = sumNums(scores, 0, Math.min(9, holes));
        const inn = holes === 18 ? sumNums(scores, 9, 18) : 0;
        const tot = sumNums(scores, 0, holes);
        const parTot = sumNums(round.par, 0, holes);
        outSpan.textContent = String(out);
        if (holes === 18) inSpan.textContent = String(inn);
        totSpan.textContent = String(tot);
        vsSpan.textContent = formatVsPar(tot - parTot);
      }

      for (let h = 0; h < holes; h++) {
        const td = document.createElement("td");
        const inp = document.createElement("input");
        inp.className = "score-input";
        inp.inputMode = "numeric";
        inp.value = scores[h] ?? "";
        inp.addEventListener("input", () => {
          const cleaned = inp.value.replace(/[^\d]/g, "").slice(0, 2);
          inp.value = cleaned;
          scores[h] = cleaned;
          refreshRowTotals();
          saveModel(model);
        });
        td.append(inp);
        tr.append(td);

        if (h === 8) {
          const tdOut = document.createElement("td");
          tdOut.className = "total-cell";
          tdOut.append(outSpan);
          tr.append(tdOut);
        }
      }

      if (holes === 18) {
        const tdIn = document.createElement("td");
        tdIn.className = "total-cell";
        tdIn.append(inSpan);
        tr.append(tdIn);
      }

      const tdTot2 = document.createElement("td");
      tdTot2.className = "total-cell";
      tdTot2.append(totSpan);

      const tdVs = document.createElement("td");
      tdVs.className = "total-cell";
      tdVs.append(vsSpan);

      tr.append(tdTot2, tdVs);

      refreshRowTotals();
      tbody.append(tr);
    });

    table.append(tbody);
    tableWrap.append(table);
    wrap.append(head, tableWrap);
    container.append(wrap);
  }

  saveModel(model);
}

export function bindPairingsUI(model) {
  ensurePairings(model);

  const btnApplyPlayers = document.getElementById("btnApplyPlayers");
  const btnCreateRound = document.getElementById("btnCreateRound");
  const btnAddRound = document.getElementById("btnAddRound");
  const btnResetScores = document.getElementById("btnResetScores");

  btnApplyPlayers.addEventListener("click", () => {
    const text = document.getElementById("playersInput").value;
    model.players = parsePlayers(text);

    // Gate: only after successful apply with >0 players
    model.ui.playersApplied = model.players.length > 0;

    // Reconcile existing rounds if any
    for (const round of model.rounds) {
      const holes = Number(round.holes || 18);
      round.hcp ??= {};
      round.scores ??= {};
      ensurePar(round, holes);

      for (const p of model.players) {
        round.hcp[p] ??= "";
        round.scores[p] ??= Array.from({ length: holes }, () => "");
      }
      for (const p of Object.keys(round.hcp)) if (!model.players.includes(p)) delete round.hcp[p];
      for (const p of Object.keys(round.scores)) if (!model.players.includes(p)) delete round.scores[p];
    }

    saveModel(model);
    renderPairings(model);
  });

  btnCreateRound.addEventListener("click", () => {
    if (!model.ui.playersApplied || model.players.length === 0) return;

    const nameEl = document.getElementById("roundNameInput");
    const holesEl = document.getElementById("holesSelect");

    const name = nameEl.value.trim() || `Round ${model.rounds.length + 1}`;
    const holes = Number(holesEl.value || 18);

    model.rounds.push({
      id: crypto?.randomUUID?.() ?? String(Date.now()),
      name,
      holes,
      par: Array.from({ length: holes }, () => ""),
      hcp: {},
      scores: makeEmptyScores(model.players, holes),
    });

    saveModel(model);
    renderPairings(model);
    nameEl.value = "";
  });

  btnAddRound.addEventListener("click", () => {
    btnCreateRound.click();
  });

  btnResetScores.addEventListener("click", () => {
    if (!model.ui.playersApplied || model.players.length === 0) return;
    for (const round of model.rounds) {
      const holes = Number(round.holes || 18);
      round.scores = makeEmptyScores(model.players, holes);
    }
    saveModel(model);
    renderPairings(model);
  });
}
