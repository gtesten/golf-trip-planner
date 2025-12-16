// js/tabs.js
// Robust, framework-agnostic tabs:
// Supports tabs identified by: data-tab, data-target, aria-controls, href="#id", role="tab"
// Supports panels identified by: id, data-tab-panel, role="tabpanel"

function isHashHref(el) {
  const href = el?.getAttribute?.("href");
  return typeof href === "string" && href.startsWith("#") && href.length > 1;
}

function getTabName(tabEl) {
  if (!tabEl) return null;

  return (
    tabEl.getAttribute("data-tab") ||
    tabEl.getAttribute("data-target") ||
    tabEl.getAttribute("aria-controls") ||
    (isHashHref(tabEl) ? tabEl.getAttribute("href").slice(1) : null)
  );
}

function getAllTabs(root = document) {
  // We include common patterns but avoid grabbing random links:
  // - role="tab"
  // - data-tab / data-target
  // - aria-controls
  // - anchor links to hash
  const selector = [
    '[data-tab]',
    '[data-target]',
    '[aria-controls]',
    '[role="tab"]',
    'a[href^="#"]',
  ].join(",");

  const all = Array.from(root.querySelectorAll(selector));

  // If it's a hash link, treat it as a tab only if a matching element exists (panel)
  return all.filter((el) => {
    const name = getTabName(el);
    if (!name) return false;

    if (el.tagName === "A" && isHashHref(el)) {
      // only keep if there's a matching panel/id
      return !!root.querySelector(`#${CSS.escape(name)}`) || !!root.querySelector(`[data-tab-panel="${name}"]`);
    }
    return true;
  });
}

function getAllPanels(root = document) {
  const selector = [
    '[data-tab-panel]',
    '[role="tabpanel"]',
  ].join(",");

  const panels = Array.from(root.querySelectorAll(selector));

  // Also include any elements with IDs that are referenced by tabs
  // We'll add those dynamically during mapping, so we don't need to pre-collect every #id.
  return panels;
}

function findTabsRootFromClick(tabEl) {
  // If you have a container like <nav class="tabs"> or [data-tabs-root], we'll scope to it.
  // Otherwise, fall back to document.
  return (
    tabEl.closest("[data-tabs-root]") ||
    tabEl.closest(".tabs") ||
    document
  );
}

function buildMapping(root) {
  const tabs = getAllTabs(root);
  const panels = getAllPanels(root);

  const panelByName = new Map();

  // Index explicit panels first
  for (const p of panels) {
    const name = p.getAttribute("data-tab-panel") || p.getAttribute("id");
    if (name) panelByName.set(name, p);
  }

  // Index id-panels referenced by tabs (href/#, aria-controls, etc.)
  for (const t of tabs) {
    const name = getTabName(t);
    if (!name) continue;

    if (!panelByName.has(name)) {
      const byId = root.querySelector(`#${CSS.escape(name)}`);
      if (byId) panelByName.set(name, byId);
    }
  }

  return { tabs, panelByName };
}

function setActiveUI({ root, tabs, panelByName, name, activeClass, hiddenClass }) {
  // Tabs: active class + aria-selected
  for (const t of tabs) {
    const tName = getTabName(t);
    const isActive = tName === name;

    t.classList.toggle(activeClass, isActive);
    t.setAttribute("aria-selected", String(isActive));
    t.setAttribute("tabindex", isActive ? "0" : "-1");
  }

  // Panels: show/hide
  for (const [pName, pEl] of panelByName.entries()) {
    const isActive = pName === name;

    if (hiddenClass) pEl.classList.toggle(hiddenClass, !isActive);
    pEl.toggleAttribute("hidden", !isActive);

    // accessibility nicety
    if (!pEl.getAttribute("role")) pEl.setAttribute("role", "tabpanel");
  }
}

function pickDefaultActive({ tabs, panelByName }) {
  // 1) URL hash
  const hash = (window.location.hash || "").replace("#", "");
  if (hash && panelByName.has(hash)) return hash;

  // 2) tab already marked active
  const pre = tabs.find((t) =>
    t.classList.contains("is-active") || t.getAttribute("aria-selected") === "true"
  );
  const preName = getTabName(pre);
  if (preName && panelByName.has(preName)) return preName;

  // 3) first tab that has a matching panel
  for (const t of tabs) {
    const name = getTabName(t);
    if (name && panelByName.has(name)) return name;
  }

  // 4) any panel key
  return panelByName.keys().next().value || null;
}

