"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AlertCircle, ExternalLink, Loader2, MapPin, Navigation } from "lucide-react";

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
  initialLat?: number;
  initialLng?: number;
  onSelectLocation: (data: {
    latitude: number;
    longitude: number;
    mapsUrl: string;
    suggestedAddress?: string;
    city?: string;
    postalCode?: string;
  }) => void;
}

// Minimal types to avoid `any`
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
}

interface GoogleMapInstance {
  setCenter: (pos: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
  addListener: (event: string, handler: (e: GoogleMapsMouseEvent) => void) => void;
}

interface GoogleMarkerInstance {
  setPosition: (pos: { lat: number; lng: number }) => void;
  addListener: (event: string, handler: (e: GoogleMapsMouseEvent) => void) => void;
}

declare global {
  interface Window {
    google?: {
      maps?: {
        Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapInstance;
        Marker: new (options: Record<string, unknown>) => GoogleMarkerInstance;
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
  if (window.google?.maps) return Promise.resolve();
  if (window.__googleMapsLoadingPromise) return window.__googleMapsLoadingPromise;

  window.__googleMapsLoadingPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", (e) => reject(e));
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });

  return window.__googleMapsLoadingPromise;
}

export function GoogleMapsPinpointDialog({
  isOpen,
  onOpenChange,
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
  const [addressDetails, setAddressDetails] = useState<{
    formatted?: string;
    city?: string;
    postalCode?: string;
  }>({});
  const [isLocating, setIsLocating] = useState(false);
  const [isScriptLoading, setIsScriptLoading] = useState(true);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [manualLink, setManualLink] = useState("");

  // Sync initial coordinates on open
  useEffect(() => {
    if (isOpen) {
      if (typeof initialLat === "number" && typeof initialLng === "number") {
        setCurrentLat(initialLat);
        setCurrentLng(initialLng);
      }
    }
  }, [isOpen, initialLat, initialLng]);

  const reverseGeocode = useCallback((lat: number, lng: number) => {
    if (!window.google?.maps?.Geocoder) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === "OK" && results?.[0]) {
        const result = results[0];
        let city = "";
        let postalCode = "";

        for (const comp of result.address_components || []) {
          const types: string[] = comp.types || [];
          if (types.includes("administrative_area_level_2") || types.includes("locality")) {
            city = comp.long_name;
          }
          if (types.includes("postal_code")) {
            postalCode = comp.long_name;
          }
        }

        setAddressDetails({
          formatted: result.formatted_address,
          city: city || undefined,
          postalCode: postalCode || undefined,
        });
      }
    });
  }, []);

  const initMap = useCallback(() => {
    if (!mapContainerRef.current || !window.google?.maps) return;

    const center = { lat: currentLat, lng: currentLng };
    const map = new window.google.maps.Map(mapContainerRef.current, {
      center,
      zoom: 16,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
    });
    mapInstanceRef.current = map;

    const marker = new window.google.maps.Marker({
      position: center,
      map,
      draggable: true,
      animation: window.google.maps.Animation.DROP,
    });
    markerInstanceRef.current = marker;

    reverseGeocode(currentLat, currentLng);

    // Click map to reposition marker
    map.addListener("click", (e) => {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      marker.setPosition({ lat, lng });
      setCurrentLat(lat);
      setCurrentLng(lng);
      reverseGeocode(lat, lng);
    });

    // Drag marker
    marker.addListener("dragend", (e) => {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setCurrentLat(lat);
      setCurrentLng(lng);
      reverseGeocode(lat, lng);
    });
  }, [currentLat, currentLng, reverseGeocode]);

  // Load Maps API when dialog opens
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

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCurrentLat(lat);
        setCurrentLng(lng);

        if (mapInstanceRef.current && markerInstanceRef.current) {
          const newPos = { lat, lng };
          mapInstanceRef.current.setCenter(newPos);
          mapInstanceRef.current.setZoom(17);
          markerInstanceRef.current.setPosition(newPos);
        }
        reverseGeocode(lat, lng);
      },
      (err) => {
        setIsLocating(false);
        console.warn("[GoogleMapsPinpointDialog] Geolocation error:", err.message);
        alert(`Could not fetch location: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleConfirm = () => {
    const mapsUrl = `https://www.google.com/maps?q=${currentLat.toFixed(6)},${currentLng.toFixed(6)}`;
    onSelectLocation({
      latitude: currentLat,
      longitude: currentLng,
      mapsUrl: manualLink.trim() || mapsUrl,
      suggestedAddress: addressDetails.formatted,
      city: addressDetails.city,
      postalCode: addressDetails.postalCode,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <MapPin className="size-5" />
            <DialogTitle className="text-lg">Pinpoint Delivery Address</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Drag the pin or click on the map to mark your exact doorstep or delivery gate location.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Controls bar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGetCurrentLocation}
              disabled={isLocating}
              className="h-8 gap-1.5 text-xs"
            >
              {isLocating ? (
                <Loader2 className="size-3.5 animate-spin text-primary" />
              ) : (
                <Navigation className="size-3.5 text-primary" />
              )}
              {isLocating ? "Detecting GPS..." : "Detect My Location"}
            </Button>

            <span className="font-mono text-[11px] text-muted-foreground">
              {currentLat.toFixed(5)}, {currentLng.toFixed(5)}
            </span>
          </div>

          {/* Interactive Map or Fallback */}
          {scriptError ? (
            <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200">
              <AlertCircle className="size-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-xs">{scriptError}</AlertDescription>
            </Alert>
          ) : (
            <div className="relative h-[320px] w-full overflow-hidden rounded-lg border border-border">
              {isScriptLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-muted/80 backdrop-blur-xs">
                  <Loader2 className="size-6 animate-spin text-primary" />
                  <span className="text-muted-foreground text-xs">Loading Google Maps...</span>
                </div>
              )}
              <div ref={mapContainerRef} className="h-full w-full" />
            </div>
          )}

          {/* Selected Address details preview */}
          {addressDetails.formatted && (
            <div className="rounded-md border border-border/70 bg-muted/30 p-2.5 text-xs">
              <span className="font-semibold text-foreground">Detected Address: </span>
              <span className="text-muted-foreground">{addressDetails.formatted}</span>
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

        <DialogFooter className="mt-4 gap-2 sm:gap-0">
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
