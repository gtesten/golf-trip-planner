// js/app.mjs
import * as overview from "./overview.js";
import * as itinerary from "./itinerary.js";
import * as pairings from "./pairings.js";
import * as tripDetails from "./tripDetails.js";
import * as settings from "./settings.js";
import * as storage from "./storage.js";
import * as tabs from "./tabs.js";
import { initStore, subscribe, setModel } from "./store.js";
import { initToast } from "./toast.js";
import { initTripsUI } from "./tripsUI.js";

console.log("[GolfTripPlanner] app boot", new Date().toISOString());

function safeCall(fn, ...args) {
  try {
    if (typeof fn !== "function") return;
    return fn(...args);
  } catch (err) {
    console.error("[GolfTripPlanner] error calling function:", fn?.name ?? "anonymous", err);
  }
}

function isFocusInsidePairings() {
  const active = document.activeElement;
  const root = document.querySelector("#pairingsRoot");
  return !!(active && root && root.contains(active));
}

function showBootError(err) {
  console.error("[GolfTripPlanner] boot failed", err);
  const el = document.createElement("div");
  el.style.cssText =
    "position:fixed;inset:0;background:#0b1220;color:#fff;padding:24px;z-index:99999;font-family:system-ui;overflow:auto;";
  el.innerHTML = `
    <h1 style="margin:0 0 12px;font-size:20px;">GolfTripPlanner failed to start</h1>
    <pre style="white-space:pre-wrap;background:rgba(255,255,255,.06);padding:12px;border-radius:12px;border:1px solid rgba(255,255,255,.12);">
${String(err?.stack || err).replaceAll("<","&lt;").replaceAll(">","&gt;")}
    </pre>
  `;
  document.body.appendChild(el);
}

async function boot() {
  initToast();

  const initialModel = await storage.loadModel();

  initStore({
    initialModel,
    saveFn: storage.saveModel,
  });

  const bindAll = (model) => {
    safeCall(itinerary.bindItineraryUI, model, { onChange: (m) => setModel(m, { meta: { source: "itinerary" } }) });
    safeCall(pairings.bindPairingsUI, model, { onChange: (m, meta) => setModel(m, { meta: meta ?? { source: "pairings" } }) });
    safeCall(tripDetails.bindTripUI, model, { onChange: (m) => setModel(m, { meta: { source: "tripDetails" } }) });
    safeCall(overview.bindOverviewUI, model, { onChange: (m) => setModel(m, { meta: { source: "overview" } }) });
    safeCall(settings.bindSettingsUI, model, { onChange: (m) => setModel(m, { meta: { source: "settings" } }) });
  };
  await initTripsUI();

  subscribe((model, meta = {}) => {
    safeCall(overview.renderOverview, model);
    safeCall(itinerary.renderItinerary, model);
    safeCall(tripDetails.renderTrip, model);
    safeCall(settings.renderSettings, model);

    const typingInPairings = meta?.source === "pairings" && isFocusInsidePairings();
    if (!typingInPairings) safeCall(pairings.renderPairings, model);

    queueMicrotask(() => bindAll(model));
  });

  safeCall(tabs.initTabs, "overview");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => boot().catch(showBootError));
} else {
  boot().catch(showBootError);
}
