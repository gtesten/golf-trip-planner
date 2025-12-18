// js/toast.js
export function initToast() {
  let el = document.querySelector("#gtpToast");
  if (!el) {
    el = document.createElement("div");
    el.id = "gtpToast";
    el.className = "gtp-toast";
    el.innerHTML = `<span id="gtpToastText"></span>`;
    document.body.appendChild(el);
  }

  const text = el.querySelector("#gtpToastText");

  const show = (msg, mode = "info") => {
    el.dataset.mode = mode;
    text.textContent = msg;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), 1200);
  };

  window.addEventListener("gtp:save:status", (e) => {
    const s = e.detail?.status;
    if (s === "saving") show("Saving…", "info");
    if (s === "saved") show("Saved ✓", "ok");
    if (s === "error") show("Save failed", "err");
  });
}
