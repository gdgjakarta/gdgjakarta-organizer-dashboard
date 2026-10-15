"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";

import { ArrowRight, Clock, ExternalLink, Mail, RefreshCw, ShieldAlert, Sparkles } from "lucide-react";

import { GdgLogo } from "@/components/gdg-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MaintenanceConfig } from "@/config/maintenance-config";

interface MaintenanceScreenProps {
  config: MaintenanceConfig;
  onRefresh?: () => void;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
}

function calculateTimeRemaining(targetIso?: string | null): TimeRemaining | null {
  if (!targetIso) return null;
  const targetTime = new Date(targetIso).getTime();
  if (Number.isNaN(targetTime)) return null;

  const now = Date.now();
  const diff = targetTime - now;

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / 1000 / 60) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return { days, hours, minutes, seconds, isPast: false };
}

export function MaintenanceScreen({ config, onRefresh }: MaintenanceScreenProps) {
  const [timeLeft, setTimeLeft] = useState<TimeRemaining | null>(() => calculateTimeRemaining(config.estimatedEndTime));
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!config.estimatedEndTime) return;
    const interval = setInterval(() => {
      setTimeLeft(calculateTimeRemaining(config.estimatedEndTime));
    }, 1000);
    return () => clearInterval(interval);
  }, [config.estimatedEndTime]);

  const formattedEstimatedDate = useMemo(() => {
    if (!config.estimatedEndTime) return null;
    try {
      const d = new Date(config.estimatedEndTime);
      if (Number.isNaN(d.getTime())) return null;
      return new Intl.DateTimeFormat("en-ID", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(d);
    } catch {
      return null;
    }
  }, [config.estimatedEndTime]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    if (onRefresh) {
      onRefresh();
    } else {
      window.location.reload();
    }
    setTimeout(() => setIsRefreshing(false), 800);
  };

  return (
    <div className="relative flex min-h-screen flex-col justify-between overflow-hidden bg-background text-foreground">
      {/* Decorative Google-colored top accent bar */}
      <div className="flex h-1.5 w-full shrink-0">
        <div className="h-full flex-1 bg-[#4285F4]" />
        <div className="h-full flex-1 bg-[#EA4335]" />
        <div className="h-full flex-1 bg-[#FBBC04]" />
        <div className="h-full flex-1 bg-[#34A853]" />
      </div>

      {/* Background ambient gradient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center overflow-hidden"
      >
        <div className="h-[420px] w-[500px] rounded-full bg-primary/5 blur-[120px] dark:bg-primary/10" />
      </div>

      {/* Header bar */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 md:px-8">
        <div className="flex items-center gap-3">
          <GdgLogo size={42} className="h-7 w-auto" />
          <div className="flex flex-col">
            <span className="font-semibold text-foreground text-sm tracking-tight sm:text-base">
              Google Developer Groups
            </span>
            <span className="font-medium text-muted-foreground text-xs">Jakarta</span>
          </div>
        </div>

        <Badge
          variant="outline"
          className="gap-1.5 border-amber-500/40 bg-amber-500/10 px-3 py-1 font-medium text-amber-700 text-xs dark:text-amber-400"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
          </span>
          System Maintenance
        </Badge>
      </header>

      {/* Main hero card */}
      <main className="mx-auto my-auto flex w-full max-w-3xl flex-col items-center px-6 py-10 text-center md:py-16">
        {/* Animated Icon badge */}
        <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-[#4285F4]/10 via-[#EA4335]/10 to-[#FBBC04]/10" />
          <ShieldAlert className="relative h-10 w-10 text-[#4285F4]" />
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#34A853]">
            <Sparkles className="h-2.5 w-2.5 text-white" />
          </span>
        </div>

        <h1 className="font-extrabold text-3xl tracking-tight sm:text-4xl md:text-5xl">
          {config.title || "Under Scheduled Maintenance"}
        </h1>

        <p className="mt-4 font-medium text-base text-primary/90 sm:text-lg">
          {config.headline || "We're making GDG Jakarta even better!"}
        </p>

        <p className="mt-3 max-w-xl text-muted-foreground text-sm leading-relaxed sm:text-base">
          {config.message ||
            "Our team is currently performing scheduled system updates and improvements. All community services and event registration will resume shortly."}
        </p>

        {/* Live Countdown & End Time display */}
        {config.estimatedEndTime && timeLeft && (
          <div className="mt-8 flex w-full max-w-md flex-col items-center rounded-2xl border border-border/70 bg-card/60 p-5 shadow-xs backdrop-blur-xs">
            <div className="flex items-center gap-1.5 font-medium text-muted-foreground text-xs">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span>{timeLeft.isPast ? "Finalizing Updates" : "Estimated Completion Countdown"}</span>
            </div>

            {!timeLeft.isPast ? (
              <div className="mt-3 grid grid-cols-4 gap-2 text-center sm:gap-3">
                <div className="flex flex-col rounded-xl border border-border/60 bg-background/80 p-2 sm:p-2.5">
                  <span className="font-bold text-foreground text-xl tracking-tight sm:text-2xl">
                    {String(timeLeft.days).padStart(2, "0")}
                  </span>
                  <span className="font-medium text-[10px] text-muted-foreground uppercase">Days</span>
                </div>
                <div className="flex flex-col rounded-xl border border-border/60 bg-background/80 p-2 sm:p-2.5">
                  <span className="font-bold text-foreground text-xl tracking-tight sm:text-2xl">
                    {String(timeLeft.hours).padStart(2, "0")}
                  </span>
                  <span className="font-medium text-[10px] text-muted-foreground uppercase">Hours</span>
                </div>
                <div className="flex flex-col rounded-xl border border-border/60 bg-background/80 p-2 sm:p-2.5">
                  <span className="font-bold text-foreground text-xl tracking-tight sm:text-2xl">
                    {String(timeLeft.minutes).padStart(2, "0")}
                  </span>
                  <span className="font-medium text-[10px] text-muted-foreground uppercase">Mins</span>
                </div>
                <div className="flex flex-col rounded-xl border border-border/60 bg-background/80 p-2 sm:p-2.5">
                  <span className="font-bold text-[#4285F4] text-xl tracking-tight sm:text-2xl">
                    {String(timeLeft.seconds).padStart(2, "0")}
                  </span>
                  <span className="font-medium text-[10px] text-muted-foreground uppercase">Secs</span>
                </div>
              </div>
            ) : (
              <p className="mt-3 font-medium text-amber-600 text-sm dark:text-amber-400">
                Maintenance operations are in their final phase. We should be back in a few moments!
              </p>
            )}

            {formattedEstimatedDate && (
              <p className="mt-3 text-muted-foreground text-xs">
                Target: <span className="font-medium text-foreground">{formattedEstimatedDate}</span>
              </p>
            )}
          </div>
        )}

        {/* Action Row */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={handleRefresh} variant="default" className="gap-2 shadow-xs" disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Checking Status..." : "Refresh Page"}
          </Button>

          {config.contactEmail && (
            <Button asChild variant="outline" className="gap-2">
              <a href={`mailto:${config.contactEmail}`}>
                <Mail className="h-4 w-4" />
                Contact Organizers
              </a>
            </Button>
          )}
        </div>

        {/* Social / Community Links */}
        {config.showSocialLinks && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-muted-foreground text-xs">
            <span className="font-medium text-foreground">Follow Community Updates:</span>
            <a
              href="https://instagram.com/gdgjakarta"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium hover:text-primary hover:underline"
            >
              Instagram @gdgjakarta
              <ExternalLink className="h-3 w-3" />
            </a>
            <span>•</span>
            <a
              href="https://gdg.community.dev/gdg-jakarta/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium hover:text-primary hover:underline"
            >
              Bevy Chapter Page
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </main>

      {/* Footer & Organizer Access */}
      <footer className="border-border/40 border-t py-5 text-center">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 text-muted-foreground text-xs sm:flex-row md:px-8">
          <p>© {new Date().getFullYear()} GDG Jakarta. Built with Google developer community spirit.</p>

          {/* Discreet Organizer Entry to prevent lockouts */}
          <Link
            href="/auth/login?callbackUrl=/dashboard/maintenance"
            className="group inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-muted-foreground/80 text-xs transition-colors hover:bg-muted hover:text-foreground"
          >
            <span>Organizer Sign In</span>
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </footer>
    </div>
  );
}
