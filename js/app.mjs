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
  ensureToasts();
  const host = document.getElementById('toastHost');
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.textContent = message;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');toast('Trip saved.', 'success');
    toast('Error saving trip — see console.', 'error', 3500);

    setTimeout(() => el.remove(), 200);
  }, timeout);
}

// -----------------------------
// Save badge + autosave
// -----------------------------
let dirty = false;
let autosaveTimer = null;

function ensureSaveBadge() {
  const statusBar = document.getElementById('statusBar');
  if (!statusBar) return;
  if (document.getElementById('saveStatus')) return;

  const badge = document.createElement('span');
  badge.id = 'saveStatus';
  badge.style.marginLeft = '10px';
  badge.style.padding = '2px 10px';
  badge.style.borderRadius = '999px';
  badge.style.fontSize = '0.8rem';
  badge.style.background = 'rgba(255,255,255,.18)';
  badge.style.border = '1px solid rgba(255,255,255,.18)';
  badge.textContent = 'Saved';
  statusBar.appendChild(badge);
}

function setSaveStatus(text, isDirty) {
  ensureSaveBadge();
  const el = document.getElementById('saveStatus');
  if (!el) return;
  el.textContent = text;
  el.style.background = isDirty ? 'rgba(249,115,22,.25)' : 'rgba(255,255,255,.18)';
}

function markDirty(source = '') {
  dirty = true;
  setSaveStatus(`Unsaved${source ? ` (${source})` : ''}`, true);

  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(async () => {
    try {
      await saveCurrentTrip({ silent: true });
      dirty = false;
      setSaveStatus('Saved', false);
    } catch (e) {
      console.error('[GolfTripPlanner] autosave failed', e);
      setSaveStatus('Save failed', true);
    }
  }, 950);
}

window.addEventListener('beforeunload', (e) => {
  if (!dirty) return;
  e.preventDefault();
  e.returnValue = '';
});

// -----------------------------
// Stableford toggle state + UI
// -----------------------------
const stablefordState = { enabled: false, net: true };

function getStablefordMode() {
  return { ...stablefordState };
}

function ensurePairingsToolbar() {
  const pairingsTab = document.getElementById('pairingsTab');
  if (!pairingsTab) return;
  if (document.getElementById('pairingsToolbar')) return;

  const toolbar = document.createElement('div');
  toolbar.id = 'pairingsToolbar';
  toolbar.style.display = 'flex';
  toolbar.style.flexWrap = 'wrap';
  toolbar.style.gap = '0.5rem';
  toolbar.style.alignItems = 'center';
  toolbar.style.margin = '0.25rem 0 0.75rem 0';

  toolbar.innerHTML = `
    <button type="button" class="secondary small" id="stablefordToggleBtn">🏆 Stableford: Off</button>
    <button type="button" class="secondary small" id="stablefordModeBtn" disabled>Net</button>
    <span class="hint" style="margin:0;">Stableford uses each round’s ⛳ Setup (Par + SI).</span>
  `;

  const stack = pairingsTab.querySelector('.stack');
  if (stack) stack.prepend(toolbar);
  else pairingsTab.prepend(toolbar);

  const toggleBtn = toolbar.querySelector('#stablefordToggleBtn');
  const modeBtn = toolbar.querySelector('#stablefordModeBtn');

  toggleBtn.addEventListener('click', () => {
    stablefordState.enabled = !stablefordState.enabled;
    toggleBtn.textContent = `🏆 Stableford: ${stablefordState.enabled ? 'On' : 'Off'}`;
    modeBtn.disabled = !stablefordState.enabled;

    rerenderPairingsFromDOM();
    markDirty('pairings');
  });

  modeBtn.addEventListener('click', () => {
    stablefordState.net = !stablefordState.net;
    modeBtn.textContent = stablefordState.net ? 'Net' : 'Gross';

    rerenderPairingsFromDOM();
    markDirty('pairings');
  });
}

function rerenderPairingsFromDOM() {
  const model = getPairingsModelFromDOM();
  renderPairingsFromModel(model, { getStablefordMode });
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

  // Pairings first (so itinerary round-link dropdowns can populate)
  let pairingsModel = { players: [], rounds: [] };
  if (typeof tripRow.pairings_data === 'string' && tripRow.pairings_data.trim()) {
    try {
      pairingsModel = JSON.parse(tripRow.pairings_data);
    } catch (e) {
      console.warn('[GolfTripPlanner] Could not parse pairings_data:', e);
    }
  }
  ensurePairingsToolbar();
  renderPairingsFromModel(pairingsModel, { getStablefordMode });

  // Itinerary (now supports structured blocks + round linking)
  let itineraryModel = { days: [] };
  if (typeof tripRow.itinerary_data === 'string' && tripRow.itinerary_data.trim()) {
    try {
      itineraryModel = JSON.parse(tripRow.itinerary_data);
    } catch (e) {
      console.warn('[GolfTripPlanner] Could not parse itinerary_data:', e);
    }
  }
  renderItineraryFromModel(itineraryModel, { pairingsModel });

  // Expenses / sharing
  const expensesArea = document.getElementById('expensesData');
  const sharingArea = document.getElementById('sharingData');
  if (expensesArea) expensesArea.value = tripRow.expenses_data ?? '';
  if (sharingArea) sharingArea.value = tripRow.sharing_data ?? '';
}

