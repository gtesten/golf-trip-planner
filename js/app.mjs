// js/app.mjs
import { initTabs } from "./tabs.js";

window.__GTP_APP_LOADED__ = true;
console.log("[GTP] app.mjs running");

// ---------- Utilities ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function logDOMSummary() {
  const tabBtns = document.querySelectorAll(".tab-btn[data-tab]").length;
  const panels = document.querySelectorAll("[data-tab-panel]").length;
  console.log(`[GTP] DOM summary: tabBtns=${tabBtns} panels=${panels}`);
}

function forceShowOnlyPanel(panelName) {
  // Hard-force: hide all panels, show one (inline style wins)
  const panels = Array.from(document.querySelectorAll("[data-tab-panel]"));
  panels.forEach((p) => {
    const match = p.getAttribute("data-tab-panel") === panelName;
    if (match) {
      p.removeAttribute("hidden");
      p.style.display = "";
      p.style.visibility = "visible";
      p.style.opacity = "1";
    } else {
      p.setAttribute("hidden", "");
      p.style.display = "none";
    }
  });
}

// This is the “make it work” initializer:
// - tries multiple times (for delayed DOM rendering)
// - after initTabs, forces the currently active tab panel visible
async function initTabsReliably() {
  const maxTries = 20; // 20 * 200ms = 4s
  for (let i = 1; i <= maxTries; i++) {
    const ok = initTabs();
    logDOMSummary();

    // If panels exist, enforce visible panel based on active button
    const activeBtn =
      document.querySelector(".tab-btn.active[data-tab]") ||
      document.querySelector(".tab-btn[data-tab]");

    const activeName = activeBtn?.getAttribute("data-tab");
    if (activeName) {
      forceShowOnlyPanel(activeName);
      console.log(`[GTP] active tab = ${activeName} (enforced)`);
    }

    // If initTabs found panels/buttons, we can stop retrying
    const tabBtns = document.querySelectorAll(".tab-btn[data-tab]").length;
    const panels = document.querySelectorAll("[data-tab-panel]").length;
    if (ok || (tabBtns > 0 && panels > 0)) {
      console.log(`[GTP] tabs initialized (try ${i}/${maxTries})`);
      return true;
    }

    await sleep(200);
  }

  console.warn("[GTP] tabs init retries exhausted — check index.html panel markup");
  return false;
}

// ---------- Boot ----------
window.addEventListener("DOMContentLoaded", async () => {
  console.log("[GTP] DOMContentLoaded");

  // 1) Initialize tabs (reliable + delayed DOM-safe)
  await initTabsReliably();

  // 2) When user clicks a tab, enforce the panel visibility immediately
  //    (covers cases where other scripts/CSS fight visibility)
  document.addEventListener(
    "click",
    (e) => {
      const btn = e.target.closest(".tab-btn[data-tab]");
      if (!btn) return;
      const name = btn.getAttribute("data-tab");
      if (!name) return;

      // Let the tab handler run first, then enforce panel visibility
      queueMicrotask(() => {
        forceShowOnlyPanel(name);
        console.log(`[GTP] click -> enforce panel ${name}`);
      });
    },
    true
  );

  // 3) If your app dynamically injects content after load,
  //    you can re-run this whenever you render sections.
  //    (Leaving this here as a hook.)
  window.__GTP_REINIT_TABS__ = initTabsReliably;

  console.log("[GTP] boot complete");
});
