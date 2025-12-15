// js/pairings.js
'use strict';

/**
 * Players textarea -> array of player names
 */
export function getPlayersFromTextarea() {
  const ta = document.getElementById('playersInput');
  if (!ta) return [];
  return ta.value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Render Pairings tab from model
 */
export function renderPairingsFromModel(model) {
  const playersArea = document.getElementById('playersInput');
  const roundsContainer = document.getElementById('roundsContainer');

  if (!playersArea || !roundsContainer) {
    console.warn('[GolfTripPlanner] playersInput or roundsContainer not found');
    return;
  }

  const incoming = model && typeof model === 'object' ? model : {};
  incoming.rounds = Array.isArray(incoming.rounds) ? incoming.rounds : [];
  incoming.players = Array.isArray(incoming.players) ? incoming.players : [];

  // Textarea is source-of-truth if it has content.
  // If textarea empty but model has players, populate textarea.
  const textareaPlayers = getPlayersFromTextarea();
  let playersList = textareaPlayers;

  if (playersList.length === 0 && incoming.players.length > 0) {
    playersArea.value = incoming.players.join('\n');
    playersList = incoming.players.slice();
  }

  // If players exist but no rounds, create one empty round so the scorecard appears
  if (playersList.length > 0 && incoming.rounds.length === 0) {
    incoming.rounds = [createEmptyRound(playersList)];
  }

  roundsContainer.innerHTML = '';
  incoming.rounds.forEach((r) => {
    const normalized = normalizeRound(r, playersList);
    const card = createRoundCard(normalized, playersList);
    roundsContainer.appendChild(card);
  });
}

/**
 * Build a round card DOM from round model + players
 */
export function createRoundCard(round = {}, playersList = []) {
  const r = round && typeof round === 'object' ? round : {};
  const players = Array.isArray(playersList) ? playersList : [];

  const card = document.createElement('div');
  card.className = 'round-card';

  // Persist groups + hole meta in dataset for serialization
  card.dataset.groups = JSON.stringify(Array.isArray(r.groups) ? r.groups : []);
  card.dataset.pars = JSON.stringify(Array.isArray(r.pars) ? r.pars : defaultPars());
  card.dataset.strokeIndex = JSON.stringify(Array.isArray(r.strokeIndex) ? r.strokeIndex : defaultStrokeIndex());

  // Header
  const header = document.createElement('div');
  header.className = 'round-header';
  header.innerHTML = `
    <div style="flex:1; min-width:220px;">
      <label style="display:block; font-size:.8rem; color: var(--muted); font-weight:700; margin-bottom:.35rem;">Course</label>
      <input class="round-course" type="text" placeholder="Course name" value="${escapeAttr(r.course || '')}">
    </div>

    <div style="width:180px; min-width:160px;">
      <label style="display:block; font-size:.8rem; color: var(--muted); font-weight:700; margin-bottom:.35rem;">Date</label>
      <input class="round-date" type="date" value="${escapeAttr(r.date || '')}">
    </div>

    <div style="display:flex; gap:.5rem; align-items:flex-end; flex-wrap:wrap;">
      <button type="button" class="secondary small auto-foursomes">👥 Auto Foursomes</button>
      <button type="button" class="secondary small clear-scores">↺ Clear Scores</button>
      <button type="button" class="small remove-round" style="background:#ef4444;">Remove</button>
    </div>
  `;
  card.appendChild(header);

  // Groups display
  const groupsWrap = document.createElement('div');
  groupsWrap.className = 'round-groups';
  groupsWrap.style.margin = '6px 0 10px';
  groupsWrap.style.fontSize = '.85rem';
  groupsWrap.style.color = 'rgba(51,65,85,.95)';
  card.appendChild(groupsWrap);

  // Front/Back toggle UI
  const toggle = document.createElement('div');
  toggle.className = 'holes-toggle';
  toggle.innerHTML = `
    <button type="button" data-view="front">Front 9</button>
    <button type="button" data-view="back">Back 9</button>
    <button type="button" data-view="all" class="is-active">All</button>
  `;
  card.appendChild(toggle);

  // Table
  const scroll = document.createElement('div');
  scroll.className = 'table-scroll';

  const table = document.createElement('table');
  table.className = 'score-table';

  table.appendChild(buildScoreTableHead(getParsFromCard(card), getStrokeIndexFromCard(card)));
  table.appendChild(buildScoreTableBody(r, players));

  scroll.appendChild(table);
  card.appendChild(scroll);

  renderGroupsUI(card, groupsWrap);

  // Default view: All (as requested)
  setHolesView(card, 'all');
  setToggleActive(toggle, 'all');

  // Toggle wiring
  toggle.addEventListener('click', (e) => {
    const btn = e.target?.closest?.('button[data-view]');
    if (!btn) return;
    const view = btn.getAttribute('data-view') || 'all';
    setHolesView(card, view);
    setToggleActive(toggle, view);
  });

  // Wire actions
  header.querySelector('.remove-round')?.addEventListener('click', () => card.remove());

  header.querySelector('.auto-foursomes')?.addEventListener('click', () => {
    const groups = makeFoursomes(players);
    card.dataset.groups = JSON.stringify(groups);
    renderGroupsUI(card, groupsWrap);
  });

  header.querySelector('.clear-scores')?.addEventListener('click', () => {
    table.querySelectorAll('input.score-input').forEach((inp) => (inp.value = ''));
    recomputeAllTotalsAndColors(table);
  });

  // Handle input changes (scores, hdcp, par, stroke index)
  table.addEventListener('input', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return;

    // Par / SI changes should recolor all rows
    if (t.classList.contains('par-input') || t.classList.contains('si-input')) {
      // Persist to card dataset so it saves
      persistHoleMetaFromTableToCard(card, table);
      recomputeAllTotalsAndColors(table);
      return;
    }

    if (t.classList.contains('score-input') || t.classList.contains('handicap-input')) {
      const tr = t.closest('tr');
      if (tr) recomputeRowTotalsAndColors(tr, table);
    }
  });

  // Compute totals + colors initially
  recomputeAllTotalsAndColors(table);

  return card;
}

