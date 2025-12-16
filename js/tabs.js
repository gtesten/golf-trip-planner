export function initTabs({ defaultTab = "itinerary" } = {}) {
  const tabs = Array.from(document.querySelectorAll(".tab"));
  const panels = Array.from(document.querySelectorAll(".panel[data-panel]"));

  function setActive(tabId, pushHash = true) {
    tabs.forEach(btn => {
      const active = btn.dataset.tab === tabId;
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });

    panels.forEach(p => {
      const active = p.dataset.panel === tabId;
      p.hidden = !active;
    });

    if (pushHash) {
      const next = `#${encodeURIComponent(tabId)}`;
      if (location.hash !== next) history.replaceState(null, "", next);
    }
  }

  tabs.forEach(btn => {
    btn.addEventListener("click", () => setActive(btn.dataset.tab));
  });

  const fromHash = decodeURIComponent((location.hash || "").replace("#", "")) || "";
  const start = tabs.some(t => t.dataset.tab === fromHash) ? fromHash : defaultTab;
  setActive(start, false);

  window.addEventListener("hashchange", () => {
    const h = decodeURIComponent((location.hash || "").replace("#", ""));
    if (tabs.some(t => t.dataset.tab === h)) setActive(h, false);
  });

  return { setActive };
}
