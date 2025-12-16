// js/tabs.js
export function initTabs() {
  const root = document.querySelector("[data-tabs-root]") || document;
  const tabs = Array.from(root.querySelectorAll(".tab-btn[data-tab]"));
  const panels = Array.from(document.querySelectorAll("[data-tab-panel]"));

  console.log("[tabs:init] tabs=", tabs.length, "panels=", panels.length);

  if (!tabs.length || !panels.length) return false;

  function show(name) {
    tabs.forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === name));

    panels.forEach((p) => {
      const match = p.getAttribute("data-tab-panel") === name;

      // ✅ use hidden attribute
      p.hidden = !match;

      // ✅ also remove/add is-hidden class (fixes your current setup)
      p.classList.toggle("is-hidden", !match);
    });
  }

  // One click handler only
  root.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-btn[data-tab]");
    if (!btn) return;
    e.preventDefault();
    const name = btn.dataset.tab;
    localStorage.setItem("gtp.activeTab", name);
    show(name);
  });

  // Initial
  const saved = localStorage.getItem("gtp.activeTab");
  const defaultTab =
    tabs.find((t) => t.classList.contains("active"))?.dataset.tab || tabs[0].dataset.tab;

  show(saved && tabs.some(t => t.dataset.tab === saved) ? saved : defaultTab);

  return true;
}