/**
 * DOM -> Model
 */
export function getPairingsModelFromDOM() {
  const players = getPlayersFromTextarea();
  const roundsContainer = document.getElementById('roundsContainer');

  const rounds = [];
  const cards = Array.from(roundsContainer?.querySelectorAll('.round-card') || []);

  cards.forEach((card) => {
    const course = card.querySelector('.round-course')?.value?.trim?.() || '';
    const date = card.querySelector('.round-date')?.value || '';

    let groups = [];
    try {
      groups = JSON.parse(card.dataset.groups || '[]');
      if (!Array.isArray(groups)) groups = [];
    } catch {
      groups = [];
    }

    let pars = defaultPars();
    try {
      const p = JSON.parse(card.dataset.pars || '[]');
      if (Array.isArray(p) && p.length === 18) pars = p;
    } catch {}

    let strokeIndex = defaultStrokeIndex();
    try {
      const si = JSON.parse(card.dataset.strokeIndex || '[]');
      if (Array.isArray(si) && si.length === 18) strokeIndex = si;
    } catch {}

    const table = card.querySelector('table.score-table');
    const scoreRows = [];

    if (table) {
      const trs = Array.from(table.querySelectorAll('tbody tr'));
      trs.forEach((tr) => {
        const player = tr.getAttribute('data-player') || '';
        const hdcpVal = tr.querySelector('input.handicap-input')?.value ?? '0';
        const hdcp = toNumber(hdcpVal);

        const holes = [];
        const holeInputs = Array.from(tr.querySelectorAll('input.score-input'));
        holeInputs.forEach((inp) => holes.push(inp.value ?? ''));

        const fixedHoles = Array.from({ length: 18 }, (_, i) => holes[i] ?? '');
        scoreRows.push({ player, hdcp, holes: fixedHoles });
      });
    }

    const normalized = normalizeRound(
      { course, date, groups, pars, strokeIndex, scores: scoreRows },
      players
    );
    rounds.push(normalized);
  });

  return { players, rounds };
}

/* ---------------------------
   Helpers
--------------------------- */

function setToggleActive(toggleEl, view) {
  toggleEl.querySelectorAll('button').forEach((b) => b.classList.remove('is-active'));
  toggleEl.querySelector(`button[data-view="${view}"]`)?.classList.add('is-active');
}

/**
 * Collapse/label the group header based on view without breaking table layout.
 * (We keep cells, but dim and adjust text so it looks intentional.)
 */
function updateGroupHeaderLabels(card, view) {
  const thFront = card.querySelector('th.front-nine');
  const thBack = card.querySelector('th.back-nine');

  if (!thFront || !thBack) return;

  if (view === 'front') {
    thFront.style.opacity = '1';
    thFront.textContent = 'Front 9';
    thBack.style.opacity = '.25';
    thBack.textContent = 'Back 9';
  } else if (view === 'back') {
    thFront.style.opacity = '.25';
    thFront.textContent = 'Front 9';
    thBack.style.opacity = '1';
    thBack.textContent = 'Back 9';
  } else {
    thFront.style.opacity = '1';
    thFront.textContent = 'Front 9';
    thBack.style.opacity = '1';
    thBack.textContent = 'Back 9';
  }
}

