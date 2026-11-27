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

/* =========================================================
   HOME
========================================================= */

function Home() {
  return (
    <div className="home-page">
      <div className="home-card">
        <h1>NAN SINAH KAN RA CANG</h1>
        <p>Driver & Public Trip System</p>

        <div className="home-buttons">
          <Link to="/admin/login" className="home-button">
            🚗 DRIVER
          </Link>

          <Link to="/public" className="home-button public-button">
            👀 PUBLIC VIEW
          </Link>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   ADMIN LOGIN
========================================================= */

function AdminLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function login(e) {
    e.preventDefault();

    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }

    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    navigate("/admin");
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-icon">🚗</div>

        <h1>NAN SINAH KAN RA CANG</h1>
        <h2>DRIVER LOGIN</h2>

        {!isSupabaseConfigured && (
          <div className="error-box">
            Supabase is not configured.
          </div>
        )}

        <form onSubmit={login}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <div className="error-box">{error}</div>}

          <button className="login-button" disabled={loading}>
            {loading ? "SIGNING IN..." : "SIGN IN"}
          </button>
        </form>

        <Link to="/" className="back-link">
          ← Back
        </Link>
      </div>
    </div>
  );
}

/* =========================================================
   PUBLIC VIEW
========================================================= */

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

    setTrip(tripData || null);

    if (!tripData) {
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

    setStops(stopData || []);

    const { data: notificationData } = await supabase
      .from("notifications")
      .select("*")
      .eq("trip_id", tripData.id)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setNotification(notificationData || null);

    setLoading(false);
  }

  useEffect(() => {
    loadPublicTrip();

    if (!supabase) return;

    const channel = supabase
      .channel("public-trip-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trips",
        },
        loadPublicTrip
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trip_stops",
        },
        loadPublicTrip
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        loadPublicTrip
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const currentStop = stops.find((stop) =>
    ["current", "coming", "arrived"].includes(stop.status)
  );

  const nextStop = stops.find((stop) =>
    ["next", "pending"].includes(stop.status)
  );

  if (loading) {
    return (
      <div className="loading-page">
        <div>Loading Public View...</div>
      </div>
    );
  }

  return (
    <div className="public-page">
      <header className="public-header">
        <div>
          <div className="public-brand">
            NAN SINAH KAN RA CANG
          </div>

          <div className="public-subtitle">
            PUBLIC VIEW
          </div>
        </div>

        <div className="live-badge">
          <span className="live-dot"></span>
          LIVE
        </div>
      </header>

      {!trip ? (
        <div className="no-trip-card">
          <div className="big-icon">🚗</div>

          <h1>Zaan Vahnak Kan Thawk Rih Lo</h1>

          {trip?.trip_title && (
  <h2 className="trip-route-title">
    {trip.trip_title}
  </h2>
)}
          <p>
            The driver has not started a trip yet.
          </p>
        </div>
      ) : (
        <main className="public-content">
          <section className="trip-card">

            <div className="trip-heading">
              <div className="trip-heading-icon">
                🗺️
              </div>

              <div>
                <h1>YOUR TRIP</h1>
                <p>Track the current trip</p>
              </div>
            </div>

            {currentStop && (
              <div className="public-stop current-stop">

                <div className="stop-label green-label">
                  {currentStop.status.toUpperCase()}
                </div>

                <div className="stop-info">

                  <div className="house-icon">
                    🏠
                  </div>

                  <div>
                    <h2>
                      {currentStop.places?.name ||
                        "Current House"}
                    </h2>

                    <p>
                      {currentStop.places?.address || ""}
                    </p>
                  </div>

                </div>
              </div>
            )}

            {nextStop && (
              <>
                <div className="down-arrow">
                  ⌄
                </div>

                <div className="public-stop next-stop">

                  <div className="stop-label blue-label">
                    NEXT
                  </div>

                  <div className="stop-info">

                    <div className="house-icon">
                      🏠
                    </div>

                    <div>
                      <h2>
                        {nextStop.places?.name ||
                          "Next House"}
                      </h2>

                      <p>
                        {nextStop.places?.address || ""}
                      </p>
                    </div>

                  </div>
                </div>
              </>
            )}

            {notification && (
              <div className="public-message">

                <div className="message-icon">
                  📢
                </div>

                <div>
                  <h3>
                    {notification.title}
                  </h3>

                  <p>
                    {notification.message}
                  </p>

                  {notification.address && (
                    <p className="message-address">
                      📍 {notification.address}
                    </p>
                  )}
                </div>

              </div>
            )}

          </section>
        </main>
      )}

      <Link
        to="/"
        className="public-home-button"
      >
        ← HOME
      </Link>
    </div>
  );
}

