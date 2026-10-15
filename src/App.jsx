import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  APIProvider,
  Map,
  Marker,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';

import { supabase } from './lib/supabase';

const GOOGLE_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const SEARCH_RADII = [
  5000,
  10000,
  25000,
  50000,
];


function degreesToRadians(degrees) {
  return degrees * (Math.PI / 180);
}


function calculateDistance(
  latitude1,
  longitude1,
  latitude2,
  longitude2
) {
  const earthRadiusMetres = 6371000;

  const latitudeDifference =
    degreesToRadians(
      latitude2 - latitude1
    );

  const longitudeDifference =
    degreesToRadians(
      longitude2 - longitude1
    );

  const firstLatitude =
    degreesToRadians(latitude1);

  const secondLatitude =
    degreesToRadians(latitude2);

  const haversineValue =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDifference / 2) ** 2;

  const angularDistance =
    2 *
    Math.atan2(
      Math.sqrt(haversineValue),
      Math.sqrt(1 - haversineValue)
    );

  return earthRadiusMetres * angularDistance;
}


function formatDistance(distanceMetres) {
  if (distanceMetres < 1000) {
    return Math.round(distanceMetres) + ' m';
  }

  return (
    (distanceMetres / 1000).toFixed(1) +
    ' km'
  );
}


function formatRadius(radiusMetres) {
  return radiusMetres / 1000 + ' km';
}


function getTodayDate() {
  const today = new Date();

  const year =
    today.getFullYear();

  const month =
    String(
      today.getMonth() + 1
    ).padStart(2, '0');

  const day =
    String(
      today.getDate()
    ).padStart(2, '0');

  return (
    year +
    '-' +
    month +
    '-' +
    day
  );
}


function formatVisitDate(dateValue) {
  if (!dateValue) {
    return '';
  }

  const parts =
    dateValue.split('-');

  if (parts.length !== 3) {
    return dateValue;
  }

  return (
    parts[2] +
    '.' +
    parts[1] +
    '.' +
    parts[0]
  );
}


function createId() {
  if (
    window.crypto &&
    typeof window.crypto.randomUUID ===
      'function'
  ) {
    return window.crypto.randomUUID();
  }

  return (
    Date.now().toString() +
    '-' +
    Math.random()
      .toString(16)
      .slice(2)
  );
}


function getHistoryStorageKey(userId) {
  return (
    'gelato_hunter_history_' +
    userId
  );
}


function loadHistory(userId) {
  try {
    const storageKey =
      getHistoryStorageKey(userId);

    const savedHistory =
      window.localStorage.getItem(
        storageKey
      );

    if (!savedHistory) {
      return [];
    }

    const parsedHistory =
      JSON.parse(savedHistory);

    return Array.isArray(parsedHistory)
      ? parsedHistory
      : [];
  } catch (error) {
    console.error(
      'Kunne ikke laste historikken:',
      error
    );

    return [];
  }
}


function saveHistory(
  userId,
  history
) {
  try {
    const storageKey =
      getHistoryStorageKey(userId);

    window.localStorage.setItem(
      storageKey,
      JSON.stringify(history)
    );

    return true;
  } catch (error) {
    console.error(
      'Kunne ikke lagre historikken:',
      error
    );

    return false;
  }
}


