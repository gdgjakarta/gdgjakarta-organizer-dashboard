import Image from "next/image";

import { CalendarX2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  getDateKeyInTimeZone,
  getEventPhase,
  getMinutesInTimeZone,
  getStageHighlight,
  LIVE_AGENDA_FULL_AGENDA_URL,
  LIVE_AGENDA_LOGO_URL,
  LIVE_AGENDA_TIME_ZONE,
  LIVE_AGENDA_TIME_ZONE_LABEL,
  type LiveAgendaStage,
  type LiveAgendaStatus,
} from "@/lib/events/live-agenda";
import { cn } from "@/lib/utils";

interface CurrentTimeColumnProps {
  now: Date | null;
  stages: LiveAgendaStage[];
}

const STATUS_LABEL: Record<LiveAgendaStatus, string> = {
  live: "Happening now",
  upcoming: "Up next",
  finished: "Finished",
};

function formatClock(now: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: LIVE_AGENDA_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(now);
}

function formatDate(now: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: LIVE_AGENDA_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
}

function stageTitle(name: string): string {
  return /track/i.test(name) ? name : `${name} Track`;
}

export function CurrentTimeColumn({ now, stages }: CurrentTimeColumnProps) {
  const nowMinutes = now ? getMinutesInTimeZone(now) : null;
  const todayKey = now ? getDateKeyInTimeZone(now) : null;

  return (
    <section
      aria-label="Current time and nearest agenda"
      className="flex flex-col justify-center gap-8 lg:col-start-2 lg:row-start-1"
    >
      <header className="flex justify-center">
        <Image
          src={LIVE_AGENDA_LOGO_URL}
          alt="DevFest Jakarta 2026"
          width={453}
          height={124}
          priority
          className="h-16 w-auto sm:h-20"
        />
      </header>

      <div className="flex flex-col items-center gap-1 rounded-2xl border border-white/30 bg-white/15 p-6 text-center shadow-2xs backdrop-blur-sm">
        <time
          dateTime={now?.toISOString()}
          className="font-bold text-5xl tabular-nums tracking-tight sm:text-6xl"
          suppressHydrationWarning
        >
          {now ? formatClock(now) : "--:--:--"}
        </time>
        <p className="font-medium text-sm text-white/80">
          {LIVE_AGENDA_TIME_ZONE_LABEL} · {LIVE_AGENDA_TIME_ZONE}
        </p>
        <p className="min-h-5 text-white/80 text-xs">{now ? formatDate(now) : ""}</p>
      </div>

      {stages.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/40 border-dashed p-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-white/20 text-white">
            <CalendarX2 className="size-6" />
          </div>
          <h2 className="font-semibold text-base">No upcoming agenda</h2>
          <p className="max-w-xs text-white/80 text-xs">
            There is no running or upcoming event with a published agenda yet. Check back closer to the event.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {stages.map((stage) => {
            const highlight =
              nowMinutes === null || todayKey === null
                ? null
                : getStageHighlight(stage.items, nowMinutes, getEventPhase(stage, todayKey));

            return (
              <article
                key={stage.id}
                className="flex flex-col gap-2 text-center text-shadow-[0_2px_16px] text-shadow-black/50"
              >
                <h2 className="font-semibold text-sm text-white/80 uppercase tracking-wider">
                  {stageTitle(stage.name)}
                </h2>
                {highlight ? (
                  <>
                    <h3 className="text-balance font-bold text-2xl leading-snug tracking-tight">
                      {highlight.item.activity}
                    </h3>
                    <div className="flex items-center justify-center gap-2">
                      <Badge
                        className={cn(
                          "border-transparent text-shadow-none",
                          highlight.status === "live" ? "bg-white text-green-700" : "bg-white/20 text-white",
                        )}
                      >
                        {STATUS_LABEL[highlight.status]}
                      </Badge>
                      <span className="font-bold text-white/90 text-xs tabular-nums">{highlight.item.time}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-white/80">{now ? "Schedule to be announced" : "Loading…"}</p>
                )}
              </article>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-1 text-center text-shadow-[0_2px_16px] text-shadow-black/50">
        <p className="font-medium text-sm text-white/90">See full agenda here</p>
        <a
          href={LIVE_AGENDA_FULL_AGENDA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-base underline underline-offset-4 outline-none focus-visible:ring-4 focus-visible:ring-white/60"
        >
          {LIVE_AGENDA_FULL_AGENDA_URL.replace(/^https?:\/\//, "")}
        </a>
      </div>
    </section>
  );
}
