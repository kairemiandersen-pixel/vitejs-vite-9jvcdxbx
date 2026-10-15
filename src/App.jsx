import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  APIProvider,
  Map,
  Marker,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const STORAGE_KEY = 'gelato_hunter_web_ratings';
const SEARCH_RADIUS_METRES = 5000;
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
    Math.sin(latitudeDifference / 2) * Math.sin(latitudeDifference / 2) +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDifference / 2) *
      Math.sin(longitudeDifference / 2);
  const angularDistance =
    2 * Math.atan2(Math.sqrt(haversineValue), Math.sqrt(1 - haversineValue));
  return earthRadiusMetres * angularDistance;
}
function formatDistance(distanceMetres) {
  if (distanceMetres < 1000) {
    return Math.round(distanceMetres) + ' m';
  }
  return (distanceMetres / 1000).toFixed(1) + ' km';
}
function loadSavedRatings() {
  try {
    const savedRatings = window.localStorage.getItem(STORAGE_KEY);
    if (!savedRatings) {
      return {};
    }
    return JSON.parse(savedRatings);
  } catch (error) {
    console.error('Kunne ikke laste vurderinger:', error);
    return {};
  }
}
function saveRatings(ratings) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ratings));
  } catch (error) {
    console.error('Kunne ikke lagre vurderinger:', error);
  }
}
function GelatoHunter() {
  const placesLibrary = useMapsLibrary('places');
  const [userPosition, setUserPosition] = useState(null);
  const [places, setPlaces] = useState([]);
  const [ratings, setRatings] = useState(loadSavedRatings);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [locationStatus, setLocationStatus] = useState('loading');
  const [placesStatus, setPlacesStatus] = useState('waiting');
  const [message, setMessage] = useState('Finner posisjonen din...');
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('error');
      setMessage('Nettleseren støtter ikke posisjon.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserPosition(coordinates);
        setLocationStatus('ready');
        setMessage('Søker etter iskremsteder...');
      },
      (error) => {
        console.error('Posisjonsfeil:', error);
        setLocationStatus('error');
        if (error.code === 1) {
          setMessage('Gelato Hunter trenger tilgang til posisjonen din.');
        } else {
          setMessage('Posisjonen din kunne ikke hentes.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }, []);
  const findGelatoPlaces = useCallback(async () => {
    if (!placesLibrary || !userPosition) {
      return;
    }
    try {
      setPlacesStatus('loading');
      setMessage('Søker etter iskremsteder...');
      const request = {
        fields: [
          'id',
          'displayName',
          'location',
          'rating',
          'userRatingCount',
          'googleMapsURI',
        ],
        locationRestriction: {
          center: userPosition,
          radius: SEARCH_RADIUS_METRES,
        },
        includedPrimaryTypes: ['ice_cream_shop'],
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
            typeof place.location.lat === 'function'
              ? place.location.lat()
              : place.location.lat;
          const longitude =
            typeof place.location.lng === 'function'
              ? place.location.lng()
              : place.location.lng;
          const distanceMetres = calculateDistance(
            userPosition.lat,
            userPosition.lng,
            latitude,
            longitude
          );
          return {
            id: place.id,
            name:
              typeof place.displayName === 'string'
                ? place.displayName
                : place.displayName?.text || 'Iskremsted',
            latitude: latitude,
            longitude: longitude,
            rating: place.rating || null,
            userRatingCount: place.userRatingCount || null,
            googleMapsURI: place.googleMapsURI || null,
            distanceMetres: distanceMetres,
          };
        })
        .sort(
          (firstPlace, secondPlace) =>
            firstPlace.distanceMetres - secondPlace.distanceMetres
        );
      setPlaces(preparedPlaces);
      setPlacesStatus('ready');
      if (preparedPlaces.length === 0) {
        setMessage('Ingen iskremsteder ble funnet innen 5 km.');
      } else {
        setMessage('');
      }
    } catch (error) {
      console.error('Google Places-feil:', error);
      setPlacesStatus('error');
      setMessage(
        'Iskremstedene kunne ikke lastes. Kontroller Google API-oppsettet.'
      );
    }
  }, [placesLibrary, userPosition]);
  useEffect(() => {
    findGelatoPlaces();
  }, [findGelatoPlaces]);
  const selectedRating = useMemo(() => {
    if (!selectedPlace) {
      return 0;
    }
    return ratings[selectedPlace.id] || 0;
  }, [selectedPlace, ratings]);
  function ratePlace(placeId, rating) {
    const updatedRatings = { ...ratings };
    updatedRatings[placeId] = rating;
    setRatings(updatedRatings);
    saveRatings(updatedRatings);
  }
  function deleteRating(placeId) {
    const updatedRatings = { ...ratings };
    delete updatedRatings[placeId];
    setRatings(updatedRatings);
    saveRatings(updatedRatings);
  }
  function navigateToPlace(place) {
    if (place.googleMapsURI) {
      window.open(place.googleMapsURI, '_blank', 'noopener,noreferrer');
      return;
    }
    const destination = place.latitude + ',' + place.longitude;
    const navigationUrl =
      'https://www.google.com/maps/dir/?api=1' +
      '&destination=' +
      encodeURIComponent(destination) +
      '&travelmode=walking';
    window.open(navigationUrl, '_blank', 'noopener,noreferrer');
  }
  if (locationStatus === 'loading') {
    return (
      <main style={styles.loadingPage}>
        {' '}
        <div style={styles.largeLogo}> 🍦 </div>{' '}
        <h1 style={styles.loadingTitle}> GELATO HUNTER </h1>{' '}
        <p style={styles.loadingMessage}> {message} </p>{' '}
      </main>
    );
  }
  if (locationStatus === 'error') {
    return (
      <main style={styles.loadingPage}>
        {' '}
        <div style={styles.largeLogo}> 📍 </div>{' '}
        <h1 style={styles.loadingTitle}> GELATO HUNTER </h1>{' '}
        <p style={styles.errorMessage}> {message} </p>{' '}
        <button
          style={styles.primaryButton}
          onClick={() => window.location.reload()}
        >
          {' '}
          Prøv igjen{' '}
        </button>{' '}
      </main>
    );
  }
  return (
    <main style={styles.app}>
      {' '}
      <header style={styles.header}>
        {' '}
        <div>
          {' '}
          <div style={styles.brandLabel}> GELATO HUNTER </div>{' '}
          <h1 style={styles.heading}> Finn neste kule 🍦 </h1>{' '}
          <p style={styles.subheading}> Iskremsteder nærmest deg </p>{' '}
        </div>{' '}
      </header>{' '}
      <section style={styles.mapWrapper}>
        {' '}
        <Map
          defaultCenter={userPosition}
          defaultZoom={13}
          gestureHandling="greedy"
          disableDefaultUI={true}
          style={styles.map}
        >
          {' '}
          <Marker position={userPosition} title="Du er her" />{' '}
          {places.map((place) => (
            <Marker
              key={place.id}
              position={{ lat: place.latitude, lng: place.longitude }}
              title={place.name}
              onClick={() => setSelectedPlace(place)}
            />
          ))}{' '}
        </Map>{' '}
      </section>{' '}
      <section style={styles.content}>
        {' '}
        <div style={styles.listHeader}>
          {' '}
          <div>
            {' '}
            <div style={styles.eyebrow}> NÆRMEST DEG </div>{' '}
            <h2 style={styles.listTitle}> Iskrem i nærheten </h2>{' '}
          </div>{' '}
          <span style={styles.resultCount}> {places.length} steder </span>{' '}
        </div>{' '}
        {placesStatus === 'loading' && (
          <div style={styles.statusCard}> Søker etter iskrem... </div>
        )}{' '}
        {message && <div style={styles.messageCard}> {message} </div>}{' '}
        <div style={styles.placeList}>
          {' '}
          {places.map((place, index) => {
            const personalRating = ratings[place.id] || 0;
            return (
              <button
                key={place.id}
                type="button"
                style={styles.placeCard}
                onClick={() => setSelectedPlace(place)}
              >
                {' '}
                <div style={styles.placeNumber}> {index + 1} </div>{' '}
                <div style={styles.placeInfo}>
                  {' '}
                  <strong style={styles.placeName}> {place.name} </strong>{' '}
                  <div style={styles.placeMetadata}>
                    {' '}
                    <span style={styles.distance}>
                      {' '}
                      📍 {formatDistance(place.distanceMetres)}{' '}
                    </span>{' '}
                    {place.rating && <span> Google {place.rating} ⭐ </span>}{' '}
                  </div>{' '}
                  {personalRating > 0 && (
                    <div style={styles.personalRating}>
                      {' '}
                      Din vurdering: {personalRating} av 5 🍦{' '}
                    </div>
                  )}{' '}
                </div>{' '}
                <span style={styles.arrow}> › </span>{' '}
              </button>
            );
          })}{' '}
        </div>{' '}
      </section>{' '}
      {selectedPlace && (
        <div style={styles.overlay} onClick={() => setSelectedPlace(null)}>
          {' '}
          <section
            style={styles.placeDialog}
            onClick={(event) => event.stopPropagation()}
          >
            {' '}
            <button
              type="button"
              aria-label="Lukk"
              style={styles.closeButton}
              onClick={() => setSelectedPlace(null)}
            >
              {' '}
              ×{' '}
            </button>{' '}
            <h2 style={styles.dialogTitle}> {selectedPlace.name} </h2>{' '}
            <div style={styles.dialogMeta}>
              {' '}
              📍 {formatDistance(selectedPlace.distanceMetres)} unna{' '}
            </div>{' '}
            {selectedPlace.rating && (
              <div style={styles.dialogMeta}>
                {' '}
                Google: {selectedPlace.rating} ⭐{' '}
              </div>
            )}{' '}
            <button
              type="button"
              style={styles.navigateButton}
              onClick={() => navigateToPlace(selectedPlace)}
            >
              {' '}
              🧭 Naviger hit{' '}
            </button>{' '}
            <h3 style={styles.ratingTitle}> Din Gelato Hunter-rating </h3>{' '}
            <div style={styles.cones}>
              {' '}
              {[1, 2, 3, 4, 5].map((number) => {
                const isSelected = number <= selectedRating;
                return (
                  <button
                    key={number}
                    type="button"
                    aria-label={'Gi ' + number + ' av 5'}
                    style={{
                      ...styles.coneButton,
                      ...(isSelected ? styles.coneButtonSelected : {}),
                    }}
                    onClick={() => ratePlace(selectedPlace.id, number)}
                  >
                    {' '}
                    <span style={styles.cone}> 🍦 </span>{' '}
                    <span
                      style={{
                        ...styles.coneNumber,
                        ...(isSelected ? styles.coneNumberSelected : {}),
                      }}
                    >
                      {' '}
                      {number}{' '}
                    </span>{' '}
                  </button>
                );
              })}{' '}
            </div>{' '}
            <div style={styles.ratingResult}>
              {' '}
              {selectedRating > 0 ? (
                <>
                  {' '}
                  <strong style={styles.savedText}>
                    {' '}
                    ✓ Vurdering lagret: {selectedRating} av 5 🍦{' '}
                  </strong>{' '}
                  <button
                    type="button"
                    style={styles.deleteButton}
                    onClick={() => deleteRating(selectedPlace.id)}
                  >
                    {' '}
                    Slett vurdering{' '}
                  </button>{' '}
                </>
              ) : (
                <span style={styles.helpText}>
                  {' '}
                  Trykk på en kjegle for å gi din vurdering{' '}
                </span>
              )}{' '}
            </div>{' '}
          </section>{' '}
        </div>
      )}{' '}
    </main>
  );
}
function App() {
  if (!API_KEY) {
    return (
      <main style={styles.loadingPage}>
        {' '}
        <div style={styles.largeLogo}> 🍦 </div>{' '}
        <h1 style={styles.loadingTitle}> GELATO HUNTER </h1>{' '}
        <p style={styles.errorMessage}>
          {' '}
          Google Maps API-nøkkel mangler. Kontroller .env-filen.{' '}
        </p>{' '}
      </main>
    );
  }
  return (
    <APIProvider apiKey={API_KEY}>
      {' '}
      <GelatoHunter />{' '}
    </APIProvider>
  );
}
const styles = {
  app: {
    minHeight: '100vh',
    background: '#FFFAF1',
    color: '#202020',
    fontFamily: 'Arial, Helvetica, sans-serif',
  },
  header: { maxWidth: 820, margin: '0 auto', padding: '28px 18px 18px' },
  brandLabel: {
    color: '#F97316',
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 3,
  },
  heading: { margin: '5px 0 0', fontSize: 36, lineHeight: 1.05 },
  subheading: { margin: '8px 0 0', color: '#666666' },
  mapWrapper: {
    maxWidth: 820,
    height: '42vh',
    minHeight: 320,
    maxHeight: 480,
    margin: '0 auto',
    padding: '0 12px',
    boxSizing: 'border-box',
  },
  map: { width: '100%', height: '100%', borderRadius: 26, overflow: 'hidden' },
  content: { maxWidth: 820, margin: '0 auto', padding: '20px 12px 50px' },
  listHeader: {
    display: 'flex',
    alignItems: 'end',
    justifyContent: 'space-between',
    gap: 16,
    padding: '0 5px 10px',
  },
  eyebrow: {
    color: '#F97316',
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 1.5,
  },
  listTitle: { margin: '3px 0 0', fontSize: 23 },
  resultCount: { color: '#777777', fontSize: 13 },
  placeList: { display: 'grid', gap: 10 },
  placeCard: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    border: '1px solid #EEE3D4',
    borderRadius: 17,
    background: '#FFFFFF',
    color: '#202020',
    font: 'inherit',
    textAlign: 'left',
    cursor: 'pointer',
  },
  placeNumber: {
    width: 38,
    height: 38,
    flexShrink: 0,
    display: 'grid',
    placeItems: 'center',
    borderRadius: '50%',
    background: '#FFF0D9',
    color: '#F97316',
    fontWeight: 900,
  },
  placeInfo: { flex: 1, minWidth: 0 },
  placeName: {
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 16,
  },
  placeMetadata: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 5,
    color: '#666666',
    fontSize: 13,
  },
  distance: { color: '#E8650C', fontWeight: 800 },
  personalRating: {
    marginTop: 6,
    color: '#D65E00',
    fontSize: 12,
    fontWeight: 800,
  },
  arrow: { color: '#BBBBBB', fontSize: 30 },
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    padding: 12,
    background: 'rgba(20,15,10,0.38)',
  },
  placeDialog: {
    position: 'relative',
    width: 'min(540px, 100%)',
    boxSizing: 'border-box',
    padding: '24px 18px 18px',
    borderRadius: 24,
    background: '#FFFFFF',
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 10,
    width: 42,
    height: 42,
    border: 0,
    background: 'transparent',
    color: '#777777',
    fontSize: 30,
    cursor: 'pointer',
  },
  dialogTitle: { margin: 0, paddingRight: 40, fontSize: 23 },
  dialogMeta: { marginTop: 5, color: '#666666', fontSize: 14 },
  navigateButton: {
    width: '100%',
    marginTop: 15,
    padding: '13px 16px',
    border: 0,
    borderRadius: 14,
    background: '#F97316',
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 900,
    cursor: 'pointer',
  },
  ratingTitle: { margin: '18px 0 10px', fontSize: 15 },
  cones: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
    gap: 7,
  },
  coneButton: {
    minWidth: 0,
    height: 74,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #DDDDDD',
    borderRadius: 14,
    background: '#F4F4F4',
    cursor: 'pointer',
  },
  coneButtonSelected: { borderColor: '#F97316', background: '#FFF0D9' },
  cone: { fontSize: 29 },
  coneNumber: { marginTop: 2, color: '#999999', fontSize: 13, fontWeight: 900 },
  coneNumberSelected: { color: '#F97316' },
  ratingResult: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 11,
    borderRadius: 11,
    background: '#FFF8ED',
  },
  savedText: { color: '#F97316', textAlign: 'center' },
  helpText: { color: '#777777', fontSize: 13, textAlign: 'center' },
  deleteButton: {
    border: 0,
    background: 'transparent',
    color: '#AA3333',
    fontWeight: 800,
    cursor: 'pointer',
  },
  statusCard: {
    marginBottom: 12,
    padding: 15,
    borderRadius: 14,
    background: '#FFFFFF',
    textAlign: 'center',
  },
  messageCard: {
    marginBottom: 12,
    padding: 15,
    borderRadius: 14,
    background: '#FFF3E4',
    color: '#8A460D',
    textAlign: 'center',
  },
  loadingPage: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    padding: 30,
    background: '#FFFAF1',
    fontFamily: 'Arial, Helvetica, sans-serif',
    textAlign: 'center',
  },
  largeLogo: { fontSize: 82 },
  loadingTitle: { margin: '12px 0 24px', color: '#F97316', fontSize: 30 },
  loadingMessage: { marginTop: 20, color: '#666666' },
  errorMessage: { maxWidth: 440, color: '#AA3333', lineHeight: 1.5 },
  primaryButton: {
    marginTop: 18,
    padding: '12px 22px',
    border: 0,
    borderRadius: 13,
    background: '#F97316',
    color: '#FFFFFF',
    fontWeight: 900,
    cursor: 'pointer',
  },
};
export default App;
