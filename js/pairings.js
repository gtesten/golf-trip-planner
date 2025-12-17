import { saveModel } from "./storage.js";

export function ensurePairings(model) {
  model.ui ??= { playersApplied: false, openRoundId: null };
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

function vsParClass(delta) {
  if (!Number.isFinite(delta)) return "";
  if (delta === 0) return "even";
  return delta > 0 ? "pos" : "neg";
}

function isFilledNumber(v) {
  if (v === "" || v == null) return false;
  const n = Number(v);
  return Number.isFinite(n);
}

function computePlayerTotals(round, player, holes) {
  const scores = round.scores[player] || [];
  const out = sumNums(scores, 0, Math.min(9, holes));
  const inn = holes === 18 ? sumNums(scores, 9, 18) : 0;
  const tot = sumNums(scores, 0, holes);
  const parTot = sumNums(round.par || [], 0, holes);
  return { out, inn, tot, vs: tot - parTot };
}

function wireGridNavigation(tableWrap) {
  // Enter -> next input; Arrow keys move
  tableWrap.addEventListener("keydown", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return;
    if (!t.classList.contains("score-input")) return;

    const inputs = Array.from(tableWrap.querySelectorAll("input.score-input"));
    const idx = inputs.indexOf(t);
    if (idx < 0) return;

    const move = (delta) => {
      const next = inputs[idx + delta];
      if (next) { next.focus(); next.select?.(); }
    };

    if (e.key === "Enter") { e.preventDefault(); move(1); }
    if (e.key === "ArrowRight") { move(1); }
    if (e.key === "ArrowLeft") { move(-1); }
  });
}

