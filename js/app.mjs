// js/app.mjs
// App orchestrator: tabs, buttons, state, Supabase CRUD, UI <-> data
'use strict';

import { supabaseClient, ensureAnonymousSession } from './supabaseClient.js';
import {
  renderItineraryFromModel,
  getItineraryModelFromDOM,
  createDayCard,
  generateDaysFromDateRange,
} from './itinerary.js';
import {
  renderPairingsFromModel,
  getPairingsModelFromDOM,
  createRoundCard,
  getPlayersFromTextarea,
} from './pairings.js';

console.log('[GolfTripPlanner] main.js loaded');
window.GTP = window.GTP || {};
window.GTP.__loadedAt = new Date().toISOString();
console.log('[GolfTripPlanner] main.js loaded at', window.GTP.__loadedAt);

window.addEventListener('error', (e) => {
  console.error('[GolfTripPlanner] window.error:', e.message, e.filename, e.lineno, e.colno, e.error);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[GolfTripPlanner] unhandledrejection:', e.reason);
});
console.log('[GolfTripPlanner] readyState on load:', document.readyState);

let currentTripPublicId = null;

// -----------------------------
// Toasts (non-blocking alerts)
// -----------------------------
function ensureToasts() {
  if (document.getElementById('toastHost')) return;
  const host = document.createElement('div');
  host.id = 'toastHost';
  host.style.position = 'fixed';
  host.style.right = '14px';
  host.style.bottom = '14px';
  host.style.display = 'flex';
  host.style.flexDirection = 'column';
  host.style.gap = '10px';
  host.style.zIndex = '9999';
  document.body.appendChild(host);
}

function toast(message, kind = 'info', timeout = 2200) {
  // ✅ dedupe to prevent waterfall spam (especially autosave)
  window.GTP = window.GTP || {};
  const key = `${kind}:${message}`;
  const now = Date.now();
  if (window.GTP.__lastToastKey === key && (now - (window.GTP.__lastToastAt || 0)) < 1200) return;
  window.GTP.__lastToastKey = key;
  window.GTP.__lastToastAt = now;

  ensureToasts();
  const host = document.getElementById('toastHost');
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.textContent = message;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 200);
  }, timeout);
}

// -----------------------------
// Status UI
// -----------------------------
function setStatus(text, mode = 'idle') {
  const statusText = document.getElementById('statusText');
  const statusDot = document.getElementById('statusDot');
  if (!statusText || !statusDot) return;

  statusText.textContent = text ?? '';

  statusDot.classList.remove('ok', 'error', 'loading');
  if (mode === 'ok') statusDot.classList.add('ok');
  else if (mode === 'error') statusDot.classList.add('error');
  else if (mode === 'loading') statusDot.classList.add('loading');
}

// -----------------------------
// Dirty tracking + autosave
// -----------------------------
let dirty = false;
let autosaveTimer = null;
let saveInFlight = null;

function markDirty(source = 'ui') {
  dirty = true;
  setStatus('Unsaved changes…', 'loading');

  // debounce autosave
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(async () => {
    if (!dirty) return;
    if (!currentTripPublicId) return; // don’t autosave until a trip exists
    try {
      await saveCurrentTrip({ silent: true });
    } catch (e) {
      console.warn('[GolfTripPlanner] autosave failed', e);
      // no toast spam on autosave; status is enough
      setStatus('Autosave failed — see console', 'error');
    }
  }, 1200);
}

function clearDirty() {
  dirty = false;
  setStatus('All changes saved.', 'ok');
}

function setupDirtyTracking() {
  // Mark dirty on most inputs
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (!t) return;
    // ignore the hidden JSON fields that we write into programmatically
    if (t.id === 'itineraryData' || t.id === 'pairingsData') return;
    markDirty('input');
  });
}

// -----------------------------
// Local storage
// -----------------------------
function loadStoredTripId() {
  try {
    const stored = localStorage.getItem('currentTripPublicId');
    if (stored && stored.trim()) {
      currentTripPublicId = stored;
      console.log('[GolfTripPlanner] Loaded stored trip id:', currentTripPublicId);
    }
  } catch (e) {
    console.warn('[GolfTripPlanner] Could not read currentTripPublicId:', e);
  }
}

