// js/pairings.js
// Pairings & Scores: players + rounds + editable 18-hole scoring
// Includes: Front 9 / Back 9 / Gross / Handicap / Net
// Enhancements:
// - Course Setup: Par + Stroke Index (SI) per hole
// - Stableford totals (uses global toggle via getStablefordMode())
// - Auto-generate foursomes per round

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

// ---------------------
// Stableford + handicap allocation
// ---------------------

function allocateHandicapStrokesToHoles(handicap, strokeIndex18) {
  const h = Number.isFinite(+handicap) ? Math.max(0, Math.floor(+handicap)) : 0;

  const si = (Array.isArray(strokeIndex18) && strokeIndex18.length === 18)
    ? strokeIndex18.map((v, i) => ({ si: Number.isFinite(+v) ? +v : (i + 1), idx: i }))
    : Array.from({ length: 18 }, (_, i) => ({ si: i + 1, idx: i }));

  si.sort((a, b) => a.si - b.si); // 1 hardest

  const strokes = Array(18).fill(0);
  const full = Math.floor(h / 18);
  const rem = h % 18;

  for (let i = 0; i < 18; i++) strokes[i] = full;
  for (let i = 0; i < rem; i++) strokes[si[i].idx] += 1;

  return strokes;
}

function stablefordPoints({ par, strokes, handicapStrokes = 0, useNet = true }) {
  const p = Number(par);
  const s = Number(strokes);
  const hs = Number(handicapStrokes || 0);

  if (!Number.isFinite(p) || !Number.isFinite(s)) return null;

  const score = useNet ? (s - hs) : s;
  const toPar = score - p;

  if (toPar <= -3) return 5;
  if (toPar === -2) return 4;
  if (toPar === -1) return 3;
  if (toPar === 0) return 2;
  if (toPar === 1) return 1;
  return 0;
}

// ---------------------
// Foursomes generator
// ---------------------

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateFoursomes(players, { groupSize = 4, method = 'byHandicapSnake' } = {}) {
  const clean = (players || []).filter(p => p?.name);
  if (!clean.length) return [];

  if (method === 'byHandicapSnake') {
    const ordered = [...clean].sort((a, b) => {
      const ha = Number.isFinite(+a.handicap) ? +a.handicap : 999;
      const hb = Number.isFinite(+b.handicap) ? +b.handicap : 999;
      return ha - hb;
    });

    const nGroups = Math.ceil(ordered.length / groupSize);
    const groups = Array.from({ length: nGroups }, () => []);

    let dir = 1;
    let g = 0;
    for (const p of ordered) {
      groups[g].push(p.name);
      g += dir;
      if (g === nGroups) { dir = -1; g = nGroups - 1; }
      if (g < 0) { dir = 1; g = 0; }
    }
    return groups;
  }

  const ordered = shuffle(clean);
  const groups = [];
  for (let i = 0; i < ordered.length; i += groupSize) {
    groups.push(ordered.slice(i, i + groupSize).map(p => p.name));
  }
  return groups;
}

/**
 * Creates a new round card DOM node.
 * Round model:
 * {
 *   id: string,
 *   course: string,
 *   date: string,
 *   pars: number[18],
 *   strokeIndex: number[18],
 *   groups: string[][],
 *   players: [{ name, handicap, scores[18] }]
 * }
 */
