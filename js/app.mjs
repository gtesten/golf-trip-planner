// js/app.mjs
import * as overview from "./overview.js";
import * as itinerary from "./itinerary.js";
import * as pairings from "./pairings.js";
import * as tripDetails from "./tripDetails.js";
import * as storage from "./storage.js";
import * as tabs from "./tabs.js";
import { initStore, subscribe, setModel } from "./store.js";
import { initToast } from "./toast.js";

console.log("[GolfTripPlanner] app boot", new Date().toISOString());

function safeCall(fn, ...args) {
  try {
    if (typeof fn !== "function") return;
    return fn(...args);
  } catch (err) {
    console.error("[GolfTripPlanner] error calling function:", fn?.name ?? "anonymous", err);
  }
}

async function boot() {
  initToast();

  const initialModel = await storage.loadModel();

  initStore({
    initialModel,
    saveFn: storage.saveModel,
  });

  // Re-render on any model change
  subscribe((model) => {
    safeCall(overview.renderOverview, model);
    safeCall(itinerary.renderItinerary, model);
    safeCall(pairings.renderPairings, model);
    safeCall(tripDetails.renderTrip, model);
  });

  // Bind once per render pass, but re-bind after renders too (simple + reliable)
  const bindAll = (model) => {
    safeCall(itinerary.bindItineraryUI, model, { onChange: (m) => setModel(m) });
    safeCall(pairings.bindPairingsUI, model, { onChange: (m) => setModel(m) });
    safeCall(tripDetails.bindTripUI, model, { onChange: (m) => setModel(m) });
    safeCall(overview.bindOverviewUI, model, { onChange: (m) => setModel(m) });
  };

  // initial bind after first render
  bindAll(initialModel);

  // Re-bind after each render tick (prevents null listener issues)
  subscribe((model) => {
    // small microtask to allow DOM to update
    queueMicrotask(() => bindAll(model));
  });

  safeCall(tabs.initTabs, "overview");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
