const { useState, useEffect, useMemo } = React;

// 🔐 Replace with your actual Supabase values
const SUPABASE_URL = "https://qnfwckmwbudvuijqlkns.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_y5qYE-uYPTtNrdM0vI5tJA_V8IA29U1";

// Grab the Supabase global from the UMD script
const supaGlobal = window.supabase;

if (!supaGlobal) {
  throw new Error(
    'Supabase global is missing. Check the <script src="https://unpkg.com/@supabase/supabase-js@2"></script> tag and its order.'
  );
}

const supabase = supaGlobal.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- Helpers ----------

function createEmptyTrip(initial = {}) {
  const id =
    (window.crypto && crypto.randomUUID && crypto.randomUUID()) ||
    Date.now().toString();

  return {
    id,
    name: initial.name || "New Golf Trip",
    destination: initial.destination || "",
    startDate: initial.startDate || "",
    endDate: initial.endDate || "",
    notes: "",
    players: [],
    rounds: [],
    lodging: [],
    teams: [],
    scores: {},
    itinerary: [],
    expenses: [],
    documents: [],
    links: []
  };
}

// ---------- Components ----------

function AuthBar({ user, onSignIn, onSignOut }) {
  const [email, setEmail] = useState("");

  async function handleSignIn(email) {
  setStatus("Sending magic link...");

  const redirectUrl = window.location.origin + window.location.pathname;
  // e.g. https://gtesten.github.io/golf-trip-planner/

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectUrl
    }
  });

  if (error) {
    console.error(error);
    setStatus("Error sending magic link.");
  } else {
    setStatus("Magic link sent! Check your email.");
  }
}


  return (
    <div
      style={{
        width: "100%",
        padding: "0.45rem 1.5rem",
        borderBottom: "1px solid rgba(148,163,184,0.25)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: "0.8rem",
        background: "rgba(15,23,42,0.92)"
      }}
    >
      {user ? (
        <>
          <span style={{ color: "#9ca3af" }}>
            Signed in as <strong>{user.email}</strong>
          </span>
          <button className="btn-secondary" onClick={onSignOut}>
            Sign out
          </button>
        </>
      ) : (
        <>
          <span style={{ color: "#9ca3af" }}>
            Sign in to sync trips across devices and browsers.
          </span>
          <form
            onSubmit={handleSignIn}
            style={{ display: "flex", gap: "0.4rem" }}
          >
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ minWidth: "200px" }}
            />
            <button className="btn-secondary" type="submit">
              Send magic link
            </button>
          </form>
        </>
      )}
    </div>
  );
}

function Sidebar({
  trips,
  selectedTripId,
  onSelectTrip,
  onNewTrip,
  onDeleteTrip
}) {
  return (
    <aside className="sidebar">
      <h1>Your Trips</h1>
      <small>
        Create a trip for each buddies weekend, annual run, or golf getaway.
      </small>

      <button className="btn" onClick={onNewTrip}>
        <span className="icon">＋</span> New Trip
      </button>

      <div className="trip-list">
        {trips.map((trip) => {
          const isActive = trip.id === selectedTripId;
          const dateLabel =
            trip.startDate || trip.endDate
              ? `${trip.startDate || "?"} → ${trip.endDate || "?"}`
              : "Dates TBD";

          return (
            <div
              key={trip.id}
              className={"trip-item" + (isActive ? " active" : "")}
              onClick={() => onSelectTrip(trip.id)}
            >
              <span className="name">{trip.name || "Untitled Trip"}</span>
              <span className="meta">
                {trip.destination || "Destination TBA"} · {dateLabel}
              </span>
              {isActive && (
                <button
                  className="btn-danger"
                  style={{
                    marginTop: "0.25rem",
                    alignSelf: "flex-start",
                    fontSize: "0.75rem",
                    padding: "0.2rem 0.5rem"
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Delete this trip? This cannot be undone.")) {
                      onDeleteTrip(trip.id);
                    }
                  }}
                >
                  🗑 Delete
                </button>
              )}
            </div>
          );
        })}

        {trips.length === 0 && (
          <p
            style={{
              marginTop: "1.1rem",
              fontSize: "0.82rem",
              color: "#9ca3af"
            }}
          >
            No trips yet. Click <strong>New Trip</strong> to set up your first
            one.
          </p>
        )}
      </div>

      <div className="sidebar-footer">
        Pro tip: build a “Forest Dunes Template” trip once, then duplicate it
        each year.
      </div>
    </aside>
  );
}

