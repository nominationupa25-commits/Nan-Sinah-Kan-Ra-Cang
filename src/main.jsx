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
  const [now, setNow] = useState(Date.now());

  // Refresh the displayed ETA every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 30000);

    return () => clearInterval(timer);
  }, []);

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
    ["current", "coming", "arrived"].includes(
      stop.status
    )
  );

  const nextStop = stops.find((stop) =>
    ["next", "pending"].includes(
      stop.status
    )
  );
const finalStop =
  stops.length > 0
    ? stops[stops.length - 1]
    : null;
  /*
 * ARRIVAL TIME
 *
 * eta_minutes is the number of minutes remaining
 * for the current stop.
 */
const completedStop = [...stops]
  .reverse()
  .find((stop) => stop.status === "completed");

// Keep the completed house visible until the next
// house becomes CURRENT / COMING / ARRIVED.
const displayStop = currentStop || completedStop;

const originalEtaMinutes = Number(
  displayStop?.eta_minutes
);

const etaStartedAt = displayStop?.eta_started_at
  ? new Date(displayStop.eta_started_at).getTime()
  : null;

const elapsedMinutes = etaStartedAt
  ? Math.floor(
      (now - etaStartedAt) / 60000
    )
  : 0;

const etaMinutes =
  Number.isFinite(originalEtaMinutes)
    ? Math.max(
        0,
        originalEtaMinutes - elapsedMinutes
      )
    : NaN;

const hasEta =
  Number.isFinite(etaMinutes) &&
  etaMinutes >= 0;

