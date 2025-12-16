
// --- DEBUG: click + tab detection (remove later) ---
document.addEventListener(
  "click",
  (e) => {
    const tab = e.target.closest('[data-tab],[data-target],[aria-controls],[role="tab"],a[href^="#"]');
    console.log("[CLICK]", e.target, "| closestTab?", !!tab, tab ? tab.outerHTML.slice(0, 120) + "..." : "");
  },
  true // CAPTURE: logs even if something stops propagation
);

import { initTabs } from "./tabs.js";

window.addEventListener("DOMContentLoaded", () => {
  initTabs();
});

// js/app.mjs
'use strict';

import {
  renderPairingsFromModel,
  getPairingsModelFromDOM,
  getPlayersFromTextarea,
  makeFoursomes
} from './pairings.js';

window.__GTP_APP_LOADED__ = true;
console.log("[GTP] app.mjs running");

window.addEventListener("DOMContentLoaded", () => {
  // Try immediately
  initTabs({ debug: true });

  // Try a couple more times in case markup renders shortly after load
  setTimeout(() => initTabs({ debug: true }), 250);
  setTimeout(() => initTabs({ debug: true }), 1000);
});

window.addEventListener("gtp:tabchange", (e) => {
  const tab = e.detail?.tab;
  console.log("[GTP] tab change:", tab);

  // Call your per-tab render/init here (examples)
  // if (tab === "pairings") renderPairingsFromModel(getPairingsModelFromDOM());
  // if (tab === "scores")   renderScores();
  // if (tab === "settings") renderSettings();

  // If your app already has an init function per section, call it here.
});

const STORAGE_KEY = 'golfTripPlanner_pairings_v2';

let lastPlayersKey = '';

function debounce(fn, wait = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function loadModel() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { players: [], rounds: [] };
  } catch {
    return { players: [], rounds: [] };
  }
}

function saveModel(model) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
}

function reflowUnlockedRounds() {
  const model = getPairingsModelFromDOM();
  const players = getPlayersFromTextarea();
  model.players = players;

  model.rounds = model.rounds.map(r =>
    r.lockGroups ? r : { ...r, groups: makeFoursomes(players) }
  );

  renderPairingsFromModel(model);
  saveModel(model);
}

function wireTabsOnce() {
  // Prevent double-binding (you've had duplicate loads before)
  if (document.body.dataset.tabsWired === '1') return;
  document.body.dataset.tabsWired = '1';

  function showTab(tabId) {
    if (!tabId) return;

    // Toggle active button
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Show/hide panels
    document.querySelectorAll('.tab-panel').forEach((panel) => {
      panel.style.display = panel.id === tabId ? '' : 'none';
    });
  }

  // Delegated click handler (survives rerenders)
  document.addEventListener('click', (e) => {
    const btn = e.target?.closest?.('.tab-btn[data-tab]');
    if (!btn) return;
    e.preventDefault();

    const tabId = btn.dataset.tab;
    showTab(tabId);
  });

  // Initial tab: active button → else first button
  const initial =
    document.querySelector('.tab-btn.active')?.dataset.tab ||
    document.querySelector('.tab-btn[data-tab]')?.dataset.tab;

  // Only run if panels exist
  if (initial && document.getElementById(initial)) {
    showTab(initial);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const model = loadModel();
  renderPairingsFromModel(model);

  initTabs();

  // ✅ initialize once after initial render
  lastPlayersKey = (Array.isArray(model?.players) ? model.players : []).join('|');

  const playersInput = document.getElementById('playersInput');
  if (!playersInput) return;

  // Debounced input handler
  const onPlayersInput = debounce(() => {
    const playersNow = getPlayersFromTextarea();
    const key = playersNow.join('|');

    // Enter-only / whitespace-only changes → do nothing
    if (key === lastPlayersKey) return;

    lastPlayersKey = key;
    reflowUnlockedRoundsAndRender();
  }, 250);

  playersInput.addEventListener('input', onPlayersInput);

  // Prevent form submission on Enter
  playersInput.closest('form')?.addEventListener('submit', (e) => e.preventDefault());
});