function storeCurrentTripId(publicId) {
  currentTripPublicId = publicId;
  try {
    localStorage.setItem('currentTripPublicId', publicId);
  } catch (e) {
    console.warn('[GolfTripPlanner] Could not write currentTripPublicId:', e);
  }
}

// -----------------------------
// UI <-> Model serialization
// -----------------------------
function collectTripDataFromUI() {
  // Itinerary JSON stored in hidden textarea
  try {
    const itineraryModel = getItineraryModelFromDOM();
    const itineraryField = document.getElementById('itineraryData');
    if (itineraryField) itineraryField.value = JSON.stringify(itineraryModel);
  } catch (e) {
    console.warn('[GolfTripPlanner] Error serializing itinerary:', e);
  }

  // Pairings JSON stored in hidden textarea
  try {
    const pairingsModel = getPairingsModelFromDOM();
    const pairingsField = document.getElementById('pairingsData');
    if (pairingsField) pairingsField.value = JSON.stringify(pairingsModel);
  } catch (e) {
    console.warn('[GolfTripPlanner] Error serializing pairings:', e);
  }

  const nameInput = document.getElementById('tripName');
  const locationInput = document.getElementById('tripLocation');
  const startInput = document.getElementById('tripStartDate');
  const endInput = document.getElementById('tripEndDate');

  const itineraryArea = document.getElementById('itineraryData');
  const pairingsArea = document.getElementById('pairingsData');
  const expensesArea = document.getElementById('expensesData');
  const sharingArea = document.getElementById('sharingData');

  return {
    name: nameInput?.value?.trim() || null,
    location: locationInput?.value?.trim() || null,
    start_date: startInput?.value || null,
    end_date: endInput?.value || null,
    itinerary_data: itineraryArea?.value || null,
    pairings_data: pairingsArea?.value || null,
    expenses_data: expensesArea?.value || null,
    sharing_data: sharingArea?.value || null,
  };
}

function populateUIFromTripRow(tripRow) {
  if (!tripRow) return;

  // Trip details
  const nameInput = document.getElementById('tripName');
  const locationInput = document.getElementById('tripLocation');
  const startInput = document.getElementById('tripStartDate');
  const endInput = document.getElementById('tripEndDate');

  if (nameInput) nameInput.value = tripRow.name ?? '';
  if (locationInput) locationInput.value = tripRow.location ?? '';
  if (startInput && tripRow.start_date) startInput.value = tripRow.start_date;
  if (endInput && tripRow.end_date) endInput.value = tripRow.end_date;

  // Itinerary
  let itineraryModel = { days: [] };
  if (typeof tripRow.itinerary_data === 'string' && tripRow.itinerary_data.trim()) {
    try {
      itineraryModel = JSON.parse(tripRow.itinerary_data);
    } catch (e) {
      console.warn('[GolfTripPlanner] Could not parse itinerary_data:', e);
    }
  }
  renderItineraryFromModel(itineraryModel);

  // Pairings
  let pairingsModel = { players: [], rounds: [] };
  if (typeof tripRow.pairings_data === 'string' && tripRow.pairings_data.trim()) {
    try {
      pairingsModel = JSON.parse(tripRow.pairings_data);
    } catch (e) {
      console.warn('[GolfTripPlanner] Could not parse pairings_data:', e);
    }
  }
  renderPairingsFromModel(pairingsModel);

  // Expenses / sharing
  const expensesArea = document.getElementById('expensesData');
  const sharingArea = document.getElementById('sharingData');
  if (expensesArea) expensesArea.value = tripRow.expenses_data ?? '';
  if (sharingArea) sharingArea.value = tripRow.sharing_data ?? '';
}

