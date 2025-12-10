const { useState, useEffect, useMemo } = React;

// ✅ Put your Supabase URL + anon key here
const SUPABASE_URL = "https://qnfwckmwbudvuijqlkns.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuZndja213YnVkdnVpanFsa25zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzOTI4MzksImV4cCI6MjA4MDk2ODgzOX0.dwMCVUoOsk2RxEeOI93pvmejaKwGDM9k6hxbrfPHgFs";

const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// ----------------- Helpers -----------------

function createEmptyTrip(initial = {}) {
  const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
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

// ----------------- Components -----------------

function AuthBar({ user, onSignIn, onSignOut }) {
  const [email, setEmail] = useState("");

  async function handleSignIn(e) {
    e.preventDefault();
    if (!email) return;
    await onSignIn(email);
    setEmail("");
  }

  return (
    <div style={{
      width: "100%",
      padding: "0.45rem 1.5rem",
      borderBottom: "1px solid rgba(148,163,184,0.25)",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      fontSize: "0.8rem",
      background: "rgba(15,23,42,0.92)"
    }}>
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
          <form onSubmit={handleSignIn} style={{ display: "flex", gap: "0.4rem" }}>
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

function Sidebar({ trips, selectedTripId, onSelectTrip, onNewTrip, onDeleteTrip }) {
  return (
    <aside className="sidebar">
      <h1>Your Trips</h1>
      <small>Create a trip for each buddies weekend, annual run, or golf getaway.</small>

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
          <p style={{ marginTop: "1.1rem", fontSize: "0.82rem", color: "#9ca3af" }}>
            No trips yet. Click <strong>New Trip</strong> to set up your first one.
          </p>
        )}
      </div>

      <div className="sidebar-footer">
        Pro tip: build a “Forest Dunes Template” trip once, then use <strong>Duplicate Trip</strong> each year.
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

// NOTE: For brevity, I'll stub the detailed cards here.
// You can paste our existing BasicInfo / Players / Rounds / Lodging / Budget / Teams cards in,
// then we’ll extend them with itinerary/expenses/sharing.

function PlaceholderCard({ title, children }) {
  return (
    <div className="card">
      <div className="card-inner">
        <h3><span className="label">{title}</span></h3>
        <div style={{ fontSize: "0.85rem", color: "#9ca3af" }}>{children}</div>
      </div>
    </div>
  );
}

// ----------------- Main App -----------------

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

  // Initial auth check
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
        .select("id, name, data")
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
        setSelectedTripId(mapped[0].id);
      }
    }

    loadTrips();
  }, [user]);

  const selectedTrip = trips.find((t) => t.id === selectedTripId) || null;

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
    const { error } = await supabase
      .from("trips")
      .delete()
      .eq("id", id);

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
    const clone = createEmptyTrip();
    // Copy most data
    const copy = {
      ...selectedTrip,
      id: clone.id,
      name: (selectedTrip.name || "Trip") + " (Copy)"
    };
    // Save to backend
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
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AuthBar user={user} onSignIn={handleSignIn} onSignOut={handleSignOut} />
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
            <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginBottom: "0.4rem" }}>
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
                    {selectedTrip.startDate || "?"} → {selectedTrip.endDate || "?"}
                  </p>
                </div>
                <div className="main-header-right">
                  <span className="pill">
                    <span className="dot" /> Auto-saved to Supabase
                  </span>
                  <button className="btn-secondary" onClick={duplicateTrip}>
                    ⧉ Duplicate Trip
                  </button>
                  <button className="btn" onClick={() => saveTrip(selectedTrip)}>
                    💾 Save Trip
                  </button>
                </div>
              </div>

              <NavTabs activeTab={activeTab} setActiveTab={setActiveTab} />

              {activeTab === "overview" && (
                <>
                  <div className="section-title">Trip setup</div>
                  <div className="grid">
                    <PlaceholderCard title="Trip Overview">
                      {/* Replace with your BasicInfo + Budget cards */}
                      Overview card goes here (we’ll wire your real fields next).
                    </PlaceholderCard>
                    <PlaceholderCard title="Budget Summary">
                      Budget summary card goes here.
                    </PlaceholderCard>
                  </div>
                  <div className="section-title">Golf & group</div>
                  <div className="grid">
                    <PlaceholderCard title="Players">Players card goes here.</PlaceholderCard>
                    <PlaceholderCard title="Rounds & Tee Times">Rounds card goes here.</PlaceholderCard>
                  </div>
                </>
              )}

              {activeTab === "itinerary" && (
                <>
                  <div className="section-title">Itinerary</div>
                  <div className="grid">
                    <PlaceholderCard title="Daily Plan">
                      Itinerary editor goes here (Day 1, Day 2, etc).
                    </PlaceholderCard>
                  </div>
                </>
              )}

              {activeTab === "pairings" && (
                <>
                  <div className="section-title">Pairings & Scores</div>
                  <div className="grid">
                    <PlaceholderCard title="Teams & Scoreboard">
                      Teams & scoring UI goes here.
                    </PlaceholderCard>
                  </div>
                </>
              )}

              {activeTab === "expenses" && (
                <>
                  <div className="section-title">Expenses & Documents</div>
                  <div className="grid">
                    <PlaceholderCard title="Trip Expenses">
                      Expense table goes here.
                    </PlaceholderCard>
                    <PlaceholderCard title="Documents & Links">
                      Store Google Drive / Dropbox / PDF links here.
                    </PlaceholderCard>
                  </div>
                </>
              )}

              {activeTab === "sharing" && (
                <>
                  <div className="section-title">Invite & Sharing</div>
                  <div className="grid">
                    <PlaceholderCard title="Invite Your Group">
                      Email invite template + copy link UI goes here.
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
