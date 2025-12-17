import { saveModel } from "./storage.js";

export function ensurePairings(model) {
  model.ui ??= { playersApplied: false, openRoundId: null, roundViews: {} };
  model.ui.roundViews ??= {};
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
    const v = arr[i];
    if (v === "" || v == null) continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    t += n;
  }
  return t;
}

function countFilled(arr, fromIdx, toIdxExclusive) {
  let c = 0;
  for (let i = fromIdx; i < toIdxExclusive; i++) {
    const v = arr[i];
    if (v === "" || v == null) continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    c++;
  }
  return c;
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

/** PAR is only "ready" if every hole has a valid 3–6 value */
function isParComplete(round, holes) {
  const par = round.par || [];
  for (let i = 0; i < holes; i++) {
    const v = par[i];
    if (v === "" || v == null) return false;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 3 || n > 6) return false;
  }
  return true;
}

// Reasonable default templates (not course-specific, but great for quick scoring)
function buildParTemplate(totalPar, holes) {
  if (holes !== 18) {
    if (totalPar === 36) return [4,4,3,4,4,3,4,5,5];
    if (totalPar === 35) return [4,4,3,4,4,3,4,5,4];
    if (totalPar === 34) return [4,4,3,4,4,3,4,4,4];
    return Array.from({ length: holes }, () => 4);
  }

  if (totalPar === 72) return [4,4,3,4,4,3,4,5,5, 4,4,3,5,4,4,3,4,5];
  if (totalPar === 71) return [4,4,3,4,4,3,4,5,5, 4,4,3,5,4,4,3,4,4];
  if (totalPar === 70) return [4,4,3,4,4,3,4,5,4, 4,4,3,5,4,4,3,4,4];
  if (totalPar === 73) return [4,4,3,4,5,3,4,5,5, 4,4,3,5,4,4,3,5,5];
  if (totalPar === 74) return [4,4,3,4,5,3,4,5,5, 4,4,3,5,4,5,3,5,5];

  return Array.from({ length: holes }, () => 4);
}

function computePlayerTotals(round, player, holes) {
  const scores = round.scores[player] || [];
  const filled = countFilled(scores, 0, holes);

  const out = sumNums(scores, 0, Math.min(9, holes));
  const inn = holes === 18 ? sumNums(scores, 9, 18) : 0;
  const tot = sumNums(scores, 0, holes);

  const hcpRaw = round.hcp?.[player];
  const hcp = Number.isFinite(Number(hcpRaw)) ? Number(hcpRaw) : 0;

  const parReady = isParComplete(round, holes);
  const parTot = parReady ? sumNums(round.par || [], 0, holes) : NaN;
  const delta = (filled > 0 && parReady) ? (tot - parTot) : NaN;

  const net = filled > 0 ? (tot - hcp) : NaN;

  return { filled, out, inn, tot, hcp, net, vs: delta, parReady };
}

function wireGridNavigation(tableWrap) {
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
    if (e.key === "ArrowRight") move(1);
    if (e.key === "ArrowLeft") move(-1);
  });
}

function renderSnapshotText(model, round, holes) {
  const hasAnyHcp = model.players.some(p => Number.isFinite(Number(round.hcp?.[p])));

  const rows = model.players
    .map(p => ({ p, ...computePlayerTotals(round, p, holes) }))
    .filter(x => x.filled > 0)
    .sort((a, b) => {
      const aScore = hasAnyHcp ? a.net : a.tot;
      const bScore = hasAnyHcp ? b.net : b.tot;
      if (aScore !== bScore) return aScore - bScore;
      return b.filled - a.filled;
    })
    .slice(0, 5);

  if (!rows.length) return `<div class="muted small">Enter scores and the leaderboard will show here.</div>`;

  const line = rows.map((x, i) =>
    `${i + 1}. <b>${x.p}</b> ${hasAnyHcp ? x.net : x.tot} (${formatVsPar(x.vs)})`
  ).join(" &nbsp; • &nbsp; ");

  return `<div class="muted small">${line}</div>`;
}

