import { saveModel } from "./storage.js";

export function ensurePairings(model) {
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
  for (const p of players) {
    scores[p] = Array.from({ length: holes }, () => "");
  }
  return scores;
}

function sumRow(arr) {
  let t = 0;
  for (const v of arr) {
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    t += n;
  }
  return t;
}

/* ---------- PAR helpers ---------- */
function ensurePar(round, holes) {
  round.par ??= Array.from({ length: holes }, () => "");
  if (round.par.length !== holes) {
    round.par = Array.from({ length: holes }, (_, i) => round.par[i] ?? "");
  }
}

function sumPar(arr) {
  let t = 0;
  for (const v of arr) {
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    t += n;
  }
  return t;
}
/* ------------------------------- */

export function renderPairings(model) {
  ensurePairings(model);

  // Players UI
  const ta = document.getElementById("playersInput");
  ta.value = model.players.join("\n");
  document.getElementById("playersCount").textContent = `${model.players.length} players`;

  const container = document.getElementById("roundsContainer");
  container.innerHTML = "";

  for (let r = 0; r < model.rounds.length; r++) {
    const round = model.rounds[r];
    const holes = Number(round.holes || 18);

    // Ensure round data structures exist and are consistent
    round.hcp ??= {};
    round.scores ??= makeEmptyScores(model.players, holes);
    ensurePar(round, holes);

    // Ensure all current players exist in round
    for (const p of model.players) {
      round.hcp[p] ??= "";
      round.scores[p] ??= Array.from({ length: holes }, () => "");
      if (round.scores[p].length !== holes) {
        round.scores[p] = Array.from({ length: holes }, (_, i) => round.scores[p][i] ?? "");
      }
    }

    // Remove players no longer in list
    for (const p of Object.keys(round.scores)) {
      if (!model.players.includes(p)) delete round.scores[p];
    }
    for (const p of Object.keys(round.hcp)) {
      if (!model.players.includes(p)) delete round.hcp[p];
    }

    const wrap = document.createElement("div");
    wrap.className = "round-card";

    const head = document.createElement("div");
    head.className = "round-head";

    const title = document.createElement("div");
    title.className = "round-title";
    title.textContent = round.name || `Round ${r + 1}`;

    const right = document.createElement("div");
    right.className = "actions";

    const del = document.createElement("button");
    del.className = "btn secondary";
    del.textContent = "Delete round";
    del.addEventListener("click", () => {
      model.rounds.splice(r, 1);
      saveModel(model);
      renderPairings(model);
    });

    right.append(del);
    head.append(title, right);

    const tableWrap = document.createElement("div");
    tableWrap.className = "table-wrap";

    const table = document.createElement("table");
    table.className = "score-table";

    // Header
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
    }

    const thTot = document.createElement("th");
    thTot.textContent = "Total";
    hr.append(thTot);

    thead.append(hr);
    table.append(thead);

    // Body
    const tbody = document.createElement("tbody");

    // PAR row (editable)
    const trPar = document.createElement("tr");

    const tdParLabel = document.createElement("td");
    tdParLabel.textContent = "PAR";

    const tdParBlank = document.createElement("td");
    tdParBlank.textContent = "";

    trPar.append(tdParLabel, tdParBlank);

    for (let h = 0; h < holes; h++) {
      const td = document.createElement("td");
      const inp = document.createElement("input");
      inp.className = "score-input";
      inp.inputMode = "numeric";
      inp.placeholder = "";
      inp.value = round.par[h] ?? "";
      inp.addEventListener("input", () => {
        const cleaned = inp.value.replace(/[^\d]/g, "").slice(0, 2);
        inp.value = cleaned;
        round.par[h] = cleaned;
        parTotalSpan.textContent = sumPar(round.par).toString();
        saveModel(model);
      });
      td.append(inp);
      trPar.append(td);
    }

    const tdParTot = document.createElement("td");
    tdParTot.className = "total-cell";
    const parTotalSpan = document.createElement("span");
    parTotalSpan.textContent = sumPar(round.par).toString();
    tdParTot.append(parTotalSpan);
    trPar.append(tdParTot);

    tbody.append(trPar);

    // Player rows
    model.players.forEach((pName) => {
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

      const row = round.scores[pName];

      // total cell needs to exist before score inputs update it
      const tdTot = document.createElement("td");
      tdTot.className = "total-cell";
      const totalSpan = document.createElement("span");
      totalSpan.textContent = sumRow(row).toString();
      tdTot.append(totalSpan);

      for (let h = 0; h < holes; h++) {
        const td = document.createElement("td");
        const inp = document.createElement("input");
        inp.className = "score-input";
        inp.inputMode = "numeric";
        inp.value = row[h] ?? "";
        inp.addEventListener("input", () => {
          const cleaned = inp.value.replace(/[^\d]/g, "").slice(0, 2);
          inp.value = cleaned;
          row[h] = cleaned;
          totalSpan.textContent = sumRow(row).toString();
          saveModel(model);
        });
        td.append(inp);
        tr.append(td);
      }

      tr.append(tdTot);
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

    // Reconcile each round with new player list
    for (const round of model.rounds) {
      const holes = Number(round.holes || 18);
      round.hcp ??= {};
      round.scores ??= {};
      ensurePar(round, holes);

      for (const p of model.players) {
        round.hcp[p] ??= "";
        round.scores[p] ??= Array.from({ length: holes }, () => "");
        if (round.scores[p].length !== holes) {
          round.scores[p] = Array.from({ length: holes }, (_, i) => round.scores[p][i] ?? "");
        }
      }
      for (const p of Object.keys(round.hcp)) if (!model.players.includes(p)) delete round.hcp[p];
      for (const p of Object.keys(round.scores)) if (!model.players.includes(p)) delete round.scores[p];
    }

    saveModel(model);
    renderPairings(model);
  });

  btnCreateRound.addEventListener("click", () => {
    const nameEl = document.getElementById("roundNameInput");
    const holesEl = document.getElementById("holesSelect");

    const name = nameEl.value.trim() || `Round ${model.rounds.length + 1}`;
    const holes = Number(holesEl.value || 18);

    const newRound = {
      id: crypto?.randomUUID?.() ?? String(Date.now()),
      name,
      holes,
      par: Array.from({ length: holes }, () => ""),
      hcp: {},
      scores: makeEmptyScores(model.players, holes),
    };

    model.rounds.push(newRound);
    saveModel(model);
    renderPairings(model);

    // Optional: clear input after creation
    nameEl.value = "";
  });

  // Make "Add Round" actually add a round (instead of just focusing)
  btnAddRound.addEventListener("click", () => {
    btnCreateRound.click();
  });

  btnResetScores.addEventListener("click", () => {
    for (const round of model.rounds) {
      const holes = Number(round.holes || 18);
      round.scores = makeEmptyScores(model.players, holes);
    }
    saveModel(model);
    renderPairings(model);
  });
}
