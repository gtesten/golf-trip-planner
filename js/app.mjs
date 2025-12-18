// js/app.mjs
import { loadModel, saveModel } from "./storage.js";
import { initTabs, setActiveTab } from "./tabs.js";

import * as overview from "./overview.js";
import * as itinerary from "./itinerary.js";
import * as pairings from "./pairings.js";
import * as tripDetails from "./tripDetails.js";

function safeCall(fn, ...args) {
  if (typeof fn === "function") fn(...args);
}

safeCall(tripDetails.bindTripDetailsUI, model);
safeCall(tripDetails.renderTripDetails, model);

import { readShareModelFromUrl } from "./share.js";

console.log("[GolfTripPlanner] app.mjs loaded");

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

// Global save guard
const _saveModel = saveModel;
window.__GTP_SAVE__ = (m) => {
  if (window.__GTP_READONLY__) return;
  _saveModel(m);
};

function showOnlyOverviewPanel() {
  document.body.classList.add("share-mode");

  // Hide all tab buttons + panels
  document.querySelectorAll("[data-tab]").forEach(btn => (btn.style.display = "none"));
  document.querySelectorAll("[data-panel]").forEach(p => (p.style.display = "none"));

  // Show overview only
  const overviewBtn = document.querySelector('[data-tab="overview"]');
  const overviewPanel = document.querySelector('[data-panel="overview"]');
  if (overviewBtn) overviewBtn.style.display = "";
  if (overviewPanel) overviewPanel.style.display = "";
}

function safeCall(fn, ...args) {
  if (typeof fn === "function") fn(...args);
}

function bootShareMode() {
  showOnlyOverviewPanel();
  safeCall(overview.renderOverview, model);
  safeCall(overview.bindOverviewUI, model);
}

function bootNormalMode() {
  initTabs();

  // bind (only what actually exists)
  safeCall(overview.bindOverviewUI, model);
  safeCall(itinerary.bindItineraryUI, model);
  safeCall(pairings.bindPairingsUI, model);

  // render
  safeCall(overview.renderOverview, model);
  safeCall(itinerary.renderItinerary, model);
  safeCall(pairings.renderPairings, model);

  // Trip Details uses renderTrip()
  if (typeof tripDetails.renderTrip === "function") {
    tripDetails.renderTrip(model);
  }

  setActiveTab("overview");
}

// Boot
if (window.__GTP_READONLY__) bootShareMode();
else bootNormalMode();

// Debug handle
window.__GTP_MODEL__ = model;