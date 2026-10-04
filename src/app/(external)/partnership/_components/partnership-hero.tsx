"use client";

import { useState } from "react";

import Link from "next/link";

import { Check, Copy, ExternalLink, Mail, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

const OFFICIAL_EMAIL = "hello@gdgjakarta.org";

export function PartnershipHero() {
  const [copied, setCopied] = useState(false);

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(OFFICIAL_EMAIL);
      setCopied(true);
      toast.success("Email copied to clipboard!", {
        description: `${OFFICIAL_EMAIL} is ready to paste into your mail app.`,
      });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Could not copy automatically", {
        description: `Please email us directly at ${OFFICIAL_EMAIL}`,
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
            <span>DevFest Jakarta 2026 • Brand Collaboration & Sponsorship Opportunities</span>
          </div>

          {/* Main Headline */}
          <h1 className="mt-6 font-extrabold text-3xl tracking-tight sm:text-5xl lg:text-6xl lg:leading-[1.1]">
            Let’s Elevate the Community Together!
          </h1>

          {/* Subtitle / Objective Copy */}
          <p className="mx-auto mt-6 max-w-3xl text-foreground/80 text-base leading-relaxed sm:text-lg sm:leading-relaxed">
            <strong className="font-semibold text-foreground">DevFest Jakarta 2026 is coming</strong>, and we’re opening
            opportunities for brands to collaborate with us! Position your brand at the center of the developer
            ecosystem and showcase your technology, products, or vision to the right audience of developers, tech leads,
            and innovators.
          </p>

          <p className="mt-3 font-medium text-[var(--theme-primary)] text-sm sm:text-base">
            Let’s build something impactful together!
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <Button
              asChild
              size="lg"
              className="relative h-12 rounded-full px-6 font-medium text-[14px] shadow-[var(--theme-shadow)] transition-all hover:scale-[1.02]"
              style={{
                backgroundColor: "var(--theme-primary)",
                color: "var(--theme-primary-foreground)",
              }}
            >
              <a
                href={`mailto:${OFFICIAL_EMAIL}?subject=%5BPartnership%20Inquiry%5D%20Collaboration%20with%20GDG%20Jakarta&body=Hi%20GDG%20Jakarta%20Team%2C%0A%0AWe%20are%20interested%20in%20partnering%20with%20GDG%20Jakarta%20for%20DevFest%202026%20%2F%20community%20initiatives.%0A%0ACompany%20Name%3A%0AContact%20Person%3A%0ACollaboration%20Interest%3A%0A%0ALooking%20forward%20to%20hearing%20from%20you!`}
                className="inline-flex items-center gap-2"
              >
                <Mail className="size-4" />
                <span>Drop an Email</span>
              </a>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleCopyEmail}
              className="h-12 rounded-full border-[var(--theme-border)] bg-background/80 px-5 font-medium text-[14px] backdrop-blur-xs transition-all hover:border-[var(--theme-primary)] hover:text-[var(--theme-text)]"
            >
              {copied ? (
                <>
                  <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Email Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="size-4" />
                  <span>Copy hello@gdgjakarta.org</span>
                </>
              )}
            </Button>

            <Button
              asChild
              variant="ghost"
              size="lg"
              className="h-12 rounded-full px-5 text-muted-foreground text-[14px] hover:text-foreground"
            >
              <Link href="#tiers" className="inline-flex items-center gap-1.5">
                <Trophy className="size-4" />
                <span>Explore Packages</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Highlight Stats Row */}
        <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div
            className="flex flex-col items-center justify-center rounded-2xl border p-5 text-center shadow-xs transition-all"
            style={{
              backgroundColor: "var(--theme-bg-subtle)",
              borderColor: "var(--theme-border)",
            }}
          >
            <span className="font-extrabold text-2xl tracking-tight sm:text-3xl text-foreground">5,000+</span>
            <span className="mt-1 font-medium text-muted-foreground text-xs sm:text-sm">Community Tech Members</span>
          </div>

          <div
            className="flex flex-col items-center justify-center rounded-2xl border p-5 text-center shadow-xs transition-all"
            style={{
              backgroundColor: "var(--theme-bg-subtle)",
              borderColor: "var(--theme-border)",
            }}
          >
            <span className="font-extrabold text-2xl tracking-tight sm:text-3xl text-foreground">1,000+</span>
            <span className="mt-1 font-medium text-muted-foreground text-xs sm:text-sm">DevFest Attendees</span>
          </div>

          <div
            className="flex flex-col items-center justify-center rounded-2xl border p-5 text-center shadow-xs transition-all"
            style={{
              backgroundColor: "var(--theme-bg-subtle)",
              borderColor: "var(--theme-border)",
            }}
          >
            <span className="font-extrabold text-2xl tracking-tight sm:text-3xl text-foreground">85%+</span>
            <span className="mt-1 font-medium text-muted-foreground text-xs sm:text-sm">Mid/Senior Devs & Leads</span>
          </div>

          <div
            className="flex flex-col items-center justify-center rounded-2xl border p-5 text-center shadow-xs transition-all"
            style={{
              backgroundColor: "var(--theme-bg-subtle)",
              borderColor: "var(--theme-border)",
            }}
          >
            <span className="font-extrabold text-2xl tracking-tight sm:text-3xl text-foreground">25+</span>
            <span className="mt-1 font-medium text-muted-foreground text-xs sm:text-sm">Workshops & Meetups/Year</span>
          </div>
        </div>
      </div>
    </section>
  );
}
