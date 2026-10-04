"use client";

import { useEffect, useState } from "react";

import Image from "next/image";

import { Calendar } from "lucide-react";

import { cn } from "@/lib/utils";

export interface EventCardImageProps {
  src?: string | null;
  alt: string;
  fill?: boolean;
  className?: string;
  containerClassName?: string;
  aspectRatio?: string;
  priority?: boolean;
  fallbackIconClassName?: string;
  children?: React.ReactNode;
  isLoading?: boolean;
}

export function EventCardImage({
  src,
  alt,
  fill = true,
  className,
  containerClassName,
  aspectRatio = "aspect-video",
  priority = false,
  fallbackIconClassName,
  children,
  isLoading: externalIsLoading,
}: EventCardImageProps) {
  const [internalLoading, setInternalLoading] = useState(Boolean(src));
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setInternalLoading(Boolean(src));
    setHasError(false);
  }, [src]);

  const isLoading = externalIsLoading ?? internalLoading;
  const showFallback = (!src && !isLoading) || hasError;

  const renderContent = () => {
    if (showFallback) {
      return (
        <div className="flex h-full w-full items-center justify-center bg-muted/50">
          <Calendar className={cn("size-10 text-muted-foreground/30", fallbackIconClassName)} />
        </div>
      );
    }

    if (src) {
      return (
        <Image
          src={src}
          alt={alt}
          fill={fill}
          unoptimized
          priority={priority}
          className={cn("object-cover transition-all duration-500", isLoading ? "opacity-0" : "opacity-100", className)}
          onLoad={() => setInternalLoading(false)}
          onError={() => {
            setInternalLoading(false);
            setHasError(true);
          }}
        />
      );
    }

    return null;
  };

  return (
    <div className={cn("relative w-full overflow-hidden bg-muted", aspectRatio, containerClassName)}>
      {/* Shimmer loading wave and placeholder icon while image is downloading or external loading is active */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden bg-muted">
          <Calendar className={cn("size-10 text-muted-foreground/20", fallbackIconClassName)} />
          <div className="shimmer-wave" aria-hidden="true" />
        </div>
      )}

      {/* Fallback state when there is no image or when loading fails */}
      {renderContent()}

      {/* Badges or additional overlay content */}
      {children}
    </div>
  );
}
