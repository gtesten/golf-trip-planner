// js/itinerary.js
// Structured itinerary days UI + model
// Enhancements:
// - Days contain blocks (tee_time, round, dinner, activity, note)
// - Round blocks can link to Pairings rounds via round_id
// - Backward compatible: old {morning,afternoon,notes} auto-converted to blocks

'use strict';

function uid() {
  return Math.random().toString(16).slice(2) + '-' + Date.now().toString(16);
}

function escapeAttr(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeText(value) {
  return String(value ?? '').replaceAll('</textarea>', '&lt;/textarea&gt;');
}

function normalizeBlock(b = {}) {
  return {
    id: b.id || uid(),
    type: b.type || 'activity',
    time: b.time || '',
    title: b.title || '',
    location: b.location || '',
    notes: b.notes || '',
    round_id: b.round_id || '',
  };
}

function normalizeDay(day = {}) {
  // Old format support
  if (!Array.isArray(day.blocks) && (day.morning || day.afternoon || day.notes)) {
    const blocks = [];
    if (day.morning) blocks.push(normalizeBlock({ type: 'activity', title: 'Morning', notes: day.morning }));
    if (day.afternoon) blocks.push(normalizeBlock({ type: 'activity', title: 'Afternoon', notes: day.afternoon }));
    if (day.notes) blocks.push(normalizeBlock({ type: 'note', title: 'Evening / Notes', notes: day.notes }));
    return { date: day.date || '', label: day.label || '', blocks };
  }

  return {
    date: day.date || '',
    label: day.label || '',
    blocks: (Array.isArray(day.blocks) ? day.blocks : []).map(normalizeBlock),
  };
}

function normalizeModel(model) {
  const days = Array.isArray(model?.days) ? model.days : [];
  return { days: days.map(normalizeDay) };
}

function roundOptionsFromPairings(pairingsModel) {
  const rounds = Array.isArray(pairingsModel?.rounds) ? pairingsModel.rounds : [];
  return rounds.map((r, idx) => ({
    id: r.id || `round_${idx + 1}`,
    label: (r.course || r.name || r.label || `Round ${idx + 1}`) + (r.date ? ` (${r.date})` : ''),
  }));
}

export function renderItineraryFromModel(model, { pairingsModel } = {}) {
  const container = document.getElementById('itineraryDaysContainer');
  if (!container) {
    console.warn('[GolfTripPlanner] itineraryDaysContainer not found');
    return;
  }

  const m = normalizeModel(model);
  container.innerHTML = '';

  if (!m.days.length) {
    container.appendChild(createDayCard({}, { pairingsModel }));
    return;
  }

  m.days.forEach((d) => container.appendChild(createDayCard(d, { pairingsModel })));
}

export function createDayCard(day = {}, { pairingsModel } = {}) {
  const d = normalizeDay(day);
  const card = document.createElement('div');
  card.className = 'day-card';

  card.innerHTML = `
    <div class="day-header" style="align-items:flex-end;">
      <div class="stack" style="min-width:170px;">
        <label>Date</label>
        <input type="date" class="day-date" value="${escapeAttr(d.date)}">
      </div>

      <div class="stack" style="flex:1; min-width:220px;">
        <label>Label</label>
        <input type="text" class="day-label" placeholder="Arrival + Warm-up" value="${escapeAttr(d.label)}">
      </div>

      <button type="button" class="small secondary add-block">➕ Block</button>
      <button type="button" class="small danger remove-day">✕ Remove</button>
    </div>

    <div class="hint" style="margin-top:.15rem;">
      Add blocks like tee time, a round (linked to Pairings), dinner, or notes.
    </div>

    <div class="it-blocks" style="margin-top:.6rem; display:flex; flex-direction:column; gap:.55rem;"></div>
  `;

  const blocksWrap = card.querySelector('.it-blocks');

  const renderBlocks = () => {
    blocksWrap.innerHTML = '';
    const opts = roundOptionsFromPairings(pairingsModel);

    d.blocks.forEach((b, idx) => {
      const row = document.createElement('div');
      row.style.display = 'grid';
      row.style.gridTemplateColumns = '140px 140px 1fr 120px';
      row.style.gap = '.55rem';
      row.style.alignItems = 'start';

      row.innerHTML = `
        <div>
          <label>Type</label>
          <select class="block-type">
            ${opt('tee_time', b.type, 'Tee Time')}
            ${opt('round', b.type, 'Round')}
            ${opt('dinner', b.type, 'Dinner')}
            ${opt('activity', b.type, 'Activity')}
            ${opt('note', b.type, 'Note')}
          </select>
        </div>

        <div>
          <label>Time</label>
          <input type="text" class="block-time" placeholder="8:10 AM" value="${escapeAttr(b.time)}">
        </div>

        <div>
          <label>Title / Location</label>
          <input type="text" class="block-title" placeholder="The Loop" value="${escapeAttr(b.title)}">
          <input type="text" class="block-location" placeholder="Location / Course / Restaurant" value="${escapeAttr(b.location)}" style="margin-top:.35rem;">
          <textarea class="block-notes" placeholder="Notes..." style="min-height:80px; margin-top:.35rem;">${escapeText(b.notes)}</textarea>

          <div class="round-link" style="margin-top:.35rem; ${b.type === 'round' ? '' : 'display:none;'}">
            <label>Link to Pairings Round</label>
            <select class="block-round">
              <option value="">— none —</option>
              ${opts.map(o => `<option value="${escapeAttr(o.id)}" ${o.id === b.round_id ? 'selected' : ''}>${o.label}</option>`).join('')}
            </select>
          </div>
        </div>

        <div>
          <label>Actions</label>
          <div style="display:flex; gap:.35rem; flex-wrap:wrap;">
            <button type="button" class="small secondary up">↑</button>
            <button type="button" class="small secondary down">↓</button>
            <button type="button" class="small danger del">✕</button>
          </div>
        </div>
      `;

      const typeSel = row.querySelector('.block-type');
      const timeIn = row.querySelector('.block-time');
      const titleIn = row.querySelector('.block-title');
      const locIn = row.querySelector('.block-location');
      const notesIn = row.querySelector('.block-notes');
      const roundWrap = row.querySelector('.round-link');
      const roundSel = row.querySelector('.block-round');

      typeSel.addEventListener('change', () => {
        b.type = typeSel.value;
        if (b.type !== 'round') b.round_id = '';
        roundWrap.style.display = b.type === 'round' ? '' : 'none';
        card.dispatchEvent(new Event('input', { bubbles: true }));
      });

      timeIn.addEventListener('input', () => { b.time = timeIn.value; card.dispatchEvent(new Event('input', { bubbles: true })); });
      titleIn.addEventListener('input', () => { b.title = titleIn.value; card.dispatchEvent(new Event('input', { bubbles: true })); });
      locIn.addEventListener('input', () => { b.location = locIn.value; card.dispatchEvent(new Event('input', { bubbles: true })); });
      notesIn.addEventListener('input', () => { b.notes = notesIn.value; card.dispatchEvent(new Event('input', { bubbles: true })); });
      roundSel?.addEventListener('change', () => { b.round_id = roundSel.value; card.dispatchEvent(new Event('input', { bubbles: true })); });

      row.querySelector('.del').addEventListener('click', () => {
        d.blocks.splice(idx, 1);
        renderBlocks();
        card.dispatchEvent(new Event('input', { bubbles: true }));
      });

      row.querySelector('.up').addEventListener('click', () => {
        if (idx <= 0) return;
        [d.blocks[idx - 1], d.blocks[idx]] = [d.blocks[idx], d.blocks[idx - 1]];
        renderBlocks();
        card.dispatchEvent(new Event('input', { bubbles: true }));
      });

      row.querySelector('.down').addEventListener('click', () => {
        if (idx >= d.blocks.length - 1) return;
        [d.blocks[idx + 1], d.blocks[idx]] = [d.blocks[idx], d.blocks[idx + 1]];
        renderBlocks();
        card.dispatchEvent(new Event('input', { bubbles: true }));
      });

      blocksWrap.appendChild(row);
    });
  };

  renderBlocks();

  card.querySelector('.add-block').addEventListener('click', () => {
    d.blocks.push(normalizeBlock({ type: 'activity', title: 'Activity' }));
    renderBlocks();
    card.dispatchEvent(new Event('input', { bubbles: true }));
  });

  card.querySelector('.remove-day').onclick = () => card.remove();

  // store model on card for DOM extraction
  card.__dayModel = d;

  return card;
}

function opt(value, current, label) {
  return `<option value="${value}" ${value === current ? 'selected' : ''}>${label}</option>`;
}

export function getItineraryModelFromDOM() {
  const days = [];

  document.querySelectorAll('.day-card').forEach(card => {
    const d = card.__dayModel ? normalizeDay(card.__dayModel) : normalizeDay({});
    d.date = card.querySelector('.day-date')?.value || '';
    d.label = card.querySelector('.day-label')?.value || '';
    days.push(d);
  });

  return { days };
}

export function generateDaysFromDateRange(startDate, endDate) {
  if (!startDate || !endDate) return { days: [] };

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return { days: [] };
  }

  const days = [];
  let current = new Date(start);
  let i = 1;

  while (current <= end) {
    const iso = current.toISOString().split('T')[0];
    days.push({
      date: iso,
      label: `Day ${i}`,
      blocks: [
        { type: 'activity', title: 'Morning', notes: '' },
        { type: 'activity', title: 'Afternoon', notes: '' },
        { type: 'note', title: 'Notes', notes: '' },
      ].map(b => ({ ...b, id: uid(), time: '', location: '', round_id: '' })),
    });

    current.setDate(current.getDate() + 1);
    i += 1;
  }

  return { days };
}
