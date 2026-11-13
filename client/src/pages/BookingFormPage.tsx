import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, FareEstimate } from '../api/client';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import {
  Coordinates,
  PlaceSuggestion,
  LOCATION_COORDINATES,
  DEFAULT_MAP_CENTER,
  GOOGLE_MAPS_API_KEY,
  resolveLocalCoordinates,
  searchPlacesNew as sharedSearchPlacesNew,
  fetchPlaceDetailsNew as sharedFetchPlaceDetailsNew
} from '../utils/places';
import {
  MapPin,
  Clock,
  Calendar,
  Users,
  IndianRupee,
  AlertCircle,
  ArrowRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Car,
  Navigation,
  Loader2,
  CheckCircle2,
  Sparkles,
  Crosshair,
  Compass,
  X
} from 'lucide-react';

interface BookingFormPageProps {
  navigate: (path: string) => void;
}

export type { PlaceSuggestion };
export { LOCATION_COORDINATES };

export const BookingFormPage: React.FC<BookingFormPageProps> = ({ navigate }) => {
  const { user, logout, refreshUser } = useAuth();

  const params = new URLSearchParams(window.location.search);
  const initialPickup = params.get('pickup') || '';
  const initialDest = params.get('dest') || '';
  const initialPassengers = Math.min(6, Math.max(1, Number(params.get('passengers')) || 1));

  // Search input and location state
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

  // Autocomplete UI & search state (Google Places API New)
  const [pickupSuggestions, setPickupSuggestions] = useState<PlaceSuggestion[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearchingPickup, setIsSearchingPickup] = useState(false);
  const [isSearchingDest, setIsSearchingDest] = useState(false);
  const [showPickupDropdown, setShowPickupDropdown] = useState(false);
  const [showDestDropdown, setShowDestDropdown] = useState(false);
  const [isResolvingPlace, setIsResolvingPlace] = useState(false);

  // Debounce and container refs
  const pickupDebounceRef = useRef<any>(null);
  const destDebounceRef = useRef<any>(null);
  const pickupWrapperRef = useRef<HTMLDivElement | null>(null);
  const destWrapperRef = useRef<HTMLDivElement | null>(null);

  // Passengers: 1 to 6
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

  // Mobile layout state: map height mode ('default' ~40%, 'expanded' ~72%, 'compact' ~22%)
  const [mobileMapMode, setMobileMapMode] = useState<'default' | 'expanded' | 'compact'>('default');

  // Google Maps state
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const pickupMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const directionsRendererRef = useRef<any>(null);

  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [activePinMode, setActivePinMode] = useState<'pickup' | 'destination' | null>(null);
  const [isDraggingPin, setIsDraggingPin] = useState(false);

  const resolveCoordinates = (name: string): Coordinates | null => resolveLocalCoordinates(name);

  // 1. Initialize Google Maps with dark theme styling
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
          console.warn('Google Places warning:', e);
        }
        try {
          await importLibrary('geometry');
        } catch (e) {
          console.warn('Google Geometry warning:', e);
        }

        const google = window.google;
        if (isCancelled || !mapContainerRef.current || !google) return;

        // Premium Dark Map styling matching #0B0B0D & #171719
        const darkMapStyle = [
          { elementType: 'geometry', stylers: [{ color: '#171719' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#0B0B0D' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#A1A1AA' }] },
          { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#FFFFFF' }] },
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#202023' }] },
          { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#303034' }] },
          { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#71717A' }] },
          { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#28282D' }] },
          { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#303034' }] },
          { featureType: 'transit', stylers: [{ visibility: 'simplified' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0B0B0D' }] },
        ];

        const map = new google.maps.Map(mapContainerRef.current, {
          center: pickupCoords || DEFAULT_MAP_CENTER,
          zoom: 14,
          styles: darkMapStyle,
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

  // GPS Current location
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setRouteError('Geolocation is not supported by your browser.');
      return;
    }
    setRouteError(null);
    setShowPickupDropdown(false);
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

  // Click outside and keyboard dismiss for autocomplete dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (pickupWrapperRef.current && !pickupWrapperRef.current.contains(target)) {
        setShowPickupDropdown(false);
      }
      if (destWrapperRef.current && !destWrapperRef.current.contains(target)) {
        setShowDestDropdown(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowPickupDropdown(false);
        setShowDestDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      if (pickupDebounceRef.current) clearTimeout(pickupDebounceRef.current);
      if (destDebounceRef.current) clearTimeout(destDebounceRef.current);
    };
  }, []);

  // ── Places API (New) Autocomplete Search ──
  const searchPlacesNew = (
    query: string,
    biasCoords?: Coordinates | null
  ): Promise<PlaceSuggestion[]> =>
    sharedSearchPlacesNew(query, {
      biasCoords,
      useLocationBias: true,
      includeLocalFallback: true
    });

  // ── Places API (New) Fetch Place Details ──
  const fetchPlaceDetailsNew = (
    placeId: string,
    fallbackText: string
  ): Promise<{ address: string; coords: Coordinates } | null> =>
    sharedFetchPlaceDetailsNew(placeId, fallbackText);

  const handlePickupInputChange = (val: string) => {
    setFromLocation(val);
    if (pickupDebounceRef.current) clearTimeout(pickupDebounceRef.current);

    const localCoords = resolveCoordinates(val);
    if (localCoords) setPickupCoords(localCoords);

    if (val.trim().length < 2) {
      setPickupSuggestions([]);
      setShowPickupDropdown(false);
      setIsSearchingPickup(false);
      return;
    }

    setShowPickupDropdown(true);
    setIsSearchingPickup(true);

    pickupDebounceRef.current = setTimeout(async () => {
      const results = await searchPlacesNew(val, destCoords || DEFAULT_MAP_CENTER);
      setPickupSuggestions(results);
      setIsSearchingPickup(false);
    }, 300);
  };

  const handleDestInputChange = (val: string) => {
    setToLocation(val);
    if (destDebounceRef.current) clearTimeout(destDebounceRef.current);

    const localCoords = resolveCoordinates(val);
    if (localCoords) setDestCoords(localCoords);

    if (val.trim().length < 2) {
      setDestSuggestions([]);
      setShowDestDropdown(false);
      setIsSearchingDest(false);
      return;
    }

    setShowDestDropdown(true);
    setIsSearchingDest(true);

    destDebounceRef.current = setTimeout(async () => {
      const results = await searchPlacesNew(val, pickupCoords || DEFAULT_MAP_CENTER);
      setDestSuggestions(results);
      setIsSearchingDest(false);
    }, 300);
  };

  const handleSelectPickupSuggestion = async (s: PlaceSuggestion) => {
    setShowPickupDropdown(false);
    setPickupSuggestions([]);
    setFromLocation(s.fullText);
    setIsResolvingPlace(true);

    const details = await fetchPlaceDetailsNew(s.placeId, s.fullText);
    setIsResolvingPlace(false);

    if (details) {
      setFromLocation(details.address);
      setPickupCoords(details.coords);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.panTo(details.coords);
        mapInstanceRef.current.setZoom(15);
      }
    }
  };

  const handleSelectDestSuggestion = async (s: PlaceSuggestion) => {
    setShowDestDropdown(false);
    setDestSuggestions([]);
    setToLocation(s.fullText);
    setIsResolvingPlace(true);

    const details = await fetchPlaceDetailsNew(s.placeId, s.fullText);
    setIsResolvingPlace(false);

    if (details) {
      setToLocation(details.address);
      setDestCoords(details.coords);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.panTo(details.coords);
        mapInstanceRef.current.setZoom(15);
      }
    }
  };

  // Handle destination marker dragend to fine-tune exact drop-off spot
  const handleDestinationPinMoved = (newLat: number, newLng: number) => {
    setDestCoords({ lat: newLat, lng: newLng });
    setIsResolvingPlace(true);
    const google = (window as any).google;
    if (google?.maps?.Geocoder) {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat: newLat, lng: newLng } }, (results: any, status: any) => {
        setIsResolvingPlace(false);
        if (status === 'OK' && results && results[0]) {
          setToLocation(results[0].formatted_address);
        } else {
          setToLocation(`Pinned Location (${newLat.toFixed(5)}, ${newLng.toFixed(5)})`);
        }
      });
    } else {
      setIsResolvingPlace(false);
      setToLocation(`Pinned Location (${newLat.toFixed(5)}, ${newLng.toFixed(5)})`);
    }
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

    // Pickup Marker (Vibrant Lime circle with dark center)
    if (pickupCoords) {
      pickupMarkerRef.current = new google.maps.Marker({
        position: pickupCoords,
        map,
        title: `Pickup: ${fromLocation || 'Pickup'}`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: '#C6FF3D',
          fillOpacity: 1,
          strokeColor: '#0B0B0D',
          strokeWeight: 3,
        },
      });
    }

    // Destination Marker (White square with lime border) - Draggable for precise drop-off
    if (destCoords) {
      destMarkerRef.current = new google.maps.Marker({
        position: destCoords,
        map,
        title: `Destination: ${toLocation || 'Destination'} (Drag to adjust drop-off spot)`,
        draggable: true,
        cursor: 'grab',
        icon: {
          path: 'M -6,-6 L 6,-6 L 6,6 L -6,6 Z',
          scale: 1.1,
          fillColor: '#FFFFFF',
          fillOpacity: 1,
          strokeColor: '#C6FF3D',
          strokeWeight: 2.5,
        },
      });

      destMarkerRef.current.addListener('dragstart', () => {
        setIsDraggingPin(true);
      });

      destMarkerRef.current.addListener('dragend', (e: any) => {
        setIsDraggingPin(false);
        if (e && e.latLng) {
          const newLat = e.latLng.lat();
          const newLng = e.latLng.lng();
          handleDestinationPinMoved(newLat, newLng);
        }
      });
    }

    // Draw driving route between pickup and destination
    if (pickupCoords && destCoords && fromLocation.trim() !== toLocation.trim()) {
      try {
        const directionsService = new google.maps.DirectionsService();
        const directionsRenderer = new google.maps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          preserveViewport: true,
          polylineOptions: {
            strokeColor: '#C6FF3D',
            strokeOpacity: 0.95,
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
          const errorMsg =
            res.error ||
            (res.data as any)?.error ||
            'Fare not configured for this location';
          setRouteError(errorMsg);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setFareEstimate(null);
          setRouteError(err.message || 'Fare not configured for this location');
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

  // 4. Handle booking creation (prevent duplicate clicks)
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
      setRouteError(routeError || 'Fare not configured for this location');
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

      if (res.success && res.data) {
        navigate(`/booking/${res.data.id}`);
      } else if (res.status === 401 || res.status === 403) {
        const verifiedUser = await refreshUser();
        setIsBooking(false);
        if (!verifiedUser) {
          await logout();
          navigate('/login');
          return;
        }
        setRouteError(res.error || 'Authentication check failed. Please try confirming your ride again.');
      } else {
        setRouteError(res.error || 'Booking failed. Please try again.');
        setIsBooking(false);
      }
    } catch (err: any) {
      setRouteError(err.message || 'Error creating booking.');
      setIsBooking(false);
    }
  };

  // Helper classes for map height on mobile
  const getMobileMapHeightClass = () => {
    if (mobileMapMode === 'expanded') return 'h-[72dvh]';
    if (mobileMapMode === 'compact') return 'h-[22dvh]';
    return 'h-[38dvh]'; // Default ~40%
  };

  return (
    <div className="h-[calc(100dvh-4rem)] min-h-[calc(100dvh-4rem)] bg-[#0B0B0D] text-white flex flex-col lg:flex-row relative overflow-hidden">

      {/* ── TOP SECTION ON MOBILE / RIGHT ON DESKTOP: Interactive Google Map ── */}
      <div
        className={`w-full lg:w-7/12 order-1 lg:order-2 relative transition-all duration-300 ease-in-out ${getMobileMapHeightClass()} lg:h-[calc(100dvh-4rem)] border-b lg:border-b-0 lg:border-l border-[#303034] bg-[#171719]`}
      >
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Map Loading / Fallback Banner */}
        {mapsError && (
          <div className="absolute top-3 left-3 right-3 p-3 bg-[#171719]/90 border border-[#303034] rounded-2xl text-xs text-[#A1A1AA] flex items-center justify-between backdrop-blur-md">
            <span>{mapsError}</span>
            <span className="text-[10px] text-[#C6FF3D] font-bold">Manual Entry Active</span>
          </div>
        )}

        {/* Map action controls float over map */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="p-2 rounded-xl bg-[#0B0B0D]/90 hover:bg-[#0B0B0D] border border-[#303034] text-white flex items-center gap-1 shadow-card text-xs font-bold backdrop-blur-md"
            >
              <ChevronLeft className="w-4 h-4 text-[#C6FF3D]" />
              <span className="hidden sm:inline">Back</span>
            </button>

            {routeInfo && (
              <div className="px-3 py-1.5 rounded-xl bg-[#0B0B0D]/90 border border-[#303034] text-[11px] font-bold text-[#C6FF3D] backdrop-blur-md">
                {routeInfo.distanceText} • {routeInfo.durationText}
              </div>
            )}
          </div>

          {/* Toggle Map Expand / Collapse on Mobile */}
          <div className="pointer-events-auto lg:hidden">
            <button
              type="button"
              onClick={() => {
                if (mobileMapMode === 'expanded') {
                  setMobileMapMode('default');
                } else {
                  setMobileMapMode('expanded');
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-[#0B0B0D]/90 hover:bg-[#0B0B0D] border border-[#303034] text-xs font-bold text-white shadow-card backdrop-blur-md flex items-center gap-1.5"
            >
              {mobileMapMode === 'expanded' ? (
                <>
                  <ChevronDown className="w-3.5 h-3.5 text-[#C6FF3D]" />
                  <span>Show Booking Details</span>
                </>
              ) : (
                <>
                  <ChevronUp className="w-3.5 h-3.5 text-[#C6FF3D]" />
                  <span>Expand Map</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Pin mode indicator banner */}
        {activePinMode && (
          <div className="absolute bottom-4 left-4 right-4 p-3 rounded-2xl bg-[#C6FF3D] text-[#0B0B0D] font-black text-xs text-center shadow-glow-lime flex items-center justify-between">
            <span>Tap on the map to set {activePinMode === 'pickup' ? 'Pickup' : 'Destination'} location</span>
            <button
              type="button"
              onClick={() => setActivePinMode(null)}
              className="px-2 py-0.5 rounded-lg bg-[#0B0B0D] text-white text-[10px]"
            >
              Done
            </button>
          </div>
        )}

        {/* Draggable Destination Pin Hint */}
        {destCoords && !activePinMode && (
          <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 p-2.5 rounded-xl bg-[#0B0B0D]/90 border border-[#303034] text-[11px] text-[#A1A1AA] font-medium shadow-card backdrop-blur-md flex items-center gap-2 pointer-events-none">
            <div className={`w-2 h-2 rounded-full ${isDraggingPin || isResolvingPlace ? 'bg-amber-400 animate-ping' : 'bg-[#C6FF3D] animate-pulse'} flex-shrink-0`} />
            <span className="text-white">
              {isDraggingPin
                ? 'Moving drop-off pin...'
                : isResolvingPlace
                ? 'Updating drop-off address...'
                : 'Drag the destination pin to fine-tune exact drop-off spot'}
            </span>
          </div>
        )}
      </div>

      {/* ── BOTTOM SHEET ON MOBILE / LEFT ON DESKTOP: Booking Controls ── */}
      <div
        className={`w-full lg:w-5/12 order-2 lg:order-1 flex-1 flex flex-col bg-[#171719] lg:h-[calc(100dvh-4rem)] overflow-y-auto rounded-t-3xl lg:rounded-none border-t lg:border-t-0 border-[#303034] shadow-sheet z-20`}
      >
        {/* Mobile Drag Handle Bar */}
        <div
          onClick={() => {
            if (mobileMapMode === 'default') setMobileMapMode('compact');
            else if (mobileMapMode === 'compact') setMobileMapMode('default');
            else setMobileMapMode('default');
          }}
          className="lg:hidden flex flex-col items-center justify-center py-2.5 cursor-pointer hover:bg-[#202023] transition-colors"
        >
          <div className="w-12 h-1 rounded-full bg-[#303034]" />
        </div>

        {/* Form Container */}
        <div className="p-4 sm:p-6 lg:p-7 space-y-4 sm:space-y-5 flex-1 pb-8 safe-bottom">

          {/* Card Title */}
          <div className="flex items-center justify-between pb-2 border-b border-[#303034]">
            <div>
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Book Auto
              </h1>
              <p className="text-[11px] text-[#A1A1AA]">
                Guaranteed point-to-point fixed pricing
              </p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-[#202023] border border-[#303034] flex items-center justify-center text-sm">
              🛺
            </div>
          </div>

          {/* Location Inputs (Places API New Autocomplete + GPS / Map Pin) */}
          <div className="relative space-y-3 bg-[#202023] p-3.5 rounded-2xl border border-[#303034]">
            {/* Connecting line */}
            <div className="absolute left-[22px] top-[28px] bottom-[28px] w-0.5 bg-[#303034] pointer-events-none" />

            {/* 1. Pickup Input */}
            <div ref={pickupWrapperRef} className="relative pl-7">
              <div className="absolute left-0 top-3 w-2.5 h-2.5 rounded-full bg-[#C6FF3D] ring-4 ring-[#C6FF3D]/20" />
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA]">Pickup</span>
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  className="text-[10px] font-bold text-[#C6FF3D] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Crosshair className="w-3 h-3" />
                  <span>Current GPS</span>
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={fromLocation}
                  onChange={(e) => handlePickupInputChange(e.target.value)}
                  onFocus={() => {
                    if (fromLocation.trim().length >= 2 && pickupSuggestions.length > 0) {
                      setShowPickupDropdown(true);
                    }
                  }}
                  placeholder="Enter pickup address or landmark..."
                  autoComplete="off"
                  className="w-full bg-[#171719] border border-[#303034] focus:border-[#C6FF3D] rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-white placeholder-[#71717A] focus:outline-none pr-8 transition-colors"
                />

                {isResolvingPlace && (
                  <div className="absolute right-8 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C6FF3D]" />
                  </div>
                )}

                {fromLocation && (
                  <button
                    type="button"
                    onClick={() => {
                      setFromLocation('');
                      setPickupCoords(null);
                      setPickupSuggestions([]);
                      setShowPickupDropdown(false);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A1A1AA] hover:text-white p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Suggestions Dropdown for Pickup */}
                {showPickupDropdown && fromLocation.trim().length >= 2 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#171719] border border-[#303034] rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md max-h-56 overflow-y-auto">
                    {isSearchingPickup ? (
                      <div className="p-3.5 flex items-center justify-center gap-2 text-xs text-[#A1A1AA]">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C6FF3D]" />
                        <span>Searching places...</span>
                      </div>
                    ) : pickupSuggestions.length > 0 ? (
                      pickupSuggestions.map((item, idx) => (
                        <button
                          key={`${item.placeId}_${idx}`}
                          type="button"
                          onClick={() => handleSelectPickupSuggestion(item)}
                          className="w-full text-left p-3 hover:bg-[#202023] active:bg-[#26262A] flex items-start gap-2.5 transition-colors border-b border-[#202023] last:border-b-0 cursor-pointer"
                        >
                          <MapPin className="w-4 h-4 text-[#C6FF3D] mt-0.5 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-white truncate">
                              {item.mainText}
                            </div>
                            {item.secondaryText && (
                              <div className="text-[10px] text-[#A1A1AA] truncate">
                                {item.secondaryText}
                              </div>
                            )}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="p-3.5 text-center text-xs text-[#71717A]">
                        No matching places found. You can continue typing or pin on map.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="h-px bg-[#303034] ml-7" />

            {/* 2. Destination Input */}
            <div ref={destWrapperRef} className="relative pl-7">
              <div className="absolute left-0 top-3 w-2.5 h-2.5 bg-white ring-4 ring-white/20 rounded-xs" />
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA]">Destination</span>
                <button
                  type="button"
                  onClick={() => {
                    setShowDestDropdown(false);
                    setActivePinMode('destination');
                  }}
                  className={`text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                    activePinMode === 'destination' ? 'text-[#C6FF3D]' : 'text-[#A1A1AA] hover:text-white'
                  }`}
                >
                  <Compass className="w-3 h-3 text-[#C6FF3D]" />
                  <span>Pin on Map</span>
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={toLocation}
                  onChange={(e) => handleDestInputChange(e.target.value)}
                  onFocus={() => {
                    if (toLocation.trim().length >= 2 && destSuggestions.length > 0) {
                      setShowDestDropdown(true);
                    }
                  }}
                  placeholder="Enter destination address or landmark..."
                  autoComplete="off"
                  className="w-full bg-[#171719] border border-[#303034] focus:border-[#C6FF3D] rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-white placeholder-[#71717A] focus:outline-none pr-8 transition-colors"
                />

                {isResolvingPlace && (
                  <div className="absolute right-8 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C6FF3D]" />
                  </div>
                )}

                {toLocation && (
                  <button
                    type="button"
                    onClick={() => {
                      setToLocation('');
                      setDestCoords(null);
                      setDestSuggestions([]);
                      setShowDestDropdown(false);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A1A1AA] hover:text-white p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Suggestions Dropdown for Destination */}
                {showDestDropdown && toLocation.trim().length >= 2 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#171719] border border-[#303034] rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md max-h-56 overflow-y-auto">
                    {isSearchingDest ? (
                      <div className="p-3.5 flex items-center justify-center gap-2 text-xs text-[#A1A1AA]">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C6FF3D]" />
                        <span>Searching places...</span>
                      </div>
                    ) : destSuggestions.length > 0 ? (
                      destSuggestions.map((item, idx) => (
                        <button
                          key={`${item.placeId}_${idx}`}
                          type="button"
                          onClick={() => handleSelectDestSuggestion(item)}
                          className="w-full text-left p-3 hover:bg-[#202023] active:bg-[#26262A] flex items-start gap-2.5 transition-colors border-b border-[#202023] last:border-b-0 cursor-pointer"
                        >
                          <MapPin className="w-4 h-4 text-[#C6FF3D] mt-0.5 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-white truncate">
                              {item.mainText}
                            </div>
                            {item.secondaryText && (
                              <div className="text-[10px] text-[#A1A1AA] truncate">
                                {item.secondaryText}
                              </div>
                            )}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="p-3.5 text-center text-xs text-[#71717A]">
                        No matching places found. You can continue typing or pin on map.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 3. Passengers Selector (1 to 6) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA] flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#C6FF3D]" />
                <span>Passengers (1 to 6 riders)</span>
              </label>
              <span className="text-[10px] text-[#A1A1AA]">Up to 6 allowed</span>
            </div>

            <div className="w-full bg-[#202023] border border-[#303034] rounded-2xl px-4 py-2.5 flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-white">
                {passengers} {passengers === 1 ? 'Passenger' : 'Passengers'}
              </span>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPassengers(Math.max(1, passengers - 1))}
                  disabled={passengers <= 1}
                  className="w-8 h-8 rounded-xl bg-[#171719] border border-[#303034] hover:border-[#C6FF3D]/50 text-white font-black flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  −
                </button>
                <span className="w-6 text-center font-black text-white text-sm">
                  {passengers}
                </span>
                <button
                  type="button"
                  onClick={() => setPassengers(Math.min(6, passengers + 1))}
                  disabled={passengers >= 6}
                  className="w-8 h-8 rounded-xl bg-[#171719] border border-[#303034] hover:border-[#C6FF3D]/50 text-white font-black flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* 4. Pickup Time Mode */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#C6FF3D]" />
                <span>Pickup Schedule</span>
              </label>

              <div className="flex rounded-xl bg-[#202023] border border-[#303034] p-0.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setTimeMode('now')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    timeMode === 'now'
                      ? 'bg-[#C6FF3D] text-[#0B0B0D]'
                      : 'text-[#A1A1AA] hover:text-white'
                  }`}
                >
                  Ride Now
                </button>
                <button
                  type="button"
                  onClick={() => setTimeMode('schedule')}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    timeMode === 'schedule'
                      ? 'bg-[#C6FF3D] text-[#0B0B0D]'
                      : 'text-[#A1A1AA] hover:text-white'
                  }`}
                >
                  Schedule
                </button>
              </div>
            </div>

            {timeMode === 'now' ? (
              <div className="w-full bg-[#202023] border border-[#303034] rounded-2xl px-4 py-2.5 text-xs font-bold text-white flex items-center justify-between">
                <span>Immediate Driver Dispatch (3–7 mins)</span>
                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-[#C6FF3D]/10 text-[#C6FF3D] border border-[#C6FF3D]/30">
                  Ready
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full bg-[#202023] border border-[#303034] rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#C6FF3D]"
                />
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full bg-[#202023] border border-[#303034] rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#C6FF3D]"
                />
              </div>
            )}
          </div>

          {/* 5. Live Fare Estimate Card */}
          <div className="p-4 bg-[#202023] rounded-2xl border border-[#303034] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#A1A1AA]">
                Guaranteed Upfront Fare
              </span>
              {routeInfo && (
                <span className="text-[10px] font-bold text-[#C6FF3D] uppercase tracking-wider">
                  {routeInfo.distanceText} • {routeInfo.durationText}
                </span>
              )}
            </div>

            <div className="flex items-baseline justify-between pt-1">
              {isCalculating ? (
                <div className="flex items-center gap-2 text-xs font-bold text-[#C6FF3D]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Calculating fixed fare...</span>
                </div>
              ) : fareEstimate && fareEstimate.available ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-[#C6FF3D]">
                    ₹{fareEstimate.estimatedFare}
                  </span>
                  {passengers > 1 && (
                    <span className="text-[11px] font-semibold text-[#A1A1AA]">
                      ({passengers} × ₹{Math.round(fareEstimate.estimatedFare / passengers)})
                    </span>
                  )}
                </div>
              ) : routeError ? (
                <span className="text-xs font-bold text-rose-400 block">
                  {routeError}
                </span>
              ) : (
                <span className="text-xs font-semibold text-[#A1A1AA]">
                  Enter pickup & destination
                </span>
              )}

              <span className="text-[10px] font-semibold text-[#A1A1AA]">
                Fixed Rate
              </span>
            </div>
          </div>

          {/* Route Error Notification */}
          {routeError && !isCalculating && (
            <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-xl text-rose-300 text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>{routeError}</span>
            </div>
          )}

          {/* 6. Primary Booking Button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleBookAuto}
              disabled={isBooking || isCalculating || !fareEstimate?.available}
              className="w-full py-4 bg-[#C6FF3D] hover:bg-[#B5F028] text-[#0B0B0D] font-black text-sm rounded-2xl shadow-glow-lime transition-all active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isBooking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#0B0B0D]" />
                  <span>Confirming Auto...</span>
                </>
              ) : (
                <>
                  <span>Confirm Ride</span>
                  <ArrowRight className="w-4 h-4 text-[#0B0B0D]" />
                </>
              )}
            </button>

            <p className="text-[10px] text-center text-[#A1A1AA] mt-2">
              Transparent fixed fare • Pay driver via Cash or UPI
            </p>
          </div>

        </div>
      </div>

    </div>
  );
};