function AuthScreen() {
  const [
    authMode,
    setAuthMode,
  ] = useState('login');

  const [
    email,
    setEmail,
  ] = useState('');

  const [
    password,
    setPassword,
  ] = useState('');

  const [
    displayName,
    setDisplayName,
  ] = useState('');

  const [
    authMessage,
    setAuthMessage,
  ] = useState('');

  const [
    authError,
    setAuthError,
  ] = useState('');

  const [
    authLoading,
    setAuthLoading,
  ] = useState(false);


  async function handleSubmit(event) {
    event.preventDefault();

    setAuthError('');
    setAuthMessage('');

    if (!email.trim()) {
      setAuthError(
        'Skriv inn e-postadressen din.'
      );

      return;
    }

    if (password.length < 6) {
      setAuthError(
        'Passordet må ha minst 6 tegn.'
      );

      return;
    }

    setAuthLoading(true);

    try {
      if (authMode === 'signup') {
        const {
          data,
          error,
        } =
          await supabase.auth.signUp({
            email:
              email.trim(),

            password:
              password,

            options: {
              data: {
                display_name:
                  displayName.trim(),
              },

              emailRedirectTo:
                window.location.origin,
            },
          });

        if (error) {
          throw error;
        }

        if (data.session) {
          setAuthMessage(
            'Kontoen er opprettet.'
          );
        } else {
          setAuthMessage(
            'Kontoen er opprettet. Kontroller e-posten din og bekreft kontoen før du logger inn.'
          );
        }
      } else {
        const {
          error,
        } =
          await supabase.auth
            .signInWithPassword({
              email:
                email.trim(),

              password:
                password,
            });

        if (error) {
          throw error;
        }
      }
    } catch (error) {
      console.error(
        'Auth-feil:',
        error
      );

      setAuthError(
        error.message ||
        'Innloggingen mislyktes.'
      );
    } finally {
      setAuthLoading(false);
    }
  }


  async function resetPassword() {
    setAuthError('');
    setAuthMessage('');

    if (!email.trim()) {
      setAuthError(
        'Skriv inn e-postadressen først.'
      );

      return;
    }

    setAuthLoading(true);

    const {
      error,
    } =
      await supabase.auth
        .resetPasswordForEmail(
          email.trim(),
          {
            redirectTo:
              window.location.origin,
          }
        );

    setAuthLoading(false);

    if (error) {
      setAuthError(
        error.message
      );

      return;
    }

    setAuthMessage(
      'Lenke for nytt passord er sendt på e-post.'
    );
  }


  return (
    <main className="auth-page">
      <AppStyles />

      <section className="auth-card">
        <div className="auth-logo">
          🍦
        </div>

        <div className="brand-label">
          GELATO HUNTER
        </div>

        <h1>
          {authMode === 'login'
            ? 'Velkommen tilbake'
            : 'Opprett konto'}
        </h1>

        <p className="auth-intro">
          Logg inn for å bygge din
          gelato-historikk og senere
          dele iskremopplevelser med
          venner.
        </p>

        <form
          onSubmit={
            handleSubmit
          }
        >
          {authMode ===
            'signup' && (
              <>
                <label className="field-label">
                  Visningsnavn
                </label>

                <input
                  className="text-input"
                  type="text"
                  value={
                    displayName
                  }
                  placeholder="Navnet vennene dine ser"
                  maxLength={40}
                  onChange={(event) =>
                    setDisplayName(
                      event.target.value
                    )
                  }
                />
              </>
            )}

          <label className="field-label">
            E-post
          </label>

          <input
            className="text-input"
            type="email"
            autoComplete="email"
            value={email}
            placeholder="navn@eksempel.no"
            onChange={(event) =>
              setEmail(
                event.target.value
              )
            }
          />

          <label className="field-label">
            Passord
          </label>

          <input
            className="text-input"
            type="password"
            autoComplete={
              authMode === 'login'
                ? 'current-password'
                : 'new-password'
            }
            value={password}
            placeholder="Minst 6 tegn"
            onChange={(event) =>
              setPassword(
                event.target.value
              )
            }
          />

          <button
            className="auth-submit"
            type="submit"
            disabled={
              authLoading
            }
          >
            {authLoading
              ? 'Arbeider...'
              : authMode ===
                'login'
              ? 'Logg inn'
              : 'Opprett konto'}
          </button>
        </form>

        {authMode ===
          'login' && (
          <button
            className="text-button"
            type="button"
            onClick={
              resetPassword
            }
          >
            Glemt passord?
          </button>
        )}

        {authError && (
          <div className="auth-error">
            {authError}
          </div>
        )}

        {authMessage && (
          <div className="auth-success">
            {authMessage}
          </div>
        )}

        <div className="auth-switch">
          {authMode === 'login'
            ? 'Har du ikke konto?'
            : 'Har du allerede konto?'}

          <button
            className="text-button"
            type="button"
            onClick={() => {
              setAuthMode(
                authMode === 'login'
                  ? 'signup'
                  : 'login'
              );

              setAuthError('');
              setAuthMessage('');
            }}
          >
            {authMode === 'login'
              ? 'Opprett konto'
              : 'Logg inn'}
          </button>
        </div>
      </section>
    </main>
  );
}


