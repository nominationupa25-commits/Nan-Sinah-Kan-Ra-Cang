import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  HashRouter,
  Routes,
  Route,
  Link,
  useNavigate,
} from "react-router-dom";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import "./styles.css";

function Home() {
  return (
    <div className="home-page">
      <div className="home-card">
        <h1>NAN SINAH KAN RA CANG</h1>
        <p>Live Trip & Public View</p>

        <div className="home-buttons">
          <Link className="primary-button" to="/public">
            PUBLIC VIEW
          </Link>

          <Link className="secondary-button" to="/admin/login">
            DRIVER LOGIN
          </Link>
        </div>
      </div>
    </div>
  );
}

function PublicView() {
  const [trip, setTrip] = useState(null);
  const [stops, setStops] = useState([]);
  const [notification, setNotification] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadPublicTrip() {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const { data: tripData } = await supabase
      .from("trips")
      .select("*")
      .eq("is_public_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!tripData) {
      setTrip(null);
      setStops([]);
      setNotification(null);
      setLoading(false);
      return;
    }

    const { data: stopData } = await supabase
      .from("trip_stops")
      .select(
        `
        *,
        places (
          id,
          name,
          address,
          latitude,
          longitude
        )
      `
      )
      .eq("trip_id", tripData.id)
      .order("stop_order", { ascending: true });

    const { data: notificationData } = await supabase
      .from("notifications")
      .select("*")
      .eq("trip_id", tripData.id)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setTrip(tripData);
    setStops(stopData || []);
    setNotification(notificationData || null);
    setLoading(false);
  }

  useEffect(() => {
    loadPublicTrip();

    if (!supabase) return;

    const channel = supabase
      .channel("public-trip-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trips" },
        loadPublicTrip
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trip_stops" },
        loadPublicTrip
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        loadPublicTrip
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="public-page">
        <div className="loading-card">Loading...</div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="public-page">
        <div className="public-card">
          <h1>NAN SINAH KAN RA CANG</h1>
          <div className="empty-state">
            <h2>No Active Trip</h2>
            <p>There is no active trip right now.</p>
          </div>
          <Link className="secondary-button" to="/">
            BACK
          </Link>
        </div>
      </div>
    );
  }

  const currentStop =
    stops.find((stop) => stop.status === "current") ||
    stops.find((stop) => stop.status === "coming") ||
    stops.find((stop) => stop.status === "arrived");

  const nextStop = stops.find(
    (stop) =>
      stop.status === "pending" &&
      stop.stop_order >
        (currentStop?.stop_order || 0)
  );

  return (
    <div className="public-page">
      <div className="public-card">
        <div className="public-header">
          <h1>NAN SINAH KAN RA CANG</h1>
          <span className="live-badge">● LIVE</span>
        </div>

        {notification && (
          <div className="public-notification">
            <h2>{notification.title}</h2>
            <p>{notification.message}</p>

            {notification.address && (
              <div className="notification-address">
                📍 {notification.address}
              </div>
            )}
          </div>
        )}

        <div className="public-section">
          <h3>CURRENT</h3>

          {currentStop?.places ? (
            <div className="public-place">
              <div className="place-icon">🏠</div>
              <div>
                <strong>{currentStop.places.name}</strong>
                <p>{currentStop.places.address}</p>
              </div>
            </div>
          ) : (
            <p>No current place.</p>
          )}
        </div>

        <div className="public-section">
          <h3>NEXT</h3>

          {nextStop?.places ? (
            <div className="public-place">
              <div className="place-icon">🏠</div>
              <div>
                <strong>{nextStop.places.name}</strong>
                <p>{nextStop.places.address}</p>
              </div>
            </div>
          ) : (
            <p>No next destination.</p>
          )}
        </div>

        <div className="public-status">
          <span>Trip Status</span>
          <strong>● {String(trip.status || "").toUpperCase()}</strong>
        </div>

        <Link className="secondary-button full-button" to="/">
          HOME
        </Link>
      </div>
    </div>
  );
}

function AdminLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(event) {
    event.preventDefault();
    setError("");

    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }

    setLoading(true);

    const { error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    setLoading(false);

    if (loginError) {
      setError(loginError.message);
      return;
    }

    navigate("/admin");
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={login}>
        <h1>NAN SINAH KAN RA CANG</h1>
        <h2>DRIVER LOGIN</h2>

        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter email"
          required
        />

        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
          required
        />

        {error && <div className="error-message">{error}</div>}

        <button className="primary-button full-button" disabled={loading}>
          {loading ? "LOGGING IN..." : "LOGIN"}
        </button>

        <Link className="secondary-button full-button" to="/">
          BACK
        </Link>
      </form>
    </div>
  );
}

function Admin() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [places, setPlaces] = useState([]);
  const [trip, setTrip] = useState(null);
  const [stops, setStops] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const [placeName, setPlaceName] = useState("");
  const [placeAddress, setPlaceAddress] = useState("");

  const [selectedPlaces, setSelectedPlaces] = useState([]);

  const [message, setMessage] = useState("");
  const [noticeTitle, setNoticeTitle] = useState("");

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const { data } = await supabase.auth.getUser();

    if (!data.user) {
      navigate("/admin/login");
      return;
    }

    setUser(data.user);
    await loadData();
    setLoading(false);
  }

  async function loadData() {
    if (!supabase) return;

    const { data: placeData } = await supabase
      .from("places")
      .select("*")
      .order("created_at", { ascending: false });

    setPlaces(placeData || []);

    const { data: tripData } = await supabase
      .from("trips")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!tripData) {
      setTrip(null);
      setStops([]);
      setNotifications([]);
      return;
    }

    setTrip(tripData);

    const { data: stopData } = await supabase
      .from("trip_stops")
      .select(
        `
        *,
        places (
          id,
          name,
          address
        )
      `
      )
      .eq("trip_id", tripData.id)
      .order("stop_order", { ascending: true });

    setStops(stopData || []);

    const { data: notificationData } = await supabase
      .from("notifications")
      .select("*")
      .eq("trip_id", tripData.id)
      .order("created_at", { ascending: false });

    setNotifications(notificationData || []);
  }

  useEffect(() => {
    if (!supabase || !user) return;

    const channel = supabase
      .channel("admin-live-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trips" },
        loadData
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trip_stops" },
        loadData
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "places" },
        loadData
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        loadData
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  async function addPlace(event) {
    event.preventDefault();

    if (!placeName.trim() || !placeAddress.trim()) return;

    const { error } = await supabase.from("places").insert({
      name: placeName.trim(),
      address: placeAddress.trim(),
      created_by: user.id,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setPlaceName("");
    setPlaceAddress("");
    await loadData();
  }

  async function deletePlace(id) {
    const confirmed = window.confirm(
      "Delete this place?"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("places")
      .delete()
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    setSelectedPlaces((current) =>
      current.filter((item) => item !== id)
    );

    await loadData();
  }

  function togglePlace(placeId) {
    setSelectedPlaces((current) => {
      if (current.includes(placeId)) {
        return current.filter((id) => id !== placeId);
      }

      return [...current, placeId];
    });
  }

  async function startTrip() {
    if (selectedPlaces.length === 0) {
      alert("Please select at least one place.");
      return;
    }

    const { data: newTrip, error: tripError } =
      await supabase
        .from("trips")
        .insert({
          status: "active",
          created_by: user.id,
          is_public_active: true,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (tripError) {
      alert(tripError.message);
      return;
    }

    const tripStops = selectedPlaces.map((placeId, index) => ({
      trip_id: newTrip.id,
      place_id: placeId,
      stop_order: index + 1,
      status: index === 0 ? "current" : "pending",
    }));

    const { error: stopsError } = await supabase
      .from("trip_stops")
      .insert(tripStops);

    if (stopsError) {
      alert(stopsError.message);
      return;
    }

    setSelectedPlaces([]);
    await loadData();

    document
      .getElementById("current-trip")
      ?.scrollIntoView({ behavior: "smooth" });
  }

  async function updateTripStatus(status) {
    if (!trip) return;

    const { error } = await supabase
      .from("trips")
      .update({
        status,
        is_public_active: status !== "done",
        completed_at:
          status === "done"
            ? new Date().toISOString()
            : null,
      })
      .eq("id", trip.id);

    if (error) {
      alert(error.message);
      return;
    }

    await updateCurrentStopForStatus(status);
    await loadData();
  }

  async function updateCurrentStopForStatus(status) {
    if (!trip || stops.length === 0) return;

    const current =
      stops.find((stop) => stop.status === "current") ||
      stops.find((stop) => stop.status === "coming") ||
      stops.find((stop) => stop.status === "arrived");

    if (!current) return;

    let stopStatus = current.status;
    const update = {};

    if (status === "coming") {
      stopStatus = "coming";
      update.coming_at = new Date().toISOString();
    }

    if (status === "arrived") {
      stopStatus = "arrived";
      update.arrived_at = new Date().toISOString();
    }

    if (status === "done") {
      stopStatus = "completed";
      update.completed_at = new Date().toISOString();
    }

    await supabase
      .from("trip_stops")
      .update({
        status: stopStatus,
        ...update,
      })
      .eq("id", current.id);
  }

  async function sendNotification(title, text) {
    if (!trip) {
      alert("There is no active trip.");
      return;
    }

    const current =
      stops.find((stop) => stop.status === "current") ||
      stops.find((stop) => stop.status === "coming") ||
      stops.find((stop) => stop.status === "arrived");

    const address = current?.places?.address || "";

    await supabase
      .from("notifications")
      .update({ active: false })
      .eq("trip_id", trip.id);

    const { error } = await supabase
      .from("notifications")
      .insert({
        trip_id: trip.id,
        stop_id: current?.id || null,
        title,
        message: text,
        address,
        active: true,
      });

    if (error) {
      alert(error.message);
      return;
    }

    setMessage("");
    setNoticeTitle("");
    await loadData();
  }

  async function sendCustomNotification(event) {
    event.preventDefault();

    if (!message.trim()) {
      alert("Please write a message.");
      return;
    }

    await sendNotification(
      noticeTitle.trim() || "Message",
      message.trim()
    );
  }

  async function clearNotification() {
    if (!trip) return;

    const { error } = await supabase
      .from("notifications")
      .update({ active: false })
      .eq("trip_id", trip.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/");
  }

  const currentStop = useMemo(
    () =>
      stops.find((stop) => stop.status === "current") ||
      stops.find((stop) => stop.status === "coming") ||
      stops.find((stop) => stop.status === "arrived"),
    [stops]
  );

  const nextStop = useMemo(
    () =>
      stops.find(
        (stop) =>
          stop.status === "pending" &&
          stop.stop_order >
            (currentStop?.stop_order || 0)
      ),
    [stops, currentStop]
  );

  if (loading) {
    return <div className="loading-page">Loading Driver Dashboard...</div>;
  }

  if (!supabase) {
    return (
      <div className="loading-page">
        Supabase is not configured.
      </div>
    );
  }

  return (
    <div className="driver-layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-title">
            NAN SINAH KAN RA CANG
          </div>
          <div className="brand-subtitle">DRIVER</div>
        </div>

        <nav className="side-nav">
          <a href="#places">🏠 Places</a>
          <a href="#add-place">➕ Add Place</a>
          <a href="#trip-plans">📋 Trip Plans</a>
          <a href="#current-trip">🚗 Current Trip</a>
          <a href="#notifications">🔔 Notifications</a>
          <a href="#letters">📝 Letters</a>
          <a href="#settings">⚙️ Settings</a>
        </nav>

        <div className="sidebar-bottom">
          <Link
            className="public-link"
            to="/public"
            target="_blank"
          >
            👁 PUBLIC VIEW
          </Link>

          <button className="logout-button" onClick={signOut}>
            LOG OUT
          </button>
        </div>
      </aside>

      <main className="dashboard">
        <div className="mobile-header">
          <div>
            <strong>NAN SINAH KAN RA CANG</strong>
            <span>DRIVER</span>
          </div>

          <Link to="/public" target="_blank">
            PUBLIC VIEW
          </Link>
        </div>

        <header className="dashboard-header">
          <div>
            <h1>Driver Dashboard</h1>
            <p>Control the current trip and public updates.</p>
          </div>

          <div className="header-actions">
            <Link
              className="secondary-button"
              to="/public"
              target="_blank"
            >
              PUBLIC VIEW
            </Link>
          </div>
        </header>

        <section
          id="current-trip"
          className="dashboard-card current-trip-card"
        >
          <div className="section-title">
            <span>🚗 CURRENT TRIP</span>

            {trip && (
              <span className="active-indicator">
                ● ACTIVE
              </span>
            )}
          </div>

          {!trip ? (
            <div className="empty-trip">
              <h2>No Current Trip</h2>
              <p>
                Select places below and start a new trip.
              </p>

              <button
                className="primary-button"
                onClick={startTrip}
                disabled={selectedPlaces.length === 0}
              >
                START TRIP
              </button>
            </div>
          ) : (
            <>
              <div className="trip-grid">
                <div className="trip-location">
                  <span className="location-label">
                    Current:
                  </span>

                  {currentStop?.places ? (
                    <>
                      <h2>🏠 {currentStop.places.name}</h2>
                      <p>{currentStop.places.address}</p>
                    </>
                  ) : (
                    <p>No current place.</p>
                  )}
                </div>

                <div className="trip-location">
                  <span className="location-label">
                    Next:
                  </span>

                  {nextStop?.places ? (
                    <>
                      <h2>🏠 {nextStop.places.name}</h2>
                      <p>{nextStop.places.address}</p>
                    </>
                  ) : (
                    <p>No next place.</p>
                  )}
                </div>
              </div>

              <div className="trip-status-line">
                <span>Trip Status:</span>

                <strong>
                  ● {String(trip.status || "").toUpperCase()}
                </strong>
              </div>

              <div className="control-buttons">
                <button
                  className="status-button start"
                  onClick={() => updateTripStatus("active")}
                >
                  START TRIP
                </button>

                <button
                  className="status-button coming"
                  onClick={() => {
                    updateTripStatus("coming");
                    sendNotification(
                      "WE ARE COMING TO YOU NOW",
                      "We are coming to you now."
                    );
                  }}
                >
                  COMING
                </button>

                <button
                  className="status-button arrived"
                  onClick={() => {
                    updateTripStatus("arrived");
                    sendNotification(
                      "WE ARE ARRIVED",
                      "We are arrived."
                    );
                  }}
                >
                  ARRIVED
                </button>

                <button
                  className="status-button done"
                  onClick={() =>
                    updateTripStatus("done")
                  }
                >
                  DONE
                </button>
              </div>
            </>
          )}
        </section>

        <section id="places" className="dashboard-card">
          <div className="section-title">
            <span>🏠 PLACES</span>
            <span className="count-badge">
              {places.length}
            </span>
          </div>

          {places.length === 0 ? (
            <p className="muted">
              No places have been added yet.
            </p>
          ) : (
            <div className="places-list">
              {places.map((place) => (
                <div className="place-row" key={place.id}>
                  <label className="place-select">
                    <input
                      type="checkbox"
                      checked={selectedPlaces.includes(
                        place.id
                      )}
                      onChange={() =>
                        togglePlace(place.id)
                      }
                    />

                    <span>
                      <strong>
                        🏠 {place.name}
                      </strong>

                      <small>{place.address}</small>
                    </span>
                  </label>

                  <button
                    className="delete-button"
                    onClick={() =>
                      deletePlace(place.id)
                    }
                  >
                    DELETE
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section id="add-place" className="dashboard-card">
          <div className="section-title">
            <span>➕ ADD PLACE</span>
          </div>

          <form className="add-place-form" onSubmit={addPlace}>
            <div>
              <label>House / Owner Name</label>

              <input
                value={placeName}
                onChange={(e) =>
                  setPlaceName(e.target.value)
                }
                placeholder="Example: Johnson House"
                required
              />
            </div>

            <div>
              <label>Address</label>

              <input
                value={placeAddress}
                onChange={(e) =>
                  setPlaceAddress(e.target.value)
                }
                placeholder="Example: 123 Main Street"
                required
              />
            </div>

            <button className="primary-button">
              ADD PLACE
            </button>
          </form>
        </section>

        <section id="trip-plans" className="dashboard-card">
          <div className="section-title">
            <span>📋 TRIP PLANS</span>
          </div>

          <p className="muted">
            Select places in the Places section in the
            order you want to visit them.
          </p>

          <div className="selected-count">
            Selected: {selectedPlaces.length}
          </div>

          <button
            className="primary-button"
            onClick={startTrip}
            disabled={
              selectedPlaces.length === 0 || !!trip
            }
          >
            {trip ? "TRIP ALREADY ACTIVE" : "START TRIP"}
          </button>
        </section>

        <section
          id="notifications"
          className="dashboard-card"
        >
          <div className="section-title">
            <span>🔔 NOTIFICATIONS</span>
          </div>

          <div className="quick-notifications">
            <button
              onClick={() =>
                sendNotification(
                  "WE ARE HERE",
                  "We are here."
                )
              }
            >
              WE ARE HERE
            </button>

            <button
              onClick={() =>
                sendNotification(
                  "NEXT, WE ARE GOING HERE",
                  "Next, we are going here."
                )
              }
            >
              NEXT, WE ARE GOING HERE
            </button>

            <button
              onClick={() =>
                sendNotification(
                  "WE ARE COMING TO YOU NOW",
                  "We are coming to you now."
                )
              }
            >
              WE ARE COMING TO YOU NOW
            </button>

            <button
              onClick={() =>
                sendNotification(
                  "WE ARE ARRIVED", 
                  "We are arrived."
                )
              }
            >
              WE ARE ARRIVED
            </button>

            <button
              className="clear-button"
              onClick={clearNotification}
            >
              CLEAR NOTIFICATION
            </button>
          </div>

          <form
            className="notification-form"
            onSubmit={sendCustomNotification}
          >
            <label>Notification Title</label>

            <input
              value={noticeTitle}
              onChange={(e) =>
                setNoticeTitle(e.target.value)
              }
              placeholder="Notification title"
            />

            <label>Message</label>

            <textarea
              value={message}
              onChange={(e) =>
                setMessage(e.target.value)
              }
              placeholder="Write a message for the public..."
              rows="4"
            />

            <button className="primary-button">
              SEND NOTIFICATION
            </button>
          </form>

          {notifications.length > 0 && (
            <div className="notification-history">
              <h3>Notification History</h3>

              {notifications.map((item) => (
                <div
                  className="history-item"
                  key={item.id}
                >
                  <strong>{item.title}</strong>
                  <p>{item.message}</p>

                  {item.address && (
                    <small>
                      📍 {item.address}
                    </small>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section id="letters" className="dashboard-card">
          <div className="section-title">
            <span>📝 LETTERS</span>
          </div>

          <p className="muted">
            Use the notification message above to send
            a letter or message to the public viewer.
          </p>

          <div className="letter-preview">
            {notificationPreview(
              notifications
            )}
          </div>
        </section>

        <section id="settings" className="dashboard-card">
          <div className="section-title">
            <span>⚙️ SETTINGS</span>
          </div>

          <div className="settings-row">
            <div>
              <strong>Driver Account</strong>
              <p>{user?.email}</p>
            </div>

            <button
              className="secondary-button"
              onClick={signOut}
            >
              LOG OUT
            </button>
          </div>

          <div className="settings-row">
            <div>
              <strong>Public View</strong>
              <p>
                Anyone can view the active trip without
                logging in.
              </p>
            </div>

            <Link
              className="primary-button"
              to="/public"
              target="_blank"
            >
              OPEN PUBLIC VIEW
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function notificationPreview(notifications) {
  const active = notifications.find(
    (item) => item.active
  );

  if (!active) {
    return (
      <div className="empty-letter">
        No active letter or message.
      </div>
    );
  }

  return (
    <div className="letter">
      <h3>{active.title}</h3>
      <p>{active.message}</p>

      {active.address && (
        <div>📍 {active.address}</div>
      )}
    </div>
  );
}

function App() {
  return (
     <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/public" element={<PublicView />} />
        <Route
          path="/admin/login"
          element={<AdminLogin />}
        />
        <Route path="/admin" element={<Admin />} />
            </Routes>
    </HashRouter>
  );
}

export default App;

createRoot(document.getElementById("root")).render(<App />);
