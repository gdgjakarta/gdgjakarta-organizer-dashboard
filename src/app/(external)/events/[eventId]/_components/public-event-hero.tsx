import Image from "next/image";

import { Calendar } from "lucide-react";

import type { BevyEvent } from "@/lib/bevy/types";

interface PublicEventHeroProps {
  event: BevyEvent;
}

export function PublicEventHero({ event }: PublicEventHeroProps) {
  const bannerImageUrl =
    event.cropped_banner_url ?? event.banner?.url ?? event.cropped_picture_url ?? event.picture?.url;

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-border/40 bg-muted/30 shadow-xs">
      <div className="relative aspect-[16/9] w-full sm:aspect-[21/9]">
        {bannerImageUrl ? (
          <Image
            src={bannerImageUrl}
            alt={event.title}
            fill
            priority
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 75vw, 1200px"
            className="object-cover"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center bg-linear-to-br from-blue-500/10 via-primary/5 to-purple-500/10 p-6 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Calendar className="size-8" />
            </div>
            <p className="mt-3 font-semibold text-foreground text-sm">{event.title}</p>
          </div>
        )}
      </div>
    </div>
  );
}