function setHolesView(card, view) {
  updateGroupHeaderLabels(card, view);

  const showAll = view === 'all';
  const showFront = view === 'front';
  const showBack = view === 'back';

  card.querySelectorAll('[data-hole]').forEach((el) => {
    const h = Number(el.getAttribute('data-hole'));
    const isFront = h >= 1 && h <= 9;
    const isBack = h >= 10 && h <= 18;

    el.style.display =
      showAll ? '' :
      showFront ? (isFront ? '' : 'none') :
      showBack ? (isBack ? '' : 'none') :
      '';
  });
}

function createEmptyRound(players) {
  return {
    course: '',
    date: '',
    groups: [],
    pars: defaultPars(),
    strokeIndex: defaultStrokeIndex(),
    scores: players.map((p) => ({
      player: p,
      hdcp: 0,
      holes: Array(18).fill(''),
    })),
  };
}

function normalizeRound(round, players) {
  const r = round && typeof round === 'object' ? round : {};
  const scores = Array.isArray(r.scores) ? r.scores : [];
  const byPlayer = new Map(scores.map((s) => [s?.player, s]));

  const pars = Array.isArray(r.pars) && r.pars.length === 18 ? r.pars : defaultPars();
  const strokeIndex = Array.isArray(r.strokeIndex) && r.strokeIndex.length === 18 ? r.strokeIndex : defaultStrokeIndex();

  const nextScores = players.map((p) => {
    const prev = byPlayer.get(p);
    if (prev) {
      const holes = Array.isArray(prev.holes) ? prev.holes : [];
      return {
        player: p,
        hdcp: toNumber(prev.hdcp ?? 0),
        holes: Array.from({ length: 18 }, (_, i) => holes[i] ?? ''),
      };
    }
    return { player: p, hdcp: 0, holes: Array(18).fill('') };
  });

  return {
    course: r.course || '',
    date: r.date || '',
    groups: Array.isArray(r.groups) ? r.groups : [],
    pars,
    strokeIndex,
    scores: nextScores,
  };
}

/**
 * Header:
 * Row 1: Player/Hdcp (rowspan 4), Front9/Back9/Totals group labels
 * Row 2: Hole numbers + totals labels
 * Row 3: Par inputs
 * Row 4: SI inputs (stroke index)
 */
