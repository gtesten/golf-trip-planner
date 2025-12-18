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
  // Try your storage module if it exists
  const fromStorage =
    (typeof storage?.loadModel === "function" && safeCall(storage.loadModel)) ||
    (typeof storage?.getModel === "function" && safeCall(storage.getModel));

  // Fallback minimal model
  return (
    fromStorage || {
      tripName: "My Golf Trip",
      dates: "",
      location: "",
      itineraryDays: [],
      players: [],
      rounds: [],
    }
  );
}

function saveModel(model) {
  if (typeof storage?.saveModel === "function") return safeCall(storage.saveModel, model);
  if (typeof storage?.setModel === "function") return safeCall(storage.setModel, model);
  // no-op fallback
}

function bootNormalMode() {
  let model = loadModel();

  // Render FIRST (fixes your null innerHTML errors)
  safeCall(overview.renderOverview, model);
  safeCall(itinerary.renderItinerary, model);

  // Pairings: support either renderPairingsFromModel(model) or renderPairings(model)
  safeCall(pairings.renderPairingsFromModel, model);
  safeCall(pairings.renderPairings, model);

  // Trip Details: support renderTrip(model) or renderTripDetails(model)
  safeCall(tripDetails.renderTrip, model);
  safeCall(tripDetails.renderTripDetails, model);

  // Bind AFTER render (fixes your null addEventListener errors)
  safeCall(overview.bindOverviewUI, model, {
    onChange: next => {
      model = next;
      saveModel(model);
    },
  });

  safeCall(itinerary.bindItineraryUI, model, {
    onChange: next => {
      model = next;
      saveModel(model);
    },
  });

  // If these exist, bind them too
  safeCall(pairings.bindPairingsUI, model, {
    onChange: next => {
      model = next;
      saveModel(model);
    },
  });

  safeCall(tripDetails.bindTripUI, model, {
    onChange: next => {
      model = next;
      saveModel(model);
    },
  });

  // Tabs last
  safeCall(tabs.initTabs, "overview");
}

// Ensure DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootNormalMode);
} else {
  bootNormalMode();
}
