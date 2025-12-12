// js/main.js
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
    alert('Error creating trip. Check console for details.');
    return;
  }

  storeCurrentTripId(data.public_id);
  populateUIFromTripRow(data);
  setStatus('New trip created & loaded.', 'ok');
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
}

async function saveCurrentTrip() {
  // Auto-generate days if empty and dates exist
  const existingItin = getItineraryModelFromDOM();
  const start = document.getElementById('tripStartDate')?.value;
  const end = document.getElementById('tripEndDate')?.value;

  if ((!existingItin.days || existingItin.days.length === 0) && start && end) {
    renderItineraryFromModel(generateDaysFromDateRange(start, end));
  }

  const tripData = collectTripDataFromUI();

  // If no trip id yet, create
  if (!currentTripPublicId) {
    await createNewTripAndLoad();
    return;
  }

  setStatus('Saving trip…', 'loading');

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
    alert('Error saving trip. Check console for details.');
    return;
  }

  setStatus('Trip saved successfully.', 'ok');
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
  document.getElementById('newTripBtn')?.addEventListener('click', createNewTripAndLoad);
  document.getElementById('saveTripBtn')?.addEventListener('click', saveCurrentTrip);

  document.getElementById('reloadTripBtn')?.addEventListener('click', async () => {
    if (!currentTripPublicId) {
      alert('No current trip ID stored. Create or save a trip first.');
      return;
    }
    await loadTripFromSupabase(currentTripPublicId);
  });

  document.getElementById('clearLocalBtn')?.addEventListener('click', () => {
    try {
      localStorage.removeItem('currentTripPublicId');
    } catch (e) {
      console.warn('[GolfTripPlanner] Error clearing local trip id:', e);
    }
    currentTripPublicId = null;
    setStatus('Local trip ID cleared. Create or save a trip.', 'idle');
  });

  document.getElementById('debugBtn')?.addEventListener('click', () => {
    console.log('[GolfTripPlanner] currentTripPublicId:', currentTripPublicId);
    console.log('[GolfTripPlanner] UI trip data:', collectTripDataFromUI());
    alert('Debug info logged to console.');
  });

  // Itinerary: Add Day
  document.getElementById('addDayBtn')?.addEventListener('click', () => {
    document.getElementById('itineraryDaysContainer')?.appendChild(createDayCard());
  });

  // Pairings: Add Round
  document.getElementById('addRoundBtn')?.addEventListener('click', () => {
    const roundsContainer = document.getElementById('roundsContainer');
    if (!roundsContainer) return;
    roundsContainer.appendChild(createRoundCard({}, getPlayersFromTextarea()));
  });
}

// -----------------------------
// Init
// -----------------------------
async function initGolfTripPlanner() {
  setStatus('Initializing Golf Trip Planner…', 'loading');

  setupTabs();
  setupButtons();

  // Initial empty UI before Supabase
  renderItineraryFromModel({ days: [] });
  renderPairingsFromModel({ players: [], rounds: [] });

  await ensureAnonymousSession(setStatus);

  loadStoredTripId();
  if (currentTripPublicId) {
    await loadTripFromSupabase(currentTripPublicId);
  } else {
    setStatus('Ready. Create a new trip or fill fields and Save.', 'ok');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('[GolfTripPlanner] DOMContentLoaded fired');
  initGolfTripPlanner().catch((err) => {
    console.error('[GolfTripPlanner] init error:', err);
    setStatus('Init error – see console.', 'error');
  });
});
