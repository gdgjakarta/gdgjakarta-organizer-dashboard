"use client";

import { useState } from "react";

import Link from "next/link";

import { Check, Copy, Download, Mail, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { usePartnershipContent } from "@/lib/content/hooks";
import { resolveStatTokens } from "@/lib/content/token-resolver";

interface LiveStatsProp {
  membersCount: number;
  eventsCount: number;
  teamCount: number;
}

interface PartnershipHeroProps {
  liveStats?: LiveStatsProp;
}

export function PartnershipHero({ liveStats }: PartnershipHeroProps = {}) {
  const { content } = usePartnershipContent();
  const [copied, setCopied] = useState(false);

  const officialEmail = content.hero.contactEmail || "hello@gdgjakarta.org";
  const featuredEventTitle = content.devfest.title || "Featured Event";

  const formatMembers = (num: number) => {
    if (num >= 1000) {
      const k = (num / 1000).toFixed(1).replace(/\.0$/, "");
      return `${k}K+`;
    }
    return `${num}+`;
  };

  // Resolve dynamic values for stats based on Bevy metrics unless overridden manually
  const effectiveStats = content.hero.stats.map((stat) => {
    // If autoSyncMetric is set or matches default member/event stat ids
    if (liveStats) {
      if (stat.autoSyncMetric === "members" || stat.id === "stat-1") {
        return { ...stat, value: formatMembers(liveStats.membersCount) };
      }
      if (stat.autoSyncMetric === "events" || stat.id === "stat-3") {
        return { ...stat, value: `${liveStats.eventsCount}+` };
      }
      if (stat.autoSyncMetric === "team") {
        return { ...stat, value: `${liveStats.teamCount}+` };
      }
    }
    return stat;
  });

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(officialEmail);
      setCopied(true);
      toast.success("Email copied to clipboard!", {
        description: `${officialEmail} is ready to paste into your mail app.`,
      });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Could not copy automatically", {
        description: `Please email us directly at ${officialEmail}`,
      });
    }
  };

  return (
    <section className="relative overflow-hidden pt-12 pb-16 sm:pt-16 sm:pb-20 lg:pt-20 lg:pb-24">
      {/* Decorative ambient gradient backdrop */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 size-[650px] -translate-x-1/2 rounded-full opacity-35 blur-3xl"
        style={{
          background: "radial-gradient(circle, var(--theme-primary) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />

      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          {/* Announcement Badge */}
          <div
            className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-medium text-xs shadow-xs"
            style={{
              borderColor: "var(--theme-border)",
              backgroundColor: "var(--theme-bg-subtle)",
              color: "var(--theme-text)",
            }}
          >
            <Sparkles className="size-3.5" style={{ color: "var(--theme-primary)" }} />
            <span>{content.hero.badge || "Brand Collaboration & Sponsorship"}</span>
          </div>

          {/* Main Headline */}
          <h1 className="mt-6 font-extrabold text-3xl tracking-tight sm:text-5xl lg:text-6xl lg:leading-[1.1]">
            {content.hero.title || "Empower Indonesia's Premier Developer Community"}
          </h1>

          {/* Subtitle / Objective Copy */}
          <p className="mx-auto mt-6 max-w-3xl text-foreground/80 text-base leading-relaxed sm:text-lg sm:leading-relaxed">
            {resolveStatTokens(
              content.hero.description ||
                "Connect your brand with over 10,000+ passionate software engineers, tech leads, system architects, and tech innovators in Jakarta.",
              effectiveStats,
            )}
          </p>

          <p className="mt-3 font-medium text-[var(--theme-primary)] text-sm sm:text-base">
            Let’s build something impactful together!
          </p>

          {/* Action CTAs: Modern Segmented Island / Floating Dock */}
          <div className="mt-8 flex justify-center">
            <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-full border border-[var(--theme-border)] bg-background/90 p-1.5 shadow-md backdrop-blur-md transition-all sm:gap-2">
              <Button
                asChild
                size="lg"
                className="h-11 rounded-full px-6 font-medium text-[14px] shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-95"
                style={{
                  backgroundColor: "var(--theme-primary)",
                  color: "var(--theme-primary-foreground)",
                }}
              >
                <a
                  href={`mailto:${officialEmail}?subject=%5BPartnership%20Inquiry%5D%20Collaboration%20with%20GDG%20Jakarta&body=Hi%20GDG%20Jakarta%20Team%2C%0A%0AWe%20are%20interested%20in%20partnering%20with%20GDG%20Jakarta%20for%20${encodeURIComponent(
                    featuredEventTitle,
                  )}%20%2F%20community%20initiatives.%0A%0ACompany%20Name%3A%0AContact%20Person%3A%0ACollaboration%20Interest%3A%0A%0ALooking%20forward%20to%20hearing%20from%20you!`}
                  className="inline-flex items-center gap-2"
                >
                  <Mail className="size-4" />
                  <span>Drop an Email</span>
                </a>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={handleCopyEmail}
                className="h-11 rounded-full px-4 font-medium text-[14px] text-foreground transition-all duration-200 hover:bg-muted/80 active:scale-95"
              >
                {copied ? (
                  <>
                    <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-4 text-muted-foreground" />
                    <span>Copy {officialEmail}</span>
                  </>
                )}
              </Button>

              <div className="hidden h-5 w-px bg-border/80 sm:block" />

              {content.hero.proposalDeckUrl && (
                <Button
                  asChild
                  variant="ghost"
                  size="lg"
                  className="h-11 rounded-full px-4 font-medium text-[14px] text-foreground transition-all duration-200 hover:bg-muted/80 active:scale-95"
                >
                  <a
                    href={content.hero.proposalDeckUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5"
                  >
                    <Download className="size-4 text-muted-foreground" />
                    <span>Deck</span>
                  </a>
                </Button>
              )}

              <Button
                asChild
                variant="ghost"
                size="lg"
                className="h-11 rounded-full px-4 font-medium text-[14px] text-muted-foreground transition-all duration-200 hover:bg-muted/80 hover:text-foreground active:scale-95"
              >
                <Link href="#tiers" className="inline-flex items-center gap-1.5">
                  <Trophy className="size-4 text-amber-500" />
                  <span>Explore Packages</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Highlight Stats Row */}
        <div className="mt-14 flex flex-wrap items-stretch justify-center gap-3 sm:gap-4">
          {effectiveStats.map((stat, i) => (
            <div
              key={stat.id || i}
              className="flex w-[calc(50%-0.375rem)] min-w-[140px] max-w-[280px] flex-1 flex-col items-center justify-center rounded-2xl border p-5 text-center shadow-xs transition-all sm:w-auto"
              style={{
                backgroundColor: "var(--theme-bg-subtle)",
                borderColor: "var(--theme-border)",
              }}
            >
              <span className="font-extrabold text-2xl tracking-tight sm:text-3xl text-foreground">{stat.value}</span>
              <span className="mt-1 font-medium text-muted-foreground text-xs sm:text-sm">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
