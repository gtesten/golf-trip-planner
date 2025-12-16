// js/tabs.js
export function initTabs({
  tabSelector = '[data-tab]',
  panelSelector = '[data-tab-panel]',
  activeClass = 'is-active',
  hiddenClass = 'is-hidden',
} = {}) {
  const tabs = Array.from(document.querySelectorAll(tabSelector));
  const panels = Array.from(document.querySelectorAll(panelSelector));

  if (!tabs.length || !panels.length) {
    console.warn('[tabs] No tabs/panels found. Check data-tab / data-tab-panel attributes.');
    return;
  }

  // Helper: activate a tab by name
  const activate = (name) => {
    // tabs
    for (const t of tabs) {
      const isActive = t.getAttribute('data-tab') === name;
      t.classList.toggle(activeClass, isActive);
      t.setAttribute('aria-selected', String(isActive));
      t.setAttribute('tabindex', isActive ? '0' : '-1');
    }

    // panels
    for (const p of panels) {
      const isActive = p.getAttribute('data-tab-panel') === name;
      p.classList.toggle(hiddenClass, !isActive);
      p.toggleAttribute('hidden', !isActive);
    }
  };

  // Event delegation: one listener for all tabs
  document.addEventListener('click', (e) => {
    const tab = e.target.closest(tabSelector);
    if (!tab) return;

    // stop <a href="#">, etc.
    e.preventDefault();

    const name = tab.getAttribute('data-tab');
    if (!name) return;
    activate(name);
  });

  // Keyboard support (optional but nice)
  document.addEventListener('keydown', (e) => {
    const focusedTab = document.activeElement?.closest?.(tabSelector);
    if (!focusedTab) return;

    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();

    const idx = tabs.indexOf(focusedTab);
    const nextIdx = e.key === 'ArrowRight'
      ? (idx + 1) % tabs.length
      : (idx - 1 + tabs.length) % tabs.length;

    tabs[nextIdx]?.focus();
    const name = tabs[nextIdx]?.getAttribute('data-tab');
    if (name) activate(name);
  });

  // Activate first tab by default (or an already-marked active one)
  const preActive = tabs.find(t => t.classList.contains(activeClass))?.getAttribute('data-tab');
  activate(preActive || tabs[0].getAttribute('data-tab'));
}
