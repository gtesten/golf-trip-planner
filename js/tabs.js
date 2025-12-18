// js/app.mjs
import { loadModel, saveModel } from "./storage.js";
import { initTabs } from "./tabs.js";

import * as overview from "./overview.js";
import * as itinerary from "./itinerary.js";
import * as pairings from "./pairings.js";
import * as tripDetails from "./tripDetails.js";
import * as settings from "./settings.js";

import { readShareModelFromUrl } from "./share.js";

console.log("[GolfTripPlanner] app.mjs loaded");

function safeCall(fn, ...args) {
  try {
    if (typeof fn === "function") return fn(...args);
  } catch (e) {
    console.error("[GolfTripPlanner] error calling:", fn?.name || fn, e);
  }
}

function clickTab(tabName) {
  const btn = document.querySelector(`[data-tab="${tabName}"]`);
  if (btn) btn.click();
}

let model = loadModel();

// Share mode detection
const shared = readShareModelFromUrl();
window.__GTP_READONLY__ = !!shared;
if (shared) model = shared;

// Guard saves in share mode
const _save = saveModel;
window.__GTP_SAVE__ = (m) => {
  if (window.__GTP_READONLY__) return;
  _save(m);
};

function enterShareModeOverviewOnly() {
  document.body.classList.add("share-mode");

  // Hide all tabs + panels
  document.querySelectorAll("[data-tab]").forEach(btn => (btn.style.display = "none"));
  document.querySelectorAll("[data-panel]").forEach(p => (p.style.display = "none"));

  // Show overview only
  const overviewBtn = document.querySelector('[data-tab="overview"]');
  const overviewPanel = document.querySelector('[data-panel="overview"]');
  if (overviewBtn) overviewBtn.style.display = "";
  if (overviewPanel) overviewPanel.style.display = "";

  safeCall(overview.renderOverview, model);
  safeCall(overview.bindOverviewUI, model);
}

function bootNormalMode() {
  safeCall(initTabs);

  // Bind handlers (if exported)
  safeCall(overview.bindOverviewUI, model);
  safeCall(itinerary.bindItineraryUI, model);
  safeCall(pairings.bindPairingsUI, model);

  // Trip Details uses renderTrip(model) in your codebase
  safeCall(tripDetails.renderTrip, model);

  // Render content
  safeCall(overview.renderOverview, model);
  safeCall(itinerary.renderItinerary, model);
  safeCall(pairings.renderPairings, model);
  safeCall(tripDetails.renderTrip, model);
  safeCall(settings.renderSettings, model);

  // Default to Overview tab without needing setActiveTab()
  clickTab("overview");
}

if (window.__GTP_READONLY__) enterShareModeOverviewOnly();
else bootNormalMode();

window.__GTP_MODEL__ = model;
