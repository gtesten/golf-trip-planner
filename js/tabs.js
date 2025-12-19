// js/tabs.js
export function initTabs(defaultTab = "overview") {
  const buttons = Array.from(document.querySelectorAll(".tab-btn[data-tab]"));
  const panels = Array.from(document.querySelectorAll(".tab-panel[data-panel]"));

  if (!buttons.length || !panels.length) {
    console.warn("[GolfTripPlanner] tabs not found");
    return;
  }

  const setActiveTab = (tabId) => {
    buttons.forEach((btn) => {
      const isActive = btn.getAttribute("data-tab") === tabId;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-selected", String(isActive));
      btn.setAttribute("tabindex", isActive ? "0" : "-1");
    });

    panels.forEach((p) => {
      const isActive = p.getAttribute("data-panel") === tabId;
      if (isActive) p.removeAttribute("hidden");
      else p.setAttribute("hidden", "");
    });

    // Persist
    try { localStorage.setItem("gtp_active_tab", tabId); } catch {}
  };

  const saved = (() => {
    try { return localStorage.getItem("gtp_active_tab"); } catch { return null; }
  })();

  // Wire clicks
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => setActiveTab(btn.getAttribute("data-tab")));
  });

  // Init
  setActiveTab(saved || defaultTab);

  // Expose small API (optional usage)
  return { setActiveTab };
}
