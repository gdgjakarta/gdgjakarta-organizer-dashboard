import Image from "next/image";

import gdgIcon from "@/app/favicon/android-chrome-512x512.png";
import { cn } from "@/lib/utils";

interface GdgLogoProps {
  size?: number;
  className?: string;
  alt?: string;
}

/**
 * GDG (Google Developer Groups) Official Brand Logo
 * Renders the crisp official favicon asset from src/app/favicon/
 */
export function GdgLogo({ size = 24, className = "size-5 shrink-0", alt = "GDG Jakarta Logo" }: GdgLogoProps) {
  return (
    <Image
      src={gdgIcon}
      alt={alt}
      width={size}
      height={size}
      priority
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
