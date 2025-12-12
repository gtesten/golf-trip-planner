// js/itinerary.js
// Structured itinerary days UI + model

'use strict';

export function createDayCard(day = {}) {
  const { date = '', label = '', morning = '', afternoon = '', notes = '' } = day;

  const card = document.createElement('div');
  card.className = 'day-card';

  card.innerHTML = `
    <div class="day-header">
      <div>
        <div class="pill-label">Day Date</div>
        <input type="date" class="day-date" value="${date || ''}">
      </div>
      <div style="flex:1; min-width:160px;">
        <div class="pill-label">Day Label</div>
        <input type="text" class="day-label" placeholder="Day 1 – Arrival / Warm-up" value="${escapeAttr(label || '')}">
      </div>
      <button type="button" class="small danger remove-day" title="Remove day">✕</button>
    </div>
    <div class="grid">
      <div>
        <label>Morning</label>
        <textarea class="day-morning" placeholder="Breakfast, range session, morning round">${escapeText(morning || '')}</textarea>
      </div>
      <div>
        <label>Afternoon / Evening</label>
        <textarea class="day-afternoon" placeholder="Afternoon round, dinner, games">${escapeText(afternoon || '')}</textarea>
      </div>
    </div>
    <div>
      <label>Notes</label>
      <textarea class="day-notes" placeholder="Shuttles, carpool, special notes, etc.">${escapeText(notes || '')}</textarea>
    </div>
  `;

  const removeBtn = card.querySelector('.remove-day');
  removeBtn.addEventListener('click', () => card.remove());

  return card;
}

export function renderItineraryFromModel(model) {
  const container = document.getElementById('itineraryDaysContainer');
  if (!container) {
    console.warn('[GolfTripPlanner] itineraryDaysContainer not found');
    return;
  }

  container.innerHTML = '';
  const days = Array.isArray(model?.days) ? model.days : [];

  if (!days.length) {
    container.appendChild(createDayCard());
    return;
  }

  days.forEach((d) => container.appendChild(createDayCard(d)));
}

export function getItineraryModelFromDOM() {
  const container = document.getElementById('itineraryDaysContainer');
  if (!container) return { days: [] };

  const cards = Array.from(container.querySelectorAll('.day-card'));

  const days = cards.map((card) => {
    const dateEl = card.querySelector('.day-date');
    const labelEl = card.querySelector('.day-label');
    const morningEl = card.querySelector('.day-morning');
    const afternoonEl = card.querySelector('.day-afternoon');
    const notesEl = card.querySelector('.day-notes');

    return {
      date: dateEl?.value || null,
      label: labelEl?.value || null,
      morning: morningEl?.value || null,
      afternoon: afternoonEl?.value || null,
      notes: notesEl?.value || null,
    };
  });

  return { days };
}

// Optional helper: auto-generate itinerary days from Trip start/end dates
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
      morning: '',
      afternoon: '',
      notes: '',
    });

    current.setDate(current.getDate() + 1);
    i += 1;
  }

  return { days };
}

// --- Tiny escaping helpers to avoid breaking markup if text contains quotes ---
function escapeAttr(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeText(value) {
  // textarea content is text; we just need to avoid `</textarea>` breaks
  return String(value).replaceAll('</textarea>', '&lt;/textarea&gt;');
}
