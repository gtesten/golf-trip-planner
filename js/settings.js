// js/settings.js
export function renderSettings(model) {
  const panel = document.querySelector('[data-panel="settings"]');
  if (!panel) return;

  panel.innerHTML = `
    <div class="card">
      <div class="card-title">Settings</div>
      <div class="muted">Settings coming soon.</div>
    </div>
  `;
}
