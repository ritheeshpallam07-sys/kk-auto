import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface PlaceSuggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
}

export const LOCATION_COORDINATES: Record<string, Coordinates> = {
  'JNTUA': { lat: 13.6508, lng: 78.7860 },
  'Cross': { lat: 13.6525, lng: 78.8035 },
  'Bus Stand': { lat: 13.6455, lng: 78.8035 },
  'Marava': { lat: 13.6408, lng: 78.8010 },
  'Indiramma Colony': { lat: 13.6550, lng: 78.7960 },
  'Cross Road': { lat: 13.6525, lng: 78.8035 },
  'Cross Road Apollo': { lat: 13.6525, lng: 78.8035 },
  'Apollo Cross Road': { lat: 13.6525, lng: 78.8035 },
  'Apollo Pharmacy Cross': { lat: 13.6525, lng: 78.8035 },
  'JNTUA Main Gate': { lat: 13.6508, lng: 78.7860 },
  'Marava Circle': { lat: 13.6408, lng: 78.8010 },
  'Railway Station': { lat: 13.6420, lng: 78.8080 },
  'Main Bazaar': { lat: 13.6475, lng: 78.8020 }
};

export const DEFAULT_MAP_CENTER: Coordinates = {
  lat: 13.6480,
  lng: 78.7950
};

export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

let optionsConfigured = false;
let placesLoadPromise: Promise<boolean> | null = null;

export const resolveLocalCoordinates = (address: string): Coordinates | null => {
  const clean = address.trim();
  const match = Object.keys(LOCATION_COORDINATES).find(
    (k) => k.toLowerCase() === clean.toLowerCase()
  );
  if (match) return LOCATION_COORDINATES[match];
  return null;
};

/**
 * Ensures the Google Maps Places library (Places API New SDK) is loaded when
 * a page mounts without an interactive map canvas (e.g. Plan a Trip modal).
 */
export async function ensureGooglePlacesLoaded(): Promise<boolean> {
  if ((window as any).google?.maps?.places?.AutocompleteSuggestion) {
    return true;
  }
  if (!GOOGLE_MAPS_API_KEY) {
    return false;
  }
  if (placesLoadPromise) {
    return placesLoadPromise;
  }

  placesLoadPromise = (async () => {
    try {
      if (!window.google?.maps?.importLibrary && !optionsConfigured) {
        setOptions({
          key: GOOGLE_MAPS_API_KEY,
          v: 'weekly'
        });
        optionsConfigured = true;
      }
      await importLibrary('places');
      return Boolean((window as any).google?.maps?.places);
    } catch {
      return false;
    } finally {
      placesLoadPromise = null;
    }
  })();

  return placesLoadPromise;
}

export interface SearchPlacesOptions {
  biasCoords?: Coordinates | null;
  useLocationBias?: boolean;
  includeLocalFallback?: boolean;
}

/**
 * Search places using Google Places API (New):
 * 1. Google Maps JS SDK AutocompleteSuggestion
 * 2. Direct REST Places API (New) v1/places:autocomplete
 * 3. Optional local landmark fallback (for local Madanapalle auto rides)
 */
