// js/pairings.js
// Pairings & Scores: players + rounds + editable 18-hole scoring
// Includes: Front 9 / Back 9 / Gross / Handicap / Net
'use strict';

/**
 * Reads the Players textarea (id="playersInput") as one name per line.
 */
export function getPlayersFromTextarea() {
  const area = document.getElementById('playersInput');
  if (!area) return [];
  return area.value
    .split('\n')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Renders entire Pairings tab from model.
 * Accepts either:
 *  - { rounds: [...] }
 *  - { players: [...], rounds: [...] } (older model)
 */
export function renderPairingsFromModel(model) {
  const playersArea = document.getElementById('playersInput');
  const roundsContainer = document.getElementById('roundsContainer');

  if (!playersArea || !roundsContainer) {
    console.warn('[GolfTripPlanner] playersInput or roundsContainer not found');
    return;
  }

  const players =
    Array.isArray(model?.players) ? model.players : Array.isArray(model?.rounds?.[0]?.players)
      ? model.rounds[0].players.map((p) => p.name).filter(Boolean)
      : [];

  const rounds = Array.isArray(model?.rounds) ? model.rounds : [];

  playersArea.value = players.join('\n');
  roundsContainer.innerHTML = '';

  const defaultPlayers = players.length ? players : getPlayersFromTextarea();

  if (!rounds.length) {
    roundsContainer.appendChild(createRoundCard({}, defaultPlayers));
    return;
  }

  rounds.forEach((r) => roundsContainer.appendChild(createRoundCard(r, defaultPlayers)));
}

/**
 * Extracts model from DOM.
 * Returns:
 * { players: [...names], rounds: [...] }
 */
export function getPairingsModelFromDOM() {
  const players = getPlayersFromTextarea();
  const roundsContainer = document.getElementById('roundsContainer');
  if (!roundsContainer) return { players, rounds: [] };

  const roundCards = Array.from(roundsContainer.querySelectorAll('.round-card'));

  const rounds = roundCards.map((card) => {
    const course = card.querySelector('.round-course')?.value?.trim() || '';
    const date = card.querySelector('.round-date')?.value || '';

    const rows = Array.from(card.querySelectorAll('tbody tr'));

    const playersForRound = rows.map((tr) => {
      const name = tr.querySelector('.player-name')?.textContent?.trim() || '';

      const handicapRaw = tr.querySelector('.handicap-input')?.value;
      const handicap = handicapRaw !== '' && handicapRaw != null ? parseInt(handicapRaw, 10) : null;

      const scores = Array.from(tr.querySelectorAll('.score-input')).map((inp) => {
        const v = inp.value;
        if (v === '' || v == null) return null;
        const n = parseInt(v, 10);
        return Number.isFinite(n) ? n : null;
      });

      return { name, handicap: Number.isFinite(handicap) ? handicap : null, scores: pad18(scores) };
    });

    return { course, date, players: playersForRound };
  });

  return { players, rounds };
}

/**
 * Creates a new round card DOM node.
 */
export function createRoundCard(round = {}, defaultPlayers = []) {
  const card = document.createElement('div');
  card.className = 'round-card';

  const course = round.course ?? '';
  const date = round.date ?? '';

  card.innerHTML = `
    <div class="round-header">
      <div class="stack" style="flex:1; min-width:220px;">
        <label>Course</label>
        <input type="text" class="round-course" placeholder="Course name" value="${escapeAttr(course)}">
      </div>

      <div class="stack" style="min-width:170px;">
        <label>Date</label>
        <input type="date" class="round-date" value="${escapeAttr(date)}">
      </div>

      <button type="button" class="small danger remove-round" title="Remove round">✕ Remove</button>
    </div>

    <div class="hint" style="margin-bottom:.5rem;">
      Tip: Enter scores left→right. Enter/Arrow keys move between holes. Totals update automatically.
    </div>

    <div class="table-scroll">
      <table class="score-table">
        <colgroup>
          <col class="col-player">
          <col class="col-hdcp">
          ${Array.from({ length: 18 }, () => `<col class="col-hole">`).join('')}
          <col class="col-outin">
          <col class="col-outin">
          <col class="col-total">
          <col class="col-total">
        </colgroup>

        <thead>
          <tr>
            <th>Player</th>
            <th>Hdcp</th>
            ${Array.from({ length: 18 }, (_, i) => `<th>${i + 1}</th>`).join('')}
            <th>Out</th>
            <th>In</th>
            <th>Gross</th>
            <th>Net</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  `;

  const tbody = card.querySelector('tbody');

  const playersForRound = normalizeRoundPlayers(round, defaultPlayers);
  playersForRound.forEach((p) => tbody.appendChild(createPlayerScoreRow(p)));

  // remove
  card.querySelector('.remove-round').addEventListener('click', () => card.remove());

  // Initial calc for all rows
  tbody.querySelectorAll('tr').forEach((tr) => recalcRow(tr));

  // Recalc any time scores/handicap changes
  card.addEventListener('input', (e) => {
    const tr = e.target.closest('tr');
    if (!tr) return;
    if (e.target.classList.contains('score-input')) {
      // clamp score
      e.target.value = clampScore(e.target.value);
    }
    recalcRow(tr);
  });

  // Better keyboard navigation + auto-advance
  card.addEventListener('keydown', (e) => {
    const inp = e.target;
    if (!(inp instanceof HTMLInputElement)) return;
    if (!inp.classList.contains('score-input')) return;

    const tr = inp.closest('tr');
    if (!tr) return;

    const hole = parseInt(inp.dataset.hole || '0', 10);
    const key = e.key;

    if (key === 'Enter') {
      e.preventDefault();
      focusScoreCell(card, tr, hole + 1);
      return;
    }

    if (key === 'ArrowRight') {
      e.preventDefault();
      focusScoreCell(card, tr, hole + 1);
      return;
    }
    if (key === 'ArrowLeft') {
      e.preventDefault();
      focusScoreCell(card, tr, hole - 1);
      return;
    }
    if (key === 'ArrowDown') {
      e.preventDefault();
      const next = tr.nextElementSibling;
      if (next) focusScoreCell(card, next, hole);
      return;
    }
    if (key === 'ArrowUp') {
      e.preventDefault();
      const prev = tr.previousElementSibling;
      if (prev) focusScoreCell(card, prev, hole);
      return;
    }
  });

  card.addEventListener('keyup', (e) => {
    const inp = e.target;
    if (!(inp instanceof HTMLInputElement)) return;
    if (!inp.classList.contains('score-input')) return;

    // auto-advance once user typed 1–2 digits (scores are 1–15)
    const v = inp.value.trim();
    if (v.length >= 2 || (v.length === 1 && v !== '1')) {
      const tr = inp.closest('tr');
      const hole = parseInt(inp.dataset.hole || '0', 10);
      focusScoreCell(card, tr, hole + 1);
    }
  });

  return card;
}

// ---------------------
// Helpers
// ---------------------

function normalizeRoundPlayers(round, defaultPlayers) {
  if (Array.isArray(round?.players) && round.players.length) {
    return round.players.map((p) => ({
      name: p?.name ?? '',
      handicap: Number.isFinite(p?.handicap) ? p.handicap : null,
      scores: pad18(Array.isArray(p?.scores) ? p.scores : []),
    }));
  }

  if (Array.isArray(round?.scores) && round.scores.length) {
    return round.scores
      .map((s) => ({
        name: s?.player ?? '',
        handicap: null,
        scores: pad18([]),
      }))
      .filter((p) => p.name);
  }

  return (defaultPlayers || []).map((name) => ({
    name,
    handicap: null,
    scores: pad18([]),
  }));
}

function createPlayerScoreRow(player) {
  const tr = document.createElement('tr');

  const scores = pad18(Array.isArray(player?.scores) ? player.scores : []);
  const hdcp = Number.isFinite(player?.handicap) ? player.handicap : '';

  tr.innerHTML = `
    <td><span class="player-name" style="font-weight:700;">${escapeText(player.name || '')}</span></td>
    <td><input type="number" class="handicap-input" min="0" max="54" placeholder="0" value="${hdcp}"></td>
    ${scores.map((s, i) => holeCell(s, i)).join('')}
    <td class="out-cell"></td>
    <td class="in-cell"></td>
    <td class="gross-cell"></td>
    <td class="net-cell"></td>
  `;

  return tr;
}

function holeCell(value, holeIndex) {
  const v = value == null ? '' : String(value);
  return `
    <td>
      <input
        type="text"
        class="score-input"
        inputmode="numeric"
        pattern="[0-9]*"
        maxlength="2"
        data-hole="${holeIndex}"
        value="${escapeAttr(v)}"
        placeholder=""
        style="text-align:center;"
      >
    </td>
  `;
}

function focusScoreCell(card, tr, holeIndex) {
  const idx = Math.max(0, Math.min(17, holeIndex));
  const target = tr.querySelector(`.score-input[data-hole="${idx}"]`);
  if (!target) return;
  target.focus();
  target.select?.();

  // If we are on small screens and using overflow, ensure the cell is visible
  const scroller = card.querySelector('.table-scroll');
  if (scroller && scroller.scrollWidth > scroller.clientWidth) {
    const cell = target.closest('td');
    if (cell) {
      const cellLeft = cell.offsetLeft;
      const cellRight = cellLeft + cell.offsetWidth;
      const viewLeft = scroller.scrollLeft;
      const viewRight = viewLeft + scroller.clientWidth;

      if (cellLeft < viewLeft) scroller.scrollLeft = Math.max(0, cellLeft - 20);
      else if (cellRight > viewRight) scroller.scrollLeft = cellRight - scroller.clientWidth + 20;
    }
  }
}

function recalcRow(tr) {
  const inputs = Array.from(tr.querySelectorAll('.score-input'));
  const scores = inputs.map((inp) => {
    const v = inp.value;
    if (!v) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  });

  const out = sum(scores.slice(0, 9));
  const inn = sum(scores.slice(9, 18));
  const gross = out + inn;

  const hdcpRaw = tr.querySelector('.handicap-input')?.value;
  const hdcp = hdcpRaw !== '' && hdcpRaw != null ? parseInt(hdcpRaw, 10) : null;

  const outCell = tr.querySelector('.out-cell');
  const inCell = tr.querySelector('.in-cell');
  const grossCell = tr.querySelector('.gross-cell');
  const netCell = tr.querySelector('.net-cell');

  if (outCell) outCell.textContent = out ? String(out) : '';
  if (inCell) inCell.textContent = inn ? String(inn) : '';
  if (grossCell) grossCell.textContent = gross ? String(gross) : '';

  if (netCell) {
    if (gross && Number.isFinite(hdcp)) netCell.textContent = String(gross - hdcp);
    else netCell.textContent = '';
  }
}

function clampScore(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const n = parseInt(s, 10);
  if (!Number.isFinite(n)) return '';
  const clamped = Math.max(1, Math.min(15, n));
  return String(clamped);
}

function sum(arr) {
  return (arr || []).reduce((acc, n) => acc + (Number.isFinite(n) ? n : 0), 0);
}

function pad18(arr) {
  const out = Array.isArray(arr) ? [...arr] : [];
  while (out.length < 18) out.push(null);
  return out.slice(0, 18).map((v) => (v == null ? null : Number(v)));
}

function escapeAttr(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeText(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
