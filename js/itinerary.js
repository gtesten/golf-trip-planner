// js/itinerary.js
// Structured itinerary days UI + model

'use strict';

export function createDayCard(day = {}) {
  const card = document.createElement('div');
  card.className = 'day-card';

  card.innerHTML = `
    <div class="day-header">
      <div class="stack">
        <label>Date</label>
        <input type="date" class="day-date" value="${day.date || ''}">
      </div>

      <button class="small danger remove-day">✕ Remove</button>
    </div>

    <div class="grid">
      <div>
        <label>Morning</label>
        <textarea class="day-morning" placeholder="Travel, breakfast, warm-up...">${day.morning || ''}</textarea>
      </div>

      <div>
        <label>Afternoon</label>
        <textarea class="day-afternoon" placeholder="Tee time, lunch, activities...">${day.afternoon || ''}</textarea>
      </div>

      <div>
        <label>Evening / Notes</label>
        <textarea class="day-notes" placeholder="Dinner, drinks, notes...">${day.notes || ''}</textarea>
      </div>
    </div>
  `;

  card.querySelector('.remove-day').onclick = () => card.remove();

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
  const days = [];

  document.querySelectorAll('.day-card').forEach(card => {
    days.push({
      date: card.querySelector('.day-date')?.value || '',
      morning: card.querySelector('.day-morning')?.value || '',
      afternoon: card.querySelector('.day-afternoon')?.value || '',
      notes: card.querySelector('.day-notes')?.value || ''
    });
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
