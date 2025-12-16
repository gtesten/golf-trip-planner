// js/tabs.js
export function initTabs() {
  const root = document.querySelector("[data-tabs-root]") || document;
  const tabs = Array.from(root.querySelectorAll(".tab-btn[data-tab]"));
  const panels = Array.from(document.querySelectorAll("[data-tab-panel]"));

  if (!tabs.length || !panels.length) {
    console.warn("[tabs] Missing .tab-btn[data-tab] or [data-tab-panel] in HTML");
    return false;
  }

  const show = (name) => {
    tabs.forEach(btn => btn.classList.toggle("active", btn.dataset.tab === name));
    panels.forEach(p => p.classList.toggle("is-hidden", p.dataset.tabPanel !== name));
  };

  root.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-btn[data-tab]");
    if (!btn) return;
    e.preventDefault();
    show(btn.dataset.tab);
  });

  const defaultTab = tabs.find(t => t.classList.contains("active"))?.dataset.tab || tabs[0].dataset.tab;
  show(defaultTab);
  return true;
}
