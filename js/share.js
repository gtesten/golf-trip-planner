// js/share.js
// Share model via URL (Base64URL JSON). Great for small/medium trips.
// Also supports download/upload JSON.

export function toBase64Url(str) {
  const b64 = btoa(unescape(encodeURIComponent(str)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function fromBase64Url(b64url) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4);
  const str = decodeURIComponent(escape(atob(b64)));
  return str;
}

export function buildShareUrl(model) {
  // Keep it lightweight: remove transient UI state that isn't needed for a share view
  const clean = structuredClone(model);
  if (clean.ui) {
    delete clean.ui.printRoundId;
    delete clean.ui.openRoundId;
    delete clean.ui.roundViews;
  }

  const payload = toBase64Url(JSON.stringify(clean));
  const url = new URL(window.location.href);
  url.searchParams.set("share", "1");
  url.searchParams.set("data", payload);
  return url.toString();
}

export function readShareModelFromUrl() {
  const url = new URL(window.location.href);
  const share = url.searchParams.get("share");
  const data = url.searchParams.get("data");
  if (share !== "1" || !data) return null;

  try {
    const json = fromBase64Url(data);
    return JSON.parse(json);
  } catch (e) {
    console.error("[share] Failed to parse share model", e);
    return null;
  }
}

export function downloadModelJson(model, filename = "golf-trip-planner.json") {
  const blob = new Blob([JSON.stringify(model, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
}
