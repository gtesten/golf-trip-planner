// js/app.mjs
import { loadModel, saveModel } from "./storage.js";
import { initTabs, setActiveTab } from "./tabs.js";

import { renderOverview, bindOverviewUI } from "./overview.js";
import { renderItinerary, bindItineraryUI } from "./itinerary.js";
import { renderPairings, bindPairingsUI } from "./pairings.js";
import { renderTripDetails, bindTripDetailsUI } from "./tripDetails.js";

import { readShareModelFromUrl } from "./share.js";

console.log("[GolfTripPlanner] app.mjs loaded");

// --- Load model (must be re-assignable) ---
let model = loadModel();

// --- Share mode detection ---
const shared = readShareModelFromUrl();
if (shared) {
  window.__GTP_READONLY__ = true;
  model = shared;
} else {
  window.__GTP_READONLY__ = false;
}

// --- Global save guard (optional safety net) ---
const _saveModel = saveModel;
window.__GTP_SAVE__ = (m) => {
  if (window.__GTP_READONLY__) return;
  _saveModel(m);
};

// --- Utilities to force Overview-only UI in share mode ---
function enterShareModeOverviewOnly() {
  document.body.classList.add("share-mode");

  // Hide all tab buttons
  document.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.style.display = "none";
  });

  // Hide all panels
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.style.display = "none";
  });

  // Show Overview tab button + panel only (if present)
  const overviewBtn = document.querySelector('[data-tab="overview"]');
  const overviewPanel = document.querySelector('[data-panel="overview"]');

  if (overviewBtn) overviewBtn.style.display = "";
  if (overviewPanel) overviewPanel.style.display = "";

  // Render Overview only
  renderOverview(model);

  // Bind overview UI (should internally disable editing in read-only mode)
  if (typeof bindOverviewUI === "function") bindOverviewUI(model);
}

function enterNormalMode() {
  // Tabs + bindings
  initTabs();

  if (typeof bindOverviewUI === "function") bindOverviewUI(model);
  if (typeof bindItineraryUI === "function") bindItineraryUI(model);
  if (typeof bindPairingsUI === "function") bindPairingsUI(model);
  if (typeof bindTripDetailsUI === "function") bindTripDetailsUI(model);

  // Initial renders
  renderOverview(model);
  renderItinerary(model);
  renderPairings(model);
  renderTripDetails(model);

  setActiveTab("overview");
}

// --- Boot ---
if (window.__GTP_READONLY__) {
  enterShareModeOverviewOnly();
} else {
  enterNormalMode();
}

// Optional: expose for debugging
window.__GTP_MODEL__ = model;
