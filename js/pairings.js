// js/pairings.js
// Players + rounds + scores UI + model

'use strict';

export function getPlayersFromTextarea() {
  const area = document.getElementById('playersInput');
  if (!area) return [];
  return area.value
    .split('\n')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

export function createRoundCard(round = {}, players = []) {
  const {
    date = '',
    course = '',
    tee_time = '',
    format = '',
    scores = [],
  } = round;

  const card = document.createElement('div');
  card.className = 'round-card';

  card.innerHTML = `
    <div class="round-header">
      <div>
        <div class="pill-label">Date</div>
        <input type="date" class="round-date" value="${date || ''}">
      </div>
      <div>
        <div class="pill-label">Tee Time</div>
        <input type="time" class="round-tee-time" value="${tee_time || ''}">
      </div>
      <div style="flex:1; min-width:160px;">
        <div class="pill-label">Course</div>
        <input type="text" class="round-course" placeholder="Forest Dunes" value="${escapeAttr(course || '')}">
      </div>
      <div style="flex:1; min-width:160px;">
        <div class="pill-label">Format</div>
        <input type="text" class="round-format" placeholder="Stroke play, Best Ball, Scramble…" value="${escapeAttr(format || '')}">
      </div>
      <button type="button" class="small danger remove-round" title="Remove round">✕</button>
    </div>

    <div class="section-bar">
      <div class="pill-label">Scores</div>
      <button type="button" class="small secondary sync-players">Sync players & rows</button>
    </div>

    <table class="round-scores-table">
      <thead>
        <tr>
          <th style="width:35%;">Player</th>
          <th style="width:15%;">Score</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  `;

  // Remove round
  card.querySelector('.remove-round').addEventListener('click', () => card.remove());

  const tbody = card.querySelector('tbody');

  function renderScoreRows(currentPlayers, currentScores) {
    tbody.innerHTML = '';

    currentPlayers.forEach((playerName) => {
      const existing = currentScores.find((s) => s.player === playerName) || {};
      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td><input type="text" class="score-player" value="${escapeAttr(playerName)}"></td>
        <td><input type="number" class="score-value" placeholder="72" value="${existing.score ?? ''}"></td>
        <td><input type="text" class="score-notes" placeholder="Birdies, skins, etc." value="${escapeAttr(existing.notes ?? '')}"></td>
      `;

      tbody.appendChild(tr);
    });
  }

  const basePlayers =
    players.length ? players : scores.map((s) => s.player).filter(Boolean);

  renderScoreRows(basePlayers, scores);

  // Sync players button: preserves existing scores by matching player name
  card.querySelector('.sync-players').addEventListener('click', () => {
    const updatedPlayers = getPlayersFromTextarea();
    const currentScores = getScoresForRoundCard(card);
    renderScoreRows(updatedPlayers, currentScores);
  });

  return card;
}

export function renderPairingsFromModel(model) {
  const playersArea = document.getElementById('playersInput');
  const roundsContainer = document.getElementById('roundsContainer');

  if (!playersArea || !roundsContainer) {
    console.warn('[GolfTripPlanner] playersInput or roundsContainer not found');
    return;
  }

  const players = Array.isArray(model?.players) ? model.players : [];
  const rounds = Array.isArray(model?.rounds) ? model.rounds : [];

  playersArea.value = players.join('\n');
  roundsContainer.innerHTML = '';

  if (!rounds.length) {
    roundsContainer.appendChild(createRoundCard({}, players));
    return;
  }

  rounds.forEach((r) => roundsContainer.appendChild(createRoundCard(r, players)));
}

export function getPairingsModelFromDOM() {
  const players = getPlayersFromTextarea();
  const roundsContainer = document.getElementById('roundsContainer');
  if (!roundsContainer) return { players: [], rounds: [] };

  const cards = Array.from(roundsContainer.querySelectorAll('.round-card'));

  const rounds = cards.map((card) => {
    const date = card.querySelector('.round-date')?.value || null;
    const tee = card.querySelector('.round-tee-time')?.value || null;
    const course = card.querySelector('.round-course')?.value || null;
    const format = card.querySelector('.round-format')?.value || null;

    return {
      date,
      tee_time: tee,
      course,
      format,
      scores: getScoresForRoundCard(card),
    };
  });

  return { players, rounds };
}

// ----- Internal helpers -----

function getScoresForRoundCard(card) {
  const rows = Array.from(card.querySelectorAll('tbody tr'));
  return rows
    .map((tr) => {
      const p = tr.querySelector('.score-player')?.value?.trim();
      const s = tr.querySelector('.score-value')?.value;
      const n = tr.querySelector('.score-notes')?.value;

      if (!p) return null;

      return {
        player: p,
        score: s !== '' && s !== null ? Number(s) : null,
        notes: n || null,
      };
    })
    .filter(Boolean);
}

function escapeAttr(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
