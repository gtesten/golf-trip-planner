function safeLink(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    return u.href;
  } catch {
    return "";
  }
}

export function renderOverview(model) {
  const root = document.getElementById("overviewContent");
  root.innerHTML = "";

  const trip = model.trip ?? {};
  const tripName = trip.name || "Your Golf Trip";
  const roster = (trip.roster || "").trim();
  const map = safeLink(trip.mapLink || "");

  // Trip summary card
  const c1 = document.createElement("div");
  c1.className = "card";
  c1.innerHTML = `
    <div class="card-title">${tripName}</div>
    <div class="muted">
      ${trip.dates ? `<div><b>Dates:</b> ${trip.dates}</div>` : ""}
      ${trip.location ? `<div><b>Location:</b> ${trip.location}</div>` : ""}
      ${trip.lodging ? `<div><b>Lodging:</b> ${trip.lodging}</div>` : ""}
      ${map ? `<div><b>Map:</b> <a href="${map}" target="_blank" rel="noreferrer">${map}</a></div>` : ""}
    </div>
    ${trip.notes ? `<div class="divider"></div><div>${trip.notes.replaceAll("\n","<br>")}</div>` : ""}
  `;
  root.appendChild(c1);

  // Roster
  if (roster) {
    const c2 = document.createElement("div");
    c2.className = "card";
    c2.innerHTML = `
      <div class="card-title">Roster</div>
      <div>${roster.replaceAll("\n","<br>")}</div>
    `;
    root.appendChild(c2);
  }

  // Itinerary summary (first 5 days shown)
  const itin = Array.isArray(model.itinerary) ? model.itinerary : [];
  const c3 = document.createElement("div");
  c3.className = "card";
  const items = itin.slice(0, 5).map((d, i) => {
    const label = d.label || `Day ${i + 1}`;
    const notes = (d.notes || "").split("\n").slice(0, 3).join(" • ");
    return `<li><b>${label}:</b> ${notes || ""}</li>`;
  }).join("");
  c3.innerHTML = `
    <div class="card-title">Itinerary Snapshot</div>
    ${itin.length ? `<ul>${items}</ul>` : `<div class="muted">No itinerary yet.</div>`}
    ${itin.length > 5 ? `<div class="muted small">Showing first 5 days.</div>` : ""}
  `;
  root.appendChild(c3);

  // Rounds summary
  const rounds = Array.isArray(model.rounds) ? model.rounds : [];
  const c4 = document.createElement("div");
  c4.className = "card";
  c4.innerHTML = `
    <div class="card-title">Rounds</div>
    ${rounds.length ? `<ol>${rounds.map(r => `<li>${r.name || "Round"} (${r.holes || 18} holes)</li>`).join("")}</ol>` : `<div class="muted">No rounds created yet.</div>`}
  `;
  root.appendChild(c4);

}

export function bindOverviewUI(model) {
  document.getElementById("btnPrintOverview").addEventListener("click", () => {
    window.print(); // browser print -> Save as PDF
  });
}