function GelatoHunter({
  session,
}) {
  const placesLibrary =
    useMapsLibrary('places');

  const user =
    session.user;

  const displayName =
    user.user_metadata
      ?.display_name ||
    user.email ||
    'Gelato Hunter';

  const [
    activeView,
    setActiveView,
  ] = useState('discover');

  const [
    userPosition,
    setUserPosition,
  ] = useState(null);

  const [
    places,
    setPlaces,
  ] = useState([]);

  const [
    history,
    setHistory,
  ] = useState(() =>
    loadHistory(user.id)
  );

  const [
    selectedPlace,
    setSelectedPlace,
  ] = useState(null);

  const [
    locationStatus,
    setLocationStatus,
  ] = useState('loading');

  const [
    placesStatus,
    setPlacesStatus,
  ] = useState('waiting');

  const [
    searchRadiusIndex,
    setSearchRadiusIndex,
  ] = useState(0);

  const [
    message,
    setMessage,
  ] = useState(
    'Finner posisjonen din...'
  );

  const [
    ratingInput,
    setRatingInput,
  ] = useState(0);

  const [
    flavourInput,
    setFlavourInput,
  ] = useState('');

  const [
    visitDateInput,
    setVisitDateInput,
  ] = useState(
    getTodayDate()
  );

  const [
    favouriteInput,
    setFavouriteInput,
  ] = useState(false);

  const [
    saveMessage,
    setSaveMessage,
  ] = useState('');

  const [
    showOnlyFavourites,
    setShowOnlyFavourites,
  ] = useState(false);

  const [
    signingOut,
    setSigningOut,
  ] = useState(false);

  const searchRadius =
    SEARCH_RADII[
      searchRadiusIndex
    ];


  useEffect(() => {
    setHistory(
      loadHistory(user.id)
    );
  }, [user.id]);


  useEffect(() => {
    if (
      !navigator.geolocation
    ) {
      setLocationStatus('error');

      setMessage(
        'Nettleseren støtter ikke posisjon.'
      );

      return;
    }

    navigator.geolocation
      .getCurrentPosition(
        (position) => {
          setUserPosition({
            lat:
              position.coords
                .latitude,

            lng:
              position.coords
                .longitude,
          });

          setLocationStatus(
            'ready'
          );

          setMessage(
            'Søker etter iskremsteder...'
          );
        },

        (error) => {
          console.error(
            'Posisjonsfeil:',
            error
          );

          setLocationStatus(
            'error'
          );

          if (
            error.code === 1
          ) {
            setMessage(
              'Gelato Hunter trenger tilgang til posisjonen din.'
            );
          } else {
            setMessage(
              'Posisjonen din kunne ikke hentes.'
            );
          }
        },

        {
          enableHighAccuracy:
            true,

          timeout: 15000,

          maximumAge: 60000,
        }
      );
  }, []);


  const findGelatoPlaces =
    useCallback(async () => {
      if (
        !placesLibrary ||
        !userPosition
      ) {
        return;
      }

      try {
        setPlacesStatus(
          'loading'
        );

        setPlaces([]);

        setMessage(
          'Søker innen ' +
          formatRadius(
            searchRadius
          ) +
          '...'
        );

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
            center:
              userPosition,

            radius:
              searchRadius,
          },

          includedPrimaryTypes: [
            'ice_cream_shop',
          ],

          maxResultCount: 20,

          rankPreference:
            placesLibrary
              .SearchNearbyRankPreference
              .DISTANCE,
        };

        const result =
          await placesLibrary.Place
            .searchNearby(
              request
            );

        const foundPlaces =
          result.places || [];

        const preparedPlaces =
          foundPlaces
            .filter((place) => {
              return Boolean(
                place.id &&
                place.location
              );
            })

            .map((place) => {
              const latitude =
                typeof place.location
                  .lat ===
                'function'
                  ? place.location
                      .lat()
                  : place.location.lat;

              const longitude =
                typeof place.location
                  .lng ===
                'function'
                  ? place.location
                      .lng()
                  : place.location.lng;

              return {
                id:
                  place.id,

                name:
                  typeof place.displayName ===
                  'string'
                    ? place.displayName
                    : place.displayName
                        ?.text ||
                      'Iskremsted',

                latitude,

                longitude,

                rating:
                  place.rating ||
                  null,

                googleMapsURI:
                  place.googleMapsURI ||
                  null,

                distanceMetres:
                  calculateDistance(
                    userPosition.lat,
                    userPosition.lng,
                    latitude,
                    longitude
                  ),
              };
            })

            .sort(
              (
                firstPlace,
                secondPlace
              ) =>
                firstPlace
                  .distanceMetres -
                secondPlace
                  .distanceMetres
            );

        setPlaces(
          preparedPlaces
        );

        setPlacesStatus(
          'ready'
        );

        if (
          preparedPlaces.length ===
          0
        ) {
          setMessage(
            'Ingen iskremsteder funnet innen ' +
            formatRadius(
              searchRadius
      