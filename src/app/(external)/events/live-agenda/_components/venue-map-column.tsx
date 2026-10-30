import Image from "next/image";

import { LIVE_AGENDA_VENUE_MAP_URL } from "@/lib/events/live-agenda";

export function VenueMapColumn() {
  return (
    <section
      aria-label="Venue map"
      className="flex flex-col items-center justify-center gap-6 text-center lg:col-start-1 lg:row-start-1"
    >
      <h2 className="text-balance font-bold text-2xl text-shadow-[0_2px_16px] text-shadow-black/50 leading-tight tracking-tight">
        Venue Map
      </h2>

      <Image
        src={LIVE_AGENDA_VENUE_MAP_URL}
        alt="Venue map: Entrance Gate, Gedung Sasono Utomo and Gedung Sasono Adiguno at TMII, with Sasana Kriya, Borobudur Mini and Jami' Pangeran Diponegoro Mosque nearby"
        width={1080}
        height={1350}
        className="h-auto w-64 rounded-2xl shadow-lg sm:w-72"
      />

      <h3 className="text-balance font-medium text-base text-shadow-[0_2px_16px] text-shadow-black/50 text-white/90">
        Find your way around Taman Mini Indonesia Indah, from the entrance gate, food stalls, and mosque.
      </h3>
    </section>
  );
}
