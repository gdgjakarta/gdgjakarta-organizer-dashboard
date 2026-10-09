import Image from "next/image";

import { Calendar } from "lucide-react";

import type { BevyEvent } from "@/lib/bevy/types";

interface PublicEventHeroProps {
  event: BevyEvent;
}

export function PublicEventHero({ event }: PublicEventHeroProps) {
  // Resolve event banner (recommended Bevy size: 2560 x 650 pixels)
  const bannerImageUrl = event.cropped_banner_url ?? event.banner?.url ?? event.banner?.thumbnail_url;

  // Resolve event thumbnail (recommended Bevy size: 1080 x 1080 pixels)
  const thumbnailImageUrl = event.cropped_picture_url ?? event.picture?.url ?? event.picture?.thumbnail_url;

  let heroContent = (
    <div className="relative aspect-[2560/650] w-full">
      <div className="flex size-full flex-col items-center justify-center bg-linear-to-br from-blue-500/10 via-primary/5 to-purple-500/10 p-6 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:size-16">
          <Calendar className="size-7 sm:size-8" />
        </div>
        <p className="mt-3 font-semibold text-foreground text-sm">{event.title}</p>
      </div>
    </div>
  );

  if (bannerImageUrl) {
    heroContent = (
      <div className="relative aspect-[2560/650] w-full">
        <Image
          src={bannerImageUrl}
          alt={event.title}
          fill
          priority
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 75vw, 1200px"
          className="object-cover"
          unoptimized={!bannerImageUrl.includes("res.cloudinary.com")}
        />
      </div>
    );
  } else if (thumbnailImageUrl) {
    heroContent = (
      <div className="flex w-full items-center justify-center bg-linear-to-b from-muted/50 to-muted/20 p-4 sm:p-6">
        <div className="relative aspect-square w-full max-w-[420px] overflow-hidden rounded-xl border border-border/50 shadow-sm">
          <Image
            src={thumbnailImageUrl}
            alt={event.title}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 420px"
            className="object-cover"
            unoptimized={!thumbnailImageUrl.includes("res.cloudinary.com")}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-border/40 bg-muted/30 shadow-xs">
      {heroContent}
    </div>
  );
}