export async function searchPlacesNew(
  query: string,
  options: SearchPlacesOptions = {}
): Promise<PlaceSuggestion[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery || cleanQuery.length < 2) return [];

  const {
    biasCoords = null,
    useLocationBias = true,
    includeLocalFallback = true
  } = options;

  const center = biasCoords || DEFAULT_MAP_CENTER;

  // 1. Primary Engine: Google Maps JS SDK Places API (New) AutocompleteSuggestion
  if (!(window as any).google?.maps?.places?.AutocompleteSuggestion && GOOGLE_MAPS_API_KEY) {
    await ensureGooglePlacesLoaded();
  }

  const google = (window as any).google;
  const placesLib = google?.maps?.places;
  if (placesLib?.AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
    try {
      const requestPayload: Record<string, any> = {
        input: cleanQuery,
        includedRegionCodes: ['in']
      };
      if (useLocationBias) {
        requestPayload.locationBias = {
          lat: center.lat,
          lng: center.lng
        };
      }

      const response = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions(
        requestPayload
      );

      if (response?.suggestions && Array.isArray(response.suggestions)) {
        const results: PlaceSuggestion[] = response.suggestions.map((s: any) => {
          const pred = s.placePrediction;
          const placeId =
            pred?.placeId || (pred?.place ? String(pred.place).replace('places/', '') : '');
          const mainText = pred?.mainText?.toString() || pred?.text?.toString() || cleanQuery;
          const secondaryText = pred?.secondaryText?.toString() || '';
          const fullText =
            pred?.text?.toString() || `${mainText}${secondaryText ? ', ' + secondaryText : ''}`;
          return { placeId, mainText, secondaryText, fullText };
        });

        if (results.length > 0) return results;
      }
    } catch {
      // SDK fetch error; fall through to REST
    }
  }

  // 2. Secondary Engine: Direct REST Places API (New)
  if (GOOGLE_MAPS_API_KEY) {
    try {
      const restBody: Record<string, any> = {
        input: cleanQuery,
        includedRegionCodes: ['in']
      };
      if (useLocationBias) {
        restBody.locationBias = {
          circle: {
            center: { latitude: center.lat, longitude: center.lng },
            radius: 35000.0
          }
        };
      }

      const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY
        },
        body: JSON.stringify(restBody)
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.suggestions && Array.isArray(data.suggestions)) {
          const results: PlaceSuggestion[] = data.suggestions.map((s: any) => {
            const pred = s.placePrediction;
            const placeId =
              pred?.placeId || (pred?.place ? String(pred.place).replace('places/', '') : '');
            const mainText =
              pred?.structuredFormat?.mainText?.text || pred?.text?.text || cleanQuery;
            const secondaryText = pred?.structuredFormat?.secondaryText?.text || '';
            const fullText =
              pred?.text?.text || `${mainText}${secondaryText ? ', ' + secondaryText : ''}`;
            return { placeId, mainText, secondaryText, fullText };
          });

          if (results.length > 0) return results;
        }
      }
    } catch {
      // Fall through to local landmarks if enabled
    }
  }

  // 3. Tertiary Engine: Local Landmark Fallback
  if (includeLocalFallback) {
    return Object.keys(LOCATION_COORDINATES)
      .filter((name) => name.toLowerCase().includes(cleanQuery.toLowerCase()))
      .map((name) => ({
        placeId: `local_${name}`,
        mainText: name,
        secondaryText: 'Madanapalle Service Area',
        fullText: `${name}, Madanapalle`
      }));
  }

  return [];
}

/**
 * Fetch place details (coordinates & formatted address) using Google Places API (New).
 */
export async function fetchPlaceDetailsNew(
  placeId: string,
  fallbackText: string
): Promise<{ address: string; coords: Coordinates } | null> {
  if (placeId.startsWith('local_')) {
    const name = placeId.replace('local_', '');
    if (LOCATION_COORDINATES[name]) {
      return {
        address: `${name}, Madanapalle`,
        coords: LOCATION_COORDINATES[name]
      };
    }
  }

  const localMatch = resolveLocalCoordinates(fallbackText);
  const google = (window as any).google;
  const placesLib = google?.maps?.places;

  // 1. Primary Engine: Google Maps JS SDK Place class
  if (placesLib?.Place && placeId) {
    try {
      const place = new placesLib.Place({ id: placeId });
      await place.fetchFields({
        fields: ['location', 'formattedAddress', 'displayName']
      });

      if (place.location) {
        const lat =
          typeof place.location.lat === 'function' ? place.location.lat() : place.location.lat;
        const lng =
          typeof place.location.lng === 'function' ? place.location.lng() : place.location.lng;
        const address =
          place.formattedAddress ||
          (typeof place.displayName === 'string'
            ? place.displayName
            : place.displayName?.text) ||
          fallbackText;
        return { address, coords: { lat, lng } };
      }
    } catch {
      // Fall through to REST
    }
  }

  // 2. Secondary Engine: Direct REST Places API (New)
  if (GOOGLE_MAPS_API_KEY && placeId) {
    try {
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(
          placeId
        )}?fields=id,formattedAddress,location,displayName`,
        {
          headers: {
            'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY
          }
        }
      );

      if (res.ok) {
        const data = await res.json();
        if (data?.location?.latitude && data?.location?.longitude) {
          const address = data.formattedAddress || data.displayName?.text || fallbackText;
          return {
            address,
            coords: {
              lat: data.location.latitude,
              lng: data.location.longitude
            }
          };
        }
      }
    } catch {
      // Fall through to geocoder
    }
  }

  // 3. Tertiary Engine: Google Maps Geocoder fallback
  if (google?.maps?.Geocoder && fallbackText) {
    try {
      const geocoder = new google.maps.Geocoder();
      const geoResult = await new Promise<any>((resolve) => {
        geocoder.geocode({ address: fallbackText }, (results: any, status: any) => {
          if (status === 'OK' && results && results[0]?.geometry?.location) {
            resolve(results[0]);
          } else {
            resolve(null);
          }
        });
      });

      if (geoResult) {
        return {
          address: geoResult.formatted_address || fallbackText,
          coords: {
            lat: geoResult.geometry.location.lat(),
            lng: geoResult.geometry.location.lng()
          }
        };
      }
    } catch {
      // Fall through
    }
  }

  if (localMatch) {
    return { address: fallbackText, coords: localMatch };
  }

  return null;
}
