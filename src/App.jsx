import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  APIProvider,
  Map,
  Marker,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { supabase } from "./lib/supabase";
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const SEARCH_RADIUS_METRES = 50000;
const MAX_RATING_DISTANCE_METRES = 100;
function toRadians(value) {
  return value * (Math.PI / 180);
}
function calculateDistance(lat1, lng1, lat2, lng2) {
  const radius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
function formatDistance(metres) {
  if (metres < 1000) {
    return Math.round(metres) + " m";
  }
  return (metres / 1000).toFixed(1) + " km";
}
function formatRadius(metres) {
  return metres / 1000 + " km";
}
function today() {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
function formatDate(value) {
  if (!value) {
    return "";
  }
  const parts = value.split("-");
  if (parts.length !== 3) {
    return value;
  }
  return [parts[2], parts[1], parts[0]].join(".");
}
function normaliseVisit(row) {
  return {
    id: row.id,
    userId: row.user_id,
    placeId: row.place_id,
    placeName: row.place_name,
    latitude: row.latitude,
    longitude: row.longitude,
    googleRating: row.google_rating,
    flavour: row.flavour || "",
    rating: row.rating,
    favourite: row.favourite,
    visitDate: row.visit_date,
    createdAt: row.created_at,
    visibility:
      row.visibility ||
      'friends',
  };
}
function navigateToCoordinates(latitude, longitude) {
  const destination = latitude + "," + longitude;
  const url =
    "https://www.google.com/maps/dir/?api=1" +
    "&destination=" +
    encodeURIComponent(destination) +
    "&travelmode=walking";
  window.open(url, "_blank", "noopener,noreferrer");
}
function RatingCones({ rating }) {
  return (
    <div className="rating">
      {" "}
      {[1, 2, 3, 4, 5].map((number) => (
        <span key={number} className={number <= rating ? "" : "off"}>
          {" "}
          🍦{" "}
        </span>
      ))}{" "}
    </div>
  );
}
function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!email.trim()) {
      setError("Skriv inn e-postadressen din.");
      return;
    }
    if (password.length < 6) {
      setError("Passordet må ha minst 6 tegn.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const result = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: displayName.trim() },
            emailRedirectTo: window.location.origin,
          },
        });
        if (result.error) {
          throw result.error;
        }
        setMessage(
          result.data.session
            ? "Kontoen er opprettet."
            : "Kontoen er opprettet. Bekreft e-posten før du logger inn.",
        );
      } else {
        const result = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (result.error) {
          throw result.error;
        }
      }
    } catch (submitError) {
      setError(submitError.message || "Innloggingen mislyktes.");
    } finally {
      setLoading(false);
    }
  }
  async function resetPassword() {
    setError("");
    setMessage("");
    if (!email.trim()) {
      setError("Skriv inn e-postadressen først.");
      return;
    }
    const result = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setMessage("Lenke for nytt passord er sendt.");
  }
  return (
    <main className="center-page">
      {" "}
      <Styles />{" "}
      <section className="panel">
        {" "}
        <div className="large-logo"> 🍦 </div>{" "}
        <div className="brand centered"> GELATO HUNTER </div>{" "}
        <h1 className="centered">
          {" "}
          {mode === "login" ? "Velkommen tilbake" : "Opprett konto"}{" "}
        </h1>{" "}
        <form onSubmit={submit}>
          {" "}
          {mode === "signup" && (
            <>
              {" "}
              <label> Visningsnavn </label>{" "}
              <input
                className="text-input"
                value={displayName}
                placeholder="Ditt navn"
                onChange={(event) => setDisplayName(event.target.value)}
              />{" "}
            </>
          )}{" "}
          <label>E-post</label>{" "}
          <input
            className="text-input"
            type="email"
            value={email}
            placeholder="navn@eksempel.no"
            onChange={(event) => setEmail(event.target.value)}
          />{" "}
          <label>Passord</label>{" "}
          <input
            className="text-input"
            type="password"
            value={password}
            placeholder="Minst 6 tegn"
            onChange={(event) => setPassword(event.target.value)}
          />{" "}
          <button className="green-button" disabled={loading}>
            {" "}
            {loading
              ? "Arbeider..."
              : mode === "login"
                ? "Logg inn"
                : "Opprett konto"}{" "}
          </button>{" "}
        </form>{" "}
        {mode === "login" && (
          <button className="link-button full" onClick={resetPassword}>
            {" "}
            Glemt passord?{" "}
          </button>
        )}{" "}
        {error && <div className="error-box"> {error} </div>}{" "}
        {message && <div className="success-box"> {message} </div>}{" "}
        <div className="switch-row">
          {" "}
          {mode === "login"
            ? "Har du ikke konto?"
            : "Har du allerede konto?"}{" "}
          <button
            className="link-button"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError("");
              setMessage("");
            }}
          >
            {" "}
            {mode === "login" ? "Opprett konto" : "Logg inn"}{" "}
          </button>{" "}
        </div>{" "}
      </section>{" "}
    </main>
  );
}
function ProfileScreen({ session, profile, onSaved }) {
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [username, setUsername] = useState(profile?.username || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  function changeUsername(event) {
    setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
  }
  async function saveProfile(event) {
    event.preventDefault();
    setError("");
    const cleanName = displayName.trim();
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanName) {
      setError("Skriv inn visningsnavnet ditt.");
      return;
    }
    if (cleanUsername.length < 3 || cleanUsername.length > 20) {
      setError("Brukernavnet må være mellom 3 og 20 tegn.");
      return;
    }
    setSaving(true);
    const result = await supabase
      .from("profiles")
      .upsert(
        {
          id: session.user.id,
          display_name: cleanName,
          username: cleanUsername,
        },
        { onConflict: "id" },
      )
      .select("id,display_name,username,created_at,default_visit_visibility")
      .single();
    setSaving(false);
    if (result.error) {
      setError(
        result.error.code === "23505"
          ? "Dette brukernavnet er allerede tatt."
          : "Profilen kunne ikke lagres: " + result.error.message,
      );
      return;
    }
    onSaved(result.data);
  }
  return (
    <main className="center-page">
      {" "}
      <Styles />{" "}
      <section className="panel">
        {" "}
        <div className="large-logo"> 👤 </div>{" "}
        <div className="brand centered"> GELATO HUNTER </div>{" "}
        <h1 className="centered"> Min profil </h1>{" "}
        <p className="muted centered">
          {" "}
          Velg navnet vennene dine skal se og et unikt brukernavn.{" "}
        </p>{" "}
        <form onSubmit={saveProfile}>
          {" "}
          <label> Visningsnavn </label>{" "}
          <input
            className="text-input"
            value={displayName}
            maxLength={40}
            placeholder="Ditt navn"
            onChange={(event) => setDisplayName(event.target.value)}
          />{" "}
          <label>Brukernavn</label>{" "}
          <div className="username-row">
            {" "}
            <span>@</span>{" "}
            <input
              value={username}
              maxLength={20}
              placeholder="brukernavn"
              onChange={changeUsername}
            />{" "}
          </div>{" "}
          <small className="muted">
            {" "}
            3–20 tegn. Små bokstaver, tall eller _.{" "}
          </small>{" "}
          {username && (
            <div className="preview-box">
              {" "}
              Vennene finner deg som <strong> @{username} </strong>{" "}
            </div>
          )}{" "}
          <button className="green-button" disabled={saving}>
            {" "}
            {saving ? "Lagrer..." : "Lagre profil"}{" "}
          </button>{" "}
        </form>{" "}
        {error && <div className="error-box"> {error} </div>}{" "}
        <button
          className="link-button full"
          onClick={() => supabase.auth.signOut()}
        >
          {" "}
          Logg ut{" "}
        </button>{" "}
      </section>{" "}
    </main>
  );
}
function ProfileSettings({ session, profile, onProfileUpdated }) {
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [username, setUsername] = useState(profile?.username || "");
  const [defaultVisibility, setDefaultVisibility] = useState(
    profile?.default_visit_visibility || "friends",
  );
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  function changeUsername(event) {
    setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
  }
  async function saveSettings(event) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    const cleanName = displayName.trim();
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanName) {
      setErrorMessage("Skriv inn visningsnavnet ditt.");
      return;
    }
    if (cleanUsername.length < 3 || cleanUsername.length > 20) {
      setErrorMessage("Brukernavnet må være mellom 3 og 20 tegn.");
      return;
    }
    if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
      setErrorMessage(
        "Brukernavnet kan bare inneholde små bokstaver, tall og _.",
      );
      return;
    }
    setSaving(true);
    const result = await supabase
      .from("profiles")
      .update({
        display_name: cleanName,
        username: cleanUsername,
        default_visit_visibility: defaultVisibility,
      })
      .eq("id", session.user.id)
      .select("id,display_name,username,created_at,default_visit_visibility")
      .single();
    setSaving(false);
    if (result.error) {
      console.error("Kunne ikke oppdatere profil:", result.error);
      if (result.error.code === "23505") {
        setErrorMessage("Dette brukernavnet er allerede tatt.");
      } else {
        setErrorMessage(
          "Profilen kunne ikke oppdateres: " + result.error.message,
        );
      }
      return;
    }
    onProfileUpdated(result.data);
    setSuccessMessage("Profilinnstillingene er lagret.");
  }
  return (
    <section className="content">
      {" "}
      <div className="section-head">
        {" "}
        <div>
          {" "}
          <div className="eyebrow"> KONTO </div> <h2> Min profil 👤 </h2>{" "}
          <p className="muted"> Administrer profil og personvern. </p>{" "}
        </div>{" "}
      </div>{" "}
      <section className="settings-card">
        {" "}
        <form onSubmit={saveSettings}>
          {" "}
          <label> Visningsnavn </label>{" "}
          <input
            className="text-input"
            value={displayName}
            maxLength={40}
            placeholder="Ditt navn"
            onChange={(event) => setDisplayName(event.target.value)}
          />{" "}
          <label> Brukernavn </label>{" "}
          <div className="username-row">
            {" "}
            <span> @ </span>{" "}
            <input
              value={username}
              maxLength={20}
              placeholder="brukernavn"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={changeUsername}
            />{" "}
          </div>{" "}
          <small className="muted">
            {" "}
            3–20 tegn. Små bokstaver, tall eller _.{" "}
          </small>{" "}
          <div className="settings-divider" />{" "}
          <div className="eyebrow"> PERSONVERN </div>{" "}
          <h3> Standard for nye besøk </h3>{" "}
          <p className="muted">
            {" "}
            Dette brukes automatisk når du registrerer en ny gelato. Du kan
            fortsatt endre innstillingen på hvert besøk.{" "}
          </p>{" "}
          <div className="privacy-options">
            {" "}
            <button
              type="button"
              className={
                defaultVisibility === "friends"
                  ? "privacy-option active"
                  : "privacy-option"
              }
              onClick={() => setDefaultVisibility("friends")}
            >
              {" "}
              <span className="privacy-icon"> 👥 </span>{" "}
              <strong> Venner </strong>{" "}
              <small> Venner kan se besøkene dine </small>{" "}
            </button>{" "}
            <button
              type="button"
              className={
                defaultVisibility === "private"
                  ? "privacy-option active"
                  : "privacy-option"
              }
              onClick={() => setDefaultVisibility("private")}
            >
              {" "}
              <span className="privacy-icon"> 🔒 </span>{" "}
              <strong> Privat </strong>{" "}
              <small> Bare du kan se besøkene dine </small>{" "}
            </button>{" "}
          </div>{" "}
          <div className="current-privacy">
            {" "}
            Standard:{" "}
            <strong>
              {" "}
              {defaultVisibility === "friends"
                ? "👥 Synlig for venner"
                : "🔒 Privat"}{" "}
            </strong>{" "}
          </div>{" "}
          <button type="submit" className="green-button" disabled={saving}>
            {" "}
            {saving ? "Lagrer..." : "Lagre innstillinger"}{" "}
          </button>{" "}
        </form>{" "}
        {errorMessage && <div className="error-box"> {errorMessage} </div>}{" "}
        {successMessage && (
          <div className="success-box"> {successMessage} </div>
        )}{" "}
        <div className="settings-divider" />{" "}
        <button
          type="button"
          className="logout-settings-button"
          onClick={() => supabase.auth.signOut()}
        >
          {" "}
          Logg ut{" "}
        </button>{" "}
      </section>{" "}
    </section>
  );
}
function FriendsScreen({ session }) {
  const currentUserId = session.user.id;
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendFeed, setFriendFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedLoading, setFeedLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const getProfilesByIds = useCallback(async (ids) => {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    if (!uniqueIds.length) {
      return [];
    }
    const result = await supabase
      .from("profiles")
      .select("id,display_name,username")
      .in("id", uniqueIds);
    if (result.error) {
      throw result.error;
    }
    return result.data || [];
  }, []);
  const loadFriendFeed = useCallback(async (acceptedFriends) => {
    const friendIds = acceptedFriends
      .map((friendship) => friendship.person?.id)
      .filter(Boolean);
    if (!friendIds.length) {
      setFriendFeed([]);
      return;
    }
    setFeedLoading(true);
    const result = await supabase
      .from("gelato_visits")
      .select(
        "id,user_id,place_id,place_name,latitude,longitude,google_rating,flavour,rating,favourite,visit_date,created_at,visibility"
      )
      .in("user_id", friendIds)
      .order("visit_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);
    if (result.error) {
      setErrorMessage("Vennefeeden kunne ikke lastes: " + result.error.message);
      setFeedLoading(false);
      return;
    }
    const profileMap = Object.fromEntries(
      acceptedFriends.map((friendship) => [
        friendship.person?.id,
        friendship.person,
      ]),
    );
    setFriendFeed(
      (result.data || []).map((row) => ({
        ...normaliseVisit(row),
        person: profileMap[row.user_id],
      })),
    );
    setFeedLoading(false);
  }, []);
  const loadFriendData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    const result = await supabase
      .from("friendships")
      .select("id,requester_id,addressee_id,status,created_at")
      .or(
        "requester_id.eq." +
          currentUserId +
          ",addressee_id.eq." +
          currentUserId,
      )
      .order("created_at", { ascending: false });
    if (result.error) {
      setErrorMessage("Vennedata kunne ikke lastes: " + result.error.message);
      setLoading(false);
      return;
    }
    try {
      const rows = result.data || [];
      const profiles = await getProfilesByIds(
        rows.flatMap((row) => [row.requester_id, row.addressee_id]),
      );
      const profileMap = Object.fromEntries(
        profiles.map((item) => [item.id, item]),
      );
      const incoming = rows
        .filter(
          (row) =>
            row.status === "pending" && row.addressee_id === currentUserId,
        )
        .map((row) => ({ ...row, person: profileMap[row.requester_id] }));
      const outgoing = rows
        .filter(
          (row) =>
            row.status === "pending" && row.requester_id === currentUserId,
        )
        .map((row) => ({ ...row, person: profileMap[row.addressee_id] }));
      const accepted = rows
        .filter((row) => row.status === "accepted")
        .map((row) => {
          const friendId =
            row.requester_id === currentUserId
              ? row.addressee_id
              : row.requester_id;
          return { ...row, person: profileMap[friendId] };
        });
      setIncomingRequests(incoming);
      setOutgoingRequests(outgoing);
      setFriends(accepted);
      await loadFriendFeed(accepted);
    } catch (loadError) {
      setErrorMessage("Venneprofilene kunne ikke lastes.");
    }
    setLoading(false);
  }, [currentUserId, getProfilesByIds, loadFriendFeed]);
  useEffect(() => {
    loadFriendData();
  }, [loadFriendData]);
  function relationshipFor(personId) {
    const accepted = friends.find((item) => item.person?.id === personId);
    if (accepted) {
      return { type: "accepted", friendship: accepted };
    }
    const outgoing = outgoingRequests.find(
      (item) => item.person?.id === personId,
    );
    if (outgoing) {
      return { type: "outgoing", friendship: outgoing };
    }
    const incoming = incomingRequests.find(
      (item) => item.person?.id === personId,
    );
    if (incoming) {
      return { type: "incoming", friendship: incoming };
    }
    return null;
  }
  async function searchUsers(event) {
    event.preventDefault();
    const query = searchText.trim().toLowerCase().replace(/^@/, "");
    setMessage("");
    setErrorMessage("");
    setSearchResults([]);
    if (query.length < 3) {
      setErrorMessage("Skriv minst 3 tegn.");
      return;
    }
    setSearching(true);
    const result = await supabase
      .from("profiles")
      .select("id,display_name,username")
      .ilike("username", "%" + query + "%")
      .neq("id", currentUserId)
      .limit(10);
    setSearching(false);
    if (result.error) {
      setErrorMessage("Søket feilet: " + result.error.message);
      return;
    }
    setSearchResults(result.data || []);
    if (!result.data?.length) {
      setMessage("Ingen brukere funnet.");
    }
  }
  async function sendRequest(person) {
    setErrorMessage("");
    const relationship = relationshipFor(person.id);
    if (relationship) {
      setMessage(
        relationship.type === "accepted"
          ? "Dere er allerede venner."
          : "Det finnes allerede en forespørsel.",
      );
      return;
    }
    const result = await supabase
      .from("friendships")
      .insert({
        requester_id: currentUserId,
        addressee_id: person.id,
        status: "pending",
      });
    if (result.error) {
      setErrorMessage(
        "Forespørselen kunne ikke sendes: " + result.error.message,
      );
      return;
    }
    setMessage("Venneforespørsel sendt til @" + person.username + ".");
    await loadFriendData();
  }
  async function acceptRequest(friendship) {
    setErrorMessage("");
    const result = await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", friendship.id)
      .eq("addressee_id", currentUserId);
    if (result.error) {
      setErrorMessage(
        "Forespørselen kunne ikke godtas: " + result.error.message,
      );
      return;
    }
    setMessage("Dere er nå venner.");
    await loadFriendData();
  }
  async function deleteFriendship(friendship, successMessage) {
    setErrorMessage("");
    const result = await supabase
      .from("friendships")
      .delete()
      .eq("id", friendship.id);
    if (result.error) {
      setErrorMessage("Handlingen feilet: " + result.error.message);
      return;
    }
    setMessage(successMessage);
    await loadFriendData();
  }
  return (
    <section className="content">
      {" "}
      <div className="section-head">
        {" "}
        <div>
          {" "}
          <div className="eyebrow"> VENNEOMRÅDE </div> <h2>Venner 👥</h2>{" "}
          <p className="muted">
            {" "}
            Finn venner og se deres siste gelato-besøk.{" "}
          </p>{" "}
        </div>{" "}
        <button className="white-button" onClick={loadFriendData}>
          {" "}
          Oppdater{" "}
        </button>{" "}
      </div>{" "}
      <form className="friend-search" onSubmit={searchUsers}>
        {" "}
        <div className="username-row">
          {" "}
          <span>@</span>{" "}
          <input
            value={searchText}
            placeholder="brukernavn"
            onChange={(event) =>
              setSearchText(
                event.target.value.toLowerCase().replace(/[^a-z0-9_@]/g, ""),
              )
            }
          />{" "}
        </div>{" "}
        <button className="orange-button" disabled={searching}>
          {" "}
          {searching ? "Søker..." : "Finn venner"}{" "}
        </button>{" "}
      </form>{" "}
      {errorMessage && <div className="error-box"> {errorMessage} </div>}{" "}
      {message && <div className="success-box"> {message} </div>}{" "}
      {!!searchResults.length && (
        <div className="friend-section">
          {" "}
          <h3>Søkeresultater</h3>{" "}
          <div className="list">
            {" "}
            {searchResults.map((person) => {
              const relationship = relationshipFor(person.id);
              return (
                <article className="friend-card" key={person.id}>
                  {" "}
                  <div className="avatar"> 👤 </div>{" "}
                  <div className="grow">
                    {" "}
                    <strong>
                      {" "}
                      {person.display_name || person.username}{" "}
                    </strong>{" "}
                    <div className="muted"> @{person.username} </div>{" "}
                  </div>{" "}
                  {!relationship && (
                    <button
                      className="orange-button compact"
                      onClick={() => sendRequest(person)}
                    >
                      {" "}
                      Legg til{" "}
                    </button>
                  )}{" "}
                  {relationship?.type === "accepted" && (
                    <span className="badge accepted"> Venner </span>
                  )}{" "}
                  {relationship?.type === "outgoing" && (
                    <span className="badge"> Sendt </span>
                  )}{" "}
                  {relationship?.type === "incoming" && (
                    <button
                      className="green-button compact"
                      onClick={() => acceptRequest(relationship.friendship)}
                    >
                      {" "}
                      Godta{" "}
                    </button>
                  )}{" "}
                </article>
              );
            })}{" "}
          </div>{" "}
        </div>
      )}{" "}
      {loading && <div className="message"> Laster vennedata... </div>}{" "}
      {!loading && !!incomingRequests.length && (
        <div className="friend-section">
          {" "}
          <h3> Venneforespørsler </h3>{" "}
          <div className="list">
            {" "}
            {incomingRequests.map((item) => (
              <article className="friend-card" key={item.id}>
                {" "}
                <div className="avatar"> 👋 </div>{" "}
                <div className="grow">
                  {" "}
                  <strong>
                    {" "}
                    {item.person?.display_name || item.person?.username}{" "}
                  </strong>{" "}
                  <div className="muted"> @ {item.person?.username} </div>{" "}
                </div>{" "}
                <div className="friend-actions">
                  {" "}
                  <button
                    className="green-button compact"
                    onClick={() => acceptRequest(item)}
                  >
                    {" "}
                    Godta{" "}
                  </button>{" "}
                  <button
                    className="delete-button compact"
                    onClick={() =>
                      deleteFriendship(item, "Forespørselen er avslått.")
                    }
                  >
                    {" "}
                    Avslå{" "}
                  </button>{" "}
                </div>{" "}
              </article>
            ))}{" "}
          </div>{" "}
        </div>
      )}{" "}
      {!loading && !!outgoingRequests.length && (
        <div className="friend-section">
          {" "}
          <h3> Sendte forespørsler </h3>{" "}
          <div className="list">
            {" "}
            {outgoingRequests.map((item) => (
              <article className="friend-card" key={item.id}>
                {" "}
                <div className="avatar"> 📤 </div>{" "}
                <div className="grow">
                  {" "}
                  <strong>
                    {" "}
                    {item.person?.display_name || item.person?.username}{" "}
                  </strong>{" "}
                  <div className="muted"> @ {item.person?.username} </div>{" "}
                </div>{" "}
                <button
                  className="delete-button compact"
                  onClick={() =>
                    deleteFriendship(item, "Forespørselen er trukket tilbake.")
                  }
                >
                  {" "}
                  Trekk tilbake{" "}
                </button>{" "}
              </article>
            ))}{" "}
          </div>{" "}
        </div>
      )}{" "}
      {!loading && (
        <div className="friend-section">
          {" "}
          <h3> Mine venner ({friends.length}) </h3>{" "}
          {!friends.length && (
            <div className="message"> Ingen venner registrert ennå. </div>
          )}{" "}
          <div className="list">
            {" "}
            {friends.map((item) => (
              <article className="friend-card" key={item.id}>
                {" "}
                <div className="avatar"> 🍦 </div>{" "}
                <div className="grow">
                  {" "}
                  <strong>
                    {" "}
                    {item.person?.display_name || item.person?.username}{" "}
                  </strong>{" "}
                  <div className="muted"> @ {item.person?.username} </div>{" "}
                </div>{" "}
                <button
                  className="delete-button compact"
                  onClick={() => {
                    const confirmed = window.confirm(
                      "Vil du fjerne denne vennen?",
                    );
                    if (confirmed) {
                      deleteFriendship(item, "Vennen er fjernet.");
                    }
                  }}
                >
                  {" "}
                  Fjern{" "}
                </button>{" "}
              </article>
            ))}{" "}
          </div>{" "}
        </div>
      )}{" "}
      <div className="friend-section">
        {" "}
        <h3> Vennenes gelatoer 🍦 </h3>{" "}
        {feedLoading && <div className="message"> Laster vennefeed... </div>}{" "}
        {!feedLoading && friends.length > 0 && friendFeed.length === 0 && (
          <div className="message">
            {" "}
            Vennene dine har ikke registrert noen besøk ennå.{" "}
          </div>
        )}{" "}
        {!feedLoading && friends.length === 0 && (
          <div className="message">
            {" "}
            Legg til venner for å se gelato-besøkene deres.{" "}
          </div>
        )}{" "}
        <div className="feed-list">
          {" "}
          {friendFeed.map((visit) => (
            <article className="feed-card" key={visit.id}>
              {" "}
              <div className="feed-person">
                {" "}
                <div className="avatar"> 👤 </div>{" "}
                <div className="grow">
                  {" "}
                  <strong>
                    {" "}
                    {visit.person?.display_name ||
                      visit.person?.username ||
                      "Gelato Hunter"}{" "}
                  </strong>{" "}
                  <div className="muted"> @ {visit.person?.username} </div>{" "}
                </div>{" "}
                {visit.favourite && (
                  <span className="feed-heart"> ❤️ </span>
                )}{" "}
              </div>{" "}
              <h3 className="feed-place"> {visit.placeName} </h3>{" "}
              <div className="feed-date">
                {" "}
                📅 {formatDate(visit.visitDate)}{" "}
              </div>{" "}
              <RatingCones rating={visit.rating} />{" "}
              <div className="feed-rating-text"> {visit.rating} av 5 </div>{" "}
              {visit.flavour && (
                <div className="tag"> Smak: {visit.flavour} </div>
              )}{" "}
              {visit.googleRating && (
                <div className="feed-google-rating">
                  {" "}
                  Google: {visit.googleRating} ⭐{" "}
                </div>
              )}{" "}
              {visit.latitude && visit.longitude && (
                <button
                  className="orange-button full"
                  onClick={() =>
                    navigateToCoordinates(visit.latitude, visit.longitude)
                  }
                >
                  {" "}
                  🧭 Naviger til stedet{" "}
                </button>
              )}{" "}
            </article>
          ))}{" "}
        </div>{" "}
      </div>{" "}
    </section>
  );
}
function GelatoHunter({ session, profile, onProfileUpdated }) {
  const placesLibrary = useMapsLibrary("places");
  const user = session.user;
  const [view, setView] = useState("discover");
  const [userPosition, setUserPosition] = useState(null);
  const [places, setPlaces] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [placeStatus, setPlaceStatus] = useState("waiting");
  const [message, setMessage] = useState("Finner posisjonen din...");
  const [rating, setRating] = useState(0);
  const [flavour, setFlavour] = useState("");
  const [visitDate, setVisitDate] = useState(today());
  const [favourite, setFavourite] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [onlyFavourites, setOnlyFavourites] = useState(false);
  const [
    visibility,
    setVisibility,
  ] = useState(
    profile.default_visit_visibility ||
    'friends'
  );
  const loadVisits = useCallback(async () => {
    setHistoryLoading(true);
    const result = await supabase
      .from("gelato_visits")
      .select(
        "id,user_id,place_id,place_name,latitude,longitude,google_rating,flavour,rating,favourite,visit_date,created_at,visibility"
      )
      .eq("user_id", user.id)
      .order("visit_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (!result.error) {
      setHistory((result.data || []).map(normaliseVisit));
    }
    setHistoryLoading(false);
  }, [user.id]);
  useEffect(() => {
    loadVisits();
  }, [loadVisits]);
  useEffect(() => {
    if (!navigator.geolocation) {
      setMessage("Nettleseren støtter ikke posisjon.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserPosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        setMessage("Posisjonen kunne ikke hentes.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }, []);
  const searchPlaces = useCallback(async () => {
    if (!placesLibrary || !userPosition) {
      return;
    }
    setPlaceStatus("loading");
    setPlaces([]);
    try {
      const result = await placesLibrary.Place.searchNearby({
        fields: ["id", "displayName", "location", "rating", "googleMapsURI"],
        locationRestriction: { center: userPosition, radius: SEARCH_RADIUS_METRES,},
        includedPrimaryTypes: ["ice_cream_shop"],
        maxResultCount: 20,
        rankPreference: placesLibrary.SearchNearbyRankPreference.DISTANCE,
      });
      const mapped = (result.places || [])
        .filter((place) => place.id && place.location)
        .map((place) => {
          const latitude =
            typeof place.location.lat === "function"
              ? place.location.lat()
              : place.location.lat;
          const longitude =
            typeof place.location.lng === "function"
              ? place.location.lng()
              : place.location.lng;
          return {
            id: place.id,
            name:
              typeof place.displayName === "string"
                ? place.displayName
                : place.displayName?.text || "Iskremsted",
            latitude,
            longitude,
            rating: place.rating || null,
            googleMapsURI: place.googleMapsURI || null,
            distanceMetres: calculateDistance(
              userPosition.lat,
              userPosition.lng,
              latitude,
              longitude,
            ),
          };
        })
        .sort((a, b) => a.distanceMetres - b.distanceMetres);
      setPlaces(mapped);
      setPlaceStatus("ready");
      setMessage(
        mapped.length
          ? ""
          : "Ingen iskremsteder funnet innen " ,
      );
    } catch (error) {
      setPlaceStatus("error");
      setMessage("Iskremstedene kunne ikke lastes.");
    }
  }, [placesLibrary, userPosition ]);
  useEffect(() => {
    searchPlaces();
  }, [searchPlaces]);
  const visibleHistory = useMemo(() => {
    return onlyFavourites
      ? history.filter((visit) => visit.favourite)
      : history;
  }, [history, onlyFavourites]);
  function openPlace(place) {
    setSelectedPlace(place);
    setRating(0);
    setFlavour("");
    setVisitDate(today());
    setFavourite(false);
    setSaveMessage("");
    setVisibility(
      profile.default_visit_visibility ||
      'friends'
    );    
  }
  async function saveVisit() { if (!selectedPlace) { return; } if (!userPosition) { setSaveMessage( 'Posisjonen din er ikke tilgjengelig ennå.' ); return; } const currentDistance = calculateDistance( userPosition.lat, userPosition.lng, selectedPlace.latitude, selectedPlace.longitude ); if ( currentDistance > MAX_RATING_DISTANCE_METRES ) { setSaveMessage( 'Du må være innenfor 100 meter fra stedet for å registrere besøket.' ); return; } if (!rating) { setSaveMessage( 'Velg 1–5 iskremkjegler.' ); return; }    setSaving(true);
    const result = await supabase
      .from("gelato_visits")
      .insert({
        user_id: user.id,
        place_id: selectedPlace.id,
        place_name: selectedPlace.name,
        latitude: selectedPlace.latitude,
        longitude: selectedPlace.longitude,
        google_rating: selectedPlace.rating,
        flavour: flavour.trim() || null,
        rating,
        favourite,
        visibility:
  visibility,
        visit_date: visitDate,
      })
      .select(
        "id,user_id,place_id,place_name,latitude,longitude,google_rating,flavour,rating,favourite,visit_date,created_at,visibility"
      )
      .single();
    setSaving(false);
    if (result.error) {
      setSaveMessage("Besøket kunne ikke lagres: " + result.error.message);
      return;
    }
    setHistory((current) => [normaliseVisit(result.data), ...current]);
    setSaveMessage("Besøket er lagret.");
  }
  async function deleteVisit(id) {
    const confirmed = window.confirm("Vil du slette dette besøket?");
    if (!confirmed) {
      return;
    }
    const result = await supabase
      .from("gelato_visits")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (!result.error) {
      setHistory((current) => current.filter((visit) => visit.id !== id));
    }
  }
  async function toggleFavourite(visit) {
    const result = await supabase
      .from("gelato_visits")
      .update({ favourite: !visit.favourite })
      .eq("id", visit.id)
      .eq("user_id", user.id)
      .select(
        "id,user_id,place_id,place_name,latitude,longitude,google_rating,flavour,rating,favourite,visit_date,created_at,visibility"
      )
      .single();
    if (!result.error) {
      const updated = normaliseVisit(result.data);
      setHistory((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    }
  }
  const selectedPlaceDistance =
  selectedPlace &&
  userPosition &&
  Number.isFinite(selectedPlace.latitude) &&
  Number.isFinite(selectedPlace.longitude)
    ? calculateDistance(
        userPosition.lat,
        userPosition.lng,
        selectedPlace.latitude,
        selectedPlace.longitude,
      )
    : null;
const canRegisterVisit =
  selectedPlaceDistance !== null &&
  selectedPlaceDistance <= MAX_RATING_DISTANCE_METRES;
  return (
    <main className="app">
      {" "}
      <Styles />{" "}
      <header className="header">
        {" "}
        <div className="top-row">
          {" "}
          <div>
            {" "}
            <div className="brand"> GELATO HUNTER </div>{" "}
            <h1> Finn neste kule 🍦 </h1>{" "}
            <p>
              {" "}
              Hei, {profile.display_name} (@{profile.username}){" "}
            </p>{" "}
          </div>{" "}
          <button
            className="white-button"
            onClick={() => supabase.auth.signOut()}
          >
            {" "}
            Logg ut{" "}
          </button>{" "}
        </div>{" "}
        <nav>
          {" "}
          <button
            className={view === "discover" ? "tab active" : "tab"}
            onClick={() => setView("discover")}
          >
            {" "}
            📍 Finn iskrem{" "}
          </button>{" "}
          <button
            className={view === "history" ? "tab active" : "tab"}
            onClick={() => setView("history")}
          >
            {" "}
            🍦 Mine gelatoer{" "}
            {history.length ? " (" + history.length + ")" : ""}{" "}
          </button>{" "}
          <button
            className={view === "friends" ? "tab active" : "tab"}
            onClick={() => setView("friends")}
          >
            {" "}
            👥 Venner{" "}
          </button>
          <button
  className={view === "profile" ? "tab active" : "tab"}
  onClick={() => setView("profile")}
>
  {" "}
  👤 Profil{" "}
</button>{" "}
        </nav>{" "}
      </header>{" "}
      {view === "discover" && (
        <>
          {" "}
          <section className="map-wrap">
            {" "}
            {userPosition ? (
              <Map
                defaultCenter={userPosition}
                defaultZoom={13}
                gestureHandling="greedy"
                disableDefaultUI
                className="map"
              >
                {" "}
                <Marker position={userPosition} title="Du er her" />{" "}
                {places.map((place) => (
                  <Marker
                    key={place.id}
                    position={{ lat: place.latitude, lng: place.longitude }}
                    title={place.name}
                    onClick={() => openPlace(place)}
                  />
                ))}{" "}
              </Map>
            ) : (
              <div className="message"> {message} </div>
            )}{" "}
          </section>{" "}
          <section className="content">
            {" "}
            <div className="section-head">
              {" "}
              <div>
                {" "}
                <div className="eyebrow"> NÆRMEST DEG </div>{" "}
                <h2> Iskrem i nærheten </h2>{" "}
                <small> Viser steder sortert etter avstand </small>{" "}
              </div>{" "}
              <span> {places.length} steder </span>{" "}
            </div>{" "}
            {placeStatus === "loading" && (
              <div className="message"> Søker etter iskrem... </div>
            )}{" "}
            {message && placeStatus !== "loading" && (
              <div className="message"> {message} </div>
            )}{" "}{" "}
            <div className="list">
              {" "}
              {places.map((place, index) => (
                <button
                  key={place.id}
                  className="place-card"
                  onClick={() => openPlace(place)}
                >
                  {" "}
                  <div className="number"> {index + 1} </div>{" "}
                  <div className="grow">
                    {" "}
                    <strong> {place.name} </strong>{" "}
                    <div className="muted">
                      {" "}
                      📍 {formatDistance(place.distanceMetres)}{" "}
                      {place.rating
                        ? " · Google " + place.rating + " ⭐"
                        : ""}{" "}
                    </div>{" "}
                  </div>{" "}
                  <span className="arrow"> › </span>{" "}
                </button>
              ))}{" "}
            </div>{" "}
          </section>{" "}
        </>
      )}{" "}
      {view === "history" && (
        <section className="content">
          {" "}
          <div className="section-head">
            {" "}
            <div>
              {" "}
              <div className="eyebrow"> DIN HISTORIKK </div>{" "}
              <h2> Mine gelatoer 🍦 </h2>{" "}
            </div>{" "}
            <button
              className="white-button"
              onClick={() => setOnlyFavourites(!onlyFavourites)}
            >
              {" "}
              {onlyFavourites ? "Vis alle" : "❤️ Favoritter"}{" "}
            </button>{" "}
          </div>{" "}
          {historyLoading && (
            <div className="message"> Laster historikken... </div>
          )}{" "}
          {!historyLoading && !visibleHistory.length && (
            <div className="message"> Ingen registrerte besøk ennå. </div>
          )}{" "}
          <div className="list">
            {" "}
            {visibleHistory.map((visit) => (
              <article className="history-card" key={visit.id}>
                {" "}
                <div className="top-row">
                  {" "}
                  <div>
                    {" "}
                    <h3> {visit.placeName} </h3>{" "}
                    <small> 📅 {formatDate(visit.visitDate)} </small>{" "}
                    <div className="privacy-label">
  {" "}
  {visit.visibility === "private" ? "🔒 Privat" : "👥 Synlig for venner"}{" "}
</div>;

                  </div>{" "}
                  <button
                    className="heart"
                    onClick={() => toggleFavourite(visit)}
                  >
                    {" "}
                    {visit.favourite ? "❤️" : "♡"}{" "}
                  </button>{" "}
                </div>{" "}
                <RatingCones rating={visit.rating} />{" "}
                {visit.flavour && (
                  <div className="tag"> Smak: {visit.flavour} </div>
                )}{" "}
                <div className="actions">
                  {" "}
                  <button
                    className="orange-button"
                    onClick={() =>
                      navigateToCoordinates(visit.latitude, visit.longitude)
                    }
                  >
                    {" "}
                    🧭 Naviger{" "}
                  </button>{" "}
                  <button
                    className="delete-button"
                    onClick={() => deleteVisit(visit.id)}
                  >
                    {" "}
                    Slett{" "}
                  </button>{" "}
                </div>{" "}
              </article>
            ))}{" "}
          </div>{" "}
        </section>
      )}{" "}
      {view === "friends" && <FriendsScreen session={session}  />}
      {
  view === "profile" && (
    <ProfileSettings
      session={session}
      profile={profile}
      onProfileUpdated={onProfileUpdated}/>)}
      {selectedPlace && (
        <div className="overlay" onClick={() => setSelectedPlace(null)}>
          {" "}
          <section
            className="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            {" "}
            <button className="close" onClick={() => setSelectedPlace(null)}>
              {" "}
              ×{" "}
            </button>{" "}
            <h2> {selectedPlace.name} </h2>{" "}
            <p className="muted">
              {" "}
              📍 {formatDistance(selectedPlace.distanceMetres)} unna{" "}
            </p>{" "}
            <button
              className="orange-button full"
              onClick={() =>
                navigateToCoordinates(
                  selectedPlace.latitude,
                  selectedPlace.longitude,
                )
              }
            >
              {" "}
              🧭 Naviger hit{" "}
            </button>{" "}
            <div className="distance-status"> <strong> {canRegisterVisit ? '✅ Du er nær nok til å registrere besøket' : '🔒 Du må være innenfor 100 meter'} </strong> <div className="muted"> Beregnet avstand:{' '} {selectedPlaceDistance !== null ? formatDistance( selectedPlaceDistance ) : 'Ukjent'} </div> </div> {canRegisterVisit ? ( <> <h3> Registrer nytt besøk </h3> <label> Din rating </label> <div className="cones"> {[1, 2, 3, 4, 5].map( (number) => ( <button type="button" key={number} className={ number <= rating ? 'cone selected' : 'cone' } onClick={() => setRating(number) } > <span> 🍦 </span> <small> {number} </small> </button> ) )} </div> <label> Smak </label> <input className="text-input" value={flavour} placeholder="For eksempel pistasj" onChange={(event) => setFlavour( event.target.value ) } /> <label> Besøksdato </label> <input className="text-input" type="date" value={visitDate} max={today()} onChange={(event) => setVisitDate( event.target.value ) } /> <button type="button" className={ favourite ? 'white-button favourite full' : 'white-button full' } onClick={() => setFavourite( !favourite ) } > {favourite ? '❤️ Favoritt' : '♡ Marker som favoritt'} </button> <div className="privacy-box"> <label> Hvem kan se besøket? </label> <div className="privacy-options"> <button type="button" className={ visibility === 'friends' ? 'privacy-option active' : 'privacy-option' } onClick={() => setVisibility( 'friends' ) } > 👥 Venner </button> <button type="button" className={ visibility === 'private' ? 'privacy-option active' : 'privacy-option' } onClick={() => setVisibility( 'private' ) } > 🔒 Privat </button> </div> <small className="muted"> {visibility === 'friends' ? 'Godkjente venner kan se besøket i vennefeeden.' : 'Bare du kan se dette besøket.'} </small> </div> <button className="green-button" disabled={saving} onClick={saveVisit} > {saving ? 'Lagrer...' : 'Lagre besøket'} </button> </> ) : ( <div className="rating-locked"> <div className="rating-locked-icon"> 🍦 </div> <strong> Besøksregistrering er låst </strong> <p> Gå nærmere iskremstedet. Når du er innenfor 100 meter kan du registrere smak, rating og favoritt. </p> <button type="button" className="orange-button full" onClick={() => navigateToCoordinates( selectedPlace.latitude, selectedPlace.longitude ) } > 🧭 Naviger til stedet </button> </div> )} {saveMessage && ( <div className="message"> {saveMessage} </div> )}
            {" "}
          </section>{" "}
        </div>
      )}{" "}
    </main>
  );
}
function Styles() {
  return (
    <style>{` * { box-sizing: border-box; } :root { --bg: #fff9ee; --surface: #ffffff; --surface-soft: #fff1dc; --text: #202020; --text-heading: #32251d; --text-soft: #6b625c; --text-muted: #91877f; --primary: #f97316; --primary-hover: #ea650c; --primary-soft: #fff0d9; --success: #3e7c59; --success-soft: #edf7f0; --danger: #c94a4a; --danger-soft: #fff0f0; --border: #eadcca; --border-dark: #ddc9b2; --shadow: 0 18px 50px rgba(72, 45, 24, 0.12); } body { margin: 0; background: var(--bg); color: var(--text); } h1, h2, h3 { color: var(--text-heading); } button, input { font: inherit; } button { touch-action: manipulation; } .app, .center-page { min-height: 100vh; background: var(--bg); color: var(--text); font-family: Arial, Helvetica, sans-serif; } .center-page { display: flex; align-items: center; justify-content: center; padding: 24px; } .panel { width: min(440px, 100%); padding: 28px; border: 1px solid var(--border); border-radius: 24px; background: var(--surface); color: var(--text); box-shadow: var(--shadow); } .large-logo { font-size: 65px; text-align: center; } .brand, .eyebrow { color: var(--primary); font-size: 11px; font-weight: 900; letter-spacing: 2px; } .centered { text-align: center; } .header h1 { color: var(--text-heading); } .header p { color: var(--text-soft); } label { display: block; margin: 15px 0 7px; color: var(--text-heading); font-size: 13px; font-weight: 900; } .text-input { width: 100%; padding: 12px 13px; border: 2px solid var(--border); border-radius: 12px; background: var(--surface); color: var(--text); font-size: 16px; } .text-input:focus { border-color: var(--primary); outline: none; } .text-input::placeholder, .username-row input::placeholder { color: var(--text-muted); opacity: 1; } .username-row { display: flex; align-items: center; border: 2px solid var(--border); border-radius: 12px; background: var(--surface); } .username-row:focus-within { border-color: var(--primary); } .username-row span { padding-left: 13px; color: var(--primary); font-size: 18px; font-weight: 900; } .username-row input { width: 100%; padding: 12px 13px 12px 4px; border: 0; outline: 0; background: var(--surface); color: var(--text); } .preview-box, .message, .error-box, .success-box { margin-top: 12px; padding: 12px; border-radius: 11px; text-align: center; } .preview-box, .message { background: var(--primary-soft); color: var(--text-heading); } .error-box { background: var(--danger-soft); color: var(--danger); } .success-box { background: var(--success-soft); color: var(--success); } .green-button, .orange-button, .white-button, .delete-button { padding: 12px 14px; border-radius: 12px; font-weight: 900; cursor: pointer; } .green-button { width: 100%; margin-top: 16px; border: 0; background: var(--success); color: #ffffff; } .orange-button { border: 0; background: var(--primary); color: #ffffff; } .orange-button:hover { background: var(--primary-hover); } .orange-button.full { width: 100%; } .white-button { border: 2px solid var(--border-dark); background: var(--surface); color: var(--text-soft); } .white-button.full, .white-button.favourite { width: 100%; margin-top: 14px; } .white-button.favourite { border-color: var(--primary); background: var(--primary-soft); color: var(--primary-hover); } .delete-button { border: 2px solid #e1caca; background: var(--surface); color: var(--danger); } .link-button { margin-top: 12px; border: 0; background: transparent; color: var(--primary-hover); font-weight: 800; cursor: pointer; } .link-button.full { width: 100%; } .switch-row { margin-top: 18px; color: var(--text-soft); text-align: center; } .switch-row .link-button { margin-left: 5px; } .muted { color: var(--text-soft); } .header, .content { max-width: 820px; margin: 0 auto; padding: 20px 14px; } .top-row, .section-head, .actions { display: flex; justify-content: space-between; gap: 12px; } .header nav { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; margin-top: 17px; } .tab { padding: 11px; border: 2px solid var(--border); border-radius: 13px; background: var(--surface); color: var(--text-soft); font-weight: 800; cursor: pointer; } .tab.active { border-color: var(--primary); background: var(--primary-soft); color: var(--primary-hover); } .map-wrap { max-width: 820px; height: 42vh; min-height: 320px; margin: 0 auto; padding: 0 12px; } .map { width: 100%; height: 100%; overflow: hidden; border-radius: 24px; } .list, .feed-list { display: grid; gap: 10px; margin-top: 12px; } .place-card, .history-card, .friend-card, .feed-card { width: 100%; padding: 14px; border: 1px solid var(--border); border-radius: 17px; background: var(--surface); color: var(--text); } .place-card, .friend-card { display: flex; align-items: center; gap: 12px; text-align: left; } .place-card { cursor: pointer; } .place-card:hover { border-color: var(--primary); background: #fffdf9; } .number { width: 38px; height: 38px; display: grid; flex-shrink: 0; place-items: center; border-radius: 50%; background: var(--primary-soft); color: var(--primary); font-weight: 900; } .grow { flex: 1; min-width: 0; } .arrow { color: var(--text-muted); font-size: 30px; } .history-card h3 { margin: 0; } .rating { display: flex; gap: 4px; margin-top: 14px; font-size: 25px; } .rating .off { filter: grayscale(1); opacity: 0.22; } .tag { display: inline-block; margin: 10px 0; padding: 7px 10px; border-radius: 10px; background: var(--primary-soft); color: var(--text-heading); font-weight: 800; } .heart { width: 44px; height: 42px; border: 2px solid var(--border-dark); border-radius: 12px; background: var(--surface); color: var(--text); font-size: 23px; cursor: pointer; } .actions { margin-top: 12px; } .actions button { flex: 1; } .friend-search { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; margin: 14px 0 20px; } .friend-section { margin-top: 24px; } .friend-section h3 { margin-bottom: 10px; } .avatar { width: 42px; height: 42px; display: grid; flex-shrink: 0; place-items: center; border-radius: 50%; background: var(--primary-soft); font-size: 22px; } .friend-actions { display: flex; gap: 6px; } .compact { width: auto; margin: 0; padding: 9px 11px; white-space: nowrap; } .badge { padding: 7px 10px; border-radius: 999px; background: #f3f1ee; color: var(--text-soft); font-size: 12px; font-weight: 900; } .badge.accepted { background: var(--success-soft); color: var(--success); } .feed-person { display: flex; align-items: center; gap: 11px; } .feed-heart { font-size: 22px; } .feed-place { margin: 15px 0 4px; } .feed-date, .feed-google-rating { color: var(--text-soft); font-size: 13px; } .feed-rating-text { margin-top: 4px; color: var(--primary); font-size: 13px; font-weight: 900; } .feed-card .full { margin-top: 12px; } .privacy-box { margin-top: 16px; padding: 14px; border-radius: 14px; background: var(--bg); } .privacy-box label { margin-top: 0; } .privacy-options { display: grid; grid-template-columns: repeat( 2, minmax(0, 1fr) ); gap: 8px; margin-bottom: 8px; } .privacy-option { padding: 11px; border: 2px solid var(--border); border-radius: 12px; background: var(--surface); color: var(--text-soft); font-weight: 900; cursor: pointer; } .privacy-option.active { border-color: var(--primary); background: var(--primary-soft); color: var(--primary-hover); } .privacy-label { display: inline-block; margin-top: 8px; padding: 5px 8px; border-radius: 999px; background: #f3f1ee; color: var(--text-soft); font-size: 11px; font-weight: 900; } .settings-card { width: 100%; padding: 20px; border: 1px solid var(--border); border-radius: 18px; background: var(--surface); color: var(--text); } .settings-divider { height: 1px; margin: 24px 0; background: var(--border); } .settings-card h3 { margin: 8px 0 6px; } .settings-card .privacy-option { display: flex; flex-direction: column; align-items: center; gap: 4px; min-height: 100px; } .privacy-icon { font-size: 25px; } .privacy-option small { color: var(--text-muted); font-weight: 500; text-align: center; } .privacy-option.active small { color: var(--primary-hover); } .current-privacy { margin-top: 12px; padding: 11px; border-radius: 11px; background: var(--bg); color: var(--text-soft); text-align: center; } .logout-settings-button { width: 100%; padding: 12px; border: 2px solid #e1caca; border-radius: 12px; background: var(--surface); color: var(--danger); font-weight: 900; cursor: pointer; } .distance-status { margin-top: 16px; padding: 13px; border-radius: 13px; background: var(--bg); color: var(--text); text-align: center; } .distance-status strong { color: var(--text-heading); } .distance-status .muted { margin-top: 5px; font-size: 13px; } .rating-locked { margin-top: 14px; padding: 18px; border: 1px solid var(--border); border-radius: 16px; background: #f8f5f0; color: var(--text-soft); text-align: center; } .rating-locked strong { color: var(--text-heading); } .rating-locked-icon { margin-bottom: 8px; font-size: 38px; filter: grayscale(1); opacity: 0.55; } .rating-locked p { color: var(--text-muted); line-height: 1.5; } .overlay { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: flex-end; justify-content: center; padding: 12px; background: rgba( 50, 37, 29, 0.45 ); } .dialog { position: relative; width: min(540px, 100%); max-height: 92vh; padding: 24px 18px 18px; overflow-y: auto; border: 1px solid var(--border); border-radius: 24px; background: var(--surface); color: var(--text); box-shadow: var(--shadow); } .dialog h2, .dialog h3 { color: var(--text-heading); } .close { position: absolute; top: 7px; right: 9px; border: 0; background: transparent; color: var(--text-muted); font-size: 30px; cursor: pointer; } .cones { display: grid; grid-template-columns: repeat(5, 1fr); gap: 7px; margin-top: 8px; } .cone { height: 70px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 2px solid var(--border-dark); border-radius: 13px; background: #f6f3ef; color: var(--text); cursor: pointer; } .cone.selected { border-color: var(--primary); background: var(--primary-soft); } .cone span { font-size: 27px; } @media ( max-width: 560px ) { .header nav { grid-template-columns: 1fr; } .top-row, .section-head { flex-direction: column; } .friend-search { grid-template-columns: 1fr; } .friend-card { align-items: flex-start; flex-wrap: wrap; } .friend-actions { width: 100%; } .friend-actions button { flex: 1; } .privacy-options { grid-template-columns: 1fr; } } `}</style>
  );
}
  function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
      }
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    async function loadProfile() {
      if (!session?.user?.id) {
        setProfile(null);
        setProfileLoading(false);
        return;
      }
      setProfileLoading(true);
      setProfileError("");
      const result = await supabase
        .from("profiles")
        .select("id,display_name,username,created_at,default_visit_visibility")
        .eq("id", session.user.id)
        .maybeSingle();
      if (result.error) {
        setProfileError(result.error.message);
        setProfile(null);
      } else {
        setProfile(result.data || null);
      }
      setProfileLoading(false);
    }
    loadProfile();
  }, [session?.user?.id]);
  if (authLoading || profileLoading) {
    return (
      <main className="center-page">
        {" "}
        <Styles />{" "}
        <section className="panel">
          {" "}
          <div className="large-logo"> 🍦 </div>{" "}
          <h1 className="centered"> GELATO HUNTER </h1>{" "}
          <p className="muted centered"> Laster... </p>{" "}
        </section>{" "}
      </main>
    );
  }
  if (!session) {
    return <AuthScreen />;
  }
  if (profileError) {
    return (
      <main className="center-page">
        {" "}
        <Styles />{" "}
        <section className="panel">
          {" "}
          <h1> Profilfeil </h1>{" "}
          <div className="error-box"> {profileError} </div>{" "}
          <button
            className="green-button"
            onClick={() => window.location.reload()}
          >
            {" "}
            Prøv igjen{" "}
          </button>{" "}
        </section>{" "}
      </main>
    );
  }
  if (!profile?.username) {
    return (
      <ProfileScreen session={session} profile={profile} onSaved={setProfile} />
    );
  }
  if (!GOOGLE_API_KEY) {
    return (
      <main className="center-page">
        {" "}
        <Styles />{" "}
        <section className="panel">
          {" "}
          Google Maps API-nøkkel mangler.{" "}
        </section>{" "}
      </main>
    );
  }
  return (
    <APIProvider apiKey={GOOGLE_API_KEY}>
      {" "}
      <GelatoHunter session={session} profile={profile} onProfileUpdated = { setProfile } />{" "}
    </APIProvider>
  );
}
export default App;