export function renderPairings(model) {
  ensurePairings(model);

  // Players UI
  const ta = document.getElementById("playersInput");
  ta.value = model.players.join("\n");
  document.getElementById("playersCount").textContent = `${model.players.length} players`;

  const subtitle = document.getElementById("pairingsSubtitle");
  const container = document.getElementById("roundsContainer");
  container.innerHTML = "";

  const btnCreateRound = document.getElementById("btnCreateRound");
  const btnAddRound = document.getElementById("btnAddRound");
  const btnResetScores = document.getElementById("btnResetScores");
  const btnPrintAll = document.getElementById("btnPrintAllScorecards");

  const canShowRounds = model.ui.playersApplied && model.players.length > 0;

  btnCreateRound.disabled = !canShowRounds;
  btnAddRound.disabled = !canShowRounds;
  btnResetScores.disabled = !canShowRounds;
  btnPrintAll.disabled = !canShowRounds || model.rounds.length === 0;

  if (!canShowRounds) {
    subtitle.textContent = "Step 1: Add players to begin.";
    const empty = document.createElement("div");
    empty.className = "card";
    empty.innerHTML = `
      <div class="card-title">Step 1 — Players</div>
      <div class="muted">
        Enter players (one per line) and click <b>Apply players</b>.
        Rounds and scorecards will appear once players are applied.
      </div>
    `;
    container.append(empty);
    saveModel(model);
    return;
  }

  subtitle.textContent = model.rounds.length
    ? "Step 3: Enter scores (use Enter / Arrow keys to move)."
    : "Step 2: Create your first round.";

  // Default open round: last created if none set
  if (!model.ui.openRoundId && model.rounds.length) {
    model.ui.openRoundId = model.rounds[model.rounds.length - 1].id;
  }

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

    // Compute leaderboard snapshot
    const leaderboard = model.players
      .map(p => ({ p, ...computePlayerTotals(round, p, holes) }))
      .filter(x => isFilledNumber(x.tot))
      .sort((a, b) => a.tot - b.tot)
      .slice(0, 5);

    const wrap = document.createElement("div");
    wrap.className = "round-card";

    const head = document.createElement("div");
    head.className = "round-head";

    const left = document.createElement("div");
    left.className = "round-meta";

    const title = document.createElement("button");
    title.className = "btn secondary";
    title.style.padding = "10px 12px";
    title.textContent = round.name || `Round ${r + 1}`;
    title.title = "Expand/collapse this round";
    title.addEventListener("click", () => {
      model.ui.openRoundId = (model.ui.openRoundId === round.id) ? null : round.id;
      saveModel(model);
      renderPairings(model);
    });

    const pillHoles = document.createElement("span");
    pillHoles.className = "pill";
    pillHoles.innerHTML = `<strong>${holes}</strong> holes`;

    const parTot = sumNums(round.par, 0, holes);
    const pillPar = document.createElement("span");
    pillPar.className = "pill";
    pillPar.innerHTML = `<strong>${parTot}</strong> par`;

    left.append(title, pillHoles, pillPar);

    const right = document.createElement("div");
    right.className = "actions";

    const btnActive = document.createElement("button");
    btnActive.className = "btn secondary";
    btnActive.textContent = (model.ui.openRoundId === round.id) ? "Active" : "Set active";
    btnActive.disabled = (model.ui.openRoundId === round.id);
    btnActive.addEventListener("click", () => {
      model.ui.openRoundId = round.id;
      saveModel(model);
      renderPairings(model);
    });

    const btnPrint = document.createElement("button");
    btnPrint.className = "btn secondary";
    btnPrint.textContent = "Print";
    btnPrint.addEventListener("click", () => window.print());

    const del = document.createElement("button");
    del.className = "btn secondary";
    del.textContent = "Delete";
    del.addEventListener("click", () => {
      model.rounds.splice(r, 1);
      if (model.ui.openRoundId === round.id) model.ui.openRoundId = null;
      saveModel(model);
      renderPairings(model);
    });

    right.append(btnActive, btnPrint, del);

    head.append(left, right);

    // Body collapsible
    const isOpen = model.ui.openRoundId === round.id;

    const body = document.createElement("div");
    body.style.display = isOpen ? "block" : "none";
    body.style.marginTop = "10px";

    // Leaderboard card (quick scan)
    const lb = document.createElement("div");
    lb.className = "card";
    lb.innerHTML = `
      <div class="card-title">Round snapshot</div>
      ${
        leaderboard.length
          ? `<div class="muted small">${leaderboard.map((x, i) =>
              `${i + 1}. <b>${x.p}</b> ${x.tot} (${formatVsPar(x.vs)})`
            ).join(" &nbsp; • &nbsp; ")}</div>`
          : `<div class="muted small">Enter a few scores and the leaderboard will show here.</div>`
      }
    `;

    // Table
    const tableWrap = document.createElement("div");
    tableWrap.className = "table-wrap";

    const table = document.createElement("table");
    table.className = "score-table";

    // Header
    const thead = document.createElement("thead");
    const hr = document.createElement("tr");

    const thPlayer = document.createElement("th"); thPlayer.textContent = "Player";
    const thHcp = document.createElement("th"); thHcp.textContent = "HCP";
    hr.append(thPlayer, thHcp);

    for (let i = 1; i <= holes; i++) {
      const th = document.createElement("th");
      th.textContent = i;
      hr.append(th);
      if (i === 9) { const thOut = document.createElement("th"); thOut.textContent = "OUT"; hr.append(thOut); }
    }
    if (holes === 18) { const thIn = document.createElement("th"); thIn.textContent = "IN"; hr.append(thIn); }
    const thTot = document.createElement("th"); thTot.textContent = "TOTAL"; hr.append(thTot);
    const thVs = document.createElement("th"); thVs.textContent = "Vs PAR"; hr.append(thVs);

    thead.append(hr);
    table.append(thead);

    const tbody = document.createElement("tbody");

    // PAR row
    const trPar = document.createElement("tr");
    trPar.append(Object.assign(document.createElement("td"), { textContent: "PAR" }));
    trPar.append(Object.assign(document.createElement("td"), { textContent: "" }));

    const parOutSpan = document.createElement("span");
    const parInSpan = document.createElement("span");
    const parTotSpan = document.createElement("span");

    function refreshParTotals() {
      parOutSpan.textContent = String(sumNums(round.par, 0, Math.min(9, holes)));
      if (holes === 18) parInSpan.textContent = String(sumNums(round.par, 9, 18));
      parTotSpan.textContent = String(sumNums(round.par, 0, holes));
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
        saveModel(model);
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
    const tdTot2 = document.createElement("td");
    tdTot2.className = "total-cell";
    tdTot2.append(parTotSpan);
    trPar.append(tdTot2);

    trPar.append(Object.assign(document.createElement("td"), { textContent: "" }));
    refreshParTotals();
    tbody.append(trPar);

    // Player rows
    model.players.forEach((pName) => {
      const scores = round.scores[pName];

      const tr = document.createElement("tr");
      tr.append(Object.assign(document.createElement("td"), { textContent: pName }));

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
      tr.append(tdHcp);

      const outSpan = document.createElement("span");
      const inSpan = document.createElement("span");
      const totSpan = document.createElement("span");
      const vsSpan = document.createElement("span");

      function refreshRowTotals() {
        const { out, inn, tot, vs } = computePlayerTotals(round, pName, holes);
        outSpan.textContent = String(out);
        if (holes === 18) inSpan.textContent = String(inn);
        totSpan.textContent = String(tot);

        const txt = formatVsPar(vs);
        vsSpan.textContent = txt;
        vsSpan.className = `badge ${vsParClass(vs)}`;
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

      const tdTot = document.createElement("td");
      tdTot.className = "total-cell";
      tdTot.append(totSpan);

      const tdVs = document.createElement("td");
      tdVs.className = "total-cell";
      tdVs.append(vsSpan);

      tr.append(tdTot, tdVs);
      refreshRowTotals();
      tbody.append(tr);
    });

    table.append(tbody);
    tableWrap.append(table);
    wireGridNavigation(tableWrap);

    body.append(lb, tableWrap);
    wrap.append(head, body);
    container.append(wrap);
  }

  saveModel(model);
}

export function bindPairingsUI(model) {
  ensurePairings(model);

  document.getElementById("btnApplyPlayers").addEventListener("click", () => {
    const text = document.getElementById("playersInput").value;
    model.players = parsePlayers(text);
    model.ui.playersApplied = model.players.length > 0;
    saveModel(model);
    renderPairings(model);
  });

  document.getElementById("btnCreateRound").addEventListener("click", () => {
    if (!model.ui.playersApplied || model.players.length === 0) return;

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
    model.ui.openRoundId = newRound.id; // open immediately
    saveModel(model);
    renderPairings(model);
    nameEl.value = "";
  });

  document.getElementById("btnAddRound").addEventListener("click", () => {
    document.getElementById("btnCreateRound").click();
  });

  document.getElementById("btnResetScores").addEventListener("click", () => {
    if (!model.ui.playersApplied || model.players.length === 0) return;
    for (const round of model.rounds) {
      const holes = Number(round.holes || 18);
      round.scores = makeEmptyScores(model.players, holes);
    }
    saveModel(model);
    renderPairings(model);
  });

  document.getElementById("btnPrintAllScorecards")?.addEventListener("click", () => {
    window.print();
  });
}
