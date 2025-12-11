// app.js
// Minimal, “safe” version with extra logging so we know it's actually running.

'use strict';

// ===============================
// 1. Supabase Client Setup
// ===============================

// TODO: REPLACE THESE with your actual values:
const SUPABASE_URL = 'https://qnfwckmwbudvuijqlkns.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_y5qYE-uYPTtNrdM0vI5tJA_V8IA29U1';

// Quick sanity log
console.log('[GolfTripPlanner] app.js loaded');

if (!window.supabase) {
  console.error('[GolfTripPlanner] window.supabase is not defined. Check the Supabase <script> tag order.');
}

// Use global supabase object
const { createClient } = window.supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Current trip UUID (trips.public_id)
let currentTripPublicId = null;

// ===============================
// 2. Status Helpers
// ===============================

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

// ===============================
// 3. Local Storage Helpers
// ===============================

function loadStoredTripId() {
  try {
    const stored = localStorage.getItem('currentTripPublicId');
    if (stored && typeof stored === 'string' && stored.trim() !== '') {
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

// ===============================
// 4. Anonymous Auth
// ===============================

async function ensureAnonymousSession() {
  setStatus('Checking session…', 'loading');

  const { data: sessionData, error: sessionError } =
    await supabaseClient.auth.getSession();

  if (sessionError) {
    console.error('[GolfTripPlanner] getSession error:', sessionError);
  }

  if (sessionData && sessionData.session) {
    setStatus('Anonymous session active', 'ok');
    return;
  }

  setStatus('Signing in anonymously…', 'loading');

  const { data, error } = await supabaseClient.auth.signInAnonymously();

  if (error) {
    console.error('[GolfTripPlanner] signInAnonymously error:', error);
    setStatus('Anon auth failed – check console.', 'error');
    return;
  }

  console.log('[GolfTripPlanner] Anonymous session started:', data);
  setStatus('Anonymous session active', 'ok');
}

// ===============================
// 5. UI ↔ Data
// ===============================

function collectTripDataFromUI() {
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

  const nameInput = document.getElementById('tripName');
  const locationInput = document.getElementById('tripLocation');
  const startInput = document.getElementById('tripStartDate');
  const endInput = document.getElementById('tripEndDate');

  const itineraryArea = document.getElementById('itineraryData');
  const pairingsArea = document.getElementById('pairingsData');
  const expensesArea = document.getElementById('expensesData');
  const sharingArea = document.getElementById('sharingData');

  if (nameInput) nameInput.value = tripRow.name ?? '';
  if (locationInput) locationInput.value = tripRow.location ?? '';
  if (startInput && tripRow.start_date) startInput.value = tripRow.start_date;
  if (endInput && tripRow.end_date) endInput.value = tripRow.end_date;

  if (itineraryArea) itineraryArea.value = tripRow.itinerary_data ?? '';
  if (pairingsArea) pairingsArea.value = tripRow.pairings_data ?? '';
  if (expensesArea) expensesArea.value = tripRow.expenses_data ?? '';
  if (sharingArea) sharingArea.value = tripRow.sharing_data ?? '';
}

// ===============================
// 6. Supabase – Trips CRUD
// ===============================

async function createNewTripAndLoad() {
  setStatus('Creating new trip…', 'loading');

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
    .select(
      'public_id, name, location, start_date, end_date, itinerary_data, pairings_data, expenses_data, sharing_data'
    )
    .single();

  if (error) {
    console.error('[GolfTripPlanner] Error creating trip:', error);
    setStatus('Error creating trip – see console.', 'error');
    alert('Error creating trip. Check the console for details.');
    return;
  }

  const publicId = data.public_id;
  storeCurrentTripId(publicId);
  populateUIFromTripRow(data);

  console.log('[GolfTripPlanner] New trip created with public_id:', publicId);
  setStatus('New trip created & loaded.', 'ok');
}

async function loadTripFromSupabase(publicId) {
  if (!publicId) {
    console.warn('[GolfTripPlanner] loadTripFromSupabase called without publicId');
    return;
  }

  setStatus('Loading trip…', 'loading');

  const { data, error } = await supabaseClient
    .from('trips')
    .select(
      'public_id, name, location, start_date, end_date, itinerary_data, pairings_data, expenses_data, sharing_data'
    )
    .eq('public_id', publicId)
    .single();

  if (error) {
    console.error('[GolfTripPlanner] Error loading trip:', error);
    setStatus('Error loading trip – see console.', 'error');
    alert('Error loading trip. Check the console for details.');
    return;
  }

  storeCurrentTripId(data.public_id);
  populateUIFromTripRow(data);

  console.log('[GolfTripPlanner] Loaded trip:', data.public_id);
  setStatus('Trip loaded from Supabase.', 'ok');
}

async function saveCurrentTrip() {
  const tripData = collectTripDataFromUI();

  if (!currentTripPublicId) {
    // No trip yet – create one
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
    alert('Error saving trip. Check the console for details.');
    return;
  }

  console.log('[GolfTripPlanner] Trip saved:', currentTripPublicId);
  setStatus('Trip saved successfully.', 'ok');
}

// ===============================
// 7. Tabs
// ===============================

function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');

      tabButtons.forEach((b) => b.classList.remove('active'));
      panels.forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      const panel = document.getElementById(tabId);
      if (panel) panel.classList.add('active');
    });
  });
}

// ===============================
// 8. Buttons
// ===============================

function setupButtons() {
  const newBtn = document.getElementById('newTripBtn');
  const saveBtn = document.getElementById('saveTripBtn');
  const reloadBtn = document.getElementById('reloadTripBtn');
  const clearLocalBtn = document.getElementById('clearLocalBtn');
  const debugBtn = document.getElementById('debugBtn');

  if (newBtn) {
    newBtn.addEventListener('click', () => {
      createNewTripAndLoad();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      saveCurrentTrip();
    });
  }

  if (reloadBtn) {
    reloadBtn.addEventListener('click', () => {
      if (!currentTripPublicId) {
        alert('No current trip ID stored. Create or save a trip first.');
        return;
      }
      loadTripFromSupabase(currentTripPublicId);
    });
  }

  if (clearLocalBtn) {
    clearLocalBtn.addEventListener('click', () => {
      try {
        localStorage.removeItem('currentTripPublicId');
      } catch (e) {
        console.warn('[GolfTripPlanner] Error clearing local trip id:', e);
      }
      currentTripPublicId = null;
      setStatus('Local trip ID cleared. Create or save a trip.', 'idle');
    });
  }

  if (debugBtn) {
    debugBtn.addEventListener('click', () => {
      console.log('[GolfTripPlanner] currentTripPublicId:', currentTripPublicId);
      console.log('[GolfTripPlanner] current UI data:', collectTripDataFromUI());
      alert('Debug info logged to console.');
    });
  }
}

// ===============================
// 9. Init
// ===============================

async function initGolfTripPlanner() {
  console.log('[GolfTripPlanner] initGolfTripPlanner starting');
  setStatus('Initializing Golf Trip Planner…', 'loading');

  setupTabs();
  setupButtons();

  await ensureAnonymousSession();

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
    console.error('[GolfTripPlanner] Error during init:', err);
    setStatus('Init error – see console.', 'error');
  });
});
