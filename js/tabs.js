// js/tabs.js
// Simple, dependency-free tab system.
// Expects:
//  - Tab buttons:   [data-tab="overview"], etc.
//  - Panels:        [data-panel="overview"], etc.
// Adds/removes class "active" on the tab buttons.

function getEls() {
  const tabs = Array.from(document.querySelectorAll("[data-tab]"));
  const panels = Array.from(document.querySelectorAll("[data-panel]"));
  return { tabs, panels };
}

export function setActiveTab(name) {
  const { tabs, panels } = getEls();

  // Activate the right tab button
  tabs.forEach((btn) => {
    const isActive = btn.getAttribute("data-tab") === name;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  // Show the right panel
  panels.forEach((panel) => {
    const isActive = panel.getAttribute("data-panel") === name;
    panel.style.display = isActive ? "" : "none";
  });

  // Persist last tab (optional)
  try {
    localStorage.setItem("gtp_active_tab", name);
  } catch {
    // ignore
  }
}

export function initTabs(defaultTab = "overview") {
  const { tabs, panels } = getEls();

  // If panels have no inline default display state, hide all first
  panels.forEach((p) => (p.style.display = "none"));

  // Attach click listeners once
  tabs.forEach((btn) => {
    // Prevent duplicate listeners if initTabs is called again
    if (btn.__gtp_bound) return;
    btn.__gtp_bound = true;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const name = btn.getAttribute("data-tab");
      if (!name) return;
      setActiveTab(name);
    });
  });

  // Pick starting tab:
  // 1) URL ?tab=xxx
  // 2) last saved tab
  // 3) defaultTab
  let start = defaultTab;

  try {
    const url = new URL(window.location.href);
    const qp = url.searchParams.get("tab");
    if (qp) start = qp;
  } catch {
    // ignore
  }

  try {
    const saved = localStorage.getItem("gtp_active_tab");
    if (saved) start = saved;
  } catch {
    // ignore
  }

  // Fallback if the tab doesn't exist
  const hasStart = tabs.some((b) => b.getAttribute("data-tab") === start);
  if (!hasStart) start = defaultTab;

  setActiveTab(start);
}
