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
  const card = document.createElement('div');
  card.className = 'round-card';

  card.innerHTML = `
    <div class="round-header">
      <div class="stack">
        <label>Course</label>
        <input type="text" class="round-course" placeholder="Course name" value="${round.course || ''}">
      </div>

      <div class="stack">
        <label>Date</label>
        <input type="date" class="round-date" value="${round.date || ''}">
      </div>

      <button class="small danger remove-round">✕ Remove</button>
    </div>

    <table class="score-table">
      <thead>
        <tr>
          <th>Player</th>
          ${Array.from({ length: 18 }, (_, i) => `<th>${i + 1}</th>`).join('')}
          <th>Total</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  `;

  const tbody = card.querySelector('tbody');

  const roundPlayers = round.players || players.map(name => ({
    name,
    scores: Array(18).fill('')
  }));

  roundPlayers.forEach(player => {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td><strong>${player.name}</strong></td>
      ${player.scores.map((s, i) => `
        <td>
          <input type="number" min="1" max="15"
            data-hole="${i}"
            value="${s ?? ''}"
            class="score-input">
        </td>
      `).join('')}
      <td class="total-cell">0</td>
    `;

    tbody.appendChild(tr);

    // Auto-calc total
    tr.addEventListener('input', () => {
      const total = [...tr.querySelectorAll('.score-input')]
        .map(i => parseInt(i.value, 10))
        .filter(n => !isNaN(n))
        .reduce((a, b) => a + b, 0);

      tr.querySelector('.total-cell').textContent = total || '';
    });
  });

  // Remove round
  card.querySelector('.remove-round').onclick = () => card.remove();

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
  const rounds = [];

  document.querySelectorAll('.round-card').forEach(card => {
    const course = card.querySelector('.round-course')?.value || '';
    const date = card.querySelector('.round-date')?.value || '';

    const players = [];

    card.querySelectorAll('tbody tr').forEach(row => {
      const name = row.querySelector('td strong')?.textContent || '';
      const scores = [...row.querySelectorAll('.score-input')]
        .map(i => i.value ? parseInt(i.value, 10) : null);

      players.push({ name, scores });
    });

    rounds.push({ course, date, players });
  });

  return { rounds };
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