// -----------------------------
// Sticky action bars (no duplicate IDs)
// -----------------------------
function setupStickyActionBars() {
  // ----- Itinerary bar -----
  const itineraryTab = document.getElementById('itineraryTab');
  if (itineraryTab && !document.getElementById('itineraryActionBar')) {
    const bar = document.createElement('div');
    bar.id = 'itineraryActionBar';
    bar.className = 'action-bar';
    bar.innerHTML = `
      <div class="left">
        <div class="title">🗓️ Itinerary</div>
        <div class="sub">Keep the main actions visible while you scroll.</div>
      </div>
      <div class="right"></div>
    `;
    itineraryTab.prepend(bar);

    const right = bar.querySelector('.right');

    // Move existing Add Day button (keeps ID, avoids duplicates)
    const addDayBtn = document.getElementById('addDayBtn');
    if (addDayBtn && right) right.appendChild(addDayBtn);

    // Add Generate Days button
    const genBtn = document.createElement('button');
    genBtn.type = 'button';
    genBtn.className = 'secondary small';
    genBtn.id = 'generateDaysBtn';
    genBtn.textContent = '📅 Generate Days';
    right?.prepend(genBtn);

    genBtn.addEventListener('click', () => {
      const start = document.getElementById('tripStartDate')?.value;
      const end = document.getElementById('tripEndDate')?.value;
      if (!start || !end) {
        toast('Set Start + End dates first', 'info');
        return;
      }
      renderItineraryFromModel(generateDaysFromDateRange(start, end));
      toast('Generated itinerary days', 'success');
      markDirty('itinerary');
    });

    // Remove old section bar if present (prevents double headers)
    const oldSectionBar = itineraryTab.querySelector('.section-bar');
    if (oldSectionBar) oldSectionBar.remove();
  }

  // ----- Pairings bar -----
  const pairingsTab = document.getElementById('pairingsTab');
  if (pairingsTab && !document.getElementById('pairingsActionBar')) {
    const bar = document.createElement('div');
    bar.id = 'pairingsActionBar';
    bar.className = 'action-bar';
    bar.innerHTML = `
      <div class="left">
        <div class="title">🏌️ Pairings & Scores</div>
        <div class="sub">Rounds + scoring controls stay visible.</div>
      </div>
      <div class="right" id="pairingsRightSlot"></div>
    `;
    pairingsTab.prepend(bar);

    const right = bar.querySelector('#pairingsRightSlot');

    // Add Auto-foursomes (clicks each round's internal button if present)
    const autoBtn = document.createElement('button');
    autoBtn.type = 'button';
    autoBtn.className = 'secondary small';
    autoBtn.id = 'autoFoursomesAllBtn';
    autoBtn.textContent = '👥 Auto Foursomes';
    right?.appendChild(autoBtn);

    autoBtn.addEventListener('click', () => {
      const cards = Array.from(document.querySelectorAll('#roundsContainer .round-card'));
      if (!cards.length) {
        toast('Add a round first', 'info');
        return;
      }
      let clicked = 0;
      cards.forEach((c) => {
        const b = c.querySelector('.auto-foursomes');
        if (b) {
          b.click();
          clicked += 1;
        }
      });
      toast(clicked ? 'Generated foursomes' : 'No foursomes button found in rounds yet', clicked ? 'success' : 'info');
      markDirty('pairings');
    });

    // Move existing Add Round button (keeps ID, avoids duplicates)
    const addRoundBtn = document.getElementById('addRoundBtn');
    if (addRoundBtn && right) right.appendChild(addRoundBtn);

    // Remove old "Rounds & Scores" section bars if present
    const oldBars = pairingsTab.querySelectorAll('.section-bar');
    oldBars.forEach((b) => {
      const title = b.querySelector('.section-title')?.textContent || '';
      if (title.toLowerCase().includes('round')) b.remove();
    });
  }
}

// -----------------------------
// Supabase CRUD
// -----------------------------
async function createNewTripAndLoad() {
  setStatus('Creating new trip…', 'loading');

  // Auto-generate days if empty and dates exist
  const existingItin = getItineraryModelFromDOM();
  const start = document.getElementById('tripStartDate')?.value;
  const end = document.getElementById('tripEndDate')?.value;

  if ((!existingItin.days || existingItin.days.length === 0) && start && end) {
    renderItineraryFromModel(generateDaysFromDateRange(start, end));
  }

  const tripData = collectTripDataFromUI();

  const { data, error } = await supabaseClient
    .from('trips')
    .insert({
      name: tripData.name,
      location: tripData.location,
      start_date: tripData.start_date,
      end_date: tripData.end_date,
      itinerary_data: tripData.itinerary_data,
      pairings_data: tripData.pairings_data,
      expenses_data: tripData.expenses_data,
      sharing_data: tripData.sharing_data,
    })
    .select('public_id, name, location, start_date, end_date, itinerary_data, pairings_data, expenses_data, sharing_data')
    .single();

  if (error) {
    console.error('[GolfTripPlanner] Error creating trip:', error);
    setStatus('Error creating trip – see console.', 'error');
    toast('Error creating trip — see console.', 'error', 3500);
    throw error;
  }

  storeCurrentTripId(data.public_id);
  populateUIFromTripRow(data);
  clearDirty();
  toast('New trip created', 'success');
}

