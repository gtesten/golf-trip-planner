// js/store.js
// Central model store with debounced autosave + toast hooks.
// v2: meta support so UI can skip expensive rerenders while typing.

let _model = null;
let _subs = new Set();
let _saveFn = null;
let _timer = null;

export function initStore({ initialModel, saveFn }) {
  _model = initialModel ?? {};
  _saveFn = saveFn;
}

export function getModel() {
  return _model;
}

export function subscribe(fn) {
  _subs.add(fn);
  fn(_model, { source: "init" });
  return () => _subs.delete(fn);
}

export function setModel(next, { autosave = true, meta = {} } = {}) {
  _model = next;
  _subs.forEach(fn => fn(_model, meta));
  if (autosave) queueSave();
}

export function patchModel(partial, opts) {
  setModel({ ..._model, ...partial }, opts);
}

function queueSave() {
  if (!_saveFn) return;
  if (_timer) clearTimeout(_timer);
  _timer = setTimeout(async () => {
    _timer = null;
    try {
      window.dispatchEvent(new CustomEvent("gtp:save:status", { detail: { status: "saving" } }));
      await _saveFn(_model);
      window.dispatchEvent(new CustomEvent("gtp:save:status", { detail: { status: "saved" } }));
    } catch (e) {
      console.error("[GolfTripPlanner] autosave failed", e);
      window.dispatchEvent(new CustomEvent("gtp:save:status", { detail: { status: "error", error: String(e) } }));
    }
  }, 600);
}
