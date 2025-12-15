// js/pairings.js
'use strict';

/**
 * Exports used by app.mjs:
 *  - renderPairingsFromModel(model)
 *  - getPairingsModelFromDOM()
 *  - createRoundCard(round, players)
 *  - getPlayersFromTextarea()
 */

// -----------------------------
// Utilities
// -----------------------------
function toNumber(v) {
  if (v === null || v === undefined) return 0;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : 0;
}

function clamp18(arr) {
  const a = Array.isArray(arr) ? arr.slice(0, 18) : [];
  while (a.length < 18) a.push('');
  return a;
}

function defaultPars() {
  // blank by default; you can set common default (4s) if you want
  return Array(18).fill('');
}

function defaultStrokeIndex() {
  // blank by default; can be filled later
  return Array(18).fill('');
}

export function getPlayersFromTextarea() {
  const playersArea = document.getElementById('playersInput');
  const raw = playersArea?.value || '';
  return raw
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

// -----------------------------
// Public: Render + Serialize
// -----------------------------
export function renderPairingsFromModel(model) {
  const playersArea = document.getElementById('playersInput');
  const roundsContainer = document.getElementById('roundsContainer');

  if (!playersArea || !roundsContainer) {
    console.warn('[GolfTripPlanner] playersInput or roundsContainer not found');
    return;
  }

  const players = Array.isArray(model?.players) ? model.players : [];
  playersArea.value = players.join('\n');

  roundsContainer.innerHTML = '';

  const rounds = Array.isArray(model?.rounds) ? model.rounds : [];

  // If no rounds saved yet, create a single empty round so UI isn't blank
  if (rounds.length === 0) {
    roundsContainer.appendChild(createRoundCard({}, getPlayersFromTextarea()));
    return;
  }

  rounds.forEach((r) => {
    roundsContainer.appendChild(createRoundCard(r, players));
  });
}

export function getPairingsModelFromDOM() {
  const players = getPlayersFromTextarea();
  const roundsContainer = document.getElementById('roundsContainer');
  const cards = Array.from(roundsContainer?.querySelectorAll('.round-card') || []);

  const rounds = cards.map((card) => {
    const round = {
      course: card.querySelector('.round-course')?.value?.trim() || '',
      date: card.querySelector('.round-date')?.value || '',
      // persisted hole meta
      pars: safeParseJSON(card.dataset.pars, defaultPars()),
      strokeIndex: safeParseJSON(card.dataset.strokeIndex, defaultStrokeIndex()),
      // groups
      groups: safeParseJSON(card.dataset.groups, []),
      // scores
      scores: []
    };

    const table = card.querySelector('table.score-table');
    if (!table) return round;

    // ensure latest Par/SI are persisted
    persistHoleMetaFromTableToCard(card, table);

    // each player row is tbody tr[data-player]
    const playerRows = Array.from(table.querySelectorAll('tbody tr[data-player]'));
    playerRows.forEach((tr) => {
      const player = tr.getAttribute('data-player') || '';
      const hdcp = toNumber(tr.querySelector('input.handicap-input')?.value);
      const holes = [];

      const holeCells = Array.from(tr.querySelectorAll('td[data-hole]'));
      holeCells.forEach((td) => {
        const inp = td.querySelector('input.score-input');
        holes.push(inp?.value ?? '');
      });

      round.scores.push({
        player,
        hdcp,
        holes: clamp18(holes)
      });
    });

    // refresh groups from players list if needed
    if (!Array.isArray(round.groups) || round.groups.length === 0) {
      round.groups = makeFoursomes(players);
    }

    // re-save groups to card dataset
    card.dataset.groups = JSON.stringify(round.groups);

    return round;
  });

  return { players, rounds };
}

// -----------------------------
// DOM Builders
// -----------------------------
export function createRoundCard(round = {}, players = []) {
  const card = document.createElement('div');
  card.className = 'round-card';

  // Persisted meta
  card.dataset.pars = JSON.stringify(
    Array.isArray(round?.pars) && round.pars.length === 18 ? round.pars : defaultPars()
  );
  card.dataset.strokeIndex = JSON.stringify(
    Array.isArray(round?.strokeIndex) && round.strokeIndex.length === 18 ? round.strokeIndex : defaultStrokeIndex()
  );

  const groups = Array.isArray(round?.groups) && round.groups.length ? round.groups : makeFoursomes(players);
  card.dataset.groups = JSON.stringify(groups);

  // Header
  const header = document.createElement('div');
  header.className = 'round-header';
  header.innerHTML = `
    <div style="display:flex; gap:.6rem; flex-wrap:wrap; align-items:center;">
      <input class="round-course" type="text" placeholder="Course (optional)" value="${escapeAttr(round?.course || '')}" style="max-width: 320px;">
      <input class="round-date" type="date" value="${escapeAttr(round?.date || '')}" style="max-width: 180px;">
    </div>
    <div style="display:flex; gap:.5rem; flex-wrap:wrap; align-items:center; margin-left:auto;">
      <button type="button" class="secondary small auto-foursomes">👥 Auto Foursomes</button>
      <button type="button" class="secondary small clear-scores">🧹 Clear Scores</button>
      <button type="button" class="secondary small remove-round">🗑️ Remove</button>
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

  const pars = getParsFromCard(card);
  const si = getStrokeIndexFromCard(card);

  table.appendChild(buildScoreTableHead());
  table.appendChild(buildScoreTableBody(round, players, pars, si));

  // ✅ ACTUALLY MOUNT TABLE (this was missing before)
  scroll.appendChild(table);
  card.appendChild(scroll);

  renderGroupsUI(card, groupsWrap);

  // Default view
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
    const currentPlayers = getPlayersFromTextarea();
    const newGroups = makeFoursomes(currentPlayers);
    card.dataset.groups = JSON.stringify(newGroups);
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

    // Persist Par/SI to dataset
    if (t.classList.contains('par-input') || t.classList.contains('si-input')) {
      persistHoleMetaFromTableToCard(card, table);
    }

    // recompute totals whenever scores or handicap changes
    if (
      t.classList.contains('score-input') ||
      t.classList.contains('handicap-input') ||
      t.classList.contains('par-input') ||
      t.classList.contains('si-input')
    ) {
      recomputeAllTotalsAndColors(table);
    }
  });

  // Initial totals on load
  recomputeAllTotalsAndColors(table);

  return card;
}

// -----------------------------
// Score table head/body
// -----------------------------
function buildScoreTableHead() {
  const thead = document.createElement('thead');

  // Row 1: group headers Front/Back/Totals
  const trGroup = document.createElement('tr');

  const thBlank1 = document.createElement('th');
  thBlank1.textContent = '';
  trGroup.appendChild(thBlank1);

  const thBlank2 = document.createElement('th');
  thBlank2.textContent = '';
  trGroup.appendChild(thBlank2);

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

  // Row 2: hole numbers + totals labels
  const tr = document.createElement('tr');

  const thPlayer = document.createElement('th');
  thPlayer.textContent = 'Player';
  tr.appendChild(thPlayer);

  const thHdcp = document.createElement('th');
  thHdcp.textContent = 'Hdcp';
  tr.appendChild(thHdcp);

  for (let i = 1; i <= 18; i += 1) {
    const th = document.createElement('th');
    th.textContent = String(i);
    th.dataset.hole = String(i);
    th.classList.add(i <= 9 ? 'hole-front' : 'hole-back'); // ✅ shading hook
    tr.appendChild(th);
  }

  ['Out', 'In', 'Gross', 'Net'].forEach((label) => {
    const th = document.createElement('th');
    th.textContent = label;
    th.className = 'tot-col';
    tr.appendChild(th);
  });

  thead.appendChild(tr);
  return thead;
}

function buildScoreTableBody(round, players, pars = [], strokeIndex = []) {
  const tbody = document.createElement('tbody');

  const scores = Array.isArray(round?.scores) ? round.scores : [];
  const byPlayer = new Map(scores.map((s) => [s?.player, s]));

  const safePars = Array.isArray(pars) ? pars : [];
  const safeSI = Array.isArray(strokeIndex) ? strokeIndex : [];

  tbody.appendChild(buildMetaRow('Par', safePars, 'par-input'));
  tbody.appendChild(buildMetaRow('SI', safeSI, 'si-input'));

  players.forEach((p) => {
    const s = byPlayer.get(p) || { player: p, hdcp: 0, holes: Array(18).fill('') };

    const tr = document.createElement('tr');
    tr.setAttribute('data-player', p);

    // Player
    const tdPlayer = document.createElement('td');
    tdPlayer.textContent = p;
    tr.appendChild(tdPlayer);

    // Handicap
    const tdHdcp = document.createElement('td');
    const hdcp = document.createElement('input');
    hdcp.type = 'number';
    hdcp.inputMode = 'numeric';
    hdcp.className = 'handicap-input';
    hdcp.value = String(toNumber(s.hdcp ?? 0));
    tdHdcp.appendChild(hdcp);
    tr.appendChild(tdHdcp);

    // Holes
    const holes = Array.isArray(s.holes) ? s.holes : [];
    for (let i = 0; i < 18; i += 1) {
      const td = document.createElement('td');
      td.dataset.hole = String(i + 1);
      td.classList.add((i + 1) <= 9 ? 'hole-front' : 'hole-back'); // ✅ shading hook

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
    tdOut.className = 'tot-col tot-out';
    tr.appendChild(tdOut);

    const tdIn = document.createElement('td');
    tdIn.className = 'tot-col tot-in';
    tr.appendChild(tdIn);

    const tdGross = document.createElement('td');
    tdGross.className = 'tot-col tot-gross';
    tr.appendChild(tdGross);

    const tdNet = document.createElement('td');
    tdNet.className = 'tot-col tot-net';
    tr.appendChild(tdNet);

    tbody.appendChild(tr);
  });

  return tbody;
}

// Par/SI row builder
function buildMetaRow(label, values, inputClass) {
  const tr = document.createElement('tr');
  tr.className = 'meta-row';
  tr.dataset.meta = String(label || '').toLowerCase();

  // label cell (shows Par / SI)
  const tdLabel = document.createElement('td');
  tdLabel.className = 'meta-label';
  tdLabel.textContent = label;
  tr.appendChild(tdLabel);

  // blank Hdcp column cell for meta rows
  const tdBlank = document.createElement('td');
  tdBlank.textContent = '';
  tr.appendChild(tdBlank);

  const arr = clamp18(values);
  for (let i = 1; i <= 18; i += 1) {
    const td = document.createElement('td');
    td.dataset.hole = String(i);
    td.classList.add(i <= 9 ? 'hole-front' : 'hole-back'); // ✅ shading hook

    const inp = document.createElement('input');
    inp.type = 'number';
    inp.inputMode = 'numeric';
    inp.className = inputClass;
    inp.value = String(arr[i - 1] ?? '');

    td.appendChild(inp);
    tr.appendChild(td);
  }

  // Totals columns (empty)
  for (let k = 0; k < 4; k += 1) {
    tr.appendChild(document.createElement('td'));
  }

  return tr;
}

// -----------------------------
// Front/Back view toggling
// -----------------------------
function setToggleActive(toggleEl, view) {
  toggleEl.querySelectorAll('button[data-view]').forEach((b) => {
    b.classList.toggle('is-active', b.getAttribute('data-view') === view);
  });
}

function setHolesView(card, view) {
  const table = card.querySelector('table.score-table');
  if (!table) return;

  const showFront = view === 'front';
  const showBack = view === 'back';
  const showAll = view === 'all';

  const holeHeaders = Array.from(table.querySelectorAll('th[data-hole]'));
  const holeCells = Array.from(table.querySelectorAll('td[data-hole]'));

  function shouldShow(holeNum) {
    if (showAll) return true;
    if (showFront) return holeNum >= 1 && holeNum <= 9;
    if (showBack) return holeNum >= 10 && holeNum <= 18;
    return true;
  }

  holeHeaders.forEach((th) => {
    const n = toNumber(th.dataset.hole);
    th.style.display = shouldShow(n) ? '' : 'none';
  });

  holeCells.forEach((td) => {
    const n = toNumber(td.dataset.hole);
    td.style.display = shouldShow(n) ? '' : 'none';
  });

  // Group header row: hide front/back groups when not relevant
  const groupRow = table.querySelector('thead tr:first-child');
  if (groupRow) {
    const thFront = groupRow.querySelector('.front-nine');
    const thBack = groupRow.querySelector('.back-nine');

    if (thFront) thFront.style.display = (showBack && !showAll) ? 'none' : '';
    if (thBack) thBack.style.display = (showFront && !showAll) ? 'none' : '';
  }
}

// -----------------------------
// Totals auto-calc
// -----------------------------
function recomputeAllTotalsAndColors(table) {
  if (!table) return;

  const bodyRows = Array.from(table.querySelectorAll('tbody tr[data-player]'));

  bodyRows.forEach((tr) => {
    const holeInputs = Array.from(tr.querySelectorAll('td[data-hole] input.score-input'));
    const vals = holeInputs.map((inp) => toNumber(inp.value));

    const out = vals.slice(0, 9).reduce((a, b) => a + b, 0);
    const inn = vals.slice(9, 18).reduce((a, b) => a + b, 0);
    const gross = out + inn;

    const hdcp = toNumber(tr.querySelector('input.handicap-input')?.value);
    const net = gross - hdcp;

    const tdOut = tr.querySelector('.tot-out');
    const tdIn = tr.querySelector('.tot-in');
    const tdGross = tr.querySelector('.tot-gross');
    const tdNet = tr.querySelector('.tot-net');

    if (tdOut) tdOut.textContent = out ? String(out) : '';
    if (tdIn) tdIn.textContent = inn ? String(inn) : '';
    if (tdGross) tdGross.textContent = gross ? String(gross) : '';
    if (tdNet) tdNet.textContent = gross ? String(net) : '';
  });
}

// -----------------------------
// Persist Par/SI to dataset
// -----------------------------
function persistHoleMetaFromTableToCard(card, table) {
  const parRow = table.querySelector('tbody tr[data-meta="par"]');
  const siRow = table.querySelector('tbody tr[data-meta="si"]');

  const pars = [];
  const si = [];

  if (parRow) {
    const cells = Array.from(parRow.querySelectorAll('td[data-hole] input'));
    cells.forEach((inp) => pars.push(inp.value ?? ''));
  }
  if (siRow) {
    const cells = Array.from(siRow.querySelectorAll('td[data-hole] input'));
    cells.forEach((inp) => si.push(inp.value ?? ''));
  }

  card.dataset.pars = JSON.stringify(clamp18(pars));
  card.dataset.strokeIndex = JSON.stringify(clamp18(si));
}

function getParsFromCard(card) {
  return safeParseJSON(card?.dataset?.pars, defaultPars());
}

function getStrokeIndexFromCard(card) {
  return safeParseJSON(card?.dataset?.strokeIndex, defaultStrokeIndex());
}

function safeParseJSON(str, fallback) {
  try {
    if (!str || !String(str).trim()) return fallback;
    const v = JSON.parse(str);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

// -----------------------------
// Groups (foursomes) UI
// -----------------------------
function makeFoursomes(players) {
  const list = Array.isArray(players) ? players.slice() : [];
  const groups = [];
  for (let i = 0; i < list.length; i += 4) {
    groups.push(list.slice(i, i + 4));
  }
  return groups;
}

function renderGroupsUI(card, wrap) {
  const groups = safeParseJSON(card?.dataset?.groups, []);
  if (!wrap) return;

  if (!Array.isArray(groups) || groups.length === 0) {
    wrap.textContent = '';
    return;
  }

  const parts = groups.map((g, idx) => `Group ${idx + 1}: ${Array.isArray(g) ? g.join(', ') : ''}`);
  wrap.textContent = parts.join('  •  ');
}

// -----------------------------
// Helpers
// -----------------------------
function escapeAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
