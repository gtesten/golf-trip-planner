// js/app.mjs
import { loadModel, saveModel } from "./storage.js";
import { initTabs, setActiveTab } from "./tabs.js";

import * as overview from "./overview.js";
import * as itinerary from "./itinerary.js";
import * as pairings from "./pairings.js";
import * as tripDetails from "./tripDetails.js";

import { readShareModelFromUrl } from "./share.js";

console.log("[GolfTripPlanner] app.mjs loaded");

function safeCall(fn, ...args) {
  try {
    if (typeof fn === "function") return fn(...args);
  } catch (e) {
    console.error("[GolfTripPlanner] error calling function:", fn?.name || fn, e);
  }
  return undefined;
}

// model must be re-assignable
let model = loadModel();

// Share mode detection
const shared = readShareModelFromUrl();
if (shared) {
  window.__GTP_READONLY__ = true;
  model = shared;
} else {
  window.__GTP_READONLY__ = false;
}

// Guard saves in share mode (so nothing persists / loops)
const _save = saveModel;
window.__GTP_SAVE__ = (m) => {
  if (window.__GTP_READONLY__) return;
  _save(m);
};

function enterShareModeOverviewOnly() {
  document.body.classList.add("share-mode");

  // Hide all tab buttons
  document.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.style.display = "none";
  });

  // Hide all panels
  document.querySelectorAll("[data-panel]").forEach((p) => {
    p.style.display = "none";
  });

  // Show only Overview button/panel (if present)
  const overviewBtn = document.querySelector('[data-tab="overview"]');
  const overviewPanel = document.querySelector('[data-panel="overview"]');
  if (overviewBtn) overviewBtn.style.display = "";
  if (overviewPanel) overviewPanel.style.display = "";

  // Render Overview only (read-only)
  safeCall(overview.renderOverview, model);
  safeCall(overview.bindOverviewUI, model);
}

function bootNormalMode() {
  // Tabs
  safeCall(initTabs);

  // Bind UI handlers
  safeCall(overview.bindOverviewUI, model);
  safeCall(itinerary.bindItineraryUI, model);
  safeCall(pairings.bindPairingsUI, model);

  // Trip Details: your file uses renderTrip(model)
  safeCall(tripDetails.renderTrip, model);

  // Render all tab content
  safeCall(overview.renderOverview, model);
  safeCall(itinerary.renderItinerary, model);
  safeCall(pairings.renderPairings, model);
  safeCall(tripDetails.renderTrip, model); // safe to call again; your render likely binds + redraws

  // Default tab
  safeCall(setActiveTab, "overview");
}

// Boot
if (window.__GTP_READONLY__) {
  enterShareModeOverviewOnly();
} else {
  bootNormalMode();
}

// Debug handle
window.__GTP_MODEL__ = model;
