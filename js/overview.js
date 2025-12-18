// js/overview.js
// Read-only dashboard derived from the shared model:
// - Players + rounds summary
// - Itinerary summary (auto updates)
// - Simple leaderboard + vs par (when scores exist)

export function renderOverview(model) {
  const root = document.querySelector("#overviewRoot");
  if (!root) return;

  const players = Array.isArray(model?.players) ? model.players : [];
  const rounds = Array.isArray(model?.rounds) ? model.rounds : [];
  const itinerary = Array.isArray(model?.itineraryDays) ? model.itineraryDays : [];

  const tripName =
    (model?.tripName && String(model.tripName).trim()) ||
    `Golf Trip — ${players.length} Players / ${rounds.length} Rounds`;

  const dateText = itineraryDates(itinerary);
  const primaryCourse = mostCommon(
    rounds.map(r => String(r?.course ?? "").trim()).filter(Boolean)
  ) || "—";

  const roundSummary = rounds.length
    ? rounds.map((r, i) => ({
        name: String(r?.title ?? `Round ${i + 1}`),
        course: String(r?.course ?? "—"),
        holes: Number(r?.holes ?? model?.defaultHoles ?? 18) || 18,
      }))
    : [];

  const leaderboard = buildLeaderboard(model);

  root.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <h2 class="panel-title">Overview</h2>
      </div>

      <div class="grid grid-3" style="margin-top:12px">
        <div class="card">
          <div class="muted">Trip</div>
          <div style="font-weight:900; font-size:18px; margin-top:6px">${escapeHtml(tripName)}</div>
          <div class="muted" style="margin-top:6px">Dates: <b>${escapeHtml(dateText)}</b></div>
          <div class="muted" style="margin-top:4px">Primary course: <b>${escapeHtml(primaryCourse)}</b></div>
        </div>

        <div class="card">
          <div class="muted">Players</div>
          <div style="font-weight:900; font-size:24px; margin-top:6px">${players.length}</div>
          <div class="muted" style="margin-top:8px">${players.length ? escapeHtml(players.join(", ")) : "—"}</div>
        </div>

        <div class="card">
          <div class="muted">Rounds</div>
          <div style="font-weight:900; font-size:24px; margin-top:6px">${rounds.length}</div>
          <div class="muted" style="margin-top:8px">${roundSummary.length ? "See breakdown below" : "—"}</div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:14px">
        <div class="card">
          <div style="font-weight:900; margin-bottom:10px">Rounds at a glance</div>
          ${roundSummary.length ? renderRoundsList(roundSummary) : `<div class="muted">No rounds yet.</div>`}
        </div>

        <div class="card">
          <div style="font-weight:900; margin-bottom:10px">Leaderboard</div>
          ${leaderboard.length ? renderLeaderboard(leaderboard) : `<div class="muted">Enter scores in Pairings & Scores to see standings.</div>`}
        </div>
      </div>

      <div class="card" style="margin-top:14px">
        <div style="font-weight:900; margin-bottom:10px">Itinerary</div>
        ${itinerary.length ? renderItinerary(itinerary) : `<div class="muted">No itinerary yet. Add days in the Itinerary tab.</div>`}
      </div>
    </section>
  `;
}

// Overview is read-only; keep this exported for compatibility with app.mjs safeCall
export function bindOverviewUI() {}

/* ------------------------
   Rendering helpers
------------------------- */

function renderRoundsList(items) {
  const rows = items
    .map(
      r => `
      <div style="display:flex; justify-content:space-between; gap:12px; padding:8px 0; border-bottom:1px solid rgba(148,163,184,.18)">
        <div>
          <div style="font-weight:800">${escapeHtml(r.name)}</div>
          <div class="muted">${escapeHtml(r.course)}</div>
        </div>
        <div style="font-weight:900">${r.holes} holes</div>
      </div>
    `
    )
    .join("");

  return `<div>${rows}</div>`;
}

function renderLeaderboard(entries) {
  // entries already sorted best first
  const rows = entries.slice(0, 10).map((e, i) => {
    return `
      <div style="display:flex; align-items:baseline; justify-content:space-between; gap:12px; padding:8px 0; border-bottom:1px solid rgba(148,163,184,.18)">
        <div style="display:flex; gap:10px; align-items:baseline;">
          <div style="font-weight:900; width:22px">${i + 1}</div>
          <div style="font-weight:800">${escapeHtml(e.name)}</div>
        </div>
        <div style="display:flex; gap:14px; align-items:baseline;">
          <div class="muted">Total: <b>${e.total}</b></div>
          <div class="muted">Vs Par: <b>${formatVsPar(e.vsPar)}</b></div>
        </div>
      </div>
    `;
  }).join("");

  return `<div>${rows}</div>`;
}

function renderItinerary(days) {
  // Sort if the user typed day labels like "Thu", "Fri" etc. We keep original order otherwise.
  const rows = days.map((d, idx) => {
    const date = String(d?.date ?? "").trim() || `Day ${idx + 1}`;
    const title = String(d?.title ?? "").trim();
    const notes = String(d?.notes ?? "").trim();

    return `
      <div style="padding:10px 0; border-bottom:1px solid rgba(148,163,184,.18)">
        <div style="display:flex; justify-content:space-between; gap:12px;">
          <div style="font-weight:900">${escapeHtml(date)}</div>
          <div class="muted">${title ? escapeHtml(title) : ""}</div>
        </div>
        ${notes ? `<div class="muted" style="margin-top:6px; white-space:pre-wrap">${escapeHtml(notes)}</div>` : ""}
      </div>
    `;
  }).join("");

  return `<div>${rows}</div>`;
}

/* ------------------------
   Data helpers
------------------------- */

function itineraryDates(days) {
  const dates = days.map(d => String(d?.date ?? "").trim()).filter(Boolean);
  if (!dates.length) return "—";
  // if they’re true dates, keep as typed; otherwise show first..last style when possible
  if (dates.length === 1) return dates[0];
  return `${dates[0]} → ${dates[dates.length - 1]}`;
}

function buildLeaderboard(model) {
  const rounds = Array.isArray(model?.rounds) ? model.rounds : [];
  const totals = new Map(); // name -> { total, vsPar }

  rounds.forEach(r => {
    const holes = Number(r?.holes ?? model?.defaultHoles ?? 18) || 18;
    const parArr = Array.isArray(r?.par) ? r.par : [];
    const parTotal = sumNumbers(parArr.slice(0, holes));

    const groups = Array.isArray(r?.groups) ? r.groups : [];
    groups.forEach(g => {
      const pls = Array.isArray(g?.players) ? g.players : [];
      pls.forEach(p => {
        const name = String(p?.name ?? "").trim();
        if (!name) return;

        const scores = Array.isArray(p?.scores) ? p.scores : [];
        const scoreTotal = sumNumbers(scores.slice(0, holes));

        if (!totals.has(name)) totals.set(name, { name, total: 0, vsPar: 0 });
        const cur = totals.get(name);

        cur.total += scoreTotal;
        // only compute vsPar meaningfully if par exists; if parTotal is 0, leave vsPar 0
        if (parTotal > 0) cur.vsPar += (scoreTotal - parTotal);
      });
    });
  });

  const arr = Array.from(totals.values())
    // Filter out empty players (all zeros) so leaderboard doesn't show noise until scoring begins
    .filter(x => x.total > 0);

  // Sort: best vsPar first, then total
  arr.sort((a, b) => {
    if (a.vsPar !== b.vsPar) return a.vsPar - b.vsPar;
    return a.total - b.total;
  });

  return arr;
}

function sumNumbers(arr) {
  let t = 0;
  for (const v of arr) {
    const n = Number(String(v ?? "").trim());
    if (Number.isFinite(n)) t += n;
  }
  return t;
}

function mostCommon(arr) {
  const m = new Map();
  arr.forEach(v => m.set(v, (m.get(v) || 0) + 1));
  let best = null, bestN = 0;
  for (const [k, n] of m.entries()) {
    if (n > bestN) { best = k; bestN = n; }
  }
  return best;
}

function formatVsPar(v) {
  if (!Number.isFinite(v)) return "—";
  if (v === 0) return "E";
  return v > 0 ? `+${v}` : `${v}`;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
