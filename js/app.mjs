// js/app.mjs

import * as overview from "./overview.js";
import * as itinerary from "./itinerary.js";
import * as pairings from "./pairings.js";
import * as tripDetails from "./tripDetails.js";
import * as storage from "./storage.js";
import * as tabs from "./tabs.js";

console.log("[GolfTripPlanner] main.js loaded");
console.log("[GolfTripPlanner] main.js loaded at", new Date().toISOString());

function safeCall(fn, ...args) {
  try {
    if (typeof fn !== "function") return;
    return fn(...args);
  } catch (err) {
    console.error("[GolfTripPlanner] error calling function:", fn?.name ?? "anonymous", err);
  }
}

function loadModel() {
  const fromStorage =
    (typeof storage?.loadModel === "function" && safeCall(storage.loadModel)) ||
    (typeof storage?.getModel === "function" && safeCall(storage.getModel));

  return (
    fromStorage || {
      itineraryDays: [],
      players: [],
      rounds: [],
      defaultHoles: 18,
      playersPerGroup: 4,
    }
  );
}

function saveModel(model) {
  if (typeof storage?.saveModel === "function") return safeCall(storage.saveModel, model);
  if (typeof storage?.setModel === "function") return safeCall(storage.setModel, model);
}

function bootNormalMode() {
  let model = loadModel();

  const onChange = (next) => {
    model = next;
    saveModel(model);
    // ✅ Overview is derived, so always refresh it on any update
    safeCall(overview.renderOverview, model);
  };

  // Render first
  safeCall(overview.renderOverview, model);
  safeCall(itinerary.renderItinerary, model);
  safeCall(pairings.renderPairingsFromModel, model);
  safeCall(pairings.renderPairings, model);
  safeCall(tripDetails.renderTrip, model);
  safeCall(tripDetails.renderTripDetails, model);

  // Bind after render
  safeCall(overview.bindOverviewUI, model, { onChange });
  safeCall(itinerary.bindItineraryUI, model, { onChange });
  safeCall(pairings.bindPairingsUI, model, { onChange });
  safeCall(tripDetails.bindTripUI, model, { onChange });

  safeCall(tabs.initTabs, "overview");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootNormalMode);
} else {
  bootNormalMode();
}
