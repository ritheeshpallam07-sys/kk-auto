import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, FareEstimate } from '../api/client';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import {
  MapPin,
  Clock,
  Calendar,
  Users,
  IndianRupee,
  AlertCircle,
  ArrowRight,
  ChevronLeft,
  Car,
  Navigation,
  Loader2,
  CheckCircle2,
  Sparkles,
  Search,
  Crosshair,
  RotateCcw,
  X,
  Compass
} from 'lucide-react';

interface BookingFormPageProps {
  navigate: (path: string) => void;
}

interface Coordinates {
  lat: number;
  lng: number;
}

// Fallback coordinates for known service landmarks in the local service area
export const LOCATION_COORDINATES: Record<string, Coordinates> = {
  'JNTUA': { lat: 13.6508, lng: 78.7860 },
  'Cross': { lat: 13.6525, lng: 78.8035 },
  'Bus Stand': { lat: 13.6455, lng: 78.8035 },
  'Marava': { lat: 13.6408, lng: 78.8010 },
  'Indiramma Colony': { lat: 13.6550, lng: 78.7960 },
  'Cross Road': { lat: 13.6525, lng: 78.8035 },
  'Railway Station': { lat: 13.6420, lng: 78.8080 },
  'Main Bazaar': { lat: 13.6475, lng: 78.8020 }
};

const DEFAULT_MAP_CENTER: Coordinates = {
  lat: 13.6480,
  lng: 78.7950,
};