const estimatedArrival =
  hasEta && etaStartedAt
    ? new Date(
        etaStartedAt +
          originalEtaMinutes * 60000
      )
    : null;

  const arrivedTime =
    displayStop?.status === "arrived"&&
    displayStop?.updated_at
      ? new Date(
          displayStop?.updated_at
        )
      : null;

  const arrivalTime =
    arrivedTime ||
    estimatedArrival;

  function formatArrivalTime(date) {
    if (!date) return "";

    return date.toLocaleTimeString(
      [],
      {
        hour: "numeric",
        minute: "2-digit",
      }
    );
  }

  if (loading) {
    return (
      <div className="loading-page">
        <div>
          Loading Public View...
        </div>
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

          <div className="big-icon">
            🚗
          </div>

          <h1>
            Zaan Vahnak Kan Thawk Rih Lo
          </h1>

          <p>
            The driver has not started
            a trip yet.
          </p>

        </div>

      ) : (

        <main className="public-content">

          <section className="trip-card">

            {/* TRIP HEADER */}

            <div className="trip-heading">

              <div className="trip-heading-icon">
                🗺️
              </div>

              <div>

                <h1>
                  Christmas Zaan Vahnak Inn
                </h1>

                {trip.trip_title && (
                  <h2 className="trip-route-title">
                    {trip.trip_title}
                  </h2>
                )}

                <p>
                  Atang Lei Hi Kan Umnak Le Kan Kal Nak Ding Inn An Si Hna
                </p>

              </div>

            </div>

            {/* CURRENT STOP */}

            {displayStop && (

              <div className="public-stop current-stop">

                <div className="stop-label green-label">

                  {displayStop.status === "coming"
  ? "Nan Inn Ah Kan Ra Lio Cang"
  : displayStop.status === "arrived"
  ? "Atu Bak Nan Inn Kan Phan"
  : displayStop.status === "completed"
  ? " Atu Bak Mah Inn Hi Kan Dih A Si "
  : " Zaan Vak Kan Thawk Rih Lo, Nan Mah Inn In Kan Thawk Te Lai"}

                </div>

                <div className="stop-info">

                  <div className="house-icon">
                    🏠
                  </div>

                  <div>

                    <h2>
                      {displayStop.places?.name||
                        "Current House"}
                    </h2>

                    <p>
                      {displayStop.places?.address ||
                        ""}
                    </p>

                  </div>

                </div>

                {/* AUTOMATIC ARRIVAL TIME */}

                <div className="public-arrival-time">
                 {displayStop.status ===
                  "arrived" ? (
                    <>

                      <strong>
                        Kan Phan Cang
                      </strong>

                      {arrivalTime && (
                        <span>
                          {formatArrivalTime(
                            arrivalTime
                          )}
                        </span>
                      )}

                    </>

                  ) : displayStop.status === "coming" && hasEta ? (

                    <>

                      <strong>
                        Atang Nazi Caan Ah Hin Nan In Kan Phan Te Lai
                      </strong>

                      <span>
                        {formatArrivalTime(
                          arrivalTime
                        )}

                        {" · about "}

                        {etaMinutes}

                        {" min"}
                      </span>

                    </>

                  ) : (

                    <>

                      <strong>
                        Nan Inn Kan Phanh Lai Caan Nazi Cu
                      </strong>

                      <span>
                      ka hin kan rak langhter te lai
                      </span>

                    </>

                  )}

                </div>

              </div>

            )}

            {/* NEXT STOP */}

            {nextStop && (

              <>

                <div className="down-arrow">
                  ⌄
                </div>

                <div className="public-stop next-stop">

                  <div className="stop-label blue-label">
                    NEXT, Nan Inn Ah Kan Ra Lai
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
                        {nextStop.places?.address ||
                          ""}
                      </p>

                    </div>

                  </div>

                </div>

              </>

            )}

            {/* PUBLIC MESSAGE */}

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
                      📍{" "}
                      {notification.address}
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

  const [tripTitle, setTripTitle] = useState("");
const [editingTrip, setEditingTrip] = useState(false);
const [editSelectedPlaces, setEditSelectedPlaces] = useState([]);

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

  /* =======================================================
   UPDATE TRIP STATUS
   FLOW:

   BEFORE:
   CURRENT → NEXT → PENDING

   COMING:
   CURRENT → COMING + ETA
   NEXT stays NEXT

   ARRIVED:
   CURRENT → ARRIVED
   same house stays ARRIVED
   NEXT stays NEXT

   DONE:
   CURRENT → COMPLETED NOW
   NEXT stays NEXT

   COMING AGAIN:
   previous NEXT → CURRENT → COMING + ETA
   following house → NEXT
======================================================= */

async function updateTripStatus(status) {

  if (!supabase) {
    return;
  }

  if (!trip) {
    alert("Start a trip first.");
    return;
  }

  /*
   * Find the house currently being worked on.
   *
   * After DONE there is no current/coming/arrived stop,
   * so COMING will automatically select the NEXT stop.
   */
  let current = stops.find((stop) =>
    [
      "current",
      "coming",
      "arrived",
    ].includes(stop.status)
  );

  /*
   * After DONE:
   * select the NEXT house.
   */
  if (!current) {
    current = stops.find((stop) =>
      [
        "next",
        "pending",
      ].includes(stop.status)
    );
  }

  if (!current) {
    alert("There is no current or next house.");
    return;
  }

  setSaving(true);

  /* =====================================================
     DONE
  ===================================================== */

  if (status === "done") {

    const { error: stopError } =
      await supabase
        .from("trip_stops")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", current.id);

    if (stopError) {
      setSaving(false);
      alert(stopError.message);
      return;
    }

    /*
     * IMPORTANT:
     * Do NOT make NEXT current yet.
     *
     * NEXT remains NEXT until the driver
     * presses COMING again.
     */
    const next = stops.find((stop) =>
      [
        "next",
        "pending",
      ].includes(stop.status)
    );

    if (next) {

      await supabase
        .from("trips")
        .update({
          status: "active",
          is_public_active: true,
        })
        .eq("id", trip.id);

    } else {

      /*
       * No more houses.
       * Trip is finished.
       */
      await supabase
        .from("trips")
        .update({
          status: "completed",
          is_public_active: false,
          completed_at: new Date().toISOString(),
        })
        .eq("id", trip.id);
    }

    setSaving(false);

    await loadData();

    setPage("current-trip");

    return;
  }

  /* =====================================================
     COMING
  ===================================================== */

  if (status === "coming") {

    /*
     * If this is the NEXT house after DONE,
     * it becomes the new CURRENT house.
     */
    const isNextHouse =
      current.status === "next" ||
      current.status === "pending";

    const eta =
      Number(current.eta_minutes) > 0
        ? Number(current.eta_minutes)
        : 15;

    const comingUpdate = {
      status: "coming",

      eta_minutes: eta,

      eta_started_at:
        current.eta_started_at ||
        new Date().toISOString(),

      coming_at:
        current.coming_at ||
        new Date().toISOString(),
    };

    const { error: comingError } =
      await supabase
        .from("trip_stops")
        .update(comingUpdate)
        .eq("id", current.id);

    if (comingError) {

      setSaving(false);

      alert(comingError.message);

      return;
    }

    /*
     * If this was NEXT, it is now the CURRENT
     * active house.
     *
     * The following house remains NEXT.
     *
     * We only need the status on the stop itself;
     * the UI determines CURRENT from the active
     * coming/arrived/current stop.
     */
    if (isNextHouse) {

      /*
       * Find the following house.
       */
      const followingStop = stops
        .filter((stop) =>
          stop.id !== current.id &&
          [
            "next",
            "pending",
          ].includes(stop.status)
        )
        .sort(
          (a, b) =>
            Number(a.stop_order) -
            Number(b.stop_order)
        )[0];

      /*
       * Keep the following house as NEXT.
       */
      if (followingStop) {

        await supabase
          .from("trip_stops")
          .update({
            status: "next",
          })
          .eq("id", followingStop.id);
      }
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

    setPage("current-trip");

    return;
  }

  /* =====================================================
     ARRIVED
  ===================================================== */

  if (status === "arrived") {

    const { error: arrivedError } =
      await supabase
        .from("trip_stops")
        .update({
          status: "arrived",

          arrived_at:
            current.arrived_at ||
            new Date().toISOString(),
        })
        .eq("id", current.id);

    if (arrivedError) {

      setSaving(false);

      alert(arrivedError.message);

      return;
    }

    /*
     * Keep the same house as ARRIVED.
     * Do not change NEXT.
     */
    await supabase
      .from("trips")
      .update({
        status: "active",
        is_public_active: true,
      })
      .eq("id", trip.id);

    setSaving(false);

    await loadData();

    setPage("current-trip");

    return;
  }

  /* =====================================================
     CURRENT / OTHER STATUS
  ===================================================== */

  const { error } =
    await supabase
      .from("trip_stops")
      .update({
        status: status,
      })
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

  setPage("current-trip");
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

  const currentStop = stops.find((stop) =>
  ["current", "coming", "arrived"].includes(
    stop.status
  )
);

const completedStop = stops
  .filter(
    (stop) =>
      stop.status === "completed"
  )
  .sort(
    (a, b) =>
      Number(b.stop_order) -
      Number(a.stop_order)
  )[0];

const nextStop = stops.find((stop) =>
  ["next", "pending"].includes(
    stop.status
  )
);
const finalStop =
  stops.length > 0
    ? stops[stops.length - 1]
    : null;
// If there is no active current stop,
// show the most recently completed stop.
// This happens immediately after DONE.
const displayStop =
  currentStop || completedStop;

    /* =======================================================
     AUTOMATIC GPS / ETA TRACKING
  ======================================================= */

  useEffect(() => {
    if (
      !trip ||
      !currentStop ||
      currentStop.status === "arrived" ||
      currentStop.status === "completed" ||
      !navigator.geolocation ||
      !supabase
    ) {
      return;
    }

    let cancelled = false;

    async function getDestinationCoordinates() {
      const place = currentStop.places;

      if (!place) return null;

      /* Use coordinates already saved in places */
      if (
        Number.isFinite(Number(place.latitude)) &&
        Number.isFinite(Number(place.longitude))
      ) {
        return {
          latitude: Number(place.latitude),
          longitude: Number(place.longitude),
        };
      }

      /* If coordinates are missing, find them from the address */
      if (!place.address) return null;

      try {
        const response = await fetch(
          "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" +
            encodeURIComponent(place.address)
        );

        const results = await response.json();

        if (!results?.[0]) {
          return null;
        }

        return {
          latitude: Number(results[0].lat),
          longitude: Number(results[0].lon),
        };
      } catch (error) {
        console.error(
          "Could not find destination coordinates:",
          error
        );

        return null;
      }
    }

    async function updateAutomaticETA(position) {
      if (cancelled) return;

      const destination =
        await getDestinationCoordinates();

      if (!destination || cancelled) {
        return;
      }

      try {
        const start =
          position.coords.longitude +
          "," +
          position.coords.latitude;

        const end =
          destination.longitude +
          "," +
          destination.latitude;

        /*
         * OSRM calculates the driving route.
         */
        const routeResponse = await fetch(
          "https://router.project-osrm.org/route/v1/driving/" +
            start +
            ";" +
            end +
            "?overview=false"
        );

        const routeData =
          await routeResponse.json();

        const route =
          routeData?.routes?.[0];

        if (!route || cancelled) {
          return;
        }

        /* Convert seconds to minutes */
        const etaMinutes = Math.max(
          0,
          Math.ceil(
            route.duration / 60
          )
        );

        /* Convert meters to miles */
        const distanceMiles =
          Number(
            (
              route.distance / 1609.344
            ).toFixed(1)
          );

        /*
         * Save ETA and distance in Supabase.
         */
        const { error } =
          await supabase
            .from("trip_stops")
            .update({
              eta_minutes:
                etaMinutes,

              distance_miles:
                distanceMiles,

              updated_at:
                new Date().toISOString(),
            })
            .eq(
              "id",
              currentStop.id
            );

        if (error) {
          console.error(
            "Could not save ETA:",
            error
          );
        }
      } catch (error) {
        console.error(
          "Automatic ETA update failed:",
          error
        );
      }
    }

    /*
     * Watch the driver's phone GPS.
     */
    const watchId =
      navigator.geolocation.watchPosition(
        updateAutomaticETA,

        (error) => {
          console.error(
            "GPS location error:",
            error.message
          );
        },

        {
          enableHighAccuracy: true,
          maximumAge: 15000,
          timeout: 20000,
        }
      );

    /*
     * Stop GPS when leaving this trip/current stop.
     */
    return () => {
      cancelled = true;

      navigator.geolocation.clearWatch(
        watchId
      );
    };
  }, [
    trip?.id,
    currentStop?.id,
    currentStop?.status,
  ]);
  

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
  setPage("trip-plans");

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

{!Array.isArray(places) || places.length === 0 ? (
                <div className="empty-box">
                  No places yet.
                </div>

              ) : (

(Array.isArray(places) ? places : []).map((place) => (
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

      <button
  className="start-button"
  type="button"
  disabled={saving}
  onClick={async () => {
    if (!trip || !supabase) return;
        setSaving(true);

    try {
      // 1. Save the trip title
      const { error: titleError } = await supabase
        .from("trips")
        .update({
          trip_title: tripTitle.trim(),
        })
        .eq("id", trip.id);

      if (titleError) {
        alert(titleError.message);
        return;
      }

      // 2. Keep the current house exactly as it is
      const currentPlaceId = currentStop?.place_id ?? null;

      // 3. Get the places selected in EDIT TRIP
      const selectedPlaceIds = editSelectedPlaces || [];

      // 4. Remove only the old NEXT/PENDING stops
      const { error: deleteError } = await supabase
        .from("trip_stops")
        .delete()
        .eq("trip_id", trip.id)
        .in("status", ["next", "pending"]);

      if (deleteError) {
        alert("Could not update the trip stops: " + deleteError.message);
        return;
      }

      // 5. Remove the current house from the new list.
      //    It must remain the CURRENT house, not become NEXT.
      const newNextPlaces = selectedPlaceIds.filter(
        (placeId) => placeId !== currentPlaceId
      );

      // 6. Create the new NEXT/PENDING order
      const newStops = newNextPlaces.map((placeId, index) => ({
        trip_id: trip.id,
        place_id: placeId,
        stop_order: index + 2,
        status: index === 0 ? "next" : "pending",
      }));

      // 7. Save the new trip order
      if (newStops.length > 0) {
        const { error: insertError } = await supabase
          .from("trip_stops")
          .insert(newStops);

        if (insertError) {
          alert(
            "Could not save the new trip order: " +
              insertError.message
          );
          return;
        }
      }

      // 8. Reload everything from Supabase
      await loadData();

      // 9. Close EDIT TRIP
      setEditSelectedPlaces([]);
      setEditingTrip(false);
      setSaving(false);

      // 10. Show the updated trip
      setPage("current-trip");

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (error) {
      console.error("Save trip error:", error);
      alert("Could not save trip changes: " + error.message);
    } finally {
      setSaving(false);
    }
  }}
>
  💾 SAVE TRIP CHANGES
</button>

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
