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
}: EventCardImageProps) {
  const [isLoading, setIsLoading] = useState(Boolean(src));
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setIsLoading(Boolean(src));
    setHasError(false);
  }, [src]);

  const showFallback = !src || hasError;

  return (
    <div className={cn("relative w-full overflow-hidden bg-muted", aspectRatio, containerClassName)}>
      {/* Shimmer loading wave and placeholder icon while image is downloading */}
      {isLoading && !showFallback && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted">
          <Calendar className={cn("size-10 text-muted-foreground/20", fallbackIconClassName)} />
          <div className="shimmer-wave" aria-hidden="true" />
        </div>
      )}

      {/* Fallback state when there is no image or when loading fails */}
      {showFallback ? (
        <div className="flex h-full w-full items-center justify-center bg-muted/50">
          <Calendar className={cn("size-10 text-muted-foreground/30", fallbackIconClassName)} />
        </div>
      ) : (
        <Image
          src={src}
          alt={alt}
          fill={fill}
          unoptimized
          priority={priority}
          className={cn(
            "object-cover transition-opacity duration-300",
            isLoading ? "opacity-0" : "opacity-100",
            className,
          )}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
        />
      )}

      {/* Badges or additional overlay content */}
      {children}
    </div>
  );
}