function NavTabs({ activeTab, setActiveTab }) {
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "itinerary", label: "Itinerary" },
    { id: "pairings", label: "Pairings & Scores" },
    { id: "expenses", label: "Expenses & Docs" },
    { id: "sharing", label: "Sharing" }
  ];

  return (
    <div className="nav-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={"nav-tab" + (activeTab === tab.id ? " active" : "")}
          onClick={() => setActiveTab(tab.id)}
        >
          <span className="dot" />
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

// ----- Cards for Overview tab -----

function BasicInfoCard({ trip, onChange }) {
  function update(field, value) {
    onChange({ ...trip, [field]: value });
  }

  return (
    <div className="card">
      <div className="card-inner">
        <h3>
          <span className="label">Trip Overview</span>
          <span className="sub">High-level details</span>
        </h3>

        <div className="field-row">
          <div className="field">
            <label>Trip Name</label>
            <input
              value={trip.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Forest Dunes 2026"
            />
          </div>
          <div className="field">
            <label>Destination / Region</label>
            <input
              value={trip.destination}
              onChange={(e) => update("destination", e.target.value)}
              placeholder="Roscommon, MI"
            />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Start Date</label>
            <input
              type="date"
              value={trip.startDate}
              onChange={(e) => update("startDate", e.target.value)}
            />
          </div>
          <div className="field">
            <label>End Date</label>
            <input
              type="date"
              value={trip.endDate}
              onChange={(e) => update("endDate", e.target.value)}
            />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label>Trip Notes</label>
            <textarea
              value={trip.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="7 guys, 4 rounds, shared cabin, rain backup plans, side games, etc."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayersCard({ trip, onChange }) {
  const players = trip.players || [];

  function addPlayer() {
    const id =
      (window.crypto && crypto.randomUUID && crypto.randomUUID()) ||
      Date.now().toString() + Math.random().toString(16).slice(2);
    const updated = {
      ...trip,
      players: [
        ...players,
        { id, name: "", handicap: "", email: "", notes: "" }
      ]
    };
    onChange(updated);
  }

  function updatePlayer(id, field, value) {
    const updatedPlayers = players.map((p) =>
      p.id === id ? { ...p, [field]: value } : p
    );
    onChange({ ...trip, players: updatedPlayers });
  }

  function removePlayer(id) {
    const updatedPlayers = players.filter((p) => p.id !== id);
    onChange({ ...trip, players: updatedPlayers });
  }

  return (
    <div className="card">
      <div className="card-inner">
        <h3>
          <span className="label">Players</span>
          <span className="sub">{players.length} in this trip</span>
        </h3>

        <button className="btn-secondary" onClick={addPlayer}>
          ＋ Add Player
        </button>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Index / HC</th>
                <th>Email</th>
                <th>Notes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id}>
                  <td>
                    <input
                      value={p.name}
                      onChange={(e) =>
                        updatePlayer(p.id, "name", e.target.value)
                      }
                      placeholder="Player name"
                    />
                  </td>
                  <td>
                    <input
                      value={p.handicap}
                      onChange={(e) =>
                        updatePlayer(p.id, "handicap", e.target.value)
                      }
                      placeholder="e.g. 8.2"
                    />
                  </td>
                  <td>
                    <input
                      value={p.email}
                      onChange={(e) =>
                        updatePlayer(p.id, "email", e.target.value)
                      }
                      placeholder="optional"
                    />
                  </td>
                  <td>
                    <input
                      value={p.notes}
                      onChange={(e) =>
                        updatePlayer(p.id, "notes", e.target.value)
                      }
                      placeholder="preferences, room pairings..."
                    />
                  </td>
                  <td>
                    <button
                      className="btn-danger"
                      onClick={() => removePlayer(p.id)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
              {players.length === 0 && (
                <tr>
                  <td
                    colSpan="5"
                    style={{ textAlign: "center", color: "#9ca3af" }}
                  >
                    Add your first player to start building your group.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <small className="help">
          Use this list for pairings, room assignments, and per-player budgeting.
        </small>
      </div>
    </div>
  );
}

function RoundsCard({ trip, onChange }) {
  const rounds = trip.rounds || [];

  function addRound() {
    const id =
      (window.crypto && crypto.randomUUID && crypto.randomUUID()) ||
      Date.now().toString() + Math.random().toString(16).slice(2);
    const updated = {
      ...trip,
      rounds: [...rounds, { id, date: "", course: "", teeTime: "", greenFee: "" }]
    };
    onChange(updated);
  }

  function updateRound(id, field, value) {
    const updatedRounds = rounds.map((r) =>
      r.id === id ? { ...r, [field]: value } : r
    );
    onChange({ ...trip, rounds: updatedRounds });
  }

  function removeRound(id) {
    const updatedRounds = rounds.filter((r) => r.id !== id);
    onChange({ ...trip, rounds: updatedRounds });
  }

  return (
    <div className="card">
      <div className="card-inner">
        <h3>
          <span className="label">Rounds & Tee Times</span>
          <span className="sub">Courses and green fees</span>
        </h3>

        <button className="btn-secondary" onClick={addRound}>
          ＋ Add Round
        </button>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Course</th>
                <th>Tee Time</th>
                <th>Green Fee ($)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rounds.map((r) => (
                <tr key={r.id}>
                  <td>
                    <input
                      type="date"
                      value={r.date}
                      onChange={(e) => updateRound(r.id, "date", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      value={r.course}
                      onChange={(e) =>
                        updateRound(r.id, "course", e.target.value)
                      }
                      placeholder="Course name"
                    />
                  </td>
                  <td>
                    <input
                      value={r.teeTime}
                      onChange={(e) =>
                        updateRound(r.id, "teeTime", e.target.value)
                      }
                      placeholder="e.g. 8:12 AM"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={r.greenFee}
                      onChange={(e) =>
                        updateRound(r.id, "greenFee", e.target.value)
                      }
                      placeholder="0"
                    />
                  </td>
                  <td>
                    <button
                      className="btn-danger"
                      onClick={() => removeRound(r.id)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
              {rounds.length === 0 && (
                <tr>
                  <td
                    colSpan="5"
                    style={{ textAlign: "center", color: "#9ca3af" }}
                  >
                    Add each planned round with an estimated green fee.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <small className="help">
          Include replay / twilight rounds and use 0 for comped rounds if needed.
        </small>
      </div>
    </div>
  );
}

function LodgingCard({ trip, onChange }) {
  const lodging = trip.lodging || [];

  function addNight() {
    const id =
      (window.crypto && crypto.randomUUID && crypto.randomUUID()) ||
      Date.now().toString() + Math.random().toString(16).slice(2);
    const updated = {
      ...trip,
      lodging: [...lodging, { id, date: "", place: "", cost: "" }]
    };
    onChange(updated);
  }

  function updateNight(id, field, value) {
    const updatedLodging = lodging.map((n) =>
      n.id === id ? { ...n, [field]: value } : n
    );
    onChange({ ...trip, lodging: updatedLodging });
  }

  function removeNight(id) {
    const updatedLodging = lodging.filter((n) => n.id !== id);
    onChange({ ...trip, lodging: updatedLodging });
  }

  return (
    <div className="card">
      <div className="card-inner">
        <h3>
          <span className="label">Lodging</span>
          <span className="sub">Cabins, hotels, and rentals</span>
        </h3>

        <button className="btn-secondary" onClick={addNight}>
          ＋ Add Night
        </button>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date / Night</th>
                <th>Place</th>
                <th>Cost / Night ($)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lodging.map((n) => (
                <tr key={n.id}>
                  <td>
                    <input
                      type="date"
                      value={n.date}
                      onChange={(e) => updateNight(n.id, "date", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      value={n.place}
                      onChange={(e) =>
                        updateNight(n.id, "place", e.target.value)
                      }
                      placeholder="Cabin / resort name"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={n.cost}
                      onChange={(e) => updateNight(n.id, "cost", e.target.value)}
                      placeholder="0"
                    />
                  </td>
                  <td>
                    <button
                      className="btn-danger"
                      onClick={() => removeNight(n.id)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
              {lodging.length === 0 && (
                <tr>
                  <td
                    colSpan="4"
                    style={{ textAlign: "center", color: "#9ca3af" }}
                  >
                    Track each night and its cost, even if part of a package.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <small className="help">
          For packages, either enter nightly equivalents or one line with full
          cost.
        </small>
      </div>
    </div>
  );
}

function BudgetCard({ trip }) {
  const players = trip.players || [];
  const rounds = trip.rounds || [];
  const lodging = trip.lodging || [];

  const { totalGreen, totalLodging, total, perPlayer } = useMemo(() => {
    const totalGreen = rounds.reduce((sum, r) => {
      const v = parseFloat(r.greenFee);
      return sum + (isNaN(v) ? 0 : v);
    }, 0);

    const totalLodging = lodging.reduce((sum, n) => {
      const v = parseFloat(n.cost);
      return sum + (isNaN(v) ? 0 : v);
    }, 0);

    const total = totalGreen + totalLodging;
    const headcount = players.length || 1;
    const perPlayer = total / headcount;

    return { totalGreen, totalLodging, total, perPlayer };
  }, [players, rounds, lodging]);

  return (
    <div className="card">
      <div className="card-inner">
        <h3>
          <span className="label">Budget Summary</span>
          <span className="badge">
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: "#22c55e",
                boxShadow: "0 0 6px rgba(34,197,94,0.9)"
              }}
            />
            Live estimate
          </span>
        </h3>

        <div className="summary-line">
          <span className="label">Players</span>
          <span className="value">{players.length || 0}</span>
        </div>
        <div className="summary-line">
          <span className="label">Total Green Fees</span>
          <span className="value">${totalGreen.toFixed(0)}</span>
        </div>
        <div className="summary-line">
          <span className="label">Total Lodging</span>
          <span className="value">${totalLodging.toFixed(0)}</span>
        </div>
        <div className="summary-total summary-line">
          <span className="label">Trip Total</span>
          <span className="value">${total.toFixed(0)}</span>
        </div>
        <div className="summary-line">
          <span className="label">Estimated Per Player</span>
          <span className="value">
            {players.length > 0
              ? `$${perPlayer.toFixed(0)}`
              : "Add players to see per-person"}
          </span>
        </div>
        <small className="help">
          Currently includes golf + lodging. You can add more categories later
          in an Expenses tab.
        </small>
      </div>
    </div>
  );
}

function PlaceholderCard({ title, children }) {
  return (
    <div className="card">
      <div className="card-inner">
        <h3>
          <span className="label">{title}</span>
        </h3>
        <div style={{ fontSize: "0.85rem", color: "#9ca3af" }}>{children}</div>
      </div>
    </div>
  );
}

// ---------- Main App ----------

function App() {
  const [user, setUser] = useState(null);
  const [trips, setTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  // Theme toggle
  useEffect(() => {
    const btn = document.getElementById("theme-toggle");
    const current = localStorage.getItem("golfTripPlannerTheme") || "dark";
    if (current === "light") {
      document.body.classList.add("light-theme");
      btn.textContent = "☀ Light";
    } else {
      document.body.classList.remove("light-theme");
      btn.textContent = "🌙 Dark";
    }
    btn.onclick = () => {
      const isLight = document.body.classList.toggle("light-theme");
      btn.textContent = isLight ? "☀ Light" : "🌙 Dark";
      localStorage.setItem("golfTripPlannerTheme", isLight ? "light" : "dark");
    };
  }, []);

  // Initial auth check + listener
  useEffect(() => {
    async function initAuth() {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setUser(data.session.user);
      }
      supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });
    }
    initAuth();
  }, []);

  // Load trips when user changes
  useEffect(() => {
    async function loadTrips() {
      if (!user) {
        setTrips([]);
        setSelectedTripId(null);
        return;
      }
      const { data, error } = await supabase
        .from("trips")
        .select("id, name, data, created_at")
        .order("created_at", { ascending: true });

      if (error) {
        console.error(error);
        setStatus("Error loading trips.");
        return;
      }

      const mapped = (data || []).map((row) => ({
        id: row.id,
        ...(row.data || {}),
        name: row.name || (row.data?.name ?? "Untitled Trip")
      }));

      setTrips(mapped);
      if (mapped.length > 0) {
        setSelectedTripId((prev) => prev || mapped[0].id);
      }
    }

    loadTrips();
  }, [user]);

  const selectedTrip =
    trips.find((t) => t.id === selectedTripId) || trips[0] || null;

  async function handleSignIn(email) {
    setStatus("Sending magic link...");
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
      console.error(error);
      setStatus("Error sending magic link.");
    } else {
      setStatus("Magic link sent! Check your email.");
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setStatus("Signed out.");
  }

  async function handleNewTrip() {
    if (!user) {
      alert("Sign in first to save trips to your account.");
      return;
    }

    const trip = createEmptyTrip({ name: "New Golf Trip" });
    setSaving(true);
    setStatus("Creating trip...");
    const { data, error } = await supabase
      .from("trips")
      .insert({
        owner_id: user.id,
        name: trip.name,
        data: trip
      })
      .select()
      .single();

    setSaving(false);

    if (error) {
      console.error(error);
      setStatus("Error creating trip.");
      return;
    }

    const newTrip = {
      id: data.id,
      ...(data.data || trip)
    };

    setTrips((prev) => [...prev, newTrip]);
    setSelectedTripId(newTrip.id);
    setStatus("Trip created.");
  }

  async function handleDeleteTrip(id) {
    if (!user) return;
    setSaving(true);
    setStatus("Deleting trip...");
    const { error } = await supabase.from("trips").delete().eq("id", id);

    setSaving(false);
    if (error) {
      console.error(error);
      setStatus("Error deleting trip.");
      return;
    }

    setTrips((prev) => prev.filter((t) => t.id !== id));
    if (id === selectedTripId) {
      const remaining = trips.filter((t) => t.id !== id);
      setSelectedTripId(remaining[0]?.id || null);
    }
    setStatus("Trip deleted.");
  }

  function updateTripLocal(updated) {
    setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  async function saveTrip(updated) {
    if (!user) {
      alert("Sign in first to save trips.");
      return;
    }
    setSaving(true);
    setStatus("Saving trip...");

    const { error } = await supabase
      .from("trips")
      .update({
        name: updated.name,
        data: updated
      })
      .eq("id", updated.id);

    setSaving(false);

    if (error) {
      console.error(error);
      setStatus("Error saving trip.");
    } else {
      setStatus("Trip saved.");
    }
  }

  function handleTripChange(updated) {
    updateTripLocal(updated);
  }

  function duplicateTrip() {
    if (!user || !selectedTrip) {
      alert("Sign in and select a trip first.");
      return;
    }
    const base = selectedTrip;
    const clone = createEmptyTrip();
    const copy = {
      ...base,
      id: clone.id,
      name: (base.name || "Trip") + " (Copy)"
    };
    (async () => {
      setSaving(true);
      setStatus("Duplicating trip...");
      const { data, error } = await supabase
        .from("trips")
        .insert({
          owner_id: user.id,
          name: copy.name,
          data: copy
        })
        .select()
        .single();
      setSaving(false);
      if (error) {
        console.error(error);
        setStatus("Error duplicating trip.");
        return;
      }
      const newTrip = {
        id: data.id,
        ...(data.data || copy)
      };
      setTrips((prev) => [...prev, newTrip]);
      setSelectedTripId(newTrip.id);
      setStatus("Trip duplicated.");
    })();
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column"
      }}
    >
      <AuthBar
        user={user}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />
      <div className="app">
        <Sidebar
          trips={trips}
          selectedTripId={selectedTripId}
          onSelectTrip={setSelectedTripId}
          onNewTrip={handleNewTrip}
          onDeleteTrip={handleDeleteTrip}
        />
        <main className="main">
          {status && (
            <div
              style={{
                fontSize: "0.75rem",
                color: "#9ca3af",
                marginBottom: "0.4rem"
              }}
            >
              {saving ? "⏳ " : "✅ "} {status}
            </div>
          )}

          {!selectedTrip ? (
            <div className="empty-state">
              <p>
                {user
                  ? "Create your first trip to start planning. You’ll be able to add players, rounds, lodging, teams, and more."
                  : "Sign in and create a trip to start planning."}
              </p>
            </div>
          ) : (
            <>
              <div className="main-header">
                <div className="main-header-left">
                  <h2>{selectedTrip.name || "Untitled Trip"}</h2>
                  <p>
                    {selectedTrip.destination || "Destination TBA"} ·{" "}
                    {selectedTrip.startDate || "?"} →{" "}
                    {selectedTrip.endDate || "?"}
                  </p>
                </div>
                <div className="main-header-right">
                  <span className="pill">
                    <span className="dot" /> Synced to Supabase
                  </span>
                  <button className="btn-secondary" onClick={duplicateTrip}>
                    ⧉ Duplicate Trip
                  </button>
                  <button
                    className="btn"
                    onClick={() => saveTrip(selectedTrip)}
                  >
                    💾 Save Trip
                  </button>
                </div>
              </div>

              <NavTabs activeTab={activeTab} setActiveTab={setActiveTab} />

              {activeTab === "overview" && (
                <>
                  <div className="section-title">Trip setup</div>
                  <div className="grid">
                    <BasicInfoCard
                      trip={selectedTrip}
                      onChange={handleTripChange}
                    />
                    <BudgetCard trip={selectedTrip} />
                  </div>

                  <div className="section-title">Golf & group</div>
                  <div className="grid">
                    <PlayersCard
                      trip={selectedTrip}
                      onChange={handleTripChange}
                    />
                    <RoundsCard
                      trip={selectedTrip}
                      onChange={handleTripChange}
                    />
                  </div>

                  <div className="section-title">Stay</div>
                  <div className="grid">
                    <LodgingCard
                      trip={selectedTrip}
                      onChange={handleTripChange}
                    />
                  </div>
                </>
              )}

              {activeTab === "itinerary" && (
                <>
                  <div className="section-title">Itinerary</div>
                  <div className="grid">
                    <PlaceholderCard title="Daily Plan">
                      Itinerary editor (Day 1, Day 2, etc.) will go here. We’ll
                      hook this into your rounds + lodging next.
                    </PlaceholderCard>
                  </div>
                </>
              )}

              {activeTab === "pairings" && (
                <>
                  <div className="section-title">Pairings & Scores</div>
                  <div className="grid">
                    <PlaceholderCard title="Teams & Scoreboard">
                      Team setups and scoring table will go here (per-round
                      scores, team totals, leaderboard).
                    </PlaceholderCard>
                  </div>
                </>
              )}

              {activeTab === "expenses" && (
                <>
                  <div className="section-title">Expenses & Documents</div>
                  <div className="grid">
                    <PlaceholderCard title="Trip Expenses">
                      We'll add an expense table here for food, travel, side
                      games, etc. You can also track who paid what.
                    </PlaceholderCard>
                    <PlaceholderCard title="Documents & Links">
                      Store Google Drive / Dropbox / PDF links here (itinerary
                      PDF, confirmations, etc.).
                    </PlaceholderCard>
                  </div>
                </>
              )}

              {activeTab === "sharing" && (
                <>
                  <div className="section-title">Invite & Sharing</div>
                  <div className="grid">
                    <PlaceholderCard title="Invite Your Group">
                      We can add an email invite template and a "copy trip
                      summary" block here. For now, just share this page and
                      have everyone log in with their own account.
                    </PlaceholderCard>
                  </div>
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// Mount
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