export function renderPairings(model) {
  ensurePairings(model);

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
      </div>
    `;
    container.append(empty);
    saveModel(model);
    return;
  }

  subtitle.textContent = model.rounds.length
    ? "Step 3: Enter scores (use Enter / Arrow keys to move)."
    : "Step 2: Create your first round.";

  if (!model.ui.openRoundId && model.rounds.length) {
    model.ui.openRoundId = model.rounds[model.rounds.length - 1].id;
  }

  for (let r = 0; r < model.rounds.length; r++) {
    const round = model.rounds[r];
    const holes = Number(round.holes || 18);

    round.hcp ??= {};
    round.scores ??= makeEmptyScores(model.players, holes);
    ensurePar(round, holes);

    for (const p of model.players) {
      round.hcp[p] ??= "";
      round.scores[p] ??= Array.from({ length: holes }, () => "");
      if (round.scores[p].length !== holes) {
        round.scores[p] = Array.from({ length: holes }, (_, i) => round.scores[p][i] ?? "");
      }
    }
    for (const p of Object.keys(round.scores)) if (!model.players.includes(p)) delete round.scores[p];
    for (const p of Object.keys(round.hcp)) if (!model.players.includes(p)) delete round.hcp[p];

    if (!model.ui.roundViews[round.id]) model.ui.roundViews[round.id] = "scores";

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

    const pillPar = document.createElement("span");
    pillPar.className = "pill";
    pillPar.innerHTML = `<strong>${sumNums(round.par, 0, holes)}</strong> par`;

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
      delete model.ui.roundViews[round.id];
      if (model.ui.openRoundId === round.id) model.ui.openRoundId = null;
      saveModel(model);
      renderPairings(model);
    });

    right.append(btnActive, btnPrint, del);
    head.append(left, right);

    const isOpen = model.ui.openRoundId === round.id;

    const body = document.createElement("div");
    body.style.display = isOpen ? "block" : "none";
    body.style.marginTop = "10px";

    // Snapshot card
    const lb = document.createElement("div");
    lb.className = "card";
    lb.innerHTML = `
      <div class="card-title">Round snapshot</div>
      <div data-snapshot="${round.id}">${renderSnapshotText(model, round, holes)}</div>
    `;

    // Toggle row
    const toggle = document.createElement("div");
    toggle.className = "round-toggle";

    const btnScores = document.createElement("button");
    btnScores.className = "btn secondary";
    btnScores.textContent = "Score Entry";

    const btnBoard = document.createElement("button");
    btnBoard.className = "btn secondary";
    btnBoard.textContent = "Leaderboard";

    toggle.append(btnScores, btnBoard);

    // PAR tools row
    const parTools = document.createElement("div");
    parTools.className = "round-toggle";

    const btnPar72 = document.createElement("button");
    btnPar72.className = "btn secondary";
    btnPar72.textContent = "Auto PAR 72";

    const btnPar71 = document.createElement("button");
    btnPar71.className = "btn secondary";
    btnPar71.textContent = "PAR 71";

    const btnPar70 = document.createElement("button");
    btnPar70.className = "btn secondary";
    btnPar70.textContent = "PAR 70";

    const btnCopyPar = document.createElement("button");
    btnCopyPar.className = "btn secondary";
    btnCopyPar.textContent = "Copy PAR from last";

    parTools.append(btnPar72, btnPar71, btnPar70, btnCopyPar);

    btnPar72.addEventListener("click", () => {
      round.par = buildParTemplate(holes === 18 ? 72 : 36, holes).map(String);
      saveModel(model);
      renderPairings(model);
    });

    btnPar71.addEventListener("click", () => {
      round.par = buildParTemplate(holes === 18 ? 71 : 35, holes).map(String);
      saveModel(model);
      renderPairings(model);
    });

    btnPar70.addEventListener("click", () => {
      round.par = buildParTemplate(holes === 18 ? 70 : 34, holes).map(String);
      saveModel(model);
      renderPairings(model);
    });

    btnCopyPar.addEventListener("click", () => {
      const idx = model.rounds.findIndex(rr => rr.id === round.id);
      const prev = idx > 0 ? model.rounds[idx - 1] : null;
      if (!prev?.par) return;
      round.par = prev.par.slice(0, holes).map(v => String(v ?? ""));
      saveModel(model);
      renderPairings(model);
    });

    // Score Entry wrap
    const scoresWrap = document.createElement("div");
    scoresWrap.style.display = "block";

    const tableWrap = document.createElement("div");
    tableWrap.className = "table-wrap";

    const table = document.createElement("table");
    table.className = "score-table";

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
      pillPar.innerHTML = `<strong>${sumNums(round.par, 0, holes)}</strong> par`;
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

    // Leaderboard wrap
    const boardWrap = document.createElement("div");
    boardWrap.style.display = "none";

    const board = document.createElement("div");
    board.className = "leaderboard";

    const hasAnyHcp = model.players.some(p => Number.isFinite(Number(round.hcp?.[p])));

    const renderLeaderboard = () => {
      board.innerHTML = "";

      const rows = model.players
        .map(p => ({ p, ...computePlayerTotals(round, p, holes) }))
        .filter(x => x.filled > 0)
        .sort((a, b) => {
          const aScore = hasAnyHcp ? a.net : a.tot;
          const bScore = hasAnyHcp ? b.net : b.tot;
          if (aScore !== bScore) return aScore - bScore;
          return b.filled - a.filled;
        });

      if (!rows.length) {
        const empty = document.createElement("div");
        empty.className = "muted small";
        empty.textContent = "No scores yet. Enter scores to see standings.";
        board.append(empty);
        return;
      }

      rows.forEach((x, idx) => {
        const row = document.createElement("div");
        row.className = "leader-row";

        const left = document.createElement("div");
        left.className = "leader-left";
        left.innerHTML = `
          <div><b>${idx + 1}. ${x.p}</b></div>
          <div class="muted small">
            Thru ${x.filled}/${holes}
            ${holes === 18 ? ` • OUT ${x.out} • IN ${x.inn}` : ` • OUT ${x.out}`}
            ${hasAnyHcp ? ` • HCP ${x.hcp}` : ``}
          </div>
        `;

        const right = document.createElement("div");
        right.className = "leader-right";

        const gross = document.createElement("div");
        gross.className = "leader-mono";
        gross.textContent = `G ${x.tot}`;
        right.append(gross);

        if (hasAnyHcp) {
          const net = document.createElement("div");
          net.className = "leader-mono";
          net.textContent = `N ${x.net}`;
          right.append(net);
        }

        const vs = document.createElement("div");
        vs.className = `badge ${vsParClass(x.vs)}`;
        vs.textContent = formatVsPar(x.vs);
        right.append(vs);

        row.append(left, right);
        board.append(row);
      });
    };

    renderLeaderboard();
    boardWrap.append(board);

    // Snapshot refresh helper
    const refreshSnapshot = () => {
      const node = container.querySelector(`[data-snapshot="${round.id}"]`);
      if (node) node.innerHTML = renderSnapshotText(model, round, holes);
      renderLeaderboard();
    };

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
        refreshSnapshot();
      });
      tdHcp.append(hcpInput);
      tr.append(tdHcp);

      const outSpan = document.createElement("span");
      const inSpan = document.createElement("span");
      const totSpan = document.createElement("span");
      const vsSpan = document.createElement("span");

      function refreshRowTotals() {
        const { out, inn, tot, vs, filled } = computePlayerTotals(round, pName, holes);
        outSpan.textContent = String(out);
        if (holes === 18) inSpan.textContent = String(inn);
        totSpan.textContent = filled > 0 ? String(tot) : "—";
        vsSpan.textContent = formatVsPar(vs);
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
          refreshSnapshot();
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

    scoresWrap.append(tableWrap);

    // View switching
    const setView = (view) => {
      model.ui.roundViews[round.id] = view;
      saveModel(model);
      scoresWrap.style.display = view === "scores" ? "block" : "none";
      boardWrap.style.display = view === "leaderboard" ? "block" : "none";
      btnScores.classList.toggle("active", view === "scores");
      btnBoard.classList.toggle("active", view === "leaderboard");
    };

    btnScores.addEventListener("click", () => setView("scores"));
    btnBoard.addEventListener("click", () => setView("leaderboard"));

    // Final append
    body.append(lb, toggle, parTools, scoresWrap, boardWrap);
    wrap.append(head, body);
    container.append(wrap);

    setView(model.ui.roundViews[round.id]);
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
    model.ui.openRoundId = newRound.id;
    model.ui.roundViews[newRound.id] = "scores";
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