export function createRoundCard(round = {}, defaultPlayers = [], options = {}) {
  const { getStablefordMode = () => ({ enabled: false, net: true }) } = options;

  const card = document.createElement('div');
  card.className = 'round-card';

  const course = round.course ?? '';
  const date = round.date ?? '';
  const roundId = round.id ?? uid();

  const pars = normalize18Nums(round.pars, 4);
  const strokeIndex = normalize18Nums(round.strokeIndex, null).map((v, i) => Number.isFinite(v) ? v : (i + 1));
  const groups = Array.isArray(round.groups) ? round.groups : [];

  card.dataset.roundId = roundId;

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

      <button type="button" class="small secondary toggle-setup" title="Course setup">⛳ Setup</button>
      <button type="button" class="small danger remove-round" title="Remove round">✕ Remove</button>
    </div>

    <div class="course-setup" style="display:none; margin:.35rem 0 .65rem 0;">
      <div class="hint" style="margin-bottom:.4rem;">
        Enter <strong>Par</strong> and <strong>Stroke Index</strong> (1 = hardest). Needed for accurate Net Stableford.
      </div>
      <div style="overflow:auto; border-radius:14px;">
        <table>
          <thead>
            <tr>
              <th style="min-width:80px;">Hole</th>
              ${Array.from({ length: 18 }, (_, i) => `<th style="min-width:44px; text-align:center;">${i + 1}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Par</strong></td>
              ${pars.map((p, i) => `
                <td style="text-align:center;">
                  <input type="number" class="par-input" data-hole="${i}" min="3" max="6" value="${escapeAttr(p)}" style="width:44px; text-align:center;">
                </td>
              `).join('')}
            </tr>
            <tr>
              <td><strong>SI</strong></td>
              ${strokeIndex.map((si, i) => `
                <td style="text-align:center;">
                  <input type="number" class="si-input" data-hole="${i}" min="1" max="18" value="${escapeAttr(si)}" style="width:44px; text-align:center;">
                </td>
              `).join('')}
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="section-bar" style="margin-top:.25rem;">
      <div class="section-title">Foursomes <span class="chip">Optional</span></div>
      <div style="display:flex; gap:.5rem; flex-wrap:wrap;">
        <button type="button" class="small secondary auto-foursomes">🤖 Auto</button>
        <button type="button" class="small secondary clear-foursomes">🧽 Clear</button>
      </div>
    </div>

    <textarea class="round-groups" placeholder="Group 1: Glenn, Mike, Dave, Chris&#10;Group 2: ..." style="min-height:80px;">${escapeText(formatGroups(groups))}</textarea>

    <div class="hint" style="margin:.35rem 0 .65rem 0;">
      Tip: enter handicaps once, then fill hole scores. Totals update automatically.
      Stableford will use Par/SI when enabled.
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
            <th style="min-width:70px;">Stbl</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  `;

  card.querySelector('.toggle-setup')?.addEventListener('click', () => {
    const setup = card.querySelector('.course-setup');
    if (!setup) return;
    setup.style.display = setup.style.display === 'none' ? 'block' : 'none';
  });

  const tbody = card.querySelector('tbody');

  const playersForRound = normalizeRoundPlayers(round, defaultPlayers);
  playersForRound.forEach((p) => tbody.appendChild(createPlayerScoreRow(p)));

  card.querySelector('.remove-round')?.addEventListener('click', () => card.remove());

  card.querySelector('.auto-foursomes')?.addEventListener('click', () => {
    const currentPlayers = getRoundPlayersFromCard(card);
    const groups2 = generateFoursomes(currentPlayers, { method: 'byHandicapSnake' });
    card.querySelector('.round-groups').value = formatGroups(groups2);
    card.querySelector('.round-groups').dispatchEvent(new Event('input', { bubbles: true }));
  });

  card.querySelector('.clear-foursomes')?.addEventListener('click', () => {
    card.querySelector('.round-groups').value = '';
    card.querySelector('.round-groups').dispatchEvent(new Event('input', { bubbles: true }));
  });

  // Initial calc
  tbody.querySelectorAll('tr').forEach((tr) => recalcRow(tr, card, getStablefordMode));

  // Recalc
  card.addEventListener('input', (e) => {
    const t = e.target;

    if (t?.classList?.contains('par-input') || t?.classList?.contains('si-input')) {
      tbody.querySelectorAll('tr').forEach((tr) => recalcRow(tr, card, getStablefordMode));
      return;
    }

    const tr = t.closest('tr');
    if (!tr) return;
    recalcRow(tr, card, getStablefordMode);
  });

  return card;
}

/**
 * Renders entire Pairings tab from model.
 */
export function renderPairingsFromModel(model, options = {}) {
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
    roundsContainer.appendChild(createRoundCard({ id: uid() }, defaultPlayers, options));
    return;
  }

  rounds.forEach((r) => roundsContainer.appendChild(createRoundCard(r, defaultPlayers, options)));
}

/**
 * Extracts model from DOM.
 * Returns: { players: [...names], rounds: [...] }
 */
export function getPairingsModelFromDOM() {
  const players = getPlayersFromTextarea();

  const roundsContainer = document.getElementById('roundsContainer');
  if (!roundsContainer) return { players, rounds: [] };

  const roundCards = Array.from(roundsContainer.querySelectorAll('.round-card'));

  const rounds = roundCards.map((card) => {
    const id = card.dataset.roundId || uid();
    const course = card.querySelector('.round-course')?.value?.trim() || '';
    const date = card.querySelector('.round-date')?.value || '';

    const pars = Array.from(card.querySelectorAll('.par-input')).map((inp) => toNumOr(inp.value, 4));
    const strokeIndex = Array.from(card.querySelectorAll('.si-input')).map((inp, i) => toNumOr(inp.value, i + 1));

    const groupsText = card.querySelector('.round-groups')?.value || '';
    const groups = parseGroups(groupsText);

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
      id,
      course,
      date,
      pars: pad18(pars).map(v => Number.isFinite(v) ? v : 4),
      strokeIndex: pad18(strokeIndex).map((v, i) => Number.isFinite(v) ? v : (i + 1)),
      groups,
      players: playersForRound,
    };
  });

  return { players, rounds };
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
    <td>
      <input type="number" class="handicap-input" min="0" max="54" placeholder="0" value="${hdcp}">
    </td>
    ${scores.slice(0, 9).map((s, i) => holeCell(s, i)).join('')}
    <td class="out-cell"></td>
    ${scores.slice(9, 18).map((s, i) => holeCell(s, i + 9)).join('')}
    <td class="in-cell"></td>
    <td class="gross-cell"></td>
    <td class="net-cell"></td>
    <td class="stbl-cell"></td>
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

function recalcRow(tr, roundCard, getStablefordMode) {
  const setCell = (sel, value) => {
    const el = tr.querySelector(sel);
    if (!el) return;
    el.textContent = value ?? '';
  };

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

  setCell('.out-cell', out ? String(out) : '');
  setCell('.in-cell', inn ? String(inn) : '');
  setCell('.gross-cell', gross ? String(gross) : '');

  if (gross && Number.isFinite(hdcp)) {
    setCell('.net-cell', String(gross - hdcp));
  } else {
    setCell('.net-cell', '');
  }

  const stblCell = tr.querySelector('.stbl-cell');
  const mode = getStablefordMode?.() || { enabled: false, net: true };

  // If Stableford column isn't present in this DOM, just don't compute it
  if (!stblCell) return;

  if (!mode.enabled) {
    stblCell.textContent = '';
    return;
  }

  const pars = readParsFromRoundCard(roundCard);
  const sis = readSIFromRoundCard(roundCard);
  const perHoleStrokes = allocateHandicapStrokesToHoles(hdcp, sis);

  let total = 0;
  for (let i = 0; i < 18; i++) {
    const pts = stablefordPoints({
      par: pars[i],
      strokes: scores[i],
      handicapStrokes: perHoleStrokes[i],
      useNet: !!mode.net,
    });
    if (Number.isFinite(pts)) total += pts;
  }

  stblCell.textContent = total ? String(total) : '';
}

function readParsFromRoundCard(card) {
  const pars = Array.from(card.querySelectorAll('.par-input')).map(inp => toNumOr(inp.value, 4));
  return pad18(pars).map(v => Number.isFinite(v) ? v : 4);
}

function readSIFromRoundCard(card) {
  const sis = Array.from(card.querySelectorAll('.si-input')).map((inp, i) => toNumOr(inp.value, i + 1));
  return pad18(sis).map((v, i) => Number.isFinite(v) ? v : (i + 1));
}

function getRoundPlayersFromCard(card) {
  const rows = Array.from(card.querySelectorAll('tbody tr'));
  return rows.map(tr => ({
    name: tr.querySelector('.player-name')?.textContent?.trim() || '',
    handicap: (() => {
      const v = tr.querySelector('.handicap-input')?.value;
      const n = v !== '' && v != null ? parseInt(v, 10) : null;
      return Number.isFinite(n) ? n : null;
    })(),
  })).filter(p => p.name);
}

function formatGroups(groups) {
  if (!Array.isArray(groups) || !groups.length) return '';
  return groups.map((g, i) => `Group ${i + 1}: ${(g || []).join(', ')}`).join('\n');
}

function parseGroups(text) {
  const t = String(text || '').trim();
  if (!t) return [];
  const lines = t.split('\n').map(s => s.trim()).filter(Boolean);
  const groups = [];
  for (const line of lines) {
    const parts = line.split(':');
    const rhs = (parts.length >= 2 ? parts.slice(1).join(':') : line).trim();
    const names = rhs.split(',').map(s => s.trim()).filter(Boolean);
    if (names.length) groups.push(names);
  }
  return groups;
}

function sum(arr) {
  return (arr || []).reduce((acc, n) => acc + (Number.isFinite(n) ? n : 0), 0);
}

function pad18(arr) {
  const out = Array.isArray(arr) ? [...arr] : [];
  while (out.length < 18) out.push(null);
  return out.slice(0, 18).map((v) => (v == null ? null : Number(v)));
}

function normalize18Nums(arr, fallback) {
  const out = Array.isArray(arr) ? [...arr] : [];
  while (out.length < 18) out.push(fallback);
  return out.slice(0, 18).map(v => (v == null ? fallback : Number(v)));
}

function toNumOr(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function uid() {
  return Math.random().toString(16).slice(2) + '-' + Date.now().toString(16);
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