const POPULAR_SUGGESTIONS = [
  'JNTUA',
  'Cross',
  'Bus Stand',
  'Marava',
  'Indiramma Colony',
  'Railway Station',
  'Main Bazaar'
];

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export const BookingFormPage: React.FC<BookingFormPageProps> = ({ navigate }) => {
  const { user } = useAuth();

  // Read optional URL parameters
  const params = new URLSearchParams(window.location.search);
  const initialPickup = params.get('pickup') || '';
  const initialDest = params.get('dest') || '';
  const initialPassengers = Number(params.get('passengers')) || 1;

  // Search input and location state (Google Maps based, not restricted to fixed routes)
  const [fromLocation, setFromLocation] = useState(initialPickup);
  const [toLocation, setToLocation] = useState(initialDest);
  const [pickupCoords, setPickupCoords] = useState<Coordinates | null>(() => {
    return initialPickup && LOCATION_COORDINATES[initialPickup]
      ? LOCATION_COORDINATES[initialPickup]
      : null;
  });
  const [destCoords, setDestCoords] = useState<Coordinates | null>(() => {
    return initialDest && LOCATION_COORDINATES[initialDest]
      ? LOCATION_COORDINATES[initialDest]
      : null;
  });

  const [passengers, setPassengers] = useState(initialPassengers);

  // Time options
  const [timeMode, setTimeMode] = useState<'now' | 'schedule'>('now');
  const [scheduledDate, setScheduledDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [scheduledTime, setScheduledTime] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 15);
    return d.toTimeString().slice(0, 5);
  });

  // Fare, route and booking state
  const [fareEstimate, setFareEstimate] = useState<FareEstimate | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{
    distanceText: string;
    durationText: string;
    distanceKm: number;
  } | null>(null);

  // Google Maps state
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const pickupMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const directionsRendererRef = useRef<any>(null);
  const pickupInputRef = useRef<HTMLInputElement | null>(null);
  const destInputRef = useRef<HTMLInputElement | null>(null);
  const pickupAutocompleteRef = useRef<any>(null);
  const destAutocompleteRef = useRef<any>(null);

  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [activePinMode, setActivePinMode] = useState<'pickup' | 'destination' | null>(null);

  // Helper: resolve coordinates from text
  const resolveCoordinates = (name: string): Coordinates | null => {
    const clean = name.trim();
    if (LOCATION_COORDINATES[clean]) return LOCATION_COORDINATES[clean];
    const match = Object.keys(LOCATION_COORDINATES).find(
      k => k.toLowerCase() === clean.toLowerCase()
    );
    if (match) return LOCATION_COORDINATES[match];
    return null;
  };

  // 1. Initialize Google Maps with Places Library
  useEffect(() => {
    let isCancelled = false;

    async function initGoogleMaps() {
      if (!mapContainerRef.current) return;
      if (!GOOGLE_MAPS_API_KEY) {
        setMapsError('Google Maps API key not configured.');
        return;
      }

      try {
        if (!window.google?.maps?.importLibrary) {
          setOptions({
            key: GOOGLE_MAPS_API_KEY,
            v: 'weekly',
          });
        }

        const { Map } = (await importLibrary('maps')) as any;
        try {
          await importLibrary('places');
        } catch (e) {
          console.warn('Google Places library warning:', e);
        }
        try {
          await importLibrary('geometry');
        } catch (e) {
          console.warn('Google Geometry library warning:', e);
        }

        const google = window.google;
        if (isCancelled || !mapContainerRef.current || !google) return;

        // Custom Dark Navy Map Style matching Clik2Go theme
        const darkNavyStyle = [
          { elementType: 'geometry', stylers: [{ color: '#091524' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#091524' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#8fa4be' }] },
          {
            featureType: 'administrative.locality',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#ff9d2e' }],
          },
          {
            featureType: 'poi',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#6882a1' }],
          },
          {
            featureType: 'poi.park',
            elementType: 'geometry',
            stylers: [{ color: '#0d2238' }],
          },
          {
            featureType: 'road',
            elementType: 'geometry',
            stylers: [{ color: '#1a3350' }],
          },
          {
            featureType: 'road',
            elementType: 'geometry.stroke',
            stylers: [{ color: '#13283f' }],
          },
          {
            featureType: 'road.highway',
            elementType: 'geometry',
            stylers: [{ color: '#274b73' }],
          },
          {
            featureType: 'road.highway',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#ffffff' }],
          },
          {
            featureType: 'transit',
            elementType: 'geometry',
            stylers: [{ color: '#14293f' }],
          },
          {
            featureType: 'water',
            elementType: 'geometry',
            stylers: [{ color: '#050d18' }],
          },
        ];

        const map = new google.maps.Map(mapContainerRef.current, {
          center: pickupCoords || DEFAULT_MAP_CENTER,
          zoom: 14,
          styles: darkNavyStyle,
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });

        mapInstanceRef.current = map;
        setMapsLoaded(true);
        setMapsError(null);

        // Click map to set pin
        map.addListener('click', (e: any) => {
          if (!e.latLng) return;
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          handleMapPinClick(lat, lng, google);
        });

        // Setup Places Autocomplete on Pickup Input
        if (pickupInputRef.current && google.maps.places?.Autocomplete) {
          const autoPickup = new google.maps.places.Autocomplete(pickupInputRef.current, {
            fields: ['formatted_address', 'geometry', 'name'],
          });
          autoPickup.bindTo('bounds', map);
          autoPickup.addListener('place_changed', () => {
            const place = autoPickup.getPlace();
            if (place.geometry?.location) {
              const lat = place.geometry.location.lat();
              const lng = place.geometry.location.lng();
              const addr = place.formatted_address || place.name || '';
              setFromLocation(addr);
              setPickupCoords({ lat, lng });
              map.panTo({ lat, lng });
            } else if (pickupInputRef.current?.value) {
              const typed = pickupInputRef.current.value;
              setFromLocation(typed);
              const known = resolveCoordinates(typed);
              if (known) setPickupCoords(known);
            }
          });
          pickupAutocompleteRef.current = autoPickup;
        }

        // Setup Places Autocomplete on Destination Input
        if (destInputRef.current && google.maps.places?.Autocomplete) {
          const autoDest = new google.maps.places.Autocomplete(destInputRef.current, {
            fields: ['formatted_address', 'geometry', 'name'],
          });
          autoDest.bindTo('bounds', map);
          autoDest.addListener('place_changed', () => {
            const place = autoDest.getPlace();
            if (place.geometry?.location) {
              const lat = place.geometry.location.lat();
              const lng = place.geometry.location.lng();
              const addr = place.formatted_address || place.name || '';
              setToLocation(addr);
              setDestCoords({ lat, lng });
              map.panTo({ lat, lng });
            } else if (destInputRef.current?.value) {
              const typed = destInputRef.current.value;
              setToLocation(typed);
              const known = resolveCoordinates(typed);
              if (known) setDestCoords(known);
            }
          });
          destAutocompleteRef.current = autoDest;
        }
      } catch (err: any) {
        console.warn('Google Maps initialization error:', err);
        setMapsError('Could not load Google Maps. You can still enter addresses manually.');
      }
    }

    initGoogleMaps();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Handle map click for setting pins
  const handleMapPinClick = (lat: number, lng: number, googleInstance?: any) => {
    const google = googleInstance || (window as any).google;
    const target = activePinMode || (!fromLocation ? 'pickup' : 'destination');

    const updateTarget = (address: string) => {
      if (target === 'pickup') {
        setFromLocation(address);
        setPickupCoords({ lat, lng });
      } else {
        setToLocation(address);
        setDestCoords({ lat, lng });
      }
      setActivePinMode(null);
    };

    if (google?.maps?.Geocoder) {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
        if (status === 'OK' && results && results[0]) {
          updateTarget(results[0].formatted_address);
        } else {
          updateTarget(`Pinned Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        }
      });
    } else {
      updateTarget(`Pinned Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
    }
  };

  // Use current GPS location
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setRouteError('Geolocation is not supported by your browser.');
      return;
    }
    setRouteError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setPickupCoords({ lat, lng });
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo({ lat, lng });
          mapInstanceRef.current.setZoom(15);
        }

        const google = (window as any).google;
        if (google?.maps?.Geocoder) {
          const geocoder = new google.maps.Geocoder();
          geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
            if (status === 'OK' && results && results[0]) {
              setFromLocation(results[0].formatted_address);
            } else {
              setFromLocation(`Current Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
            }
          });
        } else {
          setFromLocation(`Current Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        }
      },
      (err) => {
        setRouteError('Could not obtain current location: ' + err.message);
      }
    );
  };

  // 2. Update Map Markers & Route Path
  useEffect(() => {
    if (!mapsLoaded || !mapInstanceRef.current || !(window as any).google) return;

    const map = mapInstanceRef.current;
    const google = (window as any).google;

    // Clear previous markers
    if (pickupMarkerRef.current) pickupMarkerRef.current.setMap(null);
    if (destMarkerRef.current) destMarkerRef.current.setMap(null);
    if (directionsRendererRef.current) directionsRendererRef.current.setMap(null);

    // Pickup Marker (Vibrant Orange)
    if (pickupCoords) {
      pickupMarkerRef.current = new google.maps.Marker({
        position: pickupCoords,
        map,
        title: `Pickup: ${fromLocation || 'Pickup'}`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: '#FF8A00',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2.5,
        },
      });
    }

    // Destination Marker (Emerald Green)
    if (destCoords) {
      destMarkerRef.current = new google.maps.Marker({
        position: destCoords,
        map,
        title: `Destination: ${toLocation || 'Destination'}`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: '#10B981',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2.5,
        },
      });
    }

    // Draw driving route between pickup and destination
    if (pickupCoords && destCoords && fromLocation.trim() !== toLocation.trim()) {
      try {
        const directionsService = new google.maps.DirectionsService();
        const directionsRenderer = new google.maps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: '#FF8A00',
            strokeOpacity: 0.9,
            strokeWeight: 5,
          },
        });
        directionsRendererRef.current = directionsRenderer;

        directionsService.route(
          {
            origin: pickupCoords,
            destination: destCoords,
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (result: any, status: any) => {
            if (status === google.maps.DirectionsStatus.OK && result) {
              directionsRenderer.setDirections(result);
              const leg = result.routes[0]?.legs[0];
              if (leg) {
                setRouteInfo({
                  distanceText: leg.distance?.text || '',
                  durationText: leg.duration?.text || '',
                  distanceKm: (leg.distance?.value || 0) / 1000,
                });
              }
            } else {
              const bounds = new google.maps.LatLngBounds();
              bounds.extend(pickupCoords);
              bounds.extend(destCoords);
              map.fitBounds(bounds, 60);
              setRouteInfo(null);
            }
          }
        );
      } catch (err) {
        console.warn('Directions Service error:', err);
        const bounds = new google.maps.LatLngBounds();
        bounds.extend(pickupCoords);
        bounds.extend(destCoords);
        map.fitBounds(bounds, 60);
      }
    } else if (pickupCoords) {
      map.panTo(pickupCoords);
      setRouteInfo(null);
    } else if (destCoords) {
      map.panTo(destCoords);
      setRouteInfo(null);
    }
  }, [mapsLoaded, pickupCoords, destCoords, fromLocation, toLocation]);

  // 3. Recalculate Fare Estimate when locations or passengers change
  useEffect(() => {
    if (!fromLocation.trim() || !toLocation.trim()) {
      setFareEstimate(null);
      setRouteError(null);
      return;
    }

    if (fromLocation.trim().toLowerCase() === toLocation.trim().toLowerCase()) {
      setFareEstimate(null);
      setRouteError('Pickup and destination cannot be the same place.');
      return;
    }

    setRouteError(null);
    let isCancelled = false;

    async function calculateFare() {
      setIsCalculating(true);
      const effectivePickup = pickupCoords || resolveCoordinates(fromLocation);
      const effectiveDest = destCoords || resolveCoordinates(toLocation);

      try {
        const res = await api.bookings.getFareEstimate({
          fromLocation: fromLocation.trim(),
          toLocation: toLocation.trim(),
          passengers,
          pickupLatitude: effectivePickup?.lat,
          pickupLongitude: effectivePickup?.lng,
          destinationLatitude: effectiveDest?.lat,
          destinationLongitude: effectiveDest?.lng,
        });

        if (isCancelled) return;

        if (res.success && res.data && res.data.available) {
          setFareEstimate(res.data);
          setRouteError(null);
        } else {
          setFareEstimate(null);
          setRouteError('Fare not configured for this route. Please contact the admin.');
        }
      } catch (err: any) {
        if (!isCancelled) {
          setFareEstimate(null);
          setRouteError(err.message || 'Error checking fare estimate.');
        }
      } finally {
        if (!isCancelled) setIsCalculating(false);
      }
    }

    calculateFare();

    return () => {
      isCancelled = true;
    };
  }, [fromLocation, toLocation, passengers, pickupCoords, destCoords]);

  // 4. Handle booking creation
  const handleBookAuto = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    const cleanPickup = fromLocation.trim();
    const cleanDest = toLocation.trim();

    if (!cleanPickup || !cleanDest) {
      setRouteError('Please enter both pickup and destination locations.');
      return;
    }

    if (cleanPickup.toLowerCase() === cleanDest.toLowerCase()) {
      setRouteError('Pickup and destination cannot be the same location.');
      return;
    }

    if (!fareEstimate || !fareEstimate.available) {
      setRouteError('Fare not configured for this route. Please contact the admin.');
      return;
    }

    let pickupDatetimeISO: string;
    if (timeMode === 'now') {
      pickupDatetimeISO = new Date().toISOString();
    } else {
      const scheduledDt = new Date(`${scheduledDate}T${scheduledTime}`);
      if (scheduledDt.getTime() < Date.now() - 2 * 60 * 1000) {
        setRouteError('Scheduled pickup time cannot be in the past.');
        return;
      }
      pickupDatetimeISO = scheduledDt.toISOString();
    }

    setRouteError(null);
    setIsBooking(true);

    const effectivePickup = pickupCoords || resolveCoordinates(cleanPickup);
    const effectiveDest = destCoords || resolveCoordinates(cleanDest);

    try {
      const res = await api.bookings.create({
        pickupAddress: cleanPickup,
        destinationAddress: cleanDest,
        pickupDateTime: pickupDatetimeISO,
        passengers,
        pickupLatitude: effectivePickup?.lat,
        pickupLongitude: effectivePickup?.lng,
        destinationLatitude: effectiveDest?.lat,
        destinationLongitude: effectiveDest?.lng,
      });

      setIsBooking(false);

      if (res.success && res.data) {
        navigate(`/booking/${res.data.id}`);
      } else {
        setRouteError(res.error || 'Failed to book auto. Please try again.');
      }
    } catch (err: any) {
      setIsBooking(false);
      setRouteError(err.message || 'Network error occurred while booking.');
    }
  };

  // Helper to quickly apply a suggestion chip
  const handleApplySuggestion = (place: string) => {
    const coords = LOCATION_COORDINATES[place] || null;
    if (!fromLocation.trim()) {
      setFromLocation(place);
      if (coords) setPickupCoords(coords);
    } else if (!toLocation.trim()) {
      if (fromLocation.trim().toLowerCase() === place.toLowerCase()) {
        setRouteError('Pickup and destination cannot be the same place.');
        return;
      }
      setToLocation(place);
      if (coords) setDestCoords(coords);
    } else {
      // Overwrite destination if both filled
      setToLocation(place);
      if (coords) setDestCoords(coords);
    }
  };

  return (
    <div className="min-h-screen bg-[#071426] text-white py-8 px-4 sm:px-6 lg:px-8">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-1/4 -left-48 w-96 h-96 bg-[#FF8A00]/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-48 w-96 h-96 bg-[#FF8A00]/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Header bar with Back button and live status badge */}
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white transition-colors px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10"
          >
            <ChevronLeft className="w-4 h-4 text-[#FF8A00]" />
            <span>Back to Dashboard</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-slate-300">Google Maps Location Selection</span>
          </div>
        </div>

        {/* Responsive Grid: Phone-Style Booking Form + Interactive Google Maps */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* LEFT COLUMN: Phone-Style Booking Card (Matches Reference Image Screen 1) */}
          <div className="lg:col-span-5 w-full max-w-md mx-auto">
            <div className="bg-white text-slate-900 rounded-[2.5rem] shadow-2xl border-4 border-[#10243D] overflow-hidden p-6 sm:p-7 flex flex-col justify-between space-y-5 relative">

              {/* Phone Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors text-slate-700"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <h1 className="text-base font-black text-slate-900 tracking-tight">
                  Book an Auto
                </h1>

                <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center">
                  <Car className="w-4 h-4 text-[#FF8A00]" />
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">

                {/* 1. FROM (PICKUP LOCATION SEARCH) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#FF8A00]" />
                      <span>From (Pickup Location)</span>
                    </label>

                    <button
                      type="button"
                      onClick={handleUseCurrentLocation}
                      className="text-[10px] font-bold text-[#FF8A00] hover:text-[#FF9D2E] flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-orange-50 transition-colors"
                      title="Locate via device GPS"
                    >
                      <Crosshair className="w-3 h-3" />
                      <span>Current Location</span>
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      ref={pickupInputRef}
                      type="text"
                      value={fromLocation}
                      onChange={(e) => {
                        setFromLocation(e.target.value);
                        const coords = resolveCoordinates(e.target.value);
                        if (coords) setPickupCoords(coords);
                      }}
                      placeholder="Search pickup address, area, or landmark..."
                      className="w-full bg-slate-50 border border-slate-200 hover:border-[#FF8A00]/50 rounded-2xl px-4 py-3 text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF8A00] transition-all pr-10"
                    />

                    {fromLocation ? (
                      <button
                        type="button"
                        onClick={() => {
                          setFromLocation('');
                          setPickupCoords(null);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    )}
                  </div>
                </div>

                {/* 2. TO (DESTINATION LOCATION SEARCH) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#071426]" />
                      <span>To (Destination)</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => setActivePinMode('destination')}
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md transition-colors flex items-center gap-1 ${
                        activePinMode === 'destination'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      <Compass className="w-3 h-3" />
                      <span>Pin on Map</span>
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      ref={destInputRef}
                      type="text"
                      value={toLocation}
                      onChange={(e) => {
                        setToLocation(e.target.value);
                        const coords = resolveCoordinates(e.target.value);
                        if (coords) setDestCoords(coords);
                      }}
                      placeholder="Search destination, street, or landmark..."
                      className="w-full bg-slate-50 border border-slate-200 hover:border-[#FF8A00]/50 rounded-2xl px-4 py-3 text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#FF8A00] transition-all pr-10"
                    />

                    {toLocation ? (
                      <button
                        type="button"
                        onClick={() => {
                          setToLocation('');
                          setDestCoords(null);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    )}
                  </div>
                </div>

                {/* Popular Location Suggestions Chips */}
                <div className="space-y-1 pt-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Quick Suggestions
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {POPULAR_SUGGESTIONS.map((place) => (
                      <button
                        key={place}
                        type="button"
                        onClick={() => handleApplySuggestion(place)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-orange-100 text-slate-700 hover:text-[#FF8A00] text-[11px] font-semibold transition-colors"
                      >
                        {place}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. PICKUP TIME */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#FF8A00]" />
                      <span>Pickup Time</span>
                    </label>

                    <div className="flex rounded-lg bg-slate-100 p-0.5 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setTimeMode('now')}
                        className={`px-2.5 py-1 rounded-md transition-all ${
                          timeMode === 'now'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Ride Now
                      </button>
                      <button
                        type="button"
                        onClick={() => setTimeMode('schedule')}
                        className={`px-2.5 py-1 rounded-md transition-all ${
                          timeMode === 'schedule'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Schedule
                      </button>
                    </div>
                  </div>

                  {timeMode === 'now' ? (
                    <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-800 flex items-center justify-between">
                      <span>Today, Immediate Pickup (5-10 mins)</span>
                      <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                        Active
                      </span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#FF8A00]"
                      />
                      <input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#FF8A00]"
                      />
                    </div>
                  )}
                </div>

                {/* 4. PASSENGERS SELECTOR */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#FF8A00]" />
                      <span>Passengers</span>
                    </label>
                    <span className="text-[10px] text-slate-400">Max 4 riders</span>
                  </div>

                  <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2 flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-bold text-slate-800">
                      {passengers} {passengers === 1 ? 'Passenger' : 'Passengers'}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPassengers(Math.max(1, passengers - 1))}
                        disabled={passengers <= 1}
                        className="w-7 h-7 rounded-full bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 font-black flex items-center justify-center transition-all disabled:opacity-40"
                      >
                        -
                      </button>
                      <span className="w-5 text-center font-black text-slate-900 text-sm">
                        {passengers}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPassengers(Math.min(4, passengers + 1))}
                        disabled={passengers >= 4}
                        className="w-7 h-7 rounded-full bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 font-black flex items-center justify-center transition-all disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* 5. ESTIMATED FARE & ROUTE SUMMARY CARD */}
                <div className="p-4 bg-orange-50/80 rounded-2xl border-2 border-orange-200/90 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Estimated Fare
                    </span>
                    {routeInfo && (
                      <span className="text-[10px] font-bold text-[#FF8A00] uppercase tracking-wider">
                        {routeInfo.distanceText} • {routeInfo.durationText}
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline justify-between pt-1">
                    {isCalculating ? (
                      <div className="flex items-center gap-2 text-xs font-bold text-[#FF8A00]">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Checking route fare...</span>
                      </div>
                    ) : fareEstimate && fareEstimate.available ? (
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-slate-900">
                          ₹ {fareEstimate.estimatedFare}
                        </span>
                        {passengers > 1 && (
                          <span className="text-[11px] font-semibold text-slate-500">
                            ({passengers} × ₹{Math.round(fareEstimate.estimatedFare / passengers)})
                          </span>
                        )}
                      </div>
                    ) : routeError ? (
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-rose-700 block">
                          Fare not configured for this route. Please contact the admin.
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-slate-400">
                        Select pickup & destination to calculate
                      </span>
                    )}

                    <span className="text-[10px] font-semibold text-slate-500">
                      Clik2Go Auto
                    </span>
                  </div>
                </div>

                {/* Route Error or Pricing Notification */}
                {routeError && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-semibold flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <span>{routeError}</span>
                  </div>
                )}
              </div>

              {/* 6. PRIMARY BOOKING BUTTON */}
              <div>
                <button
                  type="button"
                  onClick={handleBookAuto}
                  disabled={isBooking || isCalculating || !fareEstimate?.available}
                  className="w-full py-3.5 sm:py-4 bg-gradient-to-r from-[#FF8A00] to-[#FF9D2E] hover:from-[#FF9D2E] hover:to-[#FF8A00] text-slate-950 font-black text-sm rounded-2xl shadow-lg shadow-[#FF8A00]/25 transition-transform hover:scale-102 active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isBooking ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Booking Auto...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <p className="text-[10px] text-center text-slate-400 mt-2">
                  No hidden charges • Cash on arrival or Cashfree UPI
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Interactive Google Maps Experience */}
          <div className="lg:col-span-7 flex flex-col space-y-4">

            <div className="bg-[#10243D] rounded-3xl p-6 border border-[#1A3353] shadow-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Navigation className="w-5 h-5 text-[#FF8A00]" />
                    <span>Interactive Route Map</span>
                  </h2>
                  <p className="text-xs text-[#A9B7C9] mt-0.5">
                    Search anywhere on Google Maps or click to set pickup and drop pins
                  </p>
                </div>

                {/* Map Action Controls */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setActivePinMode(activePinMode === 'pickup' ? null : 'pickup')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                      activePinMode === 'pickup'
                        ? 'bg-[#FF8A00] text-[#071426] border-[#FF8A00]'
                        : 'bg-[#071426] text-slate-300 border-[#1A3353] hover:text-white'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-[#FF8A00]" />
                    <span>Pin Pickup</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActivePinMode(activePinMode === 'destination' ? null : 'destination')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                      activePinMode === 'destination'
                        ? 'bg-emerald-500 text-white border-emerald-500'
                        : 'bg-[#071426] text-slate-300 border-[#1A3353] hover:text-white'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>Pin Destination</span>
                  </button>

                  {(pickupCoords || destCoords) && (
                    <button
                      type="button"
                      onClick={() => {
                        setPickupCoords(null);
                        setDestCoords(null);
                        setFromLocation('');
                        setToLocation('');
                        setRouteInfo(null);
                        setActivePinMode(null);
                      }}
                      className="p-1.5 rounded-xl bg-[#071426] text-slate-400 hover:text-white border border-[#1A3353]"
                      title="Clear markers"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Map Canvas */}
              <div className="relative w-full h-[380px] sm:h-[450px] rounded-2xl overflow-hidden border border-[#1A3353] bg-[#071426]">

                {/* Google Maps Viewport */}
                <div ref={mapContainerRef} className="w-full h-full" />

                {/* Active Pin Placement Banner */}
                {activePinMode && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-[#FF8A00] text-[#071426] px-4 py-1.5 rounded-full text-xs font-black shadow-lg flex items-center gap-2 animate-bounce">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Click anywhere on the map to set {activePinMode === 'pickup' ? 'Pickup' : 'Destination'}</span>
                  </div>
                )}

                {/* Fallback / Error State overlay if Google Maps is unavailable */}
                {mapsError && (
                  <div className="absolute inset-0 bg-[#071426]/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-3 z-10">
                    <div className="w-12 h-12 rounded-2xl bg-[#FF8A00]/15 text-[#FF8A00] flex items-center justify-center">
                      <MapPin className="w-6 h-6" />
                    </div>
                    <div className="max-w-xs space-y-1">
                      <h4 className="text-sm font-bold text-white">Interactive Map Ready</h4>
                      <p className="text-[11px] text-[#A9B7C9]">{mapsError}</p>
                    </div>

                    {/* Styled Route Visualizer Card */}
                    <div className="w-full max-w-sm bg-[#10243D] p-4 rounded-xl border border-[#1A3353] text-left space-y-3 mt-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-bold uppercase text-[10px]">Location Selection</span>
                        <span className="text-[#FF8A00] font-black">Google Maps</span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2 text-white font-bold">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#FF8A00]" />
                          <span className="truncate">Pickup: {fromLocation || 'Not selected'}</span>
                        </div>
                        <div className="w-0.5 h-4 bg-slate-700 ml-1" />
                        <div className="flex items-center gap-2 text-white font-bold">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                          <span className="truncate">Destination: {toLocation || 'Not selected'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Floating Live Driving Stats Pill Overlay */}
                {routeInfo && (
                  <div className="absolute top-3 left-3 z-10 bg-[#071426]/90 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/10 text-xs shadow-lg space-y-0.5">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Driving Path</div>
                    <div className="text-white font-black flex items-center gap-2">
                      <span className="text-[#FF8A00]">{routeInfo.distanceText}</span>
                      <span className="text-slate-500">•</span>
                      <span className="text-emerald-400">{routeInfo.durationText}</span>
                    </div>
                  </div>
                )}

                {/* Floating Map Legend Overlay */}
                <div className="absolute left-3 bottom-3 z-10 bg-[#071426]/85 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 text-[10px] space-y-1 text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#FF8A00]" />
                    <span className="truncate max-w-[180px]">Pickup ({fromLocation || 'Not set'})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="truncate max-w-[180px]">Destination ({toLocation || 'Not set'})</span>
                  </div>
                </div>
              </div>

              {/* Service Assurance Footer below map */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3 bg-[#071426] rounded-xl border border-[#1A3353] flex items-center gap-2.5">
                  <span className="text-lg">⚡</span>
                  <div>
                    <div className="text-xs font-bold text-white">Instant Dispatch</div>
                    <div className="text-[10px] text-[#A9B7C9]">Google Maps location accuracy</div>
                  </div>
                </div>

                <div className="p-3 bg-[#071426] rounded-xl border border-[#1A3353] flex items-center gap-2.5">
                  <span className="text-lg">🛡️</span>
                  <div>
                    <div className="text-xs font-bold text-white">Verified Drivers</div>
                    <div className="text-[10px] text-[#A9B7C9]">Live navigation to your door</div>
                  </div>
                </div>

                <div className="p-3 bg-[#071426] rounded-xl border border-[#1A3353] flex items-center gap-2.5">
                  <span className="text-lg">₹</span>
                  <div>
                    <div className="text-xs font-bold text-white">Transparent Pricing</div>
                    <div className="text-[10px] text-[#A9B7C9]">Zero hidden charges</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};