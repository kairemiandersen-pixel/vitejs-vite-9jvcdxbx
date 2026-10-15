import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  APIProvider,
  Map,
  Marker,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const HISTORY_STORAGE_KEY = "gelato_hunter_history_v1";
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
function loadHistory() {
  try {
    const savedHistory = window.localStorage.getItem(HISTORY_STORAGE_KEY);
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
function saveHistory(history) {
  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    return true;
  } catch (error) {
    console.error("Kunne ikke lagre historikken:", error);
    return false;
  }
}
function GelatoHunter() {
  const placesLibrary = useMapsLibrary("places");
  const [activeView, setActiveView] = useState("discover");
  const [userPosition, setUserPosition] = useState(null);
  const [places, setPlaces] = useState([]);
  const [history, setHistory] = useState(loadHistory);
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
  const searchRadius = SEARCH_RADII[searchRadiusIndex];
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
            latitude: latitude,
            longitude: longitude,
            rating: place.rating || null,
            userRatingCount: place.userRatingCount || null,
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
      setMessage(
        "Iskremstedene kunne ikke lastes. Kontroller Google API-oppsettet.",
      );
    }
  }, [placesLibrary, userPosition, searchRadius]);
  useEffect(() => {
    findGelatoPlaces();
  }, [findGelatoPlaces]);
  const sortedHistory = useMemo(() => {
    const visibleHistory = showOnlyFavourites
      ? history.filter((visit) => visit.favourite)
      : history;
    return [...visibleHistory].sort((firstVisit, secondVisit) => {
      const firstDate = firstVisit.visitDate || firstVisit.createdAt;
      const secondDate = secondVisit.visitDate || secondVisit.createdAt;
      return String(secondDate).localeCompare(String(firstDate));
    });
  }, [history, showOnlyFavourites]);
  const favouriteCount = useMemo(() => {
    return history.filter((visit) => visit.favourite).length;
  }, [history]);
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
    const saved = saveHistory(updatedHistory);
    if (saved) {
      setSaveMessage("Besøket er lagret i Mine gelatoer.");
    } else {
      setSaveMessage("Besøket kunne ikke lagres.");
    }
  }
  function deleteHistoryItem(visitId) {
    const updatedHistory = history.filter((visit) => visit.id !== visitId);
    setHistory(updatedHistory);
    saveHistory(updatedHistory);
  }
  function toggleHistoryFavourite(visitId) {
    const updatedHistory = history.map((visit) => {
      if (visit.id !== visitId) {
        return visit;
      }
      return { ...visit, favourite: !visit.favourite };
    });
    setHistory(updatedHistory);
    saveHistory(updatedHistory);
  }
  function increaseSearchRadius() {
    if (searchRadiusIndex < SEARCH_RADII.length - 1) {
      setSearchRadiusIndex(searchRadiusIndex + 1);
    }
  }
  function resetSearchRadius() {
    setSearchRadiusIndex(0);
  }
  function getNextRadiusLabel() {
    const nextRadius = SEARCH_RADII[searchRadiusIndex + 1];
    return nextRadius ? formatRadius(nextRadius) : "";
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
  function navigateToPlace(place) {
    if (place.googleMapsURI) {
      window.open(place.googleMapsURI, "_blank", "noopener,noreferrer");
      return;
    }
    navigateToCoordinates(place.latitude, place.longitude);
  }
  if (locationStatus === "loading") {
    return (
      <main className="loading-page">
        {" "}
        <AppStyles /> <div className="large-logo"> 🍦 </div>{" "}
        <h1>GELATO HUNTER</h1> <p>{message}</p>{" "}
      </main>
    );
  }
  if (locationStatus === "error") {
    return (
      <main className="loading-page">
        {" "}
        <AppStyles /> <div className="large-logo"> 📍 </div>{" "}
        <h1>GELATO HUNTER</h1> <p className="error-message"> {message} </p>{" "}
        <button
          className="primary-button"
          onClick={() => window.location.reload()}
        >
          {" "}
          Prøv igjen{" "}
        </button>{" "}
      </main>
    );
  }
  return (
    <main className="app">
      {" "}
      <AppStyles />{" "}
      <header className="header">
        {" "}
        <div className="brand-label"> GELATO HUNTER </div>{" "}
        <h1> Finn neste kule 🍦 </h1>{" "}
        <p> Finn iskrem og bygg din egen gelato-historikk </p>{" "}
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
            {history.length > 0 ? " (" + history.length + ")" : ""}{" "}
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
                <div className="radius-label">
                  {" "}
                  Søkeradius: {formatRadius(searchRadius)}{" "}
                </div>{" "}
              </div>{" "}
              <span className="result-count">
                {" "}
                {places.length} steder{" "}
              </span>{" "}
            </div>{" "}
            {placesStatus === "loading" && (
              <div className="status-card">
                {" "}
                🍦 Søker innen {formatRadius(searchRadius)} ...{" "}
              </div>
            )}{" "}
            {message && placesStatus !== "loading" && (
              <div className="message-card"> {message} </div>
            )}{" "}
            {placesStatus === "ready" &&
              places.length === 0 &&
              searchRadiusIndex < SEARCH_RADII.length - 1 && (
                <button
                  className="search-more-button"
                  onClick={increaseSearchRadius}
                >
                  {" "}
                  🍦 Søk innen {getNextRadiusLabel()}{" "}
                </button>
              )}{" "}
            {placesStatus === "ready" &&
              places.length === 0 &&
              searchRadiusIndex === SEARCH_RADII.length - 1 && (
                <div className="message-card">
                  {" "}
                  <strong> Ingen iskremsteder funnet innen 50 km. </strong>{" "}
                  <button
                    className="secondary-button"
                    onClick={resetSearchRadius}
                  >
                    {" "}
                    Start på nytt med 5 km{" "}
                  </button>{" "}
                </div>
              )}{" "}
            <div className="place-list">
              {" "}
              {places.map((place, index) => {
                const placeVisits = history.filter(
                  (visit) => visit.placeId === place.id,
                );
                const isFavourite = placeVisits.some(
                  (visit) => visit.favourite,
                );
                return (
                  <button
                    key={place.id}
                    className="place-card"
                    onClick={() => openPlace(place)}
                  >
                    {" "}
                    <div className="place-number"> {index + 1} </div>{" "}
                    <div className="place-info">
                      {" "}
                      <strong>
                        {" "}
                        {place.name} {isFavourite ? " ❤️" : ""}{" "}
                      </strong>{" "}
                      <div className="metadata">
                        {" "}
                        <span className="distance">
                          {" "}
                          📍 {formatDistance(place.distanceMetres)}{" "}
                        </span>{" "}
                        {place.rating && (
                          <span> Google {place.rating} ⭐ </span>
                        )}{" "}
                      </div>{" "}
                      {placeVisits.length > 0 && (
                        <div className="visit-count">
                          {" "}
                          {placeVisits.length} registrerte besøk{" "}
                        </div>
                      )}{" "}
                    </div>{" "}
                    <span className="arrow"> › </span>{" "}
                  </button>
                );
              })}{" "}
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
                {history.length} registrerte besøk og {favouriteCount}{" "}
                favoritter{" "}
              </p>{" "}
            </div>{" "}
            <button
              className={
                showOnlyFavourites ? "filter-button active" : "filter-button"
              }
              onClick={() => setShowOnlyFavourites(!showOnlyFavourites)}
            >
              {" "}
              ❤️ {showOnlyFavourites ? "Vis alle" : "Kun favoritter"}{" "}
            </button>{" "}
          </div>{" "}
          {sortedHistory.length === 0 && (
            <div className="empty-history">
              {" "}
              <div className="large-logo"> 🍦 </div>{" "}
              <h3> Ingen registrerte besøk </h3>{" "}
              <p> Finn et iskremsted og registrer din første smak. </p>{" "}
              <button
                className="primary-button"
                onClick={() => setActiveView("discover")}
              >
                {" "}
                Finn iskrem{" "}
              </button>{" "}
            </div>
          )}{" "}
          <div className="history-list">
            {" "}
            {sortedHistory.map((visit) => (
              <article key={visit.id} className="history-card">
                {" "}
                <div className="history-card-heading">
                  {" "}
                  <div>
                    {" "}
                    <h3> {visit.placeName} </h3>{" "}
                    <div className="visit-date">
                      {" "}
                      📅 {formatVisitDate(visit.visitDate)}{" "}
                    </div>{" "}
                  </div>{" "}
                  <button
                    className={
                      visit.favourite ? "heart-button active" : "heart-button"
                    }
                    onClick={() => toggleHistoryFavourite(visit.id)}
                    aria-label="Endre favoritt"
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
                        number <= visit.rating
                          ? "history-cone active"
                          : "history-cone"
                      }
                    >
                      {" "}
                      🍦{" "}
                    </span>
                  ))}{" "}
                </div>{" "}
                <div className="history-rating-text">
                  {" "}
                  {visit.rating} av 5{" "}
                </div>{" "}
                {visit.flavour && (
                  <div className="flavour-tag"> Smak: {visit.flavour} </div>
                )}{" "}
                <div className="history-actions">
                  {" "}
                  {visit.latitude && visit.longitude && (
                    <button
                      className="small-navigation-button"
                      onClick={() =>
                        navigateToCoordinates(visit.latitude, visit.longitude)
                      }
                    >
                      {" "}
                      🧭 Naviger{" "}
                    </button>
                  )}{" "}
                  <button
                    className="delete-history-button"
                    onClick={() => deleteHistoryItem(visit.id)}
                  >
                    {" "}
                    Slett besøk{" "}
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
            <button
              className="close-button"
              onClick={closePlace}
              aria-label="Lukk"
            >
              {" "}
              ×{" "}
            </button>{" "}
            <h2> {selectedPlace.name} </h2>{" "}
            <div className="dialog-meta">
              {" "}
              📍 {formatDistance(selectedPlace.distanceMetres)} unna{" "}
            </div>{" "}
            {selectedPlace.rating && (
              <div className="dialog-meta">
                {" "}
                Google: {selectedPlace.rating} ⭐{" "}
              </div>
            )}{" "}
            <button
              className="navigate-button"
              onClick={() => navigateToPlace(selectedPlace)}
            >
              {" "}
              🧭 Naviger hit{" "}
            </button>{" "}
            <h3> Registrer nytt besøk </h3>{" "}
            <label className="field-label"> Din rating </label>{" "}
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
            <label className="field-label"> Smak du prøvde </label>{" "}
            <input
              type="text"
              className="text-input"
              value={flavourInput}
              maxLength={60}
              placeholder="For eksempel pistasj"
              onChange={(event) => setFlavourInput(event.target.value)}
            />{" "}
            <label className="field-label"> Besøksdato </label>{" "}
            <input
              type="date"
              className="text-input"
              value={visitDateInput}
              max={getTodayDate()}
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
            <button className="save-visit-button" onClick={saveNewVisit}>
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
    <style>{` * { box-sizing: border-box; } body { margin: 0; } button, input { font: inherit; } button { touch-action: manipulation; } .app, .loading-page { min-height: 100vh; background: #fffaf1; color: #202020; font-family: Arial, Helvetica, sans-serif; } .loading-page { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 30px; text-align: center; } .loading-page h1 { color: #f97316; } .large-logo { font-size: 80px; } .error-message { color: #aa3333; } .header { max-width: 820px; margin: 0 auto; padding: 28px 18px 16px; } .header h1 { margin: 5px 0 0; font-size: 36px; } .header p { color: #666666; } .brand-label, .eyebrow { color: #f97316; font-size: 11px; font-weight: 900; letter-spacing: 2px; } .main-navigation { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 20px; } .navigation-button { padding: 12px; border: 2px solid #eedfce; border-radius: 14px; background: #ffffff; color: #555555; font-weight: 800; cursor: pointer; } .navigation-button.active { border-color: #f97316; background: #fff0d9; color: #d85f08; } .map-wrapper { max-width: 820px; height: 42vh; min-height: 320px; max-height: 480px; margin: 0 auto; padding: 0 12px; } .map { width: 100%; height: 100%; overflow: hidden; border-radius: 25px; } .content { max-width: 820px; margin: 0 auto; padding: 20px 12px 50px; } .list-header, .history-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 15px; margin-bottom: 12px; padding: 0 5px; } .list-header h2, .history-heading h2 { margin: 4px 0; } .radius-label, .result-count, .visit-date { color: #777777; font-size: 13px; } .status-card, .message-card, .empty-history { margin-bottom: 14px; padding: 18px; border-radius: 16px; background: #ffffff; text-align: center; } .search-more-button, .primary-button, .navigate-button, .save-visit-button { width: 100%; padding: 13px 16px; border: 0; border-radius: 14px; background: #f97316; color: #ffffff; font-weight: 900; cursor: pointer; } .secondary-button { display: block; margin: 14px auto 0; padding: 10px 14px; border: 2px solid #f97316; border-radius: 12px; background: #ffffff; color: #f97316; font-weight: 800; cursor: pointer; } .place-list, .history-list { display: grid; gap: 10px; } .place-card, .history-card { width: 100%; padding: 14px; border: 1px solid #eee1d1; border-radius: 17px; background: #ffffff; color: #202020; box-shadow: 0 3px 12px rgba(50, 30, 10, 0.06); } .place-card { display: flex; align-items: center; gap: 12px; text-align: left; cursor: pointer; } .place-number { width: 38px; height: 38px; flex-shrink: 0; display: grid; place-items: center; border-radius: 50%; background: #fff0d9; color: #f97316; font-weight: 900; } .place-info { flex: 1; min-width: 0; } .metadata { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 5px; color: #666666; font-size: 13px; } .distance { color: #e8650c; font-weight: 800; } .visit-count { margin-top: 6px; color: #d65e00; font-size: 12px; font-weight: 800; } .arrow { color: #bbbbbb; font-size: 30px; } .filter-button { padding: 10px 13px; border: 2px solid #eedfce; border-radius: 12px; background: #ffffff; color: #555555; font-weight: 800; cursor: pointer; } .filter-button.active { border-color: #f97316; background: #fff0d9; } .history-card-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; } .history-card h3 { margin: 0 0 5px; } .heart-button { width: 45px; height: 42px; border: 2px solid #dddddd; border-radius: 13px; background: #f7f7f7; font-size: 24px; cursor: pointer; } .heart-button.active { border-color: #f97316; background: #fff0d9; } .history-rating { display: flex; gap: 5px; margin-top: 14px; } .history-cone { font-size: 25px; filter: grayscale(1); opacity: 0.25; } .history-cone.active { filter: none; opacity: 1; } .history-rating-text { margin-top: 5px; color: #f97316; font-size: 13px; font-weight: 900; } .flavour-tag { display: inline-block; margin-top: 10px; padding: 7px 10px; border-radius: 10px; background: #fff0d9; color: #984b0c; font-size: 13px; font-weight: 800; } .history-actions { display: flex; gap: 8px; margin-top: 14px; } .small-navigation-button, .delete-history-button { flex: 1; padding: 10px; border-radius: 11px; font-weight: 800; cursor: pointer; } .small-navigation-button { border: 0; background: #f97316; color: #ffffff; } .delete-history-button { border: 2px solid #dcb8b8; background: #ffffff; color: #aa3333; } .overlay { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: flex-end; justify-content: center; padding: 12px; overflow-y: auto; background: rgba(20, 15, 10, 0.42); } .place-dialog { position: relative; width: min(540px, 100%); max-height: 92vh; padding: 24px 18px 18px; overflow-y: auto; border-radius: 24px; background: #ffffff; } .place-dialog h2 { margin: 0; padding-right: 40px; } .close-button { position: absolute; top: 7px; right: 9px; width: 42px; height: 42px; border: 0; background: transparent; color: #777777; font-size: 30px; cursor: pointer; } .dialog-meta { margin-top: 6px; color: #666666; font-size: 14px; } .navigate-button { margin-top: 14px; } .field-label { display: block; margin: 16px 0 7px; color: #444444; font-size: 13px; font-weight: 900; } .cones { display: grid; grid-template-columns: repeat( 5, minmax(0, 1fr) ); gap: 7px; } .cone-button { min-width: 0; height: 72px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 2px solid #dddddd; border-radius: 14px; background: #f4f4f4; cursor: pointer; } .cone-button.selected { border-color: #f97316; background: #fff0d9; } .cone-button span { font-size: 28px; } .cone-button small { margin-top: 2px; color: #777777; font-weight: 900; } .text-input { width: 100%; padding: 12px 13px; border: 2px solid #e8ded1; border-radius: 12px; background: #ffffff; color: #222222; font-size: 16px; } .favourite-toggle { width: 100%; margin-top: 15px; padding: 12px; border: 2px solid #dddddd; border-radius: 13px; background: #f7f7f7; color: #555555; font-weight: 900; cursor: pointer; } .favourite-toggle.active { border-color: #f97316; background: #fff0d9; color: #d65e00; } .save-visit-button { margin-top: 12px; background: #2e7d4f; } .save-message { margin-top: 12px; padding: 11px; border-radius: 11px; background: #fff8ed; color: #d65e00; font-size: 13px; font-weight: 900; text-align: center; } @media (max-width: 520px) { .header h1 { font-size: 30px; } .history-heading { align-items: stretch; flex-direction: column; } .main-navigation { grid-template-columns: 1fr; } } `}</style>
  );
}
function App() {
  if (!API_KEY) {
    return (
      <main className="loading-page">
        {" "}
        <AppStyles /> <div className="large-logo"> 🍦 </div>{" "}
        <h1>GELATO HUNTER</h1>{" "}
        <p className="error-message">
          {" "}
          Google Maps API-nøkkel mangler. Kontroller VITE_GOOGLE_MAPS_API_KEY i
          miljøvariablene.{" "}
        </p>{" "}
      </main>
    );
  }
  return (
    <APIProvider apiKey={API_KEY}>
      {" "}
      <GelatoHunter />{" "}
    </APIProvider>
  );
}
export default App;