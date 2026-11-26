import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import "./styles.css";

function Home() {
  return (
    <div className="page">
      <div className="hero">
        <h1>Nan Sinah Kan Ra Cang</h1>
        <p>Live Trip & Delivery Information</p>

        <div className="buttons">
          <Link to="/public" className="button primary">
            Public View
          </Link>

          <Link to="/admin/login" className="button">
            Driver Login
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

  async function loadTrip() {
    if (!supabase) return;

    const { data: tripData } = await supabase
      .from("trips")
      .select("*")
      .eq("is_public_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setTrip(tripData);

    if (!tripData) {
      setStops([]);
      setNotification(null);
      setLoading(false);
      return;
    }

    const { data: stopData } = await supabase
      .from("trip_stops")
      .select(`
        *,
        places (
          id,
          name,
          address
        )
      `)
      .eq("trip_id", tripData.id)
      .order("stop_order");

    setStops(stopData || []);

    const { data: noticeData } = await supabase
      .from("notifications")
      .select("*")
      .eq("trip_id", tripData.id)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setNotification(noticeData);
    setLoading(false);
  }

  useEffect(() => {
    loadTrip();

    if (!supabase) return;

    const channel = supabase
      .channel("public-trip-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trips" },
        loadTrip
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trip_stops" },
        loadTrip
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        loadTrip
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <div className="page">
        <div className="card">
          <h2>Supabase Not Connected</h2>
          <p>Please connect the Supabase project first.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page">
        <div className="card">
          <h2>Loading...</h2>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="page">
        <div className="card center">
          <div className="status-icon">✓</div>
          <h1>No Active Trip</h1>
          <p>The driver has not started a trip yet.</p>

          <Link to="/" className="button">
            Home
          </Link>
        </div>
      </div>
    );
  }

  const currentStop =
    stops.find((stop) => stop.status === "coming") ||
    stops.find((stop) => stop.status === "arrived") ||
    stops.find((stop) => stop.status === "start");

  const nextStop = stops.find(
    (stop) => stop.status === "planned"
  );

  return (
    <div className="page">
      <div className="public-header">
        <div>
          <h1>Nan Sinah Kan Ra Cang</h1>
          <p>Live Trip Status</p>
        </div>

        <span className="live">● LIVE</span>
      </div>

      {notification && (
        <div className="notification">
          <h2>{notification.title}</h2>
          <p>{notification.message}</p>

          {notification.address && (
            <div className="address">
              📍 {notification.address}
            </div>
          )}
        </div>
      )}

      {currentStop && (
        <div className="card current">
          <span className="label">CURRENT</span>

          <h2>
            {currentStop.places?.name || "Current Stop"}
          </h2>

          <p>
            📍 {currentStop.places?.address || "Address unavailable"}
          </p>

          <div className="status">
            {currentStop.status === "coming" && "WE ARE COMING TO YOU NOW"}
            {currentStop.status === "arrived" && "WE ARE ARRIVED"}
            {currentStop.status === "start" && "WE ARE HERE"}
          </div>
        </div>
      )}

      {nextStop && (
        <div className="card next">
          <span className="label">NEXT</span>

          <h2>Next, We Are Going Here</h2>

          <h3>{nextStop.places?.name}</h3>

          <p>
            📍 {nextStop.places?.address}
          </p>
        </div>
      )}

      <div className="card">
        <h2>Trip Stops</h2>

        <div className="stop-list">
          {stops.map((stop) => (
            <div className="stop" key={stop.id}>
              <div>
                <strong>
                  {stop.stop_order}. {stop.places?.name}
                </strong>

                <p>{stop.places?.address}</p>
              </div>

              <span className={`badge ${stop.status}`}>
                {stop.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Link to="/" className="button">
        Home
      </Link>
    </div>
  );
}

function AdminLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!supabase) {
      setError("Supabase is not connected.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    navigate("/admin");
  }

  return (
    <div className="page">
      <div className="card login-card">
        <h1>Driver Login</h1>
        <p>Authorized drivers only.</p>

        <form onSubmit={login}>
          <label>Email</label>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label>Password</label>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <div className="error">{error}</div>}

          <button className="button primary" disabled={loading}>
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>

        <Link to="/" className="button">
          Back
        </Link>
      </div>
    </div>
  );
}

function Admin() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [places, setPlaces] = useState([]);
  const [selected, setSelected] = useState([]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");

  async function loadData() {
    if (!supabase) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      navigate("/admin/login");
      return;
    }

    setUser(user);

    const { data } = await supabase
      .from("places")
      .select("*")
      .order("created_at", { ascending: false });

    setPlaces(data || []);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function addPlace(e) {
    e.preventDefault();

    if (!name || !address) return;

    const { data, error } = await supabase
      .from("places")
      .insert({
        name,
        address,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      setMessage(error.message);
      return;
    }

    setPlaces([data, ...places]);
    setName("");
    setAddress("");
    setMessage("Place added.");
  }

  async function deletePlace(id) {
    const confirmed = window.confirm(
      "Delete this place?"
    );

    if (!confirmed) return;

    await supabase
      .from("places")
      .delete()
      .eq("id", id);

    setPlaces(
      places.filter((place) => place.id !== id)
    );
  }

  function togglePlace(id) {
    setSelected((old) =>
      old.includes(id)
        ? old.filter((x) => x !== id)
        : [...old, id]
    );
  }

  async function startTrip() {
    if (selected.length === 0) {
      setMessage("Select at least one place.");
      return;
    }

    const { data: trip, error } = await supabase
      .from("trips")
      .insert({
        status: "active",
        created_by: user.id,
        is_public_active: true,
      })
      .select()
      .single();

    if (error) {
      setMessage(error.message);
      return;
    }

    for (let i = 0; i < selected.length; i++) {
      await supabase.from("trip_stops").insert({
        trip_id: trip.id,
        place_id: selected[i],
        stop_order: i + 1,
        status: i === 0 ? "start" : "planned",
      });
    }

    setMessage("Trip started.");
    setSelected([]);
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/");
  }

  return (
    <div className="page">
      <div className="admin-header">
        <div>
          <h1>Driver Dashboard</h1>
          <p>{user?.email}</p>
        </div>

        <button className="button" onClick={signOut}>
          Sign Out
        </button>
      </div>

      {message && (
        <div className="message">
          {message}
        </div>
      )}

      <div className="card">
        <h2>Add House / Place</h2>

        <form onSubmit={addPlace}>
          <label>House / Owner Name</label>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Example: Johnson House"
            required
          />

          <label>Address</label>

          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter address"
            required
          />

          <button className="button primary">
            Add Place
          </button>
        </form>
      </div>

      <div className="card">
        <h2>Places</h2>

        {places.length === 0 && (
          <p>No places added yet.</p>
        )}

        {places.map((place) => (
          <div className="place-row" key={place.id}>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={selected.includes(place.id)}
                onChange={() => togglePlace(place.id)}
              />

              <span>
                <strong>{place.name}</strong>
                <br />
                {place.address}
              </span>
            </label>

            <button
              className="delete"
              onClick={() => deletePlace(place.id)}
            >
              Delete
            </button>
          </div>
        ))}

        <button
          className="button primary full"
          onClick={startTrip}
          disabled={selected.length === 0}
        >
          START TRIP
        </button>
      </div>

      <div className="card">
        <h2>Public View</h2>

        <p>
          Anyone can open the public page without logging in.
        </p>

        <Link to="/public" className="button">
          Open Public View
        </Link>
      </div>
    </div>
  );
}

function App() {
  return (
<BrowserRouter basename="/Nan-Sinah-Kan-Ra-Cang">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/public" element={<PublicView />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
