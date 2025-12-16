// js/tabs.js
// Tabs supported:
// - data-tab="name"
// - data-target="name"
// - aria-controls="name"
// - <a href="#name">
// Panels supported:
// - data-tab-panel="name"
// - role="tabpanel"
// - id="name" ONLY if referenced by a tab

const TAB_SELECTOR =
  '[data-tab],[data-target],[aria-controls],[role="tab"],a[href^="#"]';

const EXPLICIT_PANEL_SELECTOR =
  '[data-tab-panel],[role="tabpanel"]';

function isHashLink(el) {
  const href = el?.getAttribute?.("href");
  return typeof href === "string" && href.startsWith("#") && href.length > 1;
}

function getTabName(el) {
  return (
    el.getAttribute("data-tab") ||
    el.getAttribute("data-target") ||
    el.getAttribute("aria-controls") ||
    (isHashLink(el) ? el.getAttribute("href").slice(1) : null)
  );
}

function buildState(root) {
  const tabs = Array.from(root.querySelectorAll(TAB_SELECTOR));

  // Start with explicit panels only
  const explicitPanels = Array.from(root.querySelectorAll(EXPLICIT_PANEL_SELECTOR));
  const panelByName = new Map();

  for (const p of explicitPanels) {
    const name = p.getAttribute("data-tab-panel") || p.id;
    if (name) panelByName.set(name, p);
  }

  // Add ONLY id-panels that are referenced by tabs
  for (const t of tabs) {
    const name = getTabName(t);
    if (!name || panelByName.has(name)) continue;

    const byId = document.getElementById(name);
    if (byId) panelByName.set(name, byId);
  }

  return { tabs, panelByName };
}

function setActive({ name, activeClass, hiddenClass }) {
  const { tabs, panelByName } = buildState(document);

  if (!name || !panelByName.has(name)) return false;

  // Tabs
  for (const t of tabs) {
    const tName = getTabName(t);
    const isActive = tName === name;
    t.classList.toggle(activeClass, isActive);
    t.setAttribute("aria-selected", String(isActive));
    t.setAttribute("tabindex", isActive ? "0" : "-1");
  }

  // Panels (ONLY mapped panels)
  for (const [pName, p] of panelByName.entries()) {
    const isActive = pName === name;
    if (hiddenClass) p.classList.toggle(hiddenClass, !isActive);
    p.toggleAttribute("hidden", !isActive);
    if (!p.getAttribute("role")) p.setAttribute("role", "tabpanel");
  }

  return true;
}

function pickDefaultActive({ tabs, panelByName }) {
  const hash = (window.location.hash || "").replace("#", "");
  if (hash && panelByName.has(hash)) return hash;

  const pre = tabs.find(
    (t) => t.classList.contains("is-active") || t.getAttribute("aria-selected") === "true"
  );
  const preName = pre ? getTabName(pre) : null;
  if (preName && panelByName.has(preName)) return preName;

  for (const t of tabs) {
    const name = getTabName(t);
    if (name && panelByName.has(name)) return name;
  }

  return panelByName.keys().next().value || null;
}

export function initTabs(options = {}) {
  const activeClass = options.activeClass || "is-active";
  const hiddenClass = options.hiddenClass || "is-hidden";
  const debug = options.debug ?? true;

  // Bind once
  if (!window.__GTP_TABS_BOUND__) {
    window.__GTP_TABS_BOUND__ = true;

    document.addEventListener(
      "click",
      (e) => {
        const tabEl = e.target.closest(TAB_SELECTOR);
        if (!tabEl) return;

        const name = getTabName(tabEl);
        if (!name) return;

        if (tabEl.tagName === "A" && isHashLink(tabEl)) e.preventDefault();

        const ok = setActive({ name, activeClass, hiddenClass });
        if (!ok && debug) console.warn("[tabs] No matching panel for:", name);
      },
      true
    );
  }

  // Initial activation
  const { tabs, panelByName } = buildState(document);

  if (debug) console.log("[tabs] found", tabs.length, "tabs and", panelByName.size, "panels");

  if (!tabs.length || !panelByName.size) {
    if (debug) console.warn("[tabs] No tabs/panels found (based on referenced panels only).");
    return false;
  }

  const def = pickDefaultActive({ tabs, panelByName });
  if (def) return setActive({ name: def, activeClass, hiddenClass });

  return false;
}