async function loadTripFromSupabase(publicId) {
  if (!publicId) return;

  setStatus('Loading trip…', 'loading');

  const { data, error } = await supabaseClient
    .from('trips')
    .select('public_id, name, location, start_date, end_date, itinerary_data, pairings_data, expenses_data, sharing_data')
    .eq('public_id', publicId)
    .single();

  if (error) {
    console.error('[GolfTripPlanner] Error loading trip:', error);
    setStatus('Error loading trip – see console.', 'error');
    toast('Error loading trip — see console.', 'error', 3500);
    throw error;
  }

  storeCurrentTripId(data.public_id);
  populateUIFromTripRow(data);
  clearDirty();
  toast('Trip loaded', 'success');
}

async function saveCurrentTrip(opts = {}) {
  const silent = !!opts.silent;

  // Prevent overlapping saves (autosave + manual)
  if (saveInFlight) return saveInFlight;

  // Auto-generate days if empty and dates exist
  const existingItin = getItineraryModelFromDOM();
  const start = document.getElementById('tripStartDate')?.value;
  const end = document.getElementById('tripEndDate')?.value;
  if ((!existingItin.days || existingItin.days.length === 0) && start && end) {
    renderItineraryFromModel(generateDaysFromDateRange(start, end));
  }

  const doSave = async () => {
    const tripData = collectTripDataFromUI();

    // If no trip id yet, create
    if (!currentTripPublicId) {
      await createNewTripAndLoad();
      return;
    }

    setStatus(silent ? 'Autosaving…' : 'Saving trip…', 'loading');

    const { error } = await supabaseClient
      .from('trips')
      .update({
        name: tripData.name,
        location: tripData.location,
        start_date: tripData.start_date,
        end_date: tripData.end_date,
        itinerary_data: tripData.itinerary_data,
        pairings_data: tripData.pairings_data,
        expenses_data: tripData.expenses_data,
        sharing_data: tripData.sharing_data,
      })
      .eq('public_id', currentTripPublicId);

    if (error) {
      console.error('[GolfTripPlanner] Error saving trip:', error);
      setStatus('Error saving trip – see console.', 'error');
      if (!silent) toast('Error saving trip — see console.', 'error', 3500);
      throw error;
    }

    clearDirty();
    if (!silent) toast('Trip saved', 'success');
  };

  saveInFlight = doSave().finally(() => {
    saveInFlight = null;
  });

  return saveInFlight;
}

// -----------------------------
// Tabs + Buttons
// -----------------------------
function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');

      tabButtons.forEach((b) => b.classList.remove('active'));
      panels.forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(tabId)?.classList.add('active');
    });
  });
}

