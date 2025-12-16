// js/tabs.js
// Hard-force tab panels to switch via inline styles (display none/block)
// Panels MUST have: data-tab-panel="detailsTab" etc.
// Tabs MUST have: data-tab="detailsTab" etc.

export function initTabs() {
  const root = document.querySelector("[data-tabs-root]") || document;
  const tabs = Array.from(root.querySelectorAll(".tab-btn[data-tab]"));
  const panels = Array.from(document.querySelectorAll("[data-tab-panel]"));

  console.log("[tabs:init] tabs=", tabs.length, "panels=", panels.length);

  if (!tabs.length) {
    console.warn("[tabs] No .tab-btn[data-tab] found");
    return false;
  }
  if (!panels.length) {
    console.warn("[tabs] No [data-tab-panel] panels found");
    return false;
  }

  const show = (name) => {
    // Highlight buttons
    tabs.forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === name));

    // Force-hide/show panels (inline wins over almost everything)
    panels.forEach((p) => {
      const match = p.getAttribute("data-tab-panel") === name;
      if (match) {
        p.removeAttribute("hidden");
        p.style.display = "";       // let CSS decide default
        p.style.visibility = "visible";
        p.style.opacity = "1";
      } else {
        p.setAttribute("hidden", "");
        p.style.display = "none";
      }
    });

    console.log("[tabs:show]", name, "visiblePanels=",
      panels.filter(p => p.getAttribute("data-tab-panel") === name).length
    );
  };

  // Click handler
  root.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-btn[data-tab]");
    if (!btn) return;
    e.preventDefault();
    const name = btn.dataset.tab;
    if (!name) return;
    show(name);
  });

  // Default tab = currently active button, else first button
  const defaultTab =
    tabs.find((t) => t.classList.contains("active"))?.dataset.tab || tabs[0].dataset.tab;

  // Also: persist last chosen tab to survive reloads
  const saved = localStorage.getItem("gtp.activeTab");
  const startTab = saved && tabs.some(t => t.dataset.tab === saved) ? saved : defaultTab;

  // Save on every show
  const originalShow = show;
  const showAndSave = (name) => {
    localStorage.setItem("gtp.activeTab", name);
    originalShow(name);
  };

  // swap in saving version
  root.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-btn[data-tab]");
    if (!btn) return;
    e.preventDefault();
    showAndSave(btn.dataset.tab);
  }, true);

  // Initial draw
  showAndSave(startTab);

  // If your app re-renders DOM after load, re-apply after a moment
  setTimeout(() => showAndSave(localStorage.getItem("gtp.activeTab") || startTab), 250);
  setTimeout(() => showAndSave(localStorage.getItem("gtp.activeTab") || startTab), 1000);

  return true;
}
