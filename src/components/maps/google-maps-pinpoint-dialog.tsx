"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AlertCircle, ExternalLink, Loader2, MapPin, Navigation, Search, X } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface GoogleMapsPinpointDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  initialLat?: number;
  initialLng?: number;
  onSelectLocation: (data: {
    latitude: number;
    longitude: number;
    mapsUrl: string;
    venueName?: string;
    suggestedAddress?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  }) => void;
}

interface GoogleMapsGeocoderResult {
  formatted_address: string;
  address_components: {
    long_name: string;
    short_name: string;
    types: string[];
  }[];
}

interface GoogleMapsMouseEvent {
  latLng: {
    lat: () => number;
    lng: () => number;
  };
  placeId?: string;
  stop?: () => void;
}

interface GoogleMapInstance {
  setCenter: (pos: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
  addListener: (event: string, handler: (e: GoogleMapsMouseEvent) => void) => void;
}

interface GoogleMarkerInstance {
  setPosition?: (pos: { lat: number; lng: number }) => void;
  position?: { lat: number; lng: number } | null;
  addListener?: (event: string, handler: (e: GoogleMapsMouseEvent) => void) => void;
  addEventListener?: (event: string, handler: (e: Event) => void) => void;
}

interface AutocompletePredictionItem {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text: string;
    secondary_text?: string;
  };
}

declare global {
  interface Window {
    google?: {
      maps?: {
        Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapInstance;
        Marker: new (options: Record<string, unknown>) => GoogleMarkerInstance;
        marker?: {
          AdvancedMarkerElement: new (options: Record<string, unknown>) => GoogleMarkerInstance;
        };
        places?: {
          AutocompleteSessionToken?: new () => unknown;
          AutocompleteService?: new () => {
            getPlacePredictions: (
              request: { input: string },
              callback: (predictions: AutocompletePredictionItem[] | null, status: string) => void,
            ) => void;
          };
          PlacesService?: new (
            attrContainer: HTMLDivElement,
          ) => {
            getDetails: (
              request: { placeId: string; fields: string[] },
              callback: (
                place: {
                  name?: string;
                  formatted_address?: string;
                  geometry?: { location?: { lat: () => number; lng: () => number } };
                  address_components?: { long_name: string; short_name: string; types: string[] }[];
                } | null,
                status: string,
              ) => void,
            ) => void;
          };
          AutocompleteSuggestion?: {
            fetchAutocompleteSuggestions: (request: { input: string }) => Promise<{
              suggestions?: {
                placePrediction?: {
                  text?: { toString: () => string };
                  toPlace: () => {
                    fetchFields: (opts: { fields: string[] }) => Promise<void>;
                    displayName?: string;
                    formattedAddress?: string;
                    location?: { lat: () => number; lng: () => number };
                    addressComponents?: { longText?: string; shortText?: string; types: string[] }[];
                  };
                };
              }[];
            }>;
          };
          Place?: new (options: {
            id: string;
          }) => {
            fetchFields: (opts: { fields: string[] }) => Promise<void>;
            displayName?: string;
            formattedAddress?: string;
            location?: { lat: () => number; lng: () => number };
            addressComponents?: { longText?: string; shortText?: string; types: string[] }[];
          };
        };
        Animation: { DROP: number };
        Geocoder: new () => {
          geocode: (
            request: { location: { lat: number; lng: number } },
            callback: (results: GoogleMapsGeocoderResult[] | null, status: string) => void,
          ) => void;
        };
      };
    };
    __googleMapsLoadingPromise?: Promise<void>;
  }
}

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SSR"));
  if (window.google?.maps?.Map) return Promise.resolve();
  if (window.__googleMapsLoadingPromise) return window.__googleMapsLoadingPromise;

  window.__googleMapsLoadingPromise = new Promise((resolve, reject) => {
    if (window.google?.maps?.Map) {
      resolve();
      return;
    }

    const callbackName = `__googleMapsInitCallback_${Date.now()}`;
    (window as unknown as Record<string, () => void>)[callbackName] = () => {
      delete (window as unknown as Record<string, unknown>)[callbackName];
      resolve();
    };

    const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existing) {
      if (window.google?.maps?.Map) {
        resolve();
      } else {
        existing.addEventListener("load", () => {
          if (window.google?.maps?.Map) {
            resolve();
          } else {
            setTimeout(resolve, 100);
          }
        });
        existing.addEventListener("error", (e) => reject(e));
      }
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places,marker&loading=async&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });

  return window.__googleMapsLoadingPromise;
}

