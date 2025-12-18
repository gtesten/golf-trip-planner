// js/tabs.js
// Robust tab switching: supports [data-tab] buttons and [data-tab-panel] panels.

export function setActiveTab(tabName) {
  const panels = document.querySelectorAll("[data-tab-panel]");
  const tabs = document.querySelectorAll(".tab[data-tab]");

  panels.forEach(panel => {
    const name = panel.getAttribute("data-tab-panel");
    panel.hidden = name !== tabName;
  });

  tabs.forEach(btn => {
    const name = btn.getAttribute("data-tab");
    btn.classList.toggle("active", name === tabName);
    btn.setAttribute("aria-selected", name === tabName ? "true" : "false");
  });
}

export function initTabs(defaultTab = "overview") {
  const tabs = document.querySelectorAll(".tab[data-tab]");
  if (!tabs.length) return;

  tabs.forEach(btn => {
    btn.addEventListener("click", () => {
      const tabName = btn.getAttribute("data-tab");
      if (!tabName) return;
      setActiveTab(tabName);
    });
  });

  setActiveTab(defaultTab);
}
