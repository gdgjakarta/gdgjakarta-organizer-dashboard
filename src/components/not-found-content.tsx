"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ArrowLeft, ArrowUpRight, Calendar, Compass, Handshake, HelpCircle, House, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth/auth-provider";

interface QuickLinkItem {
  title: string;
  description: string;
  href: string;
  icon: typeof Calendar;
  colorClass: string;
}

const QUICK_LINKS: QuickLinkItem[] = [
  {
    title: "Upcoming Events",
    description: "Browse meetups, technical workshops, and DevFest conferences.",
    href: "/events",
    icon: Calendar,
    colorClass: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20",
  },
  {
    title: "Community & Pillars",
    description: "Discover technical tracks across Android, Web, Cloud, and AI.",
    href: "/",
    icon: Users,
    colorClass: "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20",
  },
  {
    title: "Partnership & Sponsors",
    description: "Explore sponsorship packages and collaboration opportunities.",
    href: "/partnership",
    icon: Handshake,
    colorClass: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
  {
    title: "FAQ & Support",
    description: "Find answers about ticketing, registration, and attendance.",
    href: "/faq",
    icon: HelpCircle,
    colorClass: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },
];

export function NotFoundContent() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  let homeHref = "/";
  if (user) {
    homeHref = user.role === "organizer" ? "/dashboard/organizer" : "/dashboard/member";
  }
  const homeLabel = user ? "Go to Dashboard" : "Back to Home";

  const handleGoBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center text-center">
      {/* Ambient Google Colors Glow in the Background */}
      <div
        className="pointer-events-none absolute top-1/4 left-1/2 -z-10 h-72 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-hidden blur-3xl opacity-20 dark:opacity-25"
        aria-hidden="true"
      >
        <div className="h-full w-full bg-gradient-to-r from-blue-500 via-red-500 via-amber-500 to-emerald-500" />
      </div>

      {/* Status Badge */}
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3.5 py-1 text-xs font-medium text-muted-foreground backdrop-blur-xs shadow-xs">
        <span className="flex items-center gap-1" aria-hidden="true">
          <span className="size-2 rounded-full bg-blue-500" />
          <span className="size-2 rounded-full bg-red-500" />
          <span className="size-2 rounded-full bg-amber-500" />
          <span className="size-2 rounded-full bg-emerald-500" />
        </span>
        <span>Error 404 • Page Not Found</span>
      </div>

      {/* Big Stylized 404 Visual Graphic */}
      <div className="relative mt-6 select-none">
        <span
          className="font-black text-8xl tracking-tighter text-foreground/10 select-none sm:text-9xl md:text-[10rem] dark:text-foreground/5"
          aria-hidden="true"
        >
          404
        </span>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-2 rounded-2xl border border-border/80 bg-background/90 px-4 py-2 shadow-xs backdrop-blur-md">
            <Compass className="size-5 animate-pulse text-primary" />
            <span className="font-semibold text-xs text-foreground uppercase tracking-wider sm:text-sm">
              Lost in the Cloud?
            </span>
          </div>
        </div>
      </div>

      {/* Heading and Description */}
      <h1 className="mt-4 font-bold text-3xl text-foreground tracking-tight sm:text-4xl md:text-5xl">
        We couldn&apos;t find that page
      </h1>
      <p className="mt-3 max-w-lg text-muted-foreground text-sm leading-relaxed sm:text-base">
        The page you are looking for doesn&apos;t exist, has been moved, or may have a typo in the URL. Don&apos;t
        worry, let&apos;s get you back on track.
      </p>

      {/* Action Buttons */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button asChild size="default" className="gap-2 shadow-xs">
          <Link href={homeHref}>
            <House className="size-4" />
            <span>{homeLabel}</span>
          </Link>
        </Button>
        <Button variant="outline" size="default" onClick={handleGoBack} className="gap-2">
          <ArrowLeft className="size-4" />
          <span>Go Back</span>
        </Button>
        <Button asChild variant="outline" size="default" className="gap-2">
          <Link href="/events">
            <Calendar className="size-4" />
            <span>Explore Events</span>
          </Link>
        </Button>
      </div>

      {/* Helpful Destinations / Quick Links Grid */}
      <div className="mt-14 w-full border-border/60 border-t pt-10 text-left">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
            Popular destinations you might be looking for
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_LINKS.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="group block focus-visible:outline-none">
                <Card className="h-full border-border/70 bg-card/60 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-card hover:shadow-xs group-focus-visible:ring-2 group-focus-visible:ring-ring">
                  <CardHeader className="p-4">
                    <div className="flex items-center justify-between">
                      <div className={`flex size-8 items-center justify-center rounded-lg border ${item.colorClass}`}>
                        <Icon className="size-4" />
                      </div>
                      <ArrowUpRight className="size-4 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
                    </div>
                    <CardTitle className="mt-3 font-semibold text-foreground text-sm">{item.title}</CardTitle>
                    <CardDescription className="line-clamp-2 text-muted-foreground text-xs leading-normal">
                      {item.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