export function GoogleMapsPinpointDialog({
  isOpen,
  onOpenChange,
  title = "Pinpoint Delivery Address",
  description = "Drag the pin or click on the map to mark your exact doorstep or delivery gate location.",
  initialLat,
  initialLng,
  onSelectLocation,
}: GoogleMapsPinpointDialogProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<GoogleMapInstance | null>(null);
  const markerInstanceRef = useRef<GoogleMarkerInstance | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  // Default to Monas / Central Jakarta if none provided
  const [currentLat, setCurrentLat] = useState<number>(initialLat ?? -6.175392);
  const [currentLng, setCurrentLng] = useState<number>(initialLng ?? 106.827153);
  const [detectedVenueName, setDetectedVenueName] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<
    Array<{
      id: string;
      mainText: string;
      secondaryText?: string;
      fullText: string;
      rawPrediction?: unknown;
    }>
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [addressDetails, setAddressDetails] = useState<{
    formatted?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  }>({});
  const [isLocating, setIsLocating] = useState(false);
  const [isScriptLoading, setIsScriptLoading] = useState(true);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [manualLink, setManualLink] = useState("");

  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const sessionTokenRef = useRef<unknown>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize or reset session token for Places Autocomplete billing
  const getOrCreateSessionToken = useCallback(() => {
    if (!sessionTokenRef.current && window.google?.maps?.places?.AutocompleteSessionToken) {
      sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
    }
    return sessionTokenRef.current;
  }, []);

  // Sync initial coordinates on open
  useEffect(() => {
    if (isOpen) {
      if (typeof initialLat === "number" && typeof initialLng === "number") {
        setCurrentLat(initialLat);
        setCurrentLng(initialLng);
      }
    }
  }, [isOpen, initialLat, initialLng]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const reverseGeocode = useCallback((lat: number, lng: number, fallbackVenueName?: string) => {
    if (!window.google?.maps?.Geocoder) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === "OK" && results?.[0]) {
        const result = results[0];
        let city = "";
        let state = "";
        let postalCode = "";
        let venueNameCandidate = fallbackVenueName || "";

        for (const comp of result.address_components || []) {
          const types: string[] = comp.types || [];
          if (types.includes("administrative_area_level_2") || types.includes("locality")) {
            city = comp.long_name;
          }
          if (types.includes("administrative_area_level_1")) {
            state = comp.long_name;
          }
          if (types.includes("postal_code")) {
            postalCode = comp.long_name;
          }
          if (
            !venueNameCandidate &&
            (types.includes("point_of_interest") || types.includes("establishment") || types.includes("premise"))
          ) {
            venueNameCandidate = comp.long_name;
          }
        }

        if (venueNameCandidate?.includes("+")) {
          venueNameCandidate = "";
        }

        if (venueNameCandidate) {
          setDetectedVenueName(venueNameCandidate);
        }

        setAddressDetails({
          formatted: result.formatted_address,
          city: city || undefined,
          state: state || undefined,
          postalCode: postalCode || undefined,
        });
      }
    });
  }, []);

  const initMap = useCallback(() => {
    if (!mapContainerRef.current || !window.google?.maps) return;

    const center = { lat: currentLat, lng: currentLng };
    const mapOptions: Record<string, unknown> = {
      center,
      zoom: 16,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
      mapId: "DEMO_MAP_ID",
    };
    const map = new window.google.maps.Map(mapContainerRef.current, mapOptions);
    mapInstanceRef.current = map;

    let marker: GoogleMarkerInstance;
    if (window.google.maps.marker?.AdvancedMarkerElement) {
      marker = new window.google.maps.marker.AdvancedMarkerElement({
        position: center,
        map,
        gmpDraggable: true,
      });
    } else {
      marker = new window.google.maps.Marker({
        position: center,
        map,
        draggable: true,
        animation: window.google.maps.Animation?.DROP,
      });
    }
    markerInstanceRef.current = marker;

    reverseGeocode(currentLat, currentLng);

    const updateMarkerPosition = (lat: number, lng: number) => {
      if (marker.setPosition) {
        marker.setPosition({ lat, lng });
      } else {
        marker.position = { lat, lng };
      }
    };

    // Click map to reposition marker or pick POI
    map.addListener("click", async (e) => {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      updateMarkerPosition(lat, lng);
      setCurrentLat(lat);
      setCurrentLng(lng);

      if (e.placeId && window.google?.maps?.places?.Place) {
        if (typeof e.stop === "function") e.stop();
        try {
          const poiPlace = new window.google.maps.places.Place({ id: e.placeId });
          await poiPlace.fetchFields({
            fields: ["displayName", "formattedAddress", "location", "addressComponents"],
          });
          const poiName = poiPlace.displayName || "";
          if (poiName) {
            setDetectedVenueName(poiName);
          }
          reverseGeocode(lat, lng, poiName);
          return;
        } catch (err) {
          console.warn("[GoogleMapsPinpointDialog] POI fetch failed:", err);
        }
      }

      reverseGeocode(lat, lng);
    });

    if (marker.addEventListener) {
      marker.addEventListener("gmp-dragend", () => {
        const pos = marker.position;
        if (pos) {
          const lat = typeof pos.lat === "function" ? (pos.lat as () => number)() : Number(pos.lat);
          const lng = typeof pos.lng === "function" ? (pos.lng as () => number)() : Number(pos.lng);
          if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
            setCurrentLat(lat);
            setCurrentLng(lng);
            reverseGeocode(lat, lng);
          }
        }
      });
    } else if (marker.addListener) {
      marker.addListener("dragend", (e: GoogleMapsMouseEvent) => {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        setCurrentLat(lat);
        setCurrentLng(lng);
        reverseGeocode(lat, lng);
      });
    }
  }, [currentLat, currentLng, reverseGeocode]);

  useEffect(() => {
    if (!isOpen) return;

    if (!apiKey) {
      setIsScriptLoading(false);
      setScriptError(
        "No Google Maps API key found (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY). You can paste a Google Maps link directly or use browser GPS detection.",
      );
      return;
    }

    setIsScriptLoading(true);
    setScriptError(null);

    loadGoogleMapsScript(apiKey)
      .then(() => {
        setIsScriptLoading(false);
        initMap();
      })
      .catch((err) => {
        console.error("[GoogleMapsPinpointDialog] Error loading Google Maps:", err);
        setIsScriptLoading(false);
        setScriptError(
          "Failed to load Google Maps SDK. Please check your internet connection or use manual link input.",
        );
      });
  }, [isOpen, apiKey, initMap]);

  const applyPosition = useCallback(
    (lat: number, lng: number, venueName?: string) => {
      setCurrentLat(lat);
      setCurrentLng(lng);
      if (venueName) {
        setDetectedVenueName(venueName);
      }

      if (mapInstanceRef.current && markerInstanceRef.current) {
        const newPos = { lat, lng };
        mapInstanceRef.current.setCenter(newPos);
        mapInstanceRef.current.setZoom(17);
        if (markerInstanceRef.current.setPosition) {
          markerInstanceRef.current.setPosition(newPos);
        } else {
          markerInstanceRef.current.position = newPos;
        }
      }
      reverseGeocode(lat, lng, venueName);
    },
    [reverseGeocode],
  );

  // Search input handler with debouncing using Places Autocomplete API
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        // Modern AutocompleteSuggestion with session token
        if (window.google?.maps?.places?.AutocompleteSuggestion) {
          const sessionToken = getOrCreateSessionToken();
          const req: Record<string, unknown> = { input: query };
          if (sessionToken) req.sessionToken = sessionToken;

          const res = await window.google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(
            req as { input: string },
          );
          const rawItems = res.suggestions || [];
          const mapped = rawItems.map((item, idx) => {
            const pred = item.placePrediction;
            const full = pred?.text?.toString() || "";
            const parts = full.split(",");
            return {
              id: `pred_${idx}_${Date.now()}`,
              mainText: parts[0]?.trim() || full,
              secondaryText: parts.slice(1).join(",").trim(),
              fullText: full,
              rawPrediction: pred,
            };
          });
          setSuggestions(mapped);
          setShowDropdown(mapped.length > 0);
          setIsSearching(false);
          return;
        }

        // Classic AutocompleteService fallback
        if (window.google?.maps?.places?.AutocompleteService) {
          const sessionToken = getOrCreateSessionToken();
          const service = new window.google.maps.places.AutocompleteService();
          const req: Record<string, unknown> = { input: query };
          if (sessionToken) req.sessionToken = sessionToken;

          service.getPlacePredictions(req as { input: string }, (preds) => {
            setIsSearching(false);
            if (!preds || preds.length === 0) {
              setSuggestions([]);
              setShowDropdown(false);
              return;
            }
            const mapped = preds.map((p) => ({
              id: p.place_id,
              mainText: p.structured_formatting?.main_text || p.description,
              secondaryText: p.structured_formatting?.secondary_text,
              fullText: p.description,
            }));
            setSuggestions(mapped);
            setShowDropdown(true);
          });
          return;
        }

        setIsSearching(false);
      } catch (err) {
        console.warn("[GoogleMapsPinpointDialog] Autocomplete error:", err);
        setIsSearching(false);
      }
    }, 300);
  };

  const handleSelectSuggestion = async (item: {
    id: string;
    mainText: string;
    secondaryText?: string;
    fullText: string;
    rawPrediction?: unknown;
  }) => {
    setSearchQuery(item.fullText);
    setShowDropdown(false);
    // Reset session token on final selection so next search starts a new session
    sessionTokenRef.current = null;

    try {
      // 1. If prediction from modern AutocompleteSuggestion
      if (item.rawPrediction) {
        const pred = item.rawPrediction as {
          toPlace: () => {
            fetchFields: (opts: { fields: string[] }) => Promise<void>;
            displayName?: string;
            formattedAddress?: string;
            location?: { lat: () => number; lng: () => number };
            addressComponents?: { longText?: string; shortText?: string; types: string[] }[];
          };
        };
        const place = pred.toPlace();
        await place.fetchFields({
          fields: ["displayName", "formattedAddress", "location", "addressComponents"],
        });

        if (place.location) {
          const lat = place.location.lat();
          const lng = place.location.lng();
          const venueName = place.displayName || item.mainText;
          applyPosition(lat, lng, venueName);

          let city = "";
          let state = "";
          let postalCode = "";

          for (const comp of place.addressComponents || []) {
            const types = comp.types || [];
            if (types.includes("administrative_area_level_2") || types.includes("locality")) {
              city = comp.longText || comp.shortText || "";
            }
            if (types.includes("administrative_area_level_1")) {
              state = comp.longText || comp.shortText || "";
            }
            if (types.includes("postal_code")) {
              postalCode = comp.longText || comp.shortText || "";
            }
          }

          setAddressDetails({
            formatted: place.formattedAddress || item.fullText,
            city: city || undefined,
            state: state || undefined,
            postalCode: postalCode || undefined,
          });
          return;
        }
      }

      // 2. Fallback: query PlacesService or Geocoder by place_id
      if (item.id && window.google?.maps?.places?.PlacesService) {
        const dummyDiv = document.createElement("div");
        const service = new window.google.maps.places.PlacesService(dummyDiv);
        service.getDetails(
          { placeId: item.id, fields: ["name", "formatted_address", "geometry", "address_components"] },
          (place, status) => {
            if (status === "OK" && place?.geometry?.location) {
              const lat = place.geometry.location.lat();
              const lng = place.geometry.location.lng();
              const venueName = place.name || item.mainText;
              applyPosition(lat, lng, venueName);

              let city = "";
              let state = "";
              let postalCode = "";

              for (const comp of place.address_components || []) {
                const types = comp.types || [];
                if (types.includes("administrative_area_level_2") || types.includes("locality")) {
                  city = comp.long_name;
                }
                if (types.includes("administrative_area_level_1")) {
                  state = comp.long_name;
                }
                if (types.includes("postal_code")) {
                  postalCode = comp.long_name;
                }
              }

              setAddressDetails({
                formatted: place.formatted_address || item.fullText,
                city: city || undefined,
                state: state || undefined,
                postalCode: postalCode || undefined,
              });
            }
          },
        );
      }
    } catch (e) {
      console.warn("[GoogleMapsPinpointDialog] Select suggestion failed:", e);
    }
  };

  const handleGetCurrentLocation = async () => {
    setIsLocating(true);

    const tryIpFallback = async (reason?: string) => {
      try {
        const res = await fetch("https://ipapi.co/json/");
        if (!res.ok) throw new Error("IP geolocation service failed");
        const data = (await res.json()) as { latitude?: number; longitude?: number; city?: string };
        if (typeof data.latitude === "number" && typeof data.longitude === "number") {
          applyPosition(data.latitude, data.longitude);
          setIsLocating(false);
          toast.success(`Location detected via IP (${data.city || "Local Area"})${reason ? `: ${reason}` : ""}`);
          return true;
        }
      } catch {
        // Ignore fallback failure
      }
      return false;
    };

    if (typeof navigator !== "undefined" && "permissions" in navigator) {
      try {
        const perm = await navigator.permissions.query({ name: "geolocation" as PermissionName });
        if (perm.state !== "granted") {
          const worked = await tryIpFallback();
          if (worked) return;
        }
      } catch {
        // Continue
      }
    }

    if (!navigator.geolocation) {
      const fallbackWorked = await tryIpFallback("Browser GPS not supported");
      if (!fallbackWorked) {
        setIsLocating(false);
        toast.error("Geolocation is not supported by your browser.");
      }
      return;
    }

    let timeoutFired = false;
    const promptTimeoutId = window.setTimeout(async () => {
      timeoutFired = true;
      const fallbackWorked = await tryIpFallback();
      if (!fallbackWorked) {
        setIsLocating(false);
        toast.error("Permission request timed out. You can click on the map directly or paste a Google Maps link.");
      }
    }, 2500);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        window.clearTimeout(promptTimeoutId);
        if (timeoutFired) return;
        setIsLocating(false);
        applyPosition(pos.coords.latitude, pos.coords.longitude);
        toast.success("Location detected successfully");
      },
      async (err) => {
        window.clearTimeout(promptTimeoutId);
        if (timeoutFired) return;
        console.warn("[GoogleMapsPinpointDialog] Geolocation error:", err.message);
        const fallbackWorked = await tryIpFallback(err.message);
        if (!fallbackWorked) {
          setIsLocating(false);
          toast.error(`Could not fetch location: ${err.message}`);
        }
      },
      { enableHighAccuracy: false, timeout: 3000, maximumAge: 60000 },
    );
  };

  const handleConfirm = () => {
    const mapsUrl = `https://www.google.com/maps?q=${currentLat.toFixed(6)},${currentLng.toFixed(6)}`;
    onSelectLocation({
      latitude: currentLat,
      longitude: currentLng,
      mapsUrl: manualLink.trim() || mapsUrl,
      venueName: detectedVenueName || undefined,
      suggestedAddress: addressDetails.formatted,
      city: addressDetails.city,
      state: addressDetails.state,
      postalCode: addressDetails.postalCode,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-4 sm:p-5">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2 text-primary">
            <MapPin className="size-4" />
            <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-xs">{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5">
          {/* Autocomplete Location Search with Native Dashboad Input */}
          <div ref={dropdownRef} className="relative w-full">
            <div className="relative">
              <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search venue or address (e.g. Kopikina Cikini, Menara Astra)..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => {
                  if (suggestions.length > 0) setShowDropdown(true);
                }}
                className="h-9 pr-8 pl-9 text-xs"
              />
              {isSearching ? (
                <Loader2 className="absolute top-2.5 right-2.5 size-4 animate-spin text-muted-foreground" />
              ) : searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSuggestions([]);
                    setShowDropdown(false);
                  }}
                  className="absolute top-2 right-2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>

            {/* Suggestions Dropdown */}
            {showDropdown && suggestions.length > 0 && (
              <div className="absolute top-full z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-md">
                {suggestions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectSuggestion(item)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/80 focus:bg-muted"
                  >
                    <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-foreground">{item.mainText}</div>
                      {item.secondaryText && (
                        <div className="truncate text-[11px] text-muted-foreground">{item.secondaryText}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Controls bar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGetCurrentLocation}
              disabled={isLocating}
              className="h-7 gap-1.5 px-2.5 text-xs"
            >
              {isLocating ? (
                <Loader2 className="size-3 animate-spin text-primary" />
              ) : (
                <Navigation className="size-3 text-primary" />
              )}
              {isLocating ? "Detecting GPS..." : "Detect My Location"}
            </Button>

            <span className="font-mono text-[11px] text-muted-foreground">
              {currentLat.toFixed(5)}, {currentLng.toFixed(5)}
            </span>
          </div>

          {/* Interactive Map */}
          {scriptError ? (
            <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200">
              <AlertCircle className="size-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-xs">{scriptError}</AlertDescription>
            </Alert>
          ) : (
            <div className="relative h-[250px] w-full overflow-hidden rounded-lg border border-border sm:h-[280px]">
              {isScriptLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-muted/80 backdrop-blur-xs">
                  <Loader2 className="size-5 animate-spin text-primary" />
                  <span className="text-muted-foreground text-xs">Loading Google Maps...</span>
                </div>
              )}
              <div ref={mapContainerRef} className="h-full w-full" />
            </div>
          )}

          {/* Selected Address details preview */}
          {(detectedVenueName || addressDetails.formatted) && (
            <div className="rounded-md border border-border/70 bg-muted/30 p-2 text-xs">
              {detectedVenueName && (
                <div className="mb-0.5">
                  <span className="font-semibold text-foreground">Venue: </span>
                  <span className="font-medium text-primary">{detectedVenueName}</span>
                </div>
              )}
              {addressDetails.formatted && (
                <div>
                  <span className="font-semibold text-foreground">Detected Address: </span>
                  <span className="text-muted-foreground">{addressDetails.formatted}</span>
                </div>
              )}
            </div>
          )}

          {/* Direct link fallback input */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground text-xs">Or Paste Custom Google Maps Link</span>
              {manualLink && (
                <a
                  href={manualLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  Open Link <ExternalLink className="size-3" />
                </a>
              )}
            </div>
            <Input
              placeholder="e.g. https://maps.app.goo.gl/... or https://goo.gl/maps/..."
              value={manualLink}
              onChange={(e) => setManualLink(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        </div>

        <DialogFooter className="mt-2 flex-row justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs">
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleConfirm} className="h-8 text-xs">
            Use This Location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