/* =========================================================
   ADMIN
========================================================= */

function Admin() {

  /*
   * IMPORTANT:
   * page controls which dashboard screen is displayed.
   *
   * This MUST stay inside Admin().
   */
  const [page, setPage] = useState("current-trip");

  const navigate = useNavigate();

  const [places, setPlaces] = useState([]);
  const [trip, setTrip] = useState(null);
  const [stops, setStops] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  const [selectedPlaces, setSelectedPlaces] = useState([]);

  const [messageTitle, setMessageTitle] = useState("");
  const [messageText, setMessageText] = useState("");
  const [messageAddress, setMessageAddress] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* =======================================================
     LOAD DATA
  ======================================================= */

  async function loadData() {

    if (!supabase) {
      setLoading(false);
      return;
    }

    const { data: placesData } =
      await supabase
        .from("places")
        .select("*")
        .order("created_at", {
          ascending: false,
        });

    setPlaces(placesData || []);

    const { data: tripData } =
      await supabase
        .from("trips")
        .select("*")
        .order("created_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

    setTrip(tripData || null);

    if (!tripData) {
      setStops([]);
      setNotifications([]);
      setLoading(false);
      return;
    }

    const { data: stopsData } =
      await supabase
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
        .order("stop_order", {
          ascending: true,
        });

    setStops(stopsData || []);

    const { data: notificationData } =
      await supabase
        .from("notifications")
        .select("*")
        .eq("trip_id", tripData.id)
        .order("created_at", {
          ascending: false,
        });

    setNotifications(
      notificationData || []
    );

    setLoading(false);
  }

  /* =======================================================
     REALTIME
  ======================================================= */

  useEffect(() => {

    loadData();

    if (!supabase) return;

    const channel = supabase
      .channel("driver-live")

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "places",
        },
        loadData
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trips",
        },
        loadData
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trip_stops",
        },
        loadData
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        loadData
      )

      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };

  }, []);

  /* =======================================================
     ADD PLACE
  ======================================================= */

  async function addPlace(e) {

    e.preventDefault();

    if (
      !supabase ||
      !name.trim() ||
      !address.trim()
    ) {
      return;
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } =
      await supabase
        .from("places")
        .insert({
          name: name.trim(),
          address: address.trim(),
          created_by: user?.id || null,
        });

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    setName("");
    setAddress("");

    await loadData();

    setPage("places");
  }

  /* =======================================================
     DELETE PLACE
  ======================================================= */

  async function deletePlace(id) {

    if (
      !supabase ||
      !confirm("Delete this place?")
    ) {
      return;
    }

    const { error } =
      await supabase
        .from("places")
        .delete()
        .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
  }

  /* =======================================================
     SELECT PLACE
  ======================================================= */

  function togglePlace(id) {

    setSelectedPlaces((old) => {

      if (old.includes(id)) {
        return old.filter(
          (x) => x !== id
        );
      }

      return [...old, id];
    });
  }

  /* =======================================================
     START TRIP
  ======================================================= */

  async function startTrip() {

    if (!supabase) return;

    if (selectedPlaces.length === 0) {

      alert(
        "Please select at least one place."
      );

      setPage("places");

      return;
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: newTrip, error: tripError } =
      await supabase
        .from("trips")
        .insert({
          status: "active",
          started_at:
            new Date().toISOString(),
          created_by:
            user?.id || null,
          is_public_active: true,
        })
        .select()
        .single();

    if (tripError) {

      setSaving(false);

      alert(tripError.message);

      return;
    }

    const stopRows =
      selectedPlaces.map(
        (placeId, index) => ({
          trip_id: newTrip.id,
          place_id: placeId,
          stop_order: index + 1,
          status:
            index === 0
              ? "current"
              : "next",
        })
      );

    const { error: stopError } =
      await supabase
        .from("trip_stops")
        .insert(stopRows);

    if (stopError) {

      setSaving(false);

      alert(stopError.message);

      return;
    }

    setSelectedPlaces([]);

    setSaving(false);

    await loadData();

    setPage("current-trip");
  }

  /* =======================================================
     UPDATE TRIP STATUS
  ======================================================= */

  async function updateTripStatus(status) {

    if (!supabase) return;

    if (!trip) {

      alert(
        "Start a trip first."
      );

      return;
    }

    const current =
      stops.find((stop) =>
        [
          "current",
          "coming",
          "arrived",
        ].includes(stop.status)
      ) || stops[0];

    if (!current) {
      alert("There is no current stop.");
      return;
    }

    setSaving(true);

    /* DONE */

    if (status === "done") {

      const { error: stopError } =
        await supabase
          .from("trip_stops")
          .update({
            status: "completed",
            completed_at:
              new Date().toISOString(),
          })
          .eq("id", current.id);

      if (stopError) {

        setSaving(false);

        alert(stopError.message);

        return;
      }

      const next =
        stops.find((stop) =>
          [
            "next",
            "pending",
          ].includes(stop.status)
        );

      if (next) {

        await supabase
          .from("trip_stops")
          .update({
            status: "current",
          })
          .eq("id", next.id);

        await supabase
          .from("trips")
          .update({
            status: "active",
            is_public_active: true,
          })
          .eq("id", trip.id);

      } else {

        await supabase
          .from("trips")
          .update({
            status: "completed",
            is_public_active: false,
            completed_at:
              new Date().toISOString(),
          })
          .eq("id", trip.id);
      }

      setSaving(false);

      await loadData();

      setPage("current-trip");

      return;
    }

    /* COMING / ARRIVED */

    const stopUpdate = {
      status,
    };

    if (
      status === "coming" &&
      !current.coming_at
    ) {
      stopUpdate.coming_at =
        new Date().toISOString();
    }

    if (
      status === "arrived" &&
      !current.arrived_at
    ) {
      stopUpdate.arrived_at =
        new Date().toISOString();
    }

    const { error } =
      await supabase
        .from("trip_stops")
        .update(stopUpdate)
        .eq("id", current.id);

    if (error) {

      setSaving(false);

      alert(error.message);

      return;
    }

    await supabase
      .from("trips")
      .update({
        status: "active",
        is_public_active: true,
      })
      .eq("id", trip.id);

    setSaving(false);

    await loadData();
  }

  /* =======================================================
     PUBLIC MESSAGE
  ======================================================= */

  async function sendNotification() {

    if (!supabase || !trip) {

      alert(
        "Start a trip first."
      );

      return;
    }

    if (
      !messageTitle.trim() ||
      !messageText.trim()
    ) {

      alert(
        "Enter a title and message."
      );

      return;
    }

    setSaving(true);

    await supabase
      .from("notifications")
      .update({
        active: false,
      })
      .eq("trip_id", trip.id);

    const { error } =
      await supabase
        .from("notifications")
        .insert({
          trip_id: trip.id,
          stop_id:
            stops[0]?.id || null,
          title:
            messageTitle.trim(),
          message:
            messageText.trim(),
          address:
            messageAddress.trim(),
          active: true,
        });

    setSaving(false);

    if (error) {

      alert(error.message);

      return;
    }

    setMessageTitle("");
    setMessageText("");
    setMessageAddress("");

    await loadData();
  }

  /* =======================================================
     SIGN OUT
  ======================================================= */

  async function signOut() {

    if (supabase) {
      await supabase.auth.signOut();
    }

    navigate("/");
  }

  /* =======================================================
     CURRENT / NEXT / FINAL
  ======================================================= */

  const currentStop =
    stops.find((stop) =>
      [
        "current",
        "coming",
        "arrived",
      ].includes(stop.status)
    ) || null;

  const nextStop =
    stops.find((stop) =>
      [
        "next",
        "pending",
      ].includes(stop.status)
    ) || null;

  const finalStop =
    stops.length
      ? stops[stops.length - 1]
      : null;

  /* =======================================================
     STATUS TEXT
  ======================================================= */

  const statusText = useMemo(() => {

    if (!trip) {
      return "NO TRIP";
    }

    if (
      trip.status === "completed"
    ) {
      return "DONE";
    }

    if (
      currentStop?.status === "arrived"
    ) {
      return "ARRIVED";
    }

    if (
      currentStop?.status === "coming"
    ) {
      return "COMING";
    }

    return "ACTIVE";

  }, [trip, currentStop]);

  /* =======================================================
     MENU
  ======================================================= */

  const menuItems = [
    {
      id: "current-trip",
      icon: "🚗",
      label: "Current Trip",
    },
    {
      id: "places",
      icon: "🏠",
      label: "Places",
    },
    {
      id: "add-place",
      icon: "➕",
      label: "Add Place",
    },
    {
      id: "trip-plans",
      icon: "📋",
      label: "Trip Plans",
    },
    {
      id: "letters",
      icon: "📝",
      label: "Letters",
    },
    {
      id: "settings",
      icon: "⚙️",
      label: "Settings",
    },
  ];

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {

    return (
      <div className="loading-page">
        <div>
          Loading Driver Dashboard...
        </div>
      </div>
    );
  }

  /* =======================================================
     ADMIN RENDER
  ======================================================= */

  return (
    <div className="driver-page">

      {/* HEADER */}

      <header className="driver-header">

        <div className="driver-brand">

          <div className="car-logo">
            🚗
          </div>

          <div className="brand-text">

            <div>
              NAN SINAH KAN RA CANG
            </div>

            <span>
              DRIVER
            </span>

          </div>

        </div>

        <div className="header-actions">

          <div className="notification-bell">
            🔔

            {notifications.length > 0 && (
              <span>
                {notifications.length}
              </span>
            )}

          </div>

          <button
            className="menu-button"
            type="button"
            onClick={() => {

              const menu =
                document.getElementById(
                  "mobile-menu"
                );

              if (menu) {
                menu.classList.toggle(
                  "show"
                );
              }

            }}
          >
            ☰
          </button>

        </div>

      </header>

      {/* MOBILE MENU */}

      <div
        id="mobile-menu"
        className="mobile-menu"
      >

        {menuItems.map((item) => (

          <button
            key={item.id}
            type="button"
            className={
              page === item.id
                ? "menu-active"
                : ""
            }
            onClick={() => {

              setPage(item.id);

              document
                .getElementById(
                  "mobile-menu"
                )
                ?.classList.remove(
                  "show"
                );

              window.scrollTo({
                top: 0,
              });

            }}
          >
            {item.icon} {item.label}
          </button>

        ))}

        <Link to="/public">
          👀 Public View
        </Link>

        <button
          type="button"
          onClick={signOut}
        >
          🚪 Sign Out
        </button>

      </div>

      {/* HERO */}

      <section className="hero-image">

        <img
src="https://raw.githubusercontent.com/nominationupa25-commits/Nan-Sinah-Kan-Ra-Cang/main/IMG-23facfbd13627304b32013e3310ce98f-V.jpg"
          alt="Church"
          onError={(e) => {
            e.currentTarget.style.display =
              "none";
          }}
        />

      </section>

      {/* ===================================================
          MAIN CONTENT
      =================================================== */}

      <main className="driver-content">

        {/* CURRENT TRIP */}

        {page === "current-trip" && (

          <section
            id="current-trip"
            className="your-trip-card"
          >

            <div className="trip-top">

              <div className="trip-title">

                <div className="route-icon">
                  🗺️
                </div>

                <div>

                  <h1>
                    YOUR TRIP
                  </h1>

                  <p>
                    Track and update the
                    current trip
                  </p>

                </div>

              </div>

              <div className="live-pill">
                <span></span>
                LIVE
              </div>

            </div>

            {/* CURRENT */}

            <div className="route-stop current">

              <div className="route-dot green"></div>

              <div className="route-card">

                <span className="route-label current-label">
                  CURRENT
                </span>

                <div className="route-info">

                  <div className="house-icon">
                    🏠
                  </div>

                  <div>

                    <h2>
                      {currentStop?.places?.name ||
                        "No Current House"}
                    </h2>

                    <p>
                      {currentStop?.places?.address ||
                        "Start a trip to show the current house"}
                    </p>

                  </div>

                </div>

              </div>

            </div>

            <div className="route-arrow">
              ↓
            </div>

            {/* NEXT */}

            <div className="route-stop next">

              <div className="route-dot blue"></div>

              <div className="route-card">

                <span className="route-label next-label">
                  NEXT
                </span>

                <div className="route-info">

                  <div className="house-icon">
                    🏠
                  </div>

                  <div>

                    <h2>
                      {nextStop?.places?.name ||
                        "No Next House"}
                    </h2>

                    <p>
                      {nextStop?.places?.address ||
                        "Next destination"}
                    </p>

                  </div>

                </div>

              </div>

            </div>

            <div className="route-arrow">
              ↓
            </div>

            {/* DESTINATION */}

            <div className="route-stop destination">

              <div className="route-dot dark"></div>

              <div className="route-card">

                <span className="route-label destination-label">
                  DESTINATION
                </span>

                <div className="route-info">

                  <div className="flag-icon">
                    🏁
                  </div>

                  <div>

                    <h2>
                      {finalStop?.places?.name ||
                        "Final Stop / Last House"}
                    </h2>

                    <p>
                      {finalStop?.places?.address ||
                        ""}
                    </p>

                  </div>

                </div>

              </div>

            </div>

            {/* STATUS */}

            <div className="trip-status">

              <span>
                Trip Status:
              </span>

              <strong>
                {statusText}
              </strong>

            </div>

            {/* BUTTONS */}

            <div className="trip-buttons">

              <button
                className="start-button"
                type="button"
                onClick={startTrip}
                disabled={saving}
              >
                ▶ START TRIP
              </button>

              <div className="two-buttons">

                <button
                  className="coming-button"
                  type="button"
                  onClick={() =>
                    updateTripStatus(
                      "coming"
                    )
                  }
                  disabled={saving}
                >
                  🚗 COMING
                </button>

                <button
                  className="arrived-button"
                  type="button"
                  onClick={() =>
                    updateTripStatus(
                      "arrived"
                    )
                  }
                  disabled={saving}
                >
                  🏠 ARRIVED
                </button>

              </div>

              <button
                className="done-button"
                type="button"
                onClick={() =>
                  updateTripStatus(
                    "done"
                  )
                }
                disabled={saving}
              >
                ✓ DONE
              </button>

              <button
  className="edit-trip-button"
  type="button"
  onClick={() => {
    setEditingTrip(true);

    setEditSelectedPlaces(
      stops
        .filter(
          (stop) =>
            !["completed", "current", "coming", "arrived"]
              .includes(stop.status)
        )
        .map((stop) => stop.place_id)
    );
  }}
  disabled={saving || !trip}
>
  ✏️ EDIT TRIP
</button>

            </div>

            {/* PUBLIC MESSAGE */}

            <div className="public-message-card">

              <div className="message-big-icon">
                📢
              </div>

              <div>

                <h3>
                  PUBLIC MESSAGE
                </h3>

                <p>
                  {notifications[0]?.message ||
                    "We are waiting for the trip to start."}
                </p>

              </div>

            </div>

          </section>

        )}

        {/* =================================================
            PLACES
        ================================================= */}

        {page === "places" && (

          <section
            id="places"
            className="dashboard-section"
          >

            <div className="section-heading">
              <span>🏠</span>
              <h2>PLACES</h2>
            </div>

            <div className="place-list">

              {places.length === 0 ? (

                <div className="empty-box">
                  No places yet.
                </div>

              ) : (

                places.map((place) => (

                  <div
                    className="place-row"
                    key={place.id}
                  >

                    <label>

                      <input
                        type="checkbox"
                        checked={selectedPlaces.includes(
                          place.id
                        )}
                        onChange={() =>
                          togglePlace(
                            place.id
                          )
                        }
                      />

                      <span>

                        <strong>
                          {place.name}
                        </strong>

                        <small>
                          {place.address}
                        </small>

                      </span>

                    </label>

                    <button
                      className="delete-button"
                      type="button"
                      onClick={() =>
                        deletePlace(
                          place.id
                        )
                      }
                    >
                      🗑️
                    </button>

                  </div>

                ))

              )}

            </div>

            <button
              className="start-button"
              type="button"
              onClick={startTrip}
              disabled={saving}
            >
              ▶ START TRIP
            </button>

            {editingTrip && (
  <div className="edit-trip-card">

    <h2>✏️ EDIT TRIP</h2>

    <label>
      TRIP TITLE / WHERE TO WHERE
    </label>

    <input
      type="text"
      value={tripTitle}
      onChange={(e) =>
        setTripTitle(e.target.value)
      }
      placeholder="Example: Charlotte → Raleigh"
    />

    <h3>
      REMAINING STOPS
    </h3>

    <div className="place-list">

      {places.map((place) => {

        const currentPlaceId =
          currentStop?.place_id;

        if (place.id === currentPlaceId) {
          return null;
        }

        return (
          <label
            className="place-row"
            key={place.id}
          >

            <input
              type="checkbox"
              checked={editSelectedPlaces.includes(
                place.id
              )}
              onChange={() => {

                setEditSelectedPlaces((old) => {

                  if (old.includes(place.id)) {
                    return old.filter(
                      (id) =>
                        id !== place.id
                    );
                  }

                  return [
                    ...old,
                    place.id,
                  ];
                });

              }}
            />

            <span>

              <strong>
                {place.name}
              </strong>

              <small>
                {place.address}
              </small>

            </span>

          </label>
        );
      })}

    </div>

    <div className="two-buttons">

      <button
        className="start-button"
        type="button"
        disabled={saving}
        onClick={async () => {

          if (!trip) return;

          setSaving(true);

          const { error: titleError } =
            await supabase
              .from("trips")
              .update({
                trip_title:
                  tripTitle.trim(),
              })
              .eq("id", trip.id);

          if (titleError) {
            setSaving(false);
            alert(titleError.message);
            return;
          }

          const currentPlaceId =
            currentStop?.place_id;

          await supabase
            .from("trip_stops")
            .delete()
            .eq("trip_id", trip.id)
            .neq(
              "place_id",
              currentPlaceId
            )
            .in(
              "status",
              ["next", "pending"]
            );

          const remainingStops =
            editSelectedPlaces
              .filter(
                (id) =>
                  id !== currentPlaceId
              )
              .map(
                (placeId, index) => ({
                  trip_id: trip.id,
                  place_id: placeId,
                  stop_order:
                    index + 2,
                  status:
                    index === 0
                      ? "next"
                      : "pending",
                })
              );

          if (
            remainingStops.length > 0
          ) {
            const { error } =
              await supabase
                .from("trip_stops")
                .insert(
                  remainingStops
                );

            if (error) {
              setSaving(false);
              alert(error.message);
              return;
            }
          }

          setSaving(false);
          setEditingTrip(false);

          await loadData();
        }}
      >
        💾 SAVE TRIP CHANGES
      </button>

      <button
        type="button"
        className="done-button"
        onClick={() =>
          setEditingTrip(false)
        }
        disabled={saving}
      >
        CANCEL
      </button>

    </div>

  </div>
)}

          </section>

        )}

        {/* =================================================
            ADD PLACE
        ================================================= */}

        {page === "add-place" && (

          <section
            id="add-place"
            className="dashboard-section"
          >

            <div className="section-heading">

              <span>➕</span>

              <h2>
                ADD PLACE
              </h2>

            </div>

            <form
              className="add-place-form"
              onSubmit={addPlace}
            >

              <input
                type="text"
                placeholder="House / Owner Name"
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
                required
              />

              <input
                type="text"
                placeholder="Address"
                value={address}
                onChange={(e) =>
                  setAddress(
                    e.target.value
                  )
                }
                required
              />

              <button
                type="submit"
                disabled={saving}
              >
                {saving
                  ? "SAVING..."
                  : "➕ ADD PLACE"}
              </button>

            </form>

          </section>

        )}

        {/* =================================================
            TRIP PLANS
        ================================================= */}

        {page === "trip-plans" && (

          <section
            id="trip-plans"
            className="dashboard-section"
          >

            <div className="section-heading">

              <span>📋</span>

              <h2>
                TRIP PLANS
              </h2>

            </div>

            <p>
              Select places in the order
              you want to visit them,
              then press START TRIP.
            </p>

            <div className="selected-count">

              {selectedPlaces.length}
              {" "}
              place(s) selected

            </div>

            <div className="place-list">

              {selectedPlaces.map(
                (id, index) => {

                  const place =
                    places.find(
                      (p) =>
                        p.id === id
                    );

                  if (!place) {
                    return null;
                  }

                  return (
                    <div
                      className="place-row"
                      key={id}
                    >

                      <span>

                        <strong>
                          {index + 1}.{" "}
                          {place.name}
                        </strong>

                        <small>
                          {place.address}
                        </small>

                      </span>

                    </div>
                  );
                }
              )}

            </div>

            <button
              className="start-button"
              type="button"
              onClick={startTrip}
              disabled={saving}
            >
              ▶ START TRIP
            </button>

          </section>

        )}

        {/* =================================================
            LETTERS
        ================================================= */}

        {page === "letters" && (

          <section
            id="letters"
            className="dashboard-section"
          >

            <div className="section-heading">

              <span>📝</span>

              <h2>
                LETTERS / PUBLIC MESSAGE
              </h2>

            </div>

            <input
              type="text"
              placeholder="Message title"
              value={messageTitle}
              onChange={(e) =>
                setMessageTitle(
                  e.target.value
                )
              }
            />

            <textarea
              placeholder="Write your public message..."
              value={messageText}
              onChange={(e) =>
                setMessageText(
                  e.target.value
                )
              }
            />

            <input
              type="text"
              placeholder="Address"
              value={messageAddress}
              onChange={(e) =>
                setMessageAddress(
                  e.target.value
                )
              }
            />

            <button
              className="message-button"
              type="button"
              onClick={sendNotification}
              disabled={saving}
            >
              📢 SEND PUBLIC MESSAGE
            </button>

          </section>

        )}

        {/* =================================================
            SETTINGS
        ================================================= */}

        {page === "settings" && (

          <section
            id="settings"
            className="dashboard-section"
          >

            <div className="section-heading">

              <span>⚙️</span>

              <h2>
                SETTINGS
              </h2>

            </div>

            <Link
              to="/public"
              className="public-view-button"
            >
              👀 OPEN PUBLIC VIEW
            </Link>

            <button
              className="signout-button"
              type="button"
              onClick={signOut}
            >
              🚪 SIGN OUT
            </button>

          </section>

        )}

      </main>

      {/* =================================================
          BOTTOM NAVIGATION

          These are REAL buttons.
          They change React page state.
      ================================================= */}

      <nav className="bottom-nav">

        <button
          type="button"
          className={
            `bottom-nav-button ${
              page === "places"
                ? "active"
                : ""
            }`
          }
          onClick={() => {
            setPage("places");
            window.scrollTo({
              top: 0,
              behavior: "smooth",
            });
          }}
        >
          <span className="bottom-nav-icon">
            🏠
          </span>

          <strong className="bottom-nav-label">
            Places
          </strong>
        </button>

        <button
          type="button"
          className={
            `bottom-nav-button ${
              page === "add-place"
                ? "active"
                : ""
            }`
          }
          onClick={() => {
            setPage("add-place");
            window.scrollTo({
              top: 0,
              behavior: "smooth",
            });
          }}
        >
          <span className="bottom-nav-icon">
            ➕
          </span>

          <strong className="bottom-nav-label">
            Add Place
          </strong>
        </button>

        <button
          type="button"
          className={
            `bottom-nav-button ${
              page === "trip-plans"
                ? "active"
                : ""
            }`
          }
          onClick={() => {
            setPage("trip-plans");
            window.scrollTo({
              top: 0,
              behavior: "smooth",
            });
          }}
        >
          <span className="bottom-nav-icon">
            📋
          </span>

          <strong className="bottom-nav-label">
            Trip Plans
          </strong>
        </button>

        <button
          type="button"
          className={
            `bottom-nav-button ${
              page === "letters"
                ? "active"
                : ""
            }`
          }
          onClick={() => {
            setPage("letters");
            window.scrollTo({
              top: 0,
              behavior: "smooth",
            });
          }}
        >
          <span className="bottom-nav-icon">
            ✉️
          </span>

          <strong className="bottom-nav-label">
            Letters
          </strong>
        </button>

        <button
          type="button"
          className={
            `bottom-nav-button ${
              page === "settings"
                ? "active"
                : ""
            }`
          }
          onClick={() => {
            setPage("settings");
            window.scrollTo({
              top: 0,
              behavior: "smooth",
            });
          }}
        >
          <span className="bottom-nav-icon">
            ⚙️
          </span>

          <strong className="bottom-nav-label">
            Settings
          </strong>
        </button>

      </nav>

    </div>
  );
}

/* =========================================================
   APP
========================================================= */

function App() {
  return (
    <HashRouter>

      <Routes>

        <Route
          path="/"
          element={<Home />}
        />

        <Route
          path="/public"
          element={<PublicView />}
        />

        <Route
          path="/admin/login"
          element={<AdminLogin />}
        />

        <Route
          path="/admin"
          element={<Admin />}
        />

      </Routes>

    </HashRouter>
  );
}

/* =========================================================
   START REACT
========================================================= */

const rootElement =
  document.getElementById("root");

if (rootElement) {

  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

}
