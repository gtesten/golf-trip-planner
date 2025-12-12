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
 * Creates a new round card DOM node.
 * Round model:
 * {
 *   course: string,
 *   date: string (YYYY-MM-DD),
 *   players: [
 *     { name: string, handicap: number|null, scores: Array(18) of number|null }
 *   ]
 * }
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
      Tip: enter handicaps once, then fill hole scores. Totals update automatically.
    </div>

    <div style="overflow:auto; border-radius:14px;">
      <table class="score-table">
        <thead>
          <tr>
            <th style="min-width:160px;">Player</th>
            <th style="min-width:70px;">Hdcp</th>
            ${Array.from({ length: 9 }, (_, i) => `<th style="min-width:44px;">${i + 1}</th>`).join('')}
            <th style="min-width:56px;">Out</th>
            ${Array.from({ length: 9 }, (_, i) => `<th style="min-width:44px;">${i + 10}</th>`).join('')}
            <th style="min-width:56px;">In</th>
            <th style="min-width:70px;">Gross</th>
            <th style="min-width:70px;">Net</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  `;

  const tbody = card.querySelector('tbody');

  // Normalize player rows
  const playersForRound = normalizeRoundPlayers(round, defaultPlayers);

  playersForRound.forEach((p) => {
    tbody.appendChild(createPlayerScoreRow(p));
  });

  // remove
  card.querySelector('.remove-round').addEventListener('click', () => card.remove());

  // Initial calc for all rows
  tbody.querySelectorAll('tr').forEach((tr) => recalcRow(tr));

  // Recalc any time scores/handicap changes
  card.addEventListener('input', (e) => {
    const tr = e.target.closest('tr');
    if (!tr) return;
    recalcRow(tr);
  });

  return card;
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

  // Support older/newer model shapes
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

      return {
        name,
        handicap: Number.isFinite(handicap) ? handicap : null,
        scores: pad18(scores),
      };
    });

    return {
      course,
      date,
      players: playersForRound,
    };
  });

  return { players, rounds };
}

// ---------------------
// Helpers
// ---------------------

function normalizeRoundPlayers(round, defaultPlayers) {
  // Preferred new shape: round.players
  if (Array.isArray(round?.players) && round.players.length) {
    return round.players.map((p) => ({
      name: p?.name ?? '',
      handicap: Number.isFinite(p?.handicap) ? p.handicap : null,
      scores: pad18(Array.isArray(p?.scores) ? p.scores : []),
    }));
  }

  // Older shape: round.scores [{player, score, notes}] — convert to 18 nulls
  if (Array.isArray(round?.scores) && round.scores.length) {
    return round.scores
      .map((s) => ({
        name: s?.player ?? '',
        handicap: null,
        scores: pad18([]),
      }))
      .filter((p) => p.name);
  }

  // Fallback: default players from textarea
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
    <td>
      <input type="number" class="handicap-input" min="0" max="54" placeholder="0" value="${hdcp}">
    </td>
    ${scores.slice(0, 9).map((s, i) => holeCell(s, i)).join('')}
    <td class="out-cell"></td>
    ${scores.slice(9, 18).map((s, i) => holeCell(s, i + 9)).join('')}
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
        type="number"
        class="score-input"
        inputmode="numeric"
        min="1"
        max="15"
        data-hole="${holeIndex}"
        value="${escapeAttr(v)}"
        placeholder=""
        style="width:44px; text-align:center;"
      >
    </td>
  `;
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

  tr.querySelector('.out-cell').textContent = out ? String(out) : '';
  tr.querySelector('.in-cell').textContent = inn ? String(inn) : '';
  tr.querySelector('.gross-cell').textContent = gross ? String(gross) : '';

  if (gross && Number.isFinite(hdcp)) {
    tr.querySelector('.net-cell').textContent = String(gross - hdcp);
  } else {
    tr.querySelector('.net-cell').textContent = '';
  }
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
