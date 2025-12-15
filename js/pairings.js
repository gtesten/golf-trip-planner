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
 * Model shape:
 * {
 *   players: [ "Glenn", "Ryan", ... ],
 *   rounds: [
 *     {
 *       course: "",
 *       date: "",
 *       groups: [ ["A","B","C","D"], ... ],
 *       scores: [
 *         { player:"Glenn", hdcp:0, holes:["",...18] }
 *       ]
 *     }
 *   ]
 * }
 */
export function renderPairingsFromModel(model) {
  const playersArea = document.getElementById('playersInput');
  const roundsContainer = document.getElementById('roundsContainer');

  if (!playersArea || !roundsContainer) {
    console.warn('[GolfTripPlanner] playersInput or roundsContainer not found');
    return;
  }

  // Normalize model
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

  // If players exist but no rounds, create one empty round so the scorecard appears immediately
  if (playersList.length > 0 && incoming.rounds.length === 0) {
    incoming.rounds = [createEmptyRound(playersList)];
  }

  // Clear + rebuild rounds
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

  // Persist groups in dataset for serialization
  card.dataset.groups = JSON.stringify(Array.isArray(r.groups) ? r.groups : []);

  // Header area
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
    <button type="button" data-view="front" class="is-active">Front 9</button>
    <button type="button" data-view="back">Back 9</button>
    <button type="button" data-view="all">All</button>
  `;
  card.appendChild(toggle);

  // Scores table wrapper
  const scroll = document.createElement('div');
  scroll.className = 'table-scroll';

  const table = document.createElement('table');
  table.className = 'score-table';

  table.appendChild(buildScoreTableHead());
  table.appendChild(buildScoreTableBody(r, players));

  scroll.appendChild(table);
  card.appendChild(scroll);

  // Initial groups render
  renderGroupsUI(card, groupsWrap);

  // Default view: Front 9
  setHolesView(card, 'front');

  // Toggle wiring
  toggle.addEventListener('click', (e) => {
    const btn = e.target?.closest?.('button[data-view]');
    if (!btn) return;

    toggle.querySelectorAll('button').forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');

    const view = btn.getAttribute('data-view') || 'front';
    setHolesView(card, view);
  });

  // Wire actions
  header.querySelector('.remove-round')?.addEventListener('click', () => {
    card.remove();
  });

  header.querySelector('.auto-foursomes')?.addEventListener('click', () => {
    const groups = makeFoursomes(players);
    card.dataset.groups = JSON.stringify(groups);
    renderGroupsUI(card, groupsWrap);
  });

  header.querySelector('.clear-scores')?.addEventListener('click', () => {
    table.querySelectorAll('input.score-input').forEach((inp) => (inp.value = ''));
    recomputeAllTotals(table);
  });

  // Recompute totals on any score input change
  table.addEventListener('input', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return;
    if (t.classList.contains('score-input') || t.classList.contains('handicap-input')) {
      const tr = t.closest('tr');
      if (tr) recomputeRowTotals(tr);
    }
  });

  // Compute totals at start
  recomputeAllTotals(table);

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

        // Ensure exactly 18
        const fixedHoles = Array.from({ length: 18 }, (_, i) => holes[i] ?? '');
        scoreRows.push({ player, hdcp, holes: fixedHoles });
      });
    }

    // Normalize: make sure every player has a score row
    const normalized = normalizeRound({ course, date, groups, scores: scoreRows }, players);
    rounds.push(normalized);
  });

  return { players, rounds };
}

/* ---------------------------
   Helpers
--------------------------- */

function setHolesView(card, view) {
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
    scores: nextScores,
  };
}

function buildScoreTableHead() {
  const thead = document.createElement('thead');
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
    th.dataset.hole = String(i); // for Front/Back toggle
    tr.appendChild(th);
  }

  // Totals
  ['Out', 'In', 'Gross', 'Net'].forEach((label) => {
    const th = document.createElement('th');
    th.textContent = label;
    tr.appendChild(th);
  });

  thead.appendChild(tr);
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
      td.dataset.hole = String(i + 1); // for Front/Back toggle

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

/* Totals */
function recomputeAllTotals(table) {
  const trs = Array.from(table.querySelectorAll('tbody tr'));
  trs.forEach(recomputeRowTotals);
}

function recomputeRowTotals(tr) {
  const holeInputs = Array.from(tr.querySelectorAll('input.score-input'));
  const vals = holeInputs.map((inp) => toNumber(inp.value));

  const out = sum(vals.slice(0, 9));
  const inn = sum(vals.slice(9, 18));
  const gross = out + inn;

  const hdcp = toNumber(tr.querySelector('input.handicap-input')?.value ?? 0);
  const net = gross - hdcp;

  const outCell = tr.querySelector('.tot-out');
  const inCell = tr.querySelector('.tot-in');
  const grossCell = tr.querySelector('.tot-gross');
  const netCell = tr.querySelector('.tot-net');

  if (outCell) outCell.textContent = out ? String(out) : '';
  if (inCell) inCell.textContent = inn ? String(inn) : '';
  if (grossCell) grossCell.textContent = gross ? String(gross) : '';
  if (netCell) netCell.textContent = gross ? String(net) : '';
}

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
