import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  APIProvider,
  Map,
  Marker,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { supabase } from './lib/supabase';
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const SEARCH_RADII = [5000, 10000, 25000, 50000];
function degreesToRadians(degrees) {
  return degrees * (Math.PI / 180);
}
function calculateDistance(latitude1, longitude1, latitude2, longitude2) {
  const earthRadiusMetres = 6371000;
  const latitudeDifference = degreesToRadians(latitude2 - latitude1);
  const longitudeDifference = degreesToRadians(longitude2 - longitude1);
  const firstLatitude = degreesToRadians(latitude1);
  const secondLatitude = degreesToRadians(latitude2);
  const haversineValue =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDifference / 2) ** 2;
  const angularDistance =
    2 * Math.atan2(Math.sqrt(haversineValue), Math.sqrt(1 - haversineValue));
  return earthRadiusMetres * angularDistance;
}
function formatDistance(distanceMetres) {
  if (distanceMetres < 1000) {
    return Math.round(distanceMetres) + " m";
  }
  return (distanceMetres / 1000).toFixed(1) + " km";
}
function formatRadius(radiusMetres) {
  return radiusMetres / 1000 + " km";
}
function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}
function formatVisitDate(dateValue) {
  if (!dateValue) {
    return "";
  }
  const parts = dateValue.split("-");
  if (parts.length !== 3) {
    return dateValue;
  }
  return parts[2] + "." + parts[1] + "." + parts[0];
}
function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return Date.now().toString() + "-" + Math.random().toString(16).slice(2);
}
function getHistoryStorageKey(userId) {
  return "gelato_hunter_history_" + userId;
}
function loadHistory(userId) {
  try {
    const storageKey = getHistoryStorageKey(userId);
    const savedHistory = window.localStorage.getItem(storageKey);
    if (!savedHistory) {
      return [];
    }
    const parsedHistory = JSON.parse(savedHistory);
    return Array.isArray(parsedHistory) ? parsedHistory : [];
  } catch (error) {
    console.error("Kunne ikke laste historikken:", error);
    return [];
  }
}
function saveHistory(userId, history) {
  try {
    const storageKey = getHistoryStorageKey(userId);
    window.localStorage.setItem(storageKey, JSON.stringify(history));
    return true;
  } catch (error) {
    console.error("Kunne ikke lagre historikken:", error);
    return false;
  }
}
function AuthScreen() {
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  async function handleSubmit(event) {
    event.preventDefault();
    setAuthError("");
    setAuthMessage("");
    if (!email.trim()) {
      setAuthError("Skriv inn e-postadressen din.");
      return;
    }
    if (password.length < 6) {
      setAuthError("Passordet må ha minst 6 tegn.");
      return;
    }
    setAuthLoading(true);
    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
          options: {
            data: { display_name: displayName.trim() },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) {
          throw error;
        }
        if (data.session) {
          setAuthMessage("Kontoen er opprettet.");
        } else {
          setAuthMessage(
            "Kontoen er opprettet. Kontroller e-posten din og bekreft kontoen før du logger inn.",
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });
        if (error) {
          throw error;
        }
      }
    } catch (error) {
      console.error("Auth-feil:", error);
      setAuthError(error.message || "Innloggingen mislyktes.");
    } finally {
      setAuthLoading(false);
    }
  }
  async function resetPassword() {
    setAuthError("");
    setAuthMessage("");
    if (!email.trim()) {
      setAuthError("Skriv inn e-postadressen først.");
      return;
    }
    setAuthLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    setAuthLoading(false);
    if (error) {
      setAuthError(error.message);
      return;
    }
    setAuthMessage("Lenke for nytt passord er sendt på e-post.");
  }
  return (
    <main className="auth-page">
      {" "}
      <AppStyles />{" "}
      <section className="auth-card">
        {" "}
        <div className="auth-logo"> 🍦 </div>{" "}
        <div className="brand-label"> GELATO HUNTER </div>{" "}
        <h1>
          {" "}
          {authMode === "login" ? "Velkommen tilbake" : "Opprett konto"}{" "}
        </h1>{" "}
        <p className="auth-intro">
          {" "}
          Logg inn for å bygge din gelato-historikk og senere dele
          iskremopplevelser med venner.{" "}
        </p>{" "}
        <form onSubmit={handleSubmit}>
          {" "}
          {authMode === "signup" && (
            <>
              {" "}
              <label className="field-label"> Visningsnavn </label>{" "}
              <input
                className="text-input"
                type="text"
                value={displayName}
                placeholder="Navnet vennene dine ser"
                maxLength={40}
                onChange={(event) => setDisplayName(event.target.value)}
              />{" "}
            </>
          )}{" "}
          <label className="field-label"> E-post </label>{" "}
          <input
            className="text-input"
            type="email"
            autoComplete="email"
            value={email}
            placeholder="navn@eksempel.no"
            onChange={(event) => setEmail(event.target.value)}
          />{" "}
          <label className="field-label"> Passord </label>{" "}
          <input
            className="text-input"
            type="password"
            autoComplete={
              authMode === "login" ? "current-password" : "new-password"
            }
            value={password}
            placeholder="Minst 6 tegn"
            onChange={(event) => setPassword(event.target.value)}
          />{" "}
          <button className="auth-submit" type="submit" disabled={authLoading}>
            {" "}
            {authLoading
              ? "Arbeider..."
              : authMode === "login"
                ? "Logg inn"
                : "Opprett konto"}{" "}
          </button>{" "}
        </form>{" "}
        {authMode === "login" && (
          <button className="text-button" type="button" onClick={resetPassword}>
            {" "}
            Glemt passord?{" "}
          </button>
        )}{" "}
        {authError && <div className="auth-error"> {authError} </div>}{" "}
        {authMessage && <div className="auth-success"> {authMessage} </div>}{" "}
        <div className="auth-switch">
          {" "}
          {authMode === "login"
            ? "Har du ikke konto?"
            : "Har du allerede konto?"}{" "}
          <button
            className="text-button"
            type="button"
            onClick={() => {
              setAuthMode(authMode === "login" ? "signup" : "login");
              setAuthError("");
              setAuthMessage("");
            }}
          >
            {" "}
            {authMode === "login" ? "Opprett konto" : "Logg inn"}{" "}
          </button>{" "}
        </div>{" "}
      </section>{" "}
    </main>
  );
}
function GelatoHunter({ session }) {
  const placesLibrary = useMapsLibrary("places");
  const user = session.user;
  const displayName =
    user.user_metadata?.display_name || user.email || "Gelato Hunter";
  const [activeView, setActiveView] = useState("discover");
  const [userPosition, setUserPosition] = useState(null);
  const [places, setPlaces] = useState([]);
  const [history, setHistory] = useState(() => loadHistory(user.id));
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [locationStatus, setLocationStatus] = useState("loading");
  const [placesStatus, setPlacesStatus] = useState("waiting");
  const [searchRadiusIndex, setSearchRadiusIndex] = useState(0);
  const [message, setMessage] = useState("Finner posisjonen din...");
  const [ratingInput, setRatingInput] = useState(0);
  const [flavourInput, setFlavourInput] = useState("");
  const [visitDateInput, setVisitDateInput] = useState(getTodayDate());
  const [favouriteInput, setFavouriteInput] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [showOnlyFavourites, setShowOnlyFavourites] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const searchRadius = SEARCH_RADII[searchRadiusIndex];
  useEffect(() => {
    setHistory(loadHistory(user.id));
  }, [user.id]);
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus("error");
      setMessage("Nettleseren støtter ikke posisjon.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserPosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationStatus("ready");
        setMessage("Søker etter iskremsteder...");
      },
      (error) => {
        console.error("Posisjonsfeil:", error);
        setLocationStatus("error");
        if (error.code === 1) {
          setMessage("Gelato Hunter trenger tilgang til posisjonen din.");
        } else {
          setMessage("Posisjonen din kunne ikke hentes.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }, []);
  const findGelatoPlaces = useCallback(async () => {
    if (!placesLibrary || !userPosition) {
      return;
    }
    try {
      setPlacesStatus("loading");
      setPlaces([]);
      setMessage("Søker innen " + formatRadius(searchRadius) + "...");
      const request = {
        fields: [
          "id",
          "displayName",
          "location",
          "rating",
          "userRatingCount",
          "googleMapsURI",
        ],
        locationRestriction: { center: userPosition, radius: searchRadius },
        includedPrimaryTypes: ["ice_cream_shop"],
        maxResultCount: 20,
        rankPreference: placesLibrary.SearchNearbyRankPreference.DISTANCE,
      };
      const result = await placesLibrary.Place.searchNearby(request);
      const foundPlaces = result.places || [];
      const preparedPlaces = foundPlaces
        .filter((place) => {
          return Boolean(place.id && place.location);
        })
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
        .sort(
          (firstPlace, secondPlace) =>
            firstPlace.distanceMetres - secondPlace.distanceMetres,
        );
      setPlaces(preparedPlaces);
      setPlacesStatus("ready");
      if (preparedPlaces.length === 0) {
        setMessage(
          "Ingen iskremsteder funnet innen " + formatRadius(searchRadius) + ".",
        );
      } else {
        setMessage("");
      }
    } catch (error) {
      console.error("Google Places-feil:", error);
      setPlacesStatus("error");
      setMessage("Iskremstedene kunne ikke lastes.");
    }
  }, [placesLibrary, userPosition, searchRadius]);
  useEffect(() => {
    findGelatoPlaces();
  }, [findGelatoPlaces]);
  const sortedHistory = useMemo(() => {
    const visibleHistory = showOnlyFavourites
      ? history.filter((visit) => visit.favourite)
      : history;
    return [...visibleHistory].sort((firstVisit, secondVisit) =>
      String(secondVisit.visitDate || secondVisit.createdAt).localeCompare(
        String(firstVisit.visitDate || firstVisit.createdAt),
      ),
    );
  }, [history, showOnlyFavourites]);
  const favouriteCount = history.filter((visit) => visit.favourite).length;
  function openPlace(place) {
    setSelectedPlace(place);
    setRatingInput(0);
    setFlavourInput("");
    setVisitDateInput(getTodayDate());
    setFavouriteInput(false);
    setSaveMessage("");
  }
  function closePlace() {
    setSelectedPlace(null);
    setSaveMessage("");
  }
  function saveNewVisit() {
    if (!selectedPlace) {
      return;
    }
    if (ratingInput === 0) {
      setSaveMessage("Velg 1–5 iskremkjegler før du lagrer.");
      return;
    }
    const newVisit = {
      id: createId(),
      userId: user.id,
      placeId: selectedPlace.id,
      placeName: selectedPlace.name,
      latitude: selectedPlace.latitude,
      longitude: selectedPlace.longitude,
      googleRating: selectedPlace.rating || null,
      rating: ratingInput,
      flavour: flavourInput.trim(),
      favourite: favouriteInput,
      visitDate: visitDateInput || getTodayDate(),
      createdAt: new Date().toISOString(),
    };
    const updatedHistory = [...history, newVisit];
    setHistory(updatedHistory);
    const saved = saveHistory(user.id, updatedHistory);
    setSaveMessage(
      saved
        ? "Besøket er lagret i Mine gelatoer."
        : "Besøket kunne ikke lagres.",
    );
  }
  function deleteHistoryItem(visitId) {
    const updatedHistory = history.filter((visit) => visit.id !== visitId);
    setHistory(updatedHistory);
    saveHistory(user.id, updatedHistory);
  }
  function toggleFavourite(visitId) {
    const updatedHistory = history.map((visit) => {
      if (visit.id !== visitId) {
        return visit;
      }
      return { ...visit, favourite: !visit.favourite };
    });
    setHistory(updatedHistory);
    saveHistory(user.id, updatedHistory);
  }
  function increaseSearchRadius() {
    if (searchRadiusIndex < SEARCH_RADII.length - 1) {
      setSearchRadiusIndex(searchRadiusIndex + 1);
    }
  }
  function navigateToCoordinates(latitude, longitude) {
    const destination = latitude + "," + longitude;
    const navigationUrl =
      "https://www.google.com/maps/dir/?api=1" +
      "&destination=" +
      encodeURIComponent(destination) +
      "&travelmode=walking";
    window.open(navigationUrl, "_blank", "noopener,noreferrer");
  }
  async function handleSignOut() {
    setSigningOut(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Kunne ikke logge ut:", error);
      setSigningOut(false);
    }
  }
  if (locationStatus === "loading") {
    return (
      <main className="loading-page">
        {" "}
        <AppStyles /> <div className="large-logo"> 🍦 </div>{" "}
        <h1> GELATO HUNTER </h1> <p>{message}</p>{" "}
      </main>
    );
  }
  return (
    <main className="app">
      {" "}
      <AppStyles />{" "}
      <header className="header">
        {" "}
        <div className="top-row">
          {" "}
          <div>
            {" "}
            <div className="brand-label"> GELATO HUNTER </div>{" "}
            <h1> Finn neste kule 🍦 </h1> <p> Hei, {displayName} </p>{" "}
          </div>{" "}
          <button
            className="logout-button"
            disabled={signingOut}
            onClick={handleSignOut}
          >
            {" "}
            {signingOut ? "Logger ut..." : "Logg ut"}{" "}
          </button>{" "}
        </div>{" "}
        <nav className="main-navigation">
          {" "}
          <button
            className={
              activeView === "discover"
                ? "navigation-button active"
                : "navigation-button"
            }
            onClick={() => setActiveView("discover")}
          >
            {" "}
            📍 Finn iskrem{" "}
          </button>{" "}
          <button
            className={
              activeView === "history"
                ? "navigation-button active"
                : "navigation-button"
            }
            onClick={() => setActiveView("history")}
          >
            {" "}
            🍦 Mine gelatoer{" "}
            {history.length ? " (" + history.length + ")" : ""}{" "}
          </button>{" "}
          <button className="navigation-button" disabled>
            {" "}
            👥 Venner{" "}
          </button>{" "}
        </nav>{" "}
      </header>{" "}
      {activeView === "discover" && (
        <>
          {" "}
          <section className="map-wrapper">
            {" "}
            <Map
              defaultCenter={userPosition}
              defaultZoom={13}
              gestureHandling="greedy"
              disableDefaultUI={true}
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
            </Map>{" "}
          </section>{" "}
          <section className="content">
            {" "}
            <div className="list-header">
              {" "}
              <div>
                {" "}
                <div className="eyebrow"> NÆRMEST DEG </div>{" "}
                <h2> Iskrem i nærheten </h2>{" "}
                <small> Søkeradius: {formatRadius(searchRadius)} </small>{" "}
              </div>{" "}
              <span> {places.length} steder </span>{" "}
            </div>{" "}
            {placesStatus === "loading" && (
              <div className="message-card"> 🍦 Søker etter iskrem... </div>
            )}{" "}
            {message && placesStatus !== "loading" && (
              <div className="message-card"> {message} </div>
            )}{" "}
            {placesStatus === "ready" &&
              places.length === 0 &&
              searchRadiusIndex < SEARCH_RADII.length - 1 && (
                <button
                  className="primary-button"
                  onClick={increaseSearchRadius}
                >
                  {" "}
                  Søk innen{" "}
                  {formatRadius(SEARCH_RADII[searchRadiusIndex + 1])}{" "}
                </button>
              )}{" "}
            <div className="place-list">
              {" "}
              {places.map((place, index) => (
                <button
                  key={place.id}
                  className="place-card"
                  onClick={() => openPlace(place)}
                >
                  {" "}
                  <div className="place-number"> {index + 1} </div>{" "}
                  <div className="place-info">
                    {" "}
                    <strong> {place.name} </strong>{" "}
                    <div className="metadata">
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
      {activeView === "history" && (
        <section className="content">
          {" "}
          <div className="history-heading">
            {" "}
            <div>
              {" "}
              <div className="eyebrow"> DIN HISTORIKK </div>{" "}
              <h2> Mine gelatoer 🍦 </h2>{" "}
              <p>
                {" "}
                {history.length} besøk og {favouriteCount} favoritter{" "}
              </p>{" "}
            </div>{" "}
            <button
              className="filter-button"
              onClick={() => setShowOnlyFavourites(!showOnlyFavourites)}
            >
              {" "}
              {showOnlyFavourites ? "Vis alle" : "❤️ Favoritter"}{" "}
            </button>{" "}
          </div>{" "}
          {sortedHistory.length === 0 && (
            <div className="message-card">
              {" "}
              Ingen registrerte gelatobesøk ennå.{" "}
            </div>
          )}{" "}
          <div className="history-list">
            {" "}
            {sortedHistory.map((visit) => (
              <article className="history-card" key={visit.id}>
                {" "}
                <div className="history-title-row">
                  {" "}
                  <div>
                    {" "}
                    <h3> {visit.placeName} </h3>{" "}
                    <small> 📅 {formatVisitDate(visit.visitDate)} </small>{" "}
                  </div>{" "}
                  <button
                    className="heart-button"
                    onClick={() => toggleFavourite(visit.id)}
                  >
                    {" "}
                    {visit.favourite ? "❤️" : "♡"}{" "}
                  </button>{" "}
                </div>{" "}
                <div className="history-rating">
                  {" "}
                  {[1, 2, 3, 4, 5].map((number) => (
                    <span
                      key={number}
                      className={
                        number <= visit.rating ? "active-cone" : "inactive-cone"
                      }
                    >
                      {" "}
                      🍦{" "}
                    </span>
                  ))}{" "}
                </div>{" "}
                {visit.flavour && (
                  <div className="flavour-tag"> Smak: {visit.flavour} </div>
                )}{" "}
                <div className="history-actions">
                  {" "}
                  <button
                    className="small-navigation-button"
                    onClick={() =>
                      navigateToCoordinates(visit.latitude, visit.longitude)
                    }
                  >
                    {" "}
                    🧭 Naviger{" "}
                  </button>{" "}
                  <button
                    className="delete-button"
                    onClick={() => deleteHistoryItem(visit.id)}
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
      {selectedPlace && (
        <div className="overlay" onClick={closePlace}>
          {" "}
          <section
            className="place-dialog"
            onClick={(event) => event.stopPropagation()}
          >
            {" "}
            <button className="close-button" onClick={closePlace}>
              {" "}
              ×{" "}
            </button>{" "}
            <h2> {selectedPlace.name} </h2>{" "}
            <p> 📍 {formatDistance(selectedPlace.distanceMetres)} unna </p>{" "}
            <button
              className="primary-button"
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
            <h3> Registrer nytt besøk </h3> <label> Din rating </label>{" "}
            <div className="cones">
              {" "}
              {[1, 2, 3, 4, 5].map((number) => (
                <button
                  key={number}
                  className={
                    number <= ratingInput
                      ? "cone-button selected"
                      : "cone-button"
                  }
                  onClick={() => setRatingInput(number)}
                >
                  {" "}
                  <span> 🍦 </span> <small> {number} </small>{" "}
                </button>
              ))}{" "}
            </div>{" "}
            <label> Smak </label>{" "}
            <input
              className="text-input"
              value={flavourInput}
              placeholder="For eksempel pistasj"
              onChange={(event) => setFlavourInput(event.target.value)}
            />{" "}
            <label> Besøksdato </label>{" "}
            <input
              className="text-input"
              type="date"
              max={getTodayDate()}
              value={visitDateInput}
              onChange={(event) => setVisitDateInput(event.target.value)}
            />{" "}
            <button
              className={
                favouriteInput ? "favourite-toggle active" : "favourite-toggle"
              }
              onClick={() => setFavouriteInput(!favouriteInput)}
            >
              {" "}
              {favouriteInput ? "❤️ Favoritt" : "♡ Marker som favoritt"}{" "}
            </button>{" "}
            <button className="save-button" onClick={saveNewVisit}>
              {" "}
              Lagre besøket{" "}
            </button>{" "}
            {saveMessage && (
              <div className="save-message"> {saveMessage} </div>
            )}{" "}
          </section>{" "}
        </div>
      )}{" "}
    </main>
  );
}
function AppStyles() {
  return (
    <style>{` * { box-sizing: border-box; } body { margin: 0; } button, input { font: inherit; } button { touch-action: manipulation; } .app, .loading-page, .auth-page { min-height: 100vh; background: #fffaf1; color: #202020; font-family: Arial, Helvetica, sans-serif; } .loading-page, .auth-page { display: flex; align-items: center; justify-content: center; padding: 24px; } .auth-card { width: min(440px, 100%); padding: 28px; border: 1px solid #eedfce; border-radius: 24px; background: #ffffff; box-shadow: 0 18px 50px rgba(60, 35, 10, 0.12); } .auth-logo { font-size: 65px; text-align: center; } .auth-card h1 { margin: 8px 0; text-align: center; } .auth-card .brand-label { text-align: center; } .auth-intro { color: #666666; line-height: 1.5; text-align: center; } .field-label, .place-dialog label { display: block; margin: 15px 0 7px; color: #444444; font-size: 13px; font-weight: 900; } .text-input { width: 100%; padding: 12px 13px; border: 2px solid #e8ded1; border-radius: 12px; background: #ffffff; font-size: 16px; } .auth-submit, .save-button { width: 100%; margin-top: 18px; padding: 13px; border: 0; border-radius: 13px; background: #2e7d4f; color: #ffffff; font-weight: 900; cursor: pointer; } .auth-submit:disabled { opacity: 0.65; } .text-button { margin-top: 12px; border: 0; background: transparent; color: #e8650c; font-weight: 800; cursor: pointer; } .auth-switch { margin-top: 18px; color: #666666; text-align: center; } .auth-switch .text-button { margin-left: 5px; } .auth-error, .auth-success, .save-message { margin-top: 14px; padding: 11px; border-radius: 11px; font-size: 13px; font-weight: 800; text-align: center; } .auth-error { background: #fff0f0; color: #a32222; } .auth-success, .save-message { background: #eef8ef; color: #287348; } .header { max-width: 820px; margin: 0 auto; padding: 26px 16px 14px; } .top-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; } .header h1 { margin: 4px 0; } .header p { margin: 5px 0; color: #666666; } .brand-label, .eyebrow { color: #f97316; font-size: 11px; font-weight: 900; letter-spacing: 2px; } .logout-button { padding: 9px 12px; border: 2px solid #e7d7c5; border-radius: 11px; background: #ffffff; color: #555555; font-weight: 800; cursor: pointer; } .main-navigation { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; margin-top: 17px; } .navigation-button { padding: 11px 8px; border: 2px solid #eedfce; border-radius: 13px; background: #ffffff; color: #555555; font-weight: 800; cursor: pointer; } .navigation-button.active { border-color: #f97316; background: #fff0d9; color: #d65e00; } .navigation-button:disabled { opacity: 0.5; } .map-wrapper { max-width: 820px; height: 42vh; min-height: 320px; margin: 0 auto; padding: 0 12px; } .map { width: 100%; height: 100%; overflow: hidden; border-radius: 24px; } .content { max-width: 820px; margin: 0 auto; padding: 20px 12px 50px; } .list-header, .history-heading { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 12px; } .place-list, .history-list { display: grid; gap: 10px; } .place-card, .history-card { width: 100%; padding: 14px; border: 1px solid #eee1d1; border-radius: 17px; background: #ffffff; color: #202020; } .place-card { display: flex; align-items: center; gap: 12px; text-align: left; cursor: pointer; } .place-number { width: 38px; height: 38px; display: grid; flex-shrink: 0; place-items: center; border-radius: 50%; background: #fff0d9; color: #f97316; font-weight: 900; } .place-info { flex: 1; } .metadata { margin-top: 5px; color: #666666; font-size: 13px; } .arrow { color: #bbbbbb; font-size: 30px; } .message-card { margin-bottom: 12px; padding: 15px; border-radius: 14px; background: #ffffff; text-align: center; } .primary-button { width: 100%; padding: 13px; border: 0; border-radius: 13px; background: #f97316; color: #ffffff; font-weight: 900; cursor: pointer; } .filter-button { padding: 9px 12px; border: 2px solid #f97316; border-radius: 12px; background: #ffffff; color: #d65e00; font-weight: 800; cursor: pointer; } .history-title-row, .history-actions { display: flex; justify-content: space-between; gap: 10px; } .history-card h3 { margin: 0; } .history-rating { display: flex; gap: 4px; margin-top: 14px; } .active-cone { font-size: 25px; } .inactive-cone { font-size: 25px; filter: grayscale(1); opacity: 0.22; } .flavour-tag { display: inline-block; margin: 10px 0; padding: 7px 10px; border-radius: 10px; background: #fff0d9; color: #94470c; font-weight: 800; } .heart-button { width: 44px; height: 42px; border: 2px solid #dddddd; border-radius: 12px; background: #ffffff; font-size: 23px; cursor: pointer; } .small-navigation-button, .delete-button { flex: 1; padding: 10px; border-radius: 11px; font-weight: 800; cursor: pointer; } .small-navigation-button { border: 0; background: #f97316; color: #ffffff; } .delete-button { border: 2px solid #dcbaba; background: #ffffff; color: #a33; } .overlay { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: flex-end; justify-content: center; padding: 12px; background: rgba(20, 15, 10, 0.42); } .place-dialog { position: relative; width: min(540px, 100%); max-height: 92vh; padding: 24px 18px 18px; overflow-y: auto; border-radius: 24px; background: #ffffff; } .close-button { position: absolute; top: 7px; right: 9px; border: 0; background: transparent; color: #777777; font-size: 30px; cursor: pointer; } .cones { display: grid; grid-template-columns: repeat(5, 1fr); gap: 7px; margin-top: 8px; } .cone-button { height: 70px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 2px solid #dddddd; border-radius: 13px; background: #f4f4f4; cursor: pointer; } .cone-button.selected { border-color: #f97316; background: #fff0d9; } .cone-button span { font-size: 27px; } .favourite-toggle { width: 100%; margin-top: 14px; padding: 11px; border: 2px solid #dddddd; border-radius: 12px; background: #ffffff; font-weight: 800; cursor: pointer; } .favourite-toggle.active { border-color: #f97316; background: #fff0d9; } @media ( max-width: 560px ) { .main-navigation { grid-template-columns: 1fr; } .history-heading, .top-row { flex-direction: column; } .logout-button { align-self: flex-start; } } `}</style>
  );
}
function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Session-feil:", error);
      }
      if (mounted) {
        setSession(data.session);
        setAuthLoading(false);
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);
  if (authLoading) {
    return (
      <main className="loading-page">
        {" "}
        <AppStyles /> <div className="large-logo"> 🍦 </div>{" "}
        <h1> GELATO HUNTER </h1> <p> Kontrollerer innlogging... </p>{" "}
      </main>
    );
  }
  if (!session) {
    return <AuthScreen />;
  }
  if (!GOOGLE_API_KEY) {
    return (
      <main className="loading-page">
        {" "}
        <AppStyles /> <h1> GELATO HUNTER </h1>{" "}
        <p className="error-message"> Google Maps API-nøkkel mangler. </p>{" "}
      </main>
    );
  }
  return (
    <APIProvider apiKey={GOOGLE_API_KEY}>
      {" "}
      <GelatoHunter session={session} />{" "}
    </APIProvider>
  );
}
export default App;