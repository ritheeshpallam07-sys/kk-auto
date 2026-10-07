import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, FareEstimate } from '../api/client';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

import {
  MapPin,
  Navigation,
  Clock,
  Calendar,
  Users,
  IndianRupee,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  Car,
  LocateFixed,
  Search,
} from 'lucide-react';

interface BookingFormPageProps {
  navigate: (path: string) => void;
}

interface Coordinates {
  lat: number;
  lng: number;
}

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
  placeId: string;
}
const defaultCenter: Coordinates = {
  lat: 13.6288,
  lng: 79.4192,
};

const GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

/*
 * GOOGLE MAPS LOADER
 */
const loadGoogleMaps = async () => {
  if (!window.google) {
    setOptions({
      key: GOOGLE_MAPS_API_KEY,
      v: 'weekly',
    });
  }

  await importLibrary('maps');
  await importLibrary('geocoding');
  await importLibrary('marker');
  await importLibrary('places');

  return window.google;
};
/*
 * DISTANCE
 *
 * Temporary straight-line distance.
 * Road distance can be added later.
 */
const calculateDistanceKm = (
  pickup: Coordinates,
  destination: Coordinates
): number => {
  const toRadians = (value: number) =>
    (value * Math.PI) / 180;

  const R = 6371;

  const dLat = toRadians(
    destination.lat - pickup.lat
  );

  const dLng = toRadians(
    destination.lng - pickup.lng
  );

  const lat1 = toRadians(pickup.lat);
  const lat2 = toRadians(destination.lat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLng / 2) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return Number((R * c).toFixed(2));
};

export const BookingFormPage: React.FC<
  BookingFormPageProps