// -----------------------------
// Supabase CRUD
// -----------------------------
async function createNewTripAndLoad() {
  setStatus('Creating new trip…', 'loading');

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
    alert('Error creating trip. Check console for details.');
    return;
  }

  storeCurrentTripId(data.public_id);
  populateUIFromTripRow(data);
  setStatus('New trip created & loaded.', 'ok');

  dirty = false;
  setSaveStatus('Saved', false);
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
    alert('Error loading trip. Check console for details.');
    return;
  }

  storeCurrentTripId(data.public_id);
  populateUIFromTripRow(data);
  setStatus('Trip loaded from Supabase.', 'ok');

  dirty = false;
  setSaveStatus('Saved', false);
}

async function saveCurrentTrip({ silent = false } = {}) {
  const existingItin = getItineraryModelFromDOM();
  const start = document.getElementById('tripStartDate')?.value;
  const end = document.getElementById('tripEndDate')?.value;

  if ((!existingItin.days || existingItin.days.length === 0) && start && end) {
    renderItineraryFromModel(generateDaysFromDateRange(start, end));
  }

  const tripData = collectTripDataFromUI();

  if (!currentTripPublicId) {
    await createNewTripAndLoad();
    return;
  }

  if (!silent) setStatus('Saving trip…', 'loading');

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
    if (!silent) setStatus('Error saving trip – see console.', 'error');
    if (!silent) toast('Error loading trip — see console.', 'error', 3500);
    throw error;
  }

  if (!silent) toast('Trip saved', 'success');
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

  document.getElementById('newTripBtn')?.addEventListener('click', () => {
    console.log('[GolfTripPlanner] newTripBtn clicked');
    createNewTripAndLoad();
  });

  document.getElementById('saveTripBtn')?.addEventListener('click', () => {
    console.log('[GolfTripPlanner] saveTripBtn clicked');
    saveCurrentTrip({ silent: false }).then(() => {
      dirty = false;
      setSaveStatus('Saved', false);
    });
  });

  document.getElementById('reloadTripBtn')?.addEventListener('click', async () => {
    console.log('[GolfTripPlanner] reloadTripBtn clicked');
    if (!currentTripPublicId) {
      toast('No trip loaded yet. Save or create a trip first.', 'info');
      return;
    }
    await loadTripFromSupabase(currentTripPublicId);
  });

  document.getElementById('clearLocalBtn')?.addEventListener('click', () => {
    console.log('[GolfTripPlanner] clearLocalBtn clicked');
    try { localStorage.removeItem('currentTripPublicId'); } catch {}
    currentTripPublicId = null;
    setStatus('Local trip ID cleared. Create or save a trip.', 'idle');
  });

  document.getElementById('debugBtn')?.addEventListener('click', () => {
    console.log('[GolfTripPlanner] debugBtn clicked');
    console.log('[GolfTripPlanner] currentTripPublicId:', currentTripPublicId);
    console.log('[GolfTripPlanner] UI trip data:', collectTripDataFromUI());
    alert('Debug info logged to console.');
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
      container.appendChild(createDayCard({}, { pairingsModel: getPairingsModelFromDOM() }));
      container.lastElementChild.querySelector('textarea')?.focus();
      markDirty('itinerary');
    }

    const addRound = e.target.closest?.('#addRoundBtn');
    if (addRound) {
      console.log('[GolfTripPlanner] Add Round clicked');
      const roundsContainer = document.getElementById('roundsContainer');
      if (!roundsContainer) {
        console.warn('[GolfTripPlanner] roundsContainer missing');
        return;
      }
      roundsContainer.appendChild(createRoundCard({ id: crypto.randomUUID() }, getPlayersFromTextarea(), { getStablefordMode }));
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

// -----------------------------
// Dirty tracking
// -----------------------------
function setupDirtyTracking() {
  document.addEventListener('input', (e) => {
    const inMain = e.target?.closest('main');
    if (!inMain) return;

    if (e.target?.id === 'itineraryData' || e.target?.id === 'pairingsData') return;

    const src = e.target.closest('#pairingsTab')
      ? 'pairings'
      : e.target.closest('#itineraryTab')
        ? 'itinerary'
        : e.target.closest('#detailsTab')
          ? 'details'
          : e.target.closest('#expensesTab')
            ? 'expenses'
            : e.target.closest('#sharingTab')
              ? 'sharing'
              : '';

    markDirty(src);
  });
}

// -----------------------------
// Init
// -----------------------------
async function initGolfTripPlanner() {
  ensureSaveBadge();
  setSaveStatus('Saved', false);

  setStatus('Initializing Golf Trip Planner…', 'loading');

  setupTabs();
  setupButtons();
  setupDirtyTracking();
  console.log('[GolfTripPlanner] initGolfTripPlanner finished wiring UI');

  document.addEventListener('keydown', (e) => {
  const isSave = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's';
  if (isSave) {
    e.preventDefault();
    saveCurrentTrip({ silent: false })
      .then(() => toast('Saved', 'success'))
      .catch(() => toast('Save failed — see console', 'error', 3500));
  }
});

  // Initial empty UI before Supabase
  renderItineraryFromModel({ days: [] }, { pairingsModel: { rounds: [] } });
  ensurePairingsToolbar();
  renderPairingsFromModel({ players: [], rounds: [] }, { getStablefordMode });

  await ensureAnonymousSession(setStatus);

  loadStoredTripId();
  if (currentTripPublicId) {
    await loadTripFromSupabase(currentTripPublicId);
  } else {
    setStatus('Ready. Create a new trip or fill fields and Save.', 'ok');
  }
}

function boot() {
  console.log('[GolfTripPlanner] boot() starting');
  initGolfTripPlanner().catch((err) => {
    console.error('[GolfTripPlanner] init error:', err);
    setStatus('Init error – see console.', 'error');
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