function buildScoreTableHead(pars, strokeIndex) {
  const thead = document.createElement('thead');

  // --- Row 1: group labels (leave 2 empty cells for Player/Hdcp area)
  const trGroup = document.createElement('tr');

  const thBlank1 = document.createElement('th');
  thBlank1.colSpan = 2;
  thBlank1.className = 'sticky-left-head';
  thBlank1.textContent = '';
  trGroup.appendChild(thBlank1);

  const thFront = document.createElement('th');
  thFront.colSpan = 9;
  thFront.textContent = 'Front 9';
  thFront.className = 'nine-group front-nine';
  trGroup.appendChild(thFront);

  const thBack = document.createElement('th');
  thBack.colSpan = 9;
  thBack.textContent = 'Back 9';
  thBack.className = 'nine-group back-nine';
  trGroup.appendChild(thBack);

  const thTotals = document.createElement('th');
  thTotals.colSpan = 4;
  thTotals.textContent = 'Totals';
  thTotals.className = 'nine-group totals-group';
  trGroup.appendChild(thTotals);

  thead.appendChild(trGroup);

  // --- Row 2: column headers (Player/Hdcp + holes + totals)
  const trHoles = document.createElement('tr');

  const thPlayer = document.createElement('th');
  thPlayer.textContent = 'Player';
  trHoles.appendChild(thPlayer);

  const thHdcp = document.createElement('th');
  thHdcp.textContent = 'Hdcp';
  trHoles.appendChild(thHdcp);

  for (let i = 1; i <= 18; i += 1) {
    const th = document.createElement('th');
    th.textContent = String(i);
    th.dataset.hole = String(i);
    trHoles.appendChild(th);
  }

  ['Out', 'In', 'Gross', 'Net'].forEach((label) => {
    const th = document.createElement('th');
    th.textContent = label;
    th.className = 'tot-col';
    trHoles.appendChild(th);
  });

  thead.appendChild(trHoles);

  // --- Row 3: Par row (label at left + par inputs)
  const trPar = document.createElement('tr');
  trPar.className = 'par-row';

  const thParLabel = document.createElement('th');
  thParLabel.colSpan = 2;
  thParLabel.className = 'meta-label sticky-left-meta';
  thParLabel.textContent = 'Par';
  trPar.appendChild(thParLabel);

  for (let i = 1; i <= 18; i += 1) {
    const th = document.createElement('th');
    th.dataset.hole = String(i);

    const inp = document.createElement('input');
    inp.type = 'number';
    inp.inputMode = 'numeric';
    inp.className = 'par-input';
    inp.value = String(toNumber(pars[i - 1] ?? 0) || '');
    inp.title = `Par for hole ${i}`;
    th.appendChild(inp);

    trPar.appendChild(th);
  }

  for (let j = 0; j < 4; j += 1) {
    const th = document.createElement('th');
    th.className = 'tot-col';
    trPar.appendChild(th);
  }

  thead.appendChild(trPar);

  // --- Row 4: Stroke Index row (label at left + SI inputs)
  const trSi = document.createElement('tr');
  trSi.className = 'si-row';

  const thSiLabel = document.createElement('th');
  thSiLabel.colSpan = 2;
  thSiLabel.className = 'meta-label sticky-left-meta';
  thSiLabel.textContent = 'SI';
  trSi.appendChild(thSiLabel);

  for (let i = 1; i <= 18; i += 1) {
    const th = document.createElement('th');
    th.dataset.hole = String(i);

    const inp = document.createElement('input');
    inp.type = 'number';
    inp.inputMode = 'numeric';
    inp.className = 'si-input';
    inp.value = String(toNumber(strokeIndex[i - 1] ?? 0) || '');
    inp.title = `Stroke index for hole ${i}`;
    th.appendChild(inp);

    trSi.appendChild(th);
  }

  for (let j = 0; j < 4; j += 1) {
    const th = document.createElement('th');
    th.className = 'tot-col';
    trSi.appendChild(th);
  }

  thead.appendChild(trSi);

  return thead;
}

function buildScoreTableBody(round, players) {
  const tbody = document.createElement('tbody');
  const scores = Array.isArray(round?.scores) ? round.scores : [];
  const byPlayer = new Map(scores.map((s) => [s?.player, s]));

  players.forEach((p) => {
    const s = byPlayer.get(p) || { player: p, hdcp: 0, holes: Array(18).fill('') };

    const tr = document.createElement('tr');
    tr.setAttribute('data-player', p);

    // Player cell
    const tdPlayer = document.createElement('td');
    tdPlayer.textContent = p;
    tr.appendChild(tdPlayer);

    // Handicap input
    const tdHdcp = document.createElement('td');
    const hdcp = document.createElement('input');
    hdcp.type = 'number';
    hdcp.inputMode = 'numeric';
    hdcp.className = 'handicap-input';
    hdcp.value = String(toNumber(s.hdcp ?? 0));
    hdcp.style.width = '54px';
    hdcp.style.textAlign = 'center';
    tdHdcp.appendChild(hdcp);
    tr.appendChild(tdHdcp);

    // 18 holes
    const holes = Array.isArray(s.holes) ? s.holes : [];
    for (let i = 0; i < 18; i += 1) {
      const td = document.createElement('td');
      td.dataset.hole = String(i + 1);

      const inp = document.createElement('input');
      inp.type = 'text';
      inp.inputMode = 'numeric';
      inp.className = 'score-input';
      inp.value = holes[i] ?? '';

      td.appendChild(inp);
      tr.appendChild(td);
    }

    // Totals cells
    const tdOut = document.createElement('td');
    tdOut.className = 'tot-out';
    tr.appendChild(tdOut);

    const tdIn = document.createElement('td');
    tdIn.className = 'tot-in';
    tr.appendChild(tdIn);

    const tdGross = document.createElement('td');
    tdGross.className = 'tot-gross';
    tr.appendChild(tdGross);

    const tdNet = document.createElement('td');
    tdNet.className = 'tot-net';
    tr.appendChild(tdNet);

    tbody.appendChild(tr);
  });

  return tbody;
}

function makeFoursomes(players) {
  const list = players.slice();
  const groups = [];
  for (let i = 0; i < list.length; i += 4) {
    groups.push(list.slice(i, i + 4));
  }
  return groups;
}