> = ({ navigate }) => {
  const { user } = useAuth();

  /*
   * URL PARAMS
   */
  const params = new URLSearchParams(
    window.location.search
  );

  const initialPickup =
    params.get('pickup') || '';

  const initialDest =
    params.get('dest') || '';

  const initialPassengers =
    Number(params.get('passengers')) || 1;

  /*
   * LOCATION STATE
   */
  const [fromLocation, setFromLocation] =
    useState(initialPickup);

  const [toLocation, setToLocation] =
    useState(initialDest);

  const [pickupCoordinates, setPickupCoordinates] =
    useState<Coordinates | null>(null);

  const [
    destinationCoordinates,
    setDestinationCoordinates,
  ] = useState<Coordinates | null>(null);

  /*
   * MAP STATE
   */
  const [mapCenter, setMapCenter] =
    useState<Coordinates>(defaultCenter);

  const [mapMode, setMapMode] =
    useState<'pickup' | 'destination'>(
      'pickup'
    );

  const [
    isGettingLocation,
    setIsGettingLocation,
  ] = useState(false);

  const [isMapLoading, setIsMapLoading] =
    useState(true);

  const [mapError, setMapError] =
    useState<string | null>(null);

  /*
   * SEARCH
   */
  const [
    pickupSuggestions,
    setPickupSuggestions,
  ] = useState<SearchResult[]>([]);

  const [
    destinationSuggestions,
    setDestinationSuggestions,
  ] = useState<SearchResult[]>([]);

  const [
    isSearchingPickup,
    setIsSearchingPickup,
  ] = useState(false);

  const [
    isSearchingDestination,
    setIsSearchingDestination,
  ] = useState(false);

  /*
   * ROUTE
   */
  const [routeDistance, setRouteDistance] =
    useState<number | null>(null);

  /*
   * TIME
   */
  const [timeMode, setTimeMode] =
    useState<'now' | 'schedule'>('now');

  const [scheduledDate, setScheduledDate] =
    useState(() => {
      const today = new Date();

      return today
        .toISOString()
        .split('T')[0];
    });

  const [scheduledTime, setScheduledTime] =
    useState(() => {
      const now = new Date();

      now.setMinutes(
        now.getMinutes() + 30
      );

      return now
        .toTimeString()
        .slice(0, 5);
    });

  /*
   * PASSENGERS
   */
  const [passengers, setPassengers] =
    useState(initialPassengers);

  /*
   * FARE / BOOKING
   */
  const [isCalculating, setIsCalculating] =
    useState(false);

  const [isBooking, setIsBooking] =
    useState(false);

  const [fareEstimate, setFareEstimate] =
    useState<FareEstimate | null>(null);

  const [routeError, setRouteError] =
    useState<string | null>(null);

  const [successBooking, setSuccessBooking] =
    useState<any | null>(null);

  /*
   * GOOGLE MAP REFS
   */
  const mapElementRef =
    useRef<HTMLDivElement | null>(null);

  const mapRef = useRef<any>(null);

  const pickupMarkerRef =
    useRef<any>(null);

  const destinationMarkerRef =
    useRef<any>(null);

  const geocoderRef =
    useRef<any>(null);
  const placesAutocompleteRef =
    useRef<any>(null);

  /*
   * INITIALIZE GOOGLE MAP
   */
  useEffect(() => {
    let cancelled = false;

    const initializeMap = async () => {
      if (!mapElementRef.current) {
        return;
      }

      if (!GOOGLE_MAPS_API_KEY) {
        setMapError(
          'Google Maps API key is missing. Add VITE_GOOGLE_MAPS_API_KEY to your client .env file.'
        );
        setIsMapLoading(false);
        return;
      }

      try {
        const google = await loadGoogleMaps();

        if (cancelled) {
          return;
        }

        const map = new google.maps.Map(
          mapElementRef.current,
          {
            center: {
              lat: defaultCenter.lat,
              lng: defaultCenter.lng,
            },
            zoom: 14,
            streetViewControl: false,
            fullscreenControl: false,
            mapTypeControl: false,
            clickableIcons: true,
            gestureHandling: 'greedy',
          }
        );

        mapRef.current = map;

        geocoderRef.current =
          new google.maps.Geocoder();

        /*
         * MAP CLICK
         */
        map.addListener(
  'click',
  async (event: any) => {
    if (!event.latLng) {
      return;
    }

    const coordinates = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng(),
    };

    if (mapMode === 'destination') {
      await setDestinationFromCoordinates(coordinates);
    } else {
      await setPickupFromCoordinates(coordinates);
    }
  }
);

        setIsMapLoading(false);
      } catch (error) {
        console.error(
          'Google Maps loading error:',
          error
        );

        setMapError(
          'Google Maps could not be loaded. Check your Google Maps API key and Google Cloud billing/API settings.'
        );

        setIsMapLoading(false);
      }
    };

    initializeMap();

    return () => {
      cancelled = true;

      if (
        pickupMarkerRef.current
      ) {
        pickupMarkerRef.current.setMap(
          null
        );
      }

      if (
        destinationMarkerRef.current
      ) {
        destinationMarkerRef.current.setMap(
          null
        );
      }

      mapRef.current = null;
      geocoderRef.current = null;
    };
  }, []);

  /*
   * UPDATE MAP CENTER
   */
  useEffect(() => {
    if (
      mapRef.current &&
      mapCenter
    ) {
      mapRef.current.panTo({
        lat: mapCenter.lat,
        lng: mapCenter.lng,
      });
    }
  }, [mapCenter]);

  /*
   * PICKUP MARKER
   */
  useEffect(() => {
    if (
      !mapRef.current ||
      !pickupCoordinates
    ) {
      return;
    }

    const google =
      (window as any).google;

    if (
      !google ||
      !google.maps
    ) {
      return;
    }

    if (
      pickupMarkerRef.current
    ) {
      pickupMarkerRef.current.setPosition(
        pickupCoordinates
      );
      pickupMarkerRef.current.setMap(
        mapRef.current
      );
    } else {
      pickupMarkerRef.current =
        new google.maps.Marker({
          map: mapRef.current,
          position: pickupCoordinates,
          draggable: true,
          title: 'Pickup location',
          label: {
            text: 'P',
            color: '#ffffff',
            fontWeight: '800',
          },
          icon: {
            path: google.maps.SymbolPath
              .CIRCLE,
            scale: 15,
            fillColor: '#10b981',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 4,
          },
        });

      pickupMarkerRef.current.addListener(
        'dragend',
        async (event: any) => {
          if (
            !event.latLng
          ) {
            return;
          }

          const coordinates = {
            lat: event.latLng.lat(),
            lng: event.latLng.lng(),
          };

          await setPickupFromCoordinates(
            coordinates
          );
        }
      );
    }
  }, [pickupCoordinates]);

  /*
   * DESTINATION MARKER
   */
  useEffect(() => {
    if (
      !mapRef.current ||
      !destinationCoordinates
    ) {
      return;
    }

    const google =
      (window as any).google;

    if (
      !google ||
      !google.maps
    ) {
      return;
    }

    if (
      destinationMarkerRef.current
    ) {
      destinationMarkerRef.current.setPosition(
        destinationCoordinates
      );

      destinationMarkerRef.current.setMap(
        mapRef.current
      );
    } else {
      destinationMarkerRef.current =
        new google.maps.Marker({
          map: mapRef.current,
          position:
            destinationCoordinates,
          draggable: true,
          title: 'Destination',
          label: {
            text: 'D',
            color: '#ffffff',
            fontWeight: '800',
          },
          icon: {
            path: google.maps.SymbolPath
              .CIRCLE,
            scale: 15,
            fillColor: '#f43f5e',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 4,
          },
        });

      destinationMarkerRef.current.addListener(
        'dragend',
        async (event: any) => {
          if (
            !event.latLng
          ) {
            return;
          }

          const coordinates = {
            lat: event.latLng.lat(),
            lng: event.latLng.lng(),
          };

          await setDestinationFromCoordinates(
            coordinates
          );
        }
      );
    }
  }, [destinationCoordinates]);

  /*
   * PICKUP LOCATION
   */
  const setPickupFromCoordinates =
    async (
      coordinates: Coordinates
    ) => {
      setPickupCoordinates(
        coordinates
      );

      setMapCenter(coordinates);
      setFareEstimate(null);
      setRouteError(null);

      if (
        !geocoderRef.current
      ) {
        setFromLocation(
          `${coordinates.lat.toFixed(
            6
          )}, ${coordinates.lng.toFixed(6)}`
        );

        return;
      }

      try {
        const result =
          await geocoderRef.current.geocode(
            {
              location: coordinates,
            }
          );

        if (
          result.results &&
          result.results[0]
        ) {
          setFromLocation(
            result.results[0]
              .formatted_address
          );
        } else {
          setFromLocation(
            `${coordinates.lat.toFixed(
              6
            )}, ${coordinates.lng.toFixed(6)}`
          );
        }
      } catch (error) {
        console.error(
          'Pickup geocoding error:',
          error
        );

        setFromLocation(
          `${coordinates.lat.toFixed(
            6
          )}, ${coordinates.lng.toFixed(6)}`
        );
      }
    };

  /*
   * DESTINATION LOCATION
   */
  const setDestinationFromCoordinates =
    async (
      coordinates: Coordinates
    ) => {
      setDestinationCoordinates(
        coordinates
      );

      setMapCenter(coordinates);
      setFareEstimate(null);
      setRouteError(null);

      if (
        !geocoderRef.current
      ) {
        setToLocation(
          `${coordinates.lat.toFixed(
            6
          )}, ${coordinates.lng.toFixed(6)}`
        );

        return;
      }

      try {
        const result =
          await geocoderRef.current.geocode(
            {
              location: coordinates,
            }
          );

        if (
          result.results &&
          result.results[0]
        ) {
          setToLocation(
            result.results[0]
              .formatted_address
          );
        } else {
          setToLocation(
            `${coordinates.lat.toFixed(
              6
            )}, ${coordinates.lng.toFixed(6)}`
          );
        }
      } catch (error) {
        console.error(
          'Destination geocoding error:',
          error
        );

        setToLocation(
          `${coordinates.lat.toFixed(
            6
          )}, ${coordinates.lng.toFixed(6)}`
        );
      }
    };

  /*
   * GOOGLE LOCATION SEARCH
   */
  const searchGoogleLocation = async (query: string): Promise<SearchResult[]> => {
  if (!query.trim()) return [];

  try {
    const google = await loadGoogleMaps();

    const placesLibrary =
      await importLibrary('places') as google.maps.PlacesLibrary;

    const { suggestions } =
      await placesLibrary.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: query,
        includedRegionCodes: ['in'],
        language: 'en',
      });

    return (suggestions || [])
      .slice(0, 5)
      .map((suggestion: any) => {
        const prediction = suggestion.placePrediction;

        return {
          display_name:
            prediction?.text?.toString() ||
            prediction?.mainText?.toString() ||
            query,
          lat: '',
          lon: '',
          placeId: prediction?.placeId || '',
        };
      });
  } catch (error) {
    console.error('Google Places search error:', error);
    return [];
  }
};

  /*
   * CURRENT GPS LOCATION
   */
  const handleUseCurrentLocation =
    () => {
      if (!navigator.geolocation) {
        setRouteError(
          'Location services are not supported on this device.'
        );

        return;
      }

      setIsGettingLocation(true);
      setRouteError(null);
      setMapMode('pickup');

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coordinates = {
            lat:
              position.coords.latitude,
            lng:
              position.coords.longitude,
          };

          console.log(
            'GPS coordinates:',
            coordinates
          );

          console.log(
            'GPS Accuracy:',
            position.coords.accuracy,
            'meters'
          );

          try {
  await setPickupFromCoordinates(coordinates);
} catch (error) {
  console.error('Pickup location update error:', error);
} finally {
  setIsGettingLocation(false);
}
        },
        (error) => {
          console.error(
            'Geolocation error:',
            error
          );

          setIsGettingLocation(false);

          setRouteError(
            'Unable to get your current location. Please allow location permission and try again.'
          );
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    };

  /*
   * PICKUP SEARCH
   */
  const handlePickupSearch = (value: string) => {
  setFromLocation(value);
  setPickupCoordinates(null);
  setFareEstimate(null);
  setRouteError(null);

  if (value.trim().length < 3) {
    setPickupSuggestions([]);
    return;
  }

  setMapMode('pickup');
  setIsSearchingPickup(true);

  setTimeout(async () => {
    const results = await searchGoogleLocation(value);
    setPickupSuggestions(results);
    setIsSearchingPickup(false);
  }, 500);
};

  /*
   * DESTINATION SEARCH
   */
  const handleDestinationSearch = (value: string) => {
  setToLocation(value);
  setDestinationCoordinates(null);
  setFareEstimate(null);
  setRouteError(null);

  if (value.trim().length < 3) {
    setDestinationSuggestions([]);
    return;
  }

  setMapMode('destination');
  setIsSearchingDestination(true);

  setTimeout(async () => {
    const results = await searchGoogleLocation(value);
    setDestinationSuggestions(results);
    setIsSearchingDestination(false);
  }, 500);
};
  /*
   * SELECT PICKUP SEARCH RESULT
   */
  const selectPickupSuggestion = async (
  result: SearchResult
) => {
  setPickupSuggestions([]);

  try {
    const placesLibrary =
      await importLibrary('places') as google.maps.PlacesLibrary;

    const place = new placesLibrary.Place({
      id: result.placeId,
    });

    await place.fetchFields({
      fields: [
        'displayName',
        'formattedAddress',
        'location',
      ],
    });

    if (!place.location) {
      setMapError(
        'Could not get the selected pickup location.'
      );
      return;
    }

    const coordinates = {
      lat: place.location.lat(),
      lng: place.location.lng(),
    };

    console.log(
      'PICKUP SELECTED GPS:',
      coordinates
    );

    await setPickupFromCoordinates(
      coordinates
    );
  } catch (error) {
    console.error(
      'Pickup place selection error:',
      error
    );

    setMapError(
      'Could not select this pickup location.'
    );
  }
};
  /*
   * SELECT DESTINATION SEARCH RESULT
   */
  const selectDestinationSuggestion = async (result: SearchResult) => {
  setDestinationSuggestions([]);

  try {
    const google = await loadGoogleMaps();

    const placesLibrary =
      await importLibrary('places') as google.maps.PlacesLibrary;

    const place = new placesLibrary.Place({
      id: result.placeId,
    });

    await place.fetchFields({
      fields: ['displayName', 'formattedAddress', 'location'],
    });

    if (!place.location) {
      setMapError('Could not get the selected location.');
      return;
    }

    const coordinates = {
      lat: place.location.lat(),
      lng: place.location.lng(),
    };

    await setDestinationFromCoordinates(coordinates);
  } catch (error) {
    console.error('Place selection error:', error);
    setMapError('Could not select this destination.');
  }
};
  /*
   * INITIAL URL LOCATIONS
   */
  useEffect(() => {
    const loadInitialLocations =
      async () => {
        if (
          initialPickup &&
          geocoderRef.current
        ) {
          const results =
            await searchGoogleLocation(
              initialPickup
            );

          if (results[0]) {
            await selectPickupSuggestion(
              results[0]
            );
          }
        }

        if (
          initialDest &&
          geocoderRef.current
        ) {
          const results =
            await searchGoogleLocation(
              initialDest
            );

          if (results[0]) {
            await selectDestinationSuggestion(
              results[0]
            );
          }
        }
      };

    if (
      initialPickup ||
      initialDest
    ) {
      const timer =
        window.setTimeout(
          loadInitialLocations,
          1200
        );

      return () =>
        window.clearTimeout(timer);
    }
  }, []);

  /*
   * UPDATE DISTANCE
   */
  useEffect(() => {
    if (
      !pickupCoordinates ||
      !destinationCoordinates
    ) {
      setRouteDistance(null);
      return;
    }

    const distance =
      calculateDistanceKm(
        pickupCoordinates,
        destinationCoordinates
      );

    setRouteDistance(distance);
  }, [
    pickupCoordinates,
    destinationCoordinates,
  ]);

  /*
   * GET FARE
   */
  const handleGetFare = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setRouteError(null);
    setFareEstimate(null);

    if (!fromLocation) {
      setRouteError(
        'Please select a pickup location.'
      );

      return;
    }

    if (!toLocation) {
      setRouteError(
        'Please select a destination.'
      );

      return;
    }

    if (
      fromLocation === toLocation
    ) {
      setRouteError(
        'Pickup and destination cannot be the same location.'
      );

      return;
    }

    if (
      !pickupCoordinates ||
      !destinationCoordinates
    ) {
      setRouteError(
        'Please select both pickup and destination locations on the map.'
      );

      return;
    }

    if (
      timeMode === 'schedule'
    ) {
      const selectedDatetime =
        new Date(
          `${scheduledDate}T${scheduledTime}`
        );

      if (
        selectedDatetime.getTime() <
        Date.now()
      ) {
        setRouteError(
          'Scheduled pickup time cannot be in the past.'
        );

        return;
      }
    }

    setIsCalculating(true);

    const res =
  await api.bookings.getFareEstimate({
    fromLocation,
    toLocation,
    passengers,
    pickupLatitude: pickupCoordinates?.lat,
    pickupLongitude: pickupCoordinates?.lng,
    destinationLatitude: destinationCoordinates?.lat,
    destinationLongitude: destinationCoordinates?.lng,
  });

    setIsCalculating(false);
    console.log('FARE API RESPONSE:', res);

    if (
      res.success &&
      res.data &&
      res.data.available
    ) {
      setFareEstimate(res.data);
    } else {
        console.log('FARE ERROR:', res.error);
      setRouteError(
        res.error ||
          'Sorry, this route is currently unavailable.'
      );
    }
  };

  /*
   * BOOK AUTO
   */
  const handleBookAuto = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (
      !fareEstimate ||
      !fareEstimate.available
    ) {
      setRouteError(
        'Please check fare first before booking.'
      );

      return;
    }

    if (
      !pickupCoordinates ||
      !destinationCoordinates
    ) {
      setRouteError(
        'Please select valid pickup and destination locations.'
      );

      return;
    }

    setRouteError(null);
    setIsBooking(true);

    let pickupDatetimeISO: string;

    if (timeMode === 'now') {
      pickupDatetimeISO =
        new Date().toISOString();
    } else {
      const scheduledDt =
        new Date(
          `${scheduledDate}T${scheduledTime}`
        );

      if (
        scheduledDt.getTime() <
        Date.now()
      ) {
        setRouteError(
          'Cannot select a pickup time in the past.'
        );

        setIsBooking(false);
        return;
      }

      pickupDatetimeISO =
        scheduledDt.toISOString();
    }

    const res = await api.bookings.create({
  pickupAddress: fromLocation,
  destinationAddress: toLocation,
  pickupDateTime: pickupDatetimeISO,
  passengers,
  pickupLatitude: pickupCoordinates.lat,
  pickupLongitude: pickupCoordinates.lng,
  destinationLatitude: destinationCoordinates.lat,
  destinationLongitude: destinationCoordinates.lng,
});

    setIsBooking(false);

    if (
      res.success &&
      res.data
    ) {
      setSuccessBooking(
        res.data
      );
    } else {
      setRouteError(
        res.error ||
          'Failed to book auto.'
      );
    }
  };

  /*
   * SUCCESS SCREEN
   */
  if (successBooking) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-2xl border border-slate-100 text-center space-y-6">

          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl">
            🛺
          </div>

          <div>
            <span className="inline-block px-3.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold uppercase mb-2">
              Confirmation
            </span>

            <h2 className="text-3xl font-black text-slate-900">
              Auto Booked Successfully!
            </h2>

            <p className="text-xs text-slate-500 mt-1">
              Your request has been broadcasted to nearby verified drivers.
            </p>
          </div>

          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200/80 text-left space-y-3.5 text-xs">

            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <span className="font-bold text-slate-500 uppercase">
                Booking ID:
              </span>

              <span className="font-black text-slate-900 text-sm tracking-wider font-mono">
                {successBooking.booking_reference}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500">
                Customer:
              </span>

              <span className="font-bold text-slate-800 text-right">
                {user?.name}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500">
                Pickup:
              </span>

              <span className="font-bold text-slate-800 text-right">
                {successBooking.pickup_address}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500">
                Destination:
              </span>

              <span className="font-bold text-slate-800 text-right">
                {successBooking.destination_address}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-500">
                Pickup Date & Time:
              </span>

              <span className="font-bold text-slate-800 text-right">
                {new Date(
                  successBooking.pickup_datetime
                ).toLocaleString()}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">
                Passenger Count:
              </span>

              <span className="font-bold text-slate-800">
                {successBooking.passengers}{' '}
                Passenger(s)
              </span>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200 text-sm">
              <span className="font-bold text-slate-700">
                Estimated Fare:
              </span>

              <span className="font-black text-amber-600 text-base">
                ₹
                {
                  successBooking.estimated_fare
                }
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">
                Booking Status:
              </span>

              <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-bold text-[11px]">
                {successBooking.status}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">

            <button
              type="button"
              onClick={() =>
                navigate(
                  `/booking/${successBooking.id}`
                )
              }
              className="flex-1 py-3.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-sm rounded-xl shadow-md transition-transform flex items-center justify-center gap-2"
            >
              View My Booking
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() =>
                navigate('/my-rides')
              }
              className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm rounded-xl transition-colors"
            >
              All Rides
            </button>

          </div>
        </div>
      </div>
    );
  }

  /*
   * MAIN PAGE
   */
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* HEADER */}
      <div className="mb-7">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold uppercase mb-2">
          <Car className="w-3.5 h-3.5 text-amber-600" />
          <span>Book an Auto</span>
        </div>

        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
          Where do you want to go?
        </h1>

        <p className="text-sm text-slate-500 mt-2">
          Choose your exact pickup and destination location.
        </p>
      </div>

      {/* MAIN CARD */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">

        {/* GOOGLE MAP */}
        <div className="relative">

          <div
            ref={mapElementRef}
            className="w-full h-[320px] sm:h-[380px] md:h-[420px]"
          />

          {isMapLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10">
              <div className="bg-white rounded-xl shadow-lg px-5 py-3 text-xs font-bold text-slate-700">
                Loading Google Maps...
              </div>
            </div>
          )}

          {mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-20 p-6">
              <div className="max-w-md bg-white rounded-2xl shadow-xl border border-rose-200 p-5 text-center">
                <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-3" />

                <p className="text-sm font-bold text-slate-800">
                  Google Maps unavailable
                </p>

                <p className="text-xs text-slate-500 mt-2">
                  {mapError}
                </p>
              </div>
            </div>
          )}

          {/* MAP MODE */}
          <div className="absolute left-4 top-4 z-[1000] bg-white rounded-xl shadow-lg border border-slate-200 p-1.5 flex gap-1">

            <button
              type="button"
              onClick={() =>
                setMapMode('pickup')
              }
              className={`px-3 py-2 rounded-lg text-xs font-bold ${
                mapMode === 'pickup'
                  ? 'bg-emerald-500 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Set Pickup
            </button>

            <button
              type="button"
              onClick={() =>
                setMapMode(
                  'destination'
                )
              }
              className={`px-3 py-2 rounded-lg text-xs font-bold ${
                mapMode ===
                'destination'
                  ? 'bg-rose-500 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Set Destination
            </button>

          </div>

          {/* CURRENT LOCATION */}
          <button
            type="button"
            onClick={
              handleUseCurrentLocation
            }
            disabled={
              isGettingLocation
            }
            className="absolute right-4 bottom-4 z-[1000] bg-white hover:bg-slate-50 text-slate-800 px-4 py-2.5 rounded-xl shadow-lg border border-slate-200 text-xs font-bold flex items-center gap-2 disabled:opacity-50"
          >
            <LocateFixed className="w-4 h-4 text-amber-600" />

            {isGettingLocation
              ? 'Getting location...'
              : 'Use my current location'}
          </button>

          {/* MAP HELP */}
          <div className="absolute left-4 bottom-4 z-[1000] bg-white/95 backdrop-blur-sm rounded-lg shadow-md border border-slate-200 px-3 py-2 text-[10px] font-semibold text-slate-600">
            Tap map or drag P / D pin
          </div>

        </div>

        {/* FORM */}
        <div className="p-5 sm:p-7 md:p-8">

          <form
            onSubmit={handleGetFare}
            className="space-y-6"
          >

            {/* PICKUP */}
            <div className="relative">

              <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  Pickup Location
                </span>
              </label>

              <div className="relative">

                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />

                <input
                  type="text"
                  value={fromLocation}
                  onFocus={() =>
                    setMapMode(
                      'pickup'
                    )
                  }
                  onChange={(e) =>
                    handlePickupSearch(
                      e.target.value
                    )
                  }
                  placeholder="Search your pickup location"
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 text-sm font-semibold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  required
                />

              </div>

              {pickupSuggestions.length >
                0 && (
                <div className="absolute z-[1100] left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">

                  {pickupSuggestions.map(
                    (
                      suggestion,
                      index
                    ) => (
                      <button
                        key={`${suggestion.lat}-${suggestion.lon}-${index}`}
                        type="button"
                        onClick={() =>
                          selectPickupSuggestion(
                            suggestion
                          )
                        }
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b last:border-b-0 border-slate-100 text-xs font-semibold text-slate-700"
                      >
                        {suggestion.display_name}
                      </button>
                    )
                  )}

                </div>
              )}

              {isSearchingPickup && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Searching Google Maps...
                </p>
              )}

              <p className="text-[11px] text-slate-400 mt-1.5">
                Use current location, search your address, or tap the map.
              </p>

            </div>

            {/* DESTINATION */}
            <div className="relative">

              <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                <span className="flex items-center gap-1.5">
                  <Navigation className="w-4 h-4 text-rose-500" />
                  Destination
                </span>
              </label>

              <div className="relative">

                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />

                <input
                  type="text"
                  value={toLocation}
                  onFocus={() =>
                    setMapMode(
                      'destination'
                    )
                  }
                  onChange={(e) =>
                    handleDestinationSearch(
                      e.target.value
                    )
                  }
                  placeholder="Search your destination"
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 text-sm font-semibold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  required
                />

              </div>

              {destinationSuggestions.length >
                0 && (
                <div className="absolute z-[1100] left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">

                  {destinationSuggestions.map(
                    (
                      suggestion,
                      index
                    ) => (
                      <button
                        key={`${suggestion.lat}-${suggestion.lon}-${index}`}
                        type="button"
                        onClick={() =>
                          selectDestinationSuggestion(
                            suggestion
                          )
                        }
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b last:border-b-0 border-slate-100 text-xs font-semibold text-slate-700"
                      >
                        {suggestion.display_name}
                      </button>
                    )
                  )}

                </div>
              )}

              {isSearchingDestination && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Searching Google Maps...
                </p>
              )}

              <p className="text-[11px] text-slate-400 mt-1.5">
                Search any place in your town or nearby area.
              </p>

            </div>

            {/* DISTANCE */}
            {routeDistance !==
              null && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">

                <div className="flex items-center justify-between">

                  <span className="text-xs font-bold text-emerald-800 uppercase">
                    Approx. Distance
                  </span>

                  <span className="text-lg font-black text-emerald-900">
                    {routeDistance} km
                  </span>

                </div>

                <p className="text-[10px] text-emerald-700 mt-1">
                  Temporary straight-line distance. Road distance will be added later.
                </p>

              </div>
            )}

            {/* PICKUP TIME */}
            <div>

              <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                  Pickup Option
                </span>
              </label>

              <div className="grid grid-cols-2 gap-3">

                <button
                  type="button"
                  onClick={() =>
                    setTimeMode('now')
                  }
                  className={`py-3 px-4 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                    timeMode === 'now'
                      ? 'bg-amber-400 text-slate-950 border-amber-400'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Ride Now
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setTimeMode(
                      'schedule'
                    )
                  }
                  className={`py-3 px-4 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                    timeMode ===
                    'schedule'
                      ? 'bg-amber-400 text-slate-950 border-amber-400'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Schedule Ride
                </button>

              </div>

              {timeMode ===
                'schedule' && (
                <div className="mt-3 p-4 bg-amber-50 rounded-2xl border border-amber-200 grid grid-cols-2 gap-3">

                  <div>

                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                      Date
                    </label>

                    <input
                      type="date"
                      value={
                        scheduledDate
                      }
                      min={
                        new Date()
                          .toISOString()
                          .split('T')[0]
                      }
                      onChange={(e) =>
                        setScheduledDate(
                          e.target.value
                        )
                      }
                      className="w-full px-3 py-2 rounded-lg border border-amber-300 text-xs font-semibold bg-white"
                      required
                    />

                  </div>

                  <div>

                    <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                      Time
                    </label>

                    <input
                      type="time"
                      value={
                        scheduledTime
                      }
                      onChange={(e) =>
                        setScheduledTime(
                          e.target.value
                        )
                      }
                      className="w-full px-3 py-2 rounded-lg border border-amber-300 text-xs font-semibold bg-white"
                      required
                    />

                  </div>

                </div>
              )}

            </div>

            {/* PASSENGERS */}
            <div>

              <label className="block text-xs font-bold text-slate-700 uppercase mb-2">

                <span className="flex items-center justify-between">

                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-indigo-600" />
                    Number of Passengers
                  </span>

                  <span className="text-[10px] text-slate-400 font-normal">
                    Max 4
                  </span>

                </span>

              </label>

              <div className="grid grid-cols-4 gap-2">

                {[1, 2, 3, 4].map(
                  (num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() =>
                        setPassengers(
                          num
                        )
                      }
                      className={`py-3 rounded-xl text-xs font-bold border transition-all ${
                        passengers ===
                        num
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {num}{' '}
                      {num === 1
                        ? 'Person'
                        : 'People'}
                    </button>
                  )
                )}

              </div>

            </div>

            {/* GET FARE */}
            <button
              type="submit"
              disabled={
                isCalculating
              }
              className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >

              {isCalculating ? (
                <span>
                  Checking Fare...
                </span>
              ) : (
                <>
                  <IndianRupee className="w-4 h-4 text-amber-400" />

                  <span>
                    GET FARE
                  </span>
                </>
              )}

            </button>

          </form>

          {/* ERROR */}
          {routeError && (
            <div className="mt-5 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold flex items-start gap-3">

              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />

              <span>
                {routeError}
              </span>

            </div>
          )}

          {/* FARE RESULT */}
          {fareEstimate &&
            fareEstimate.available && (
              <div className="mt-6 p-6 bg-amber-50 rounded-2xl border-2 border-amber-300 space-y-4">

                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-amber-200">

                  <div>

                    <span className="text-[10px] font-bold uppercase text-amber-800">
                      Estimated Fare
                    </span>

                    <div className="text-3xl font-black text-slate-900">
                      ₹
                      {
                        fareEstimate.estimatedFare
                      }
                    </div>

                  </div>

                  <div className="text-right max-w-xs">

                    <span className="text-xs font-bold text-slate-800">
                      {fromLocation}
                    </span>

                    <div className="text-xs text-slate-400">
                      ↓
                    </div>

                    <span className="text-xs font-bold text-slate-800">
                      {toLocation}
                    </span>

                    {routeDistance !==
                      null && (
                      <div className="text-[11px] text-slate-500 mt-1">
                        {routeDistance} km approx.
                      </div>
                    )}

                  </div>

                </div>

                <p className="text-xs text-slate-600">
                  Fare shown from the current Kk_Auto fare system.
                </p>

                <button
                  type="button"
                  onClick={
                    handleBookAuto
                  }
                  disabled={
                    isBooking
                  }
                  className="w-full py-4 bg-amber-400 hover:bg-amber-500 text-slate-950 font-extrabold text-base rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2.5 disabled:opacity-50"
                >

                  {isBooking ? (
                    <span>
                      Booking Auto...
                    </span>
                  ) : (
                    <>
                      <span>
                        Book Auto
                      </span>

                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}

                </button>

              </div>
            )}

          {/* INFO */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex items-start gap-2 text-xs text-slate-500">

            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />

            <span>
              Your pickup location uses your device GPS or map selection. You can drag the pickup pin to the exact street or house location.
            </span>

          </div>

        </div>
      </div>
    </div>
  );
};