function setupButtons() {
  console.log('[GolfTripPlanner] setupButtons starting…');

  document.getElementById('saveTripBtn')?.addEventListener('click', async () => {
    console.log('[GolfTripPlanner] saveTripBtn clicked');
    try {
      await saveCurrentTrip({ silent: false });
    } catch {}
  });

  document.getElementById('reloadTripBtn')?.addEventListener('click', async () => {
    console.log('[GolfTripPlanner] reloadTripBtn clicked');
    if (!currentTripPublicId) {
      toast('No trip loaded yet. Save or create a trip first.', 'info');
      return;
    }
    try {
      await loadTripFromSupabase(currentTripPublicId);
    } catch {}
  });

  document.getElementById('clearLocalBtn')?.addEventListener('click', () => {
    console.log('[GolfTripPlanner] clearLocalBtn clicked');
    try { localStorage.removeItem('currentTripPublicId'); } catch {}
    currentTripPublicId = null;
    setStatus('Local trip ID cleared. Create or save a trip.', 'idle');
    toast('Cleared local trip id', 'info');
  });

  document.getElementById('debugBtn')?.addEventListener('click', () => {
    console.log('[GolfTripPlanner] debugBtn clicked');
    console.log('[GolfTripPlanner] currentTripPublicId:', currentTripPublicId);
    console.log('[GolfTripPlanner] UI trip data:', collectTripDataFromUI());
    toast('Debug info logged to console', 'info');
  });

  // Delegated clicks: Add Day / Add Round
  document.addEventListener('click', (e) => {
    const addDay = e.target.closest?.('#addDayBtn');
    if (addDay) {
      console.log('[GolfTripPlanner] Add Day clicked');
      const container = document.getElementById('itineraryDaysContainer');
      if (!container) {
        console.warn('[GolfTripPlanner] itineraryDaysContainer missing');
        return;
      }
      container.appendChild(createDayCard());
      container.lastElementChild?.querySelector('textarea')?.focus();
      markDirty('itinerary');
      return;
    }

    const addRound = e.target.closest?.('#addRoundBtn');
    if (addRound) {
      console.log('[GolfTripPlanner] Add Round clicked');
      const roundsContainer = document.getElementById('roundsContainer');
      if (!roundsContainer) {
        console.warn('[GolfTripPlanner] roundsContainer missing');
        return;
      }

      const card = createRoundCard({}, getPlayersFromTextarea());
      roundsContainer.appendChild(card);
      card.querySelector('.round-course')?.focus?.();
      markDirty('pairings');
      return;
    }
  });

  // Diagnostics
  const addDayBtn = document.getElementById('addDayBtn');
  const addRoundBtn = document.getElementById('addRoundBtn');

  if (addDayBtn) console.log('[GolfTripPlanner] addDayBtn rect', addDayBtn.getBoundingClientRect());
  if (addRoundBtn) console.log('[GolfTripPlanner] addRoundBtn rect', addRoundBtn.getBoundingClientRect());
}

// Keyboard shortcut: Ctrl/Cmd+S
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    const isSave = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's';
    if (!isSave) return;
    e.preventDefault();
    saveCurrentTrip({ silent: false }).catch(() => {});
  });
}

// -----------------------------
// Init
// -----------------------------
async function initGolfTripPlanner() {
  setStatus('Initializing Golf Trip Planner…', 'loading');

  setupTabs();
  setupButtons();
  setupDirtyTracking();
  setupKeyboardShortcuts();

  // Initial empty UI before Supabase
  renderItineraryFromModel({ days: [] });
  // Initial empty UI before Supabase
  renderItineraryFromModel({ days: [] });

  // Pairings: seed players from textarea so the first/default table shows everyone
  const seedPairings = getPairingsModelFromDOM?.() || { players: [], rounds: [] };
  seedPairings.players = getPlayersFromTextarea();
  renderPairingsFromModel(seedPairings);

  // When players list changes, re-render pairings so rows stay aligned
  document.getElementById('playersInput')?.addEventListener('input', () => {
  const m = getPairingsModelFromDOM() || { players: [], rounds: [] };
  m.players = getPlayersFromTextarea();
  renderPairingsFromModel(m);
  markDirty('pairings');
  });

  // Build sticky bars AFTER the base DOM exists (and after initial render)
  setupStickyActionBars();

  console.log('[GolfTripPlanner] initGolfTripPlanner finished wiring UI');

  await ensureAnonymousSession(setStatus);

  loadStoredTripId();
  if (currentTripPublicId) {
    try {
      await loadTripFromSupabase(currentTripPublicId);
    } catch {
      // keep app usable even if load fails
      setStatus('Ready (load failed). You can still create/save.', 'error');
    }
  } else {
    setStatus('Ready. Create a new trip or fill fields and Save.', 'ok');
  }
}

function boot() {
  console.log('[GolfTripPlanner] boot() starting');
  initGolfTripPlanner().catch((err) => {
    console.error('[GolfTripPlanner] init error:', err);
    setStatus('Init error – see console.', 'error');
    toast('Init error — see console', 'error', 3500);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[GolfTripPlanner] DOMContentLoaded fired');
    boot();
  });
} else {
  console.log('[GolfTripPlanner] DOM already ready:', document.readyState);
  boot();
}