function renderGroupsUI(card, wrapEl) {
  let groups = [];
  try {
    groups = JSON.parse(card.dataset.groups || '[]');
    if (!Array.isArray(groups)) groups = [];
  } catch {
    groups = [];
  }

  if (!wrapEl) return;

  if (!groups.length) {
    wrapEl.innerHTML = `<div style="color: rgba(100,116,139,.95);">No groups yet. Click <strong>Auto Foursomes</strong>.</div>`;
    return;
  }

  const html = groups
    .map((g, idx) => {
      const names = Array.isArray(g) ? g.join(', ') : '';
      return `<div><strong>Group ${idx + 1}:</strong> ${escapeHtml(names)}</div>`;
    })
    .join('');

  wrapEl.innerHTML = html;
}

/* ---- Totals + Birdie/Bogey coloring ---- */

function recomputeAllTotalsAndColors(table) {
  const trs = Array.from(table.querySelectorAll('tbody tr'));
  trs.forEach((tr) => recomputeRowTotalsAndColors(tr, table));
}

function recomputeRowTotalsAndColors(tr, table) {
  const pars = getParsFromTable(table);

  const holeTds = Array.from(tr.querySelectorAll('td[data-hole]'));
  const holeInputs = Array.from(tr.querySelectorAll('input.score-input'));
  const vals = holeInputs.map((inp) => toNumber(inp.value));

  const out = sum(vals.slice(0, 9));
  const inn = sum(vals.slice(9, 18));
  const gross = out + inn;

  const hdcp = toNumber(tr.querySelector('input.handicap-input')?.value ?? 0);
  const net = gross - hdcp;

  tr.querySelector('.tot-out') && (tr.querySelector('.tot-out').textContent = out ? String(out) : '');
  tr.querySelector('.tot-in') && (tr.querySelector('.tot-in').textContent = inn ? String(inn) : '');
  tr.querySelector('.tot-gross') && (tr.querySelector('.tot-gross').textContent = gross ? String(gross) : '');
  tr.querySelector('.tot-net') && (tr.querySelector('.tot-net').textContent = gross ? String(net) : '');

  // Color each hole cell based on par if par exists
  for (let i = 0; i < 18; i += 1) {
    const td = holeTds[i];
    if (!td) continue;

    // Clear prior classes
    td.classList.remove('score-eagle', 'score-birdie', 'score-par', 'score-bogey', 'score-double');

    const score = vals[i];
    const par = toNumber(pars[i]);

    if (!par || !score) continue; // don't color if missing par or score

    const diff = score - par;
    if (diff <= -2) td.classList.add('score-eagle');
    else if (diff === -1) td.classList.add('score-birdie');
    else if (diff === 0) td.classList.add('score-par');
    else if (diff === 1) td.classList.add('score-bogey');
    else if (diff >= 2) td.classList.add('score-double');
  }
}

/* ---- Hole meta persistence ---- */

function persistHoleMetaFromTableToCard(card, table) {
  const pars = getParsFromTable(table);
  const si = getStrokeIndexFromTable(table);
  card.dataset.pars = JSON.stringify(pars);
  card.dataset.strokeIndex = JSON.stringify(si);
}

function getParsFromCard(card) {
  try {
    const p = JSON.parse(card.dataset.pars || '[]');
    if (Array.isArray(p) && p.length === 18) return p;
  } catch {}
  return defaultPars();
}

function getStrokeIndexFromCard(card) {
  try {
    const si = JSON.parse(card.dataset.strokeIndex || '[]');
    if (Array.isArray(si) && si.length === 18) return si;
  } catch {}
  return defaultStrokeIndex();
}

function getParsFromTable(table) {
  const inputs = Array.from(table.querySelectorAll('thead input.par-input'));
  if (inputs.length !== 18) return defaultPars();
  return inputs.map((i) => toNumber(i.value));
}

function getStrokeIndexFromTable(table) {
  const inputs = Array.from(table.querySelectorAll('thead input.si-input'));
  if (inputs.length !== 18) return defaultStrokeIndex();
  return inputs.map((i) => toNumber(i.value));
}

function defaultPars() {
  // Neutral defaults; user can edit. (Leaving 0 means no coloring until filled.)
  return Array(18).fill(0);
}

function defaultStrokeIndex() {
  // Neutral defaults; user can edit.
  return Array(18).fill(0);
}

/* ---- Utilities ---- */

function sum(arr) {
  return arr.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
}

function toNumber(v) {
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) ? n : 0;
}

/* Escaping helpers */
function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
function escapeAttr(str) {
  return escapeHtml(str).replaceAll('\n', ' ');
}
