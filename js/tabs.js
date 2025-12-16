// js/tabs.js
// Robust tabs that work with:
// - data-tab="name"
// - data-target="name"
// - aria-controls="name"
// - <a href="#name">
// Panels can be:
// - id="name"
// - data-tab-panel="name"
//
// Adds/removes:
// - .is-active on tabs
// - [hidden] + .is-hidden on panels

const DEFAULT_TAB_SELECTOR =
  '[data-tab],[data-target],[aria-controls],[role="tab"],a[href^="#"]';

const DEFAULT_PANEL_SELECTOR =
  '[data-tab-panel],[role="tabpanel"],[id]';

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

function buildState(root, tabSelector, panelSelector) {
  const tabs = Array.from(root.querySelectorAll(tabSelector));
  const panels = Array.from(root.querySelectorAll(panelSelector));

  // Map panel name -> element (prefers explicit data-tab-panel / role=tabpanel; falls back to id)
  const panelByName = new Map();
  for (const p of panels) {
    const name = p.getAttribute("data-tab-panel") || p.id;
    if (name) panelByName.set(name, p);
  }

  // Also map any id panels referenced by tabs (if not already)
  for (const t of tabs) {
    const name = getTabName(t);
    if (!name) continue;
    if (!panelByName.has(name)) {
      const byId = root.getElementById
        ? root.getElementById(name)
        : document.getElementById(name);
      if (byId) panelByName.set(name, byId);
    }
  }

  return { tabs, panelByName };
}

function pickDefaultActive({ panelByName, tabs }) {
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

function setActive({ root, tabSelector, panelSelector, name, activeClass, hiddenClass }) {
  const { tabs, panelByName } = buildState(root, tabSelector, panelSelector);

  if (!name || !panelByName.has(name)) return false;

  // Tabs
  for (const t of tabs) {
    const tName = getTabName(t);
    const isActive = tName === name;
    t.classList.toggle(activeClass, isActive);
    t.setAttribute("aria-selected", String(isActive));
    t.setAttribute("tabindex", isActive ? "0" : "-1");
  }

  // Panels (only hide panels that are actually part of our mapping)
  for (const [pName, p] of panelByName.entries()) {
    const isActive = pName === name;
    if (hiddenClass) p.classList.toggle(hiddenClass, !isActive);
    p.toggleAttribute("hidden", !isActive);
    if (!p.getAttribute("role")) p.setAttribute("role", "tabpanel");
  }

  return true;
}

export function initTabs(options = {}) {
  const root = options.root || document;
  const tabSelector = options.tabSelector || DEFAULT_TAB_SELECTOR;
  const panelSelector = options.panelSelector || DEFAULT_PANEL_SELECTOR;
  const activeClass = options.activeClass || "is-active";
  const hiddenClass = options.hiddenClass || "is-hidden";
  const debug = options.debug ?? true;

  // Bind click handler once
  if (!window.__GTP_TABS_BOUND__) {
    window.__GTP_TABS_BOUND__ = true;

    document.addEventListener(
      "click",
      (e) => {
        const tabEl = e.target.closest(tabSelector);
        if (!tabEl) return;

        const name = getTabName(tabEl);
        if (!name) return;

        // Prevent the hash jump if it's an <a href="#...">
        if (tabEl.tagName === "A" && isHashLink(tabEl)) e.preventDefault();

        const ok = setActive({
          root,
          tabSelector,
          panelSelector,
          name,
          activeClass,
          hiddenClass,
        });

        if (!ok && debug) {
          console.warn("[tabs] Clicked tab but no matching panel found for:", name);
        }
      },
      true // capture (helps with tricky propagation)
    );
  }

  // Initial scan + default activation
  const { tabs, panelByName } = buildState(root, tabSelector, panelSelector);

  if (debug) console.log("[tabs] found", tabs.length, "tabs and", panelByName.size, "panels");

  if (!tabs.length || !panelByName.size) {
    if (debug) {
      console.warn(
        "[tabs] No tabs/panels found. Your markup must include data-tab/data-target/aria-controls or href='#id' and panels with id or data-tab-panel."
      );
    }
    return false;
  }

  const defaultActive = pickDefaultActive({ panelByName, tabs });
  if (defaultActive) {
    setActive({ root, tabSelector, panelSelector, name: defaultActive, activeClass, hiddenClass });
    return true;
  }

  return false;
}