export function initTabs(options = {}) {
  // Add near the top of tabs.js (or inside initTabs before adding listeners)
// Bind listeners only once (safe for retries)
if (!window.__GTP_TABS_BOUND__) {
  window.__GTP_TABS_BOUND__ = true;

  document.addEventListener("click", (e) => {
    const raw = e.target.closest('[data-tab],[data-target],[aria-controls],[role="tab"],a[href^="#"]');
    if (!raw) return;

    const name =
      raw.getAttribute("data-tab") ||
      raw.getAttribute("data-target") ||
      raw.getAttribute("aria-controls") ||
      (raw.getAttribute("href")?.startsWith("#") ? raw.getAttribute("href").slice(1) : null);

    if (!name) return;

    // Prevent hash jump if this is a # link
    if (raw.tagName === "A" && raw.getAttribute("href")?.startsWith("#")) e.preventDefault();

    // Re-scan *at click time* (covers tabs/panels added later)
    const tabs = Array.from(document.querySelectorAll('[data-tab],[data-target],[aria-controls],[role="tab"],a[href^="#"]'));
    const panel =
      document.querySelector(`[data-tab-panel="${CSS.escape(name)}"]`) ||
      document.getElementById(name);

    if (!panel) {
      console.warn("[tabs] Clicked tab name but no matching panel found:", name);
      return;
    }

    // Hide/show panels
    const panels = Array.from(document.querySelectorAll('[data-tab-panel],[role="tabpanel"],[id]'));
    panels.forEach((p) => {
      const match = p.getAttribute("data-tab-panel") === name || p.id === name;
      if (match) {
        p.classList.remove("is-hidden");
        p.removeAttribute("hidden");
      } else if (p.hasAttribute("data-tab-panel") || p.getAttribute("role") === "tabpanel") {
        p.classList.add("is-hidden");
        p.setAttribute("hidden", "");
      }
    });

    // Mark active tab (best-effort)
    tabs.forEach((t) => {
      const tName =
        t.getAttribute("data-tab") ||
        t.getAttribute("data-target") ||
        t.getAttribute("aria-controls") ||
        (t.getAttribute("href")?.startsWith("#") ? t.getAttribute("href").slice(1) : null);
      t.classList.toggle("is-active", tName === name);
      t.setAttribute("aria-selected", String(tName === name));
    });
  }, true);
}

  // Ensure panels have hidden state except active
  const defaultActive = pickDefaultActive({ tabs, panelByName });
  if (defaultActive) {
    setActiveUI({ root, tabs, panelByName, name: defaultActive, activeClass, hiddenClass });
  }

  // One delegated listener (scoped by nearest tabs root)
  document.addEventListener("click", (e) => {
    const raw = e.target.closest('[data-tab],[data-target],[aria-controls],[role="tab"],a[href^="#"]');
    if (!raw) return;

    const tabsRoot = findTabsRootFromClick(raw);
    const { tabs: scopedTabs, panelByName: scopedPanels } = buildMapping(tabsRoot);

    if (!scopedTabs.length || !scopedPanels.size) return;

    const name = getTabName(raw);
    if (!name || !scopedPanels.has(name)) return;

    // prevent hash navigation if it's a hash link
    if (raw.tagName === "A" && isHashHref(raw)) e.preventDefault();

    setActiveUI({
      root: tabsRoot,
      tabs: scopedTabs,
      panelByName: scopedPanels,
      name,
      activeClass,
      hiddenClass,
    });
  });

  // Optional: respond to hash changes (if you use <a href="#panel">)
  window.addEventListener("hashchange", () => {
    const newHash = (window.location.hash || "").replace("#", "");
    if (!newHash) return;

    const { tabs: scopedTabs, panelByName: scopedPanels } = buildMapping(root);
    if (scopedPanels.has(newHash)) {
      setActiveUI({
        root,
        tabs: scopedTabs,
        panelByName: scopedPanels,
        name: newHash,
        activeClass,
        hiddenClass,
      });
    }
  });

  return true;
}
