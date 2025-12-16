// js/tabs.js
export function initTabs() {
  const tabsRoot = document.querySelector("[data-tabs-root]") || document;
  const tabs = Array.from(tabsRoot.querySelectorAll(".tab-btn[data-tab]"));
  const panels = Array.from(document.querySelectorAll(".tab-panel[data-tab-panel]"));

  console.log("[tabs] tabs:", tabs.length, "panels:", panels.length);

  if (!tabs.length || !panels.length) return false;

  const show = (name) => {
    // buttons
    tabs.forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === name));

    // panels
    panels.forEach((p) => p.classList.toggle("is-hidden", p.dataset.tabPanel !== name));
  };

  tabsRoot.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-btn[data-tab]");
    if (!btn) return;
    e.preventDefault();
    show(btn.dataset.tab);
  });

  const defaultTab = tabs.find((t) => t.classList.contains("active"))?.dataset.tab || tabs[0].dataset.tab;
  show(defaultTab);
  return true;
}
