"use client";

import Link from "next/link";

import { ArrowRight, Calendar, Code, Heart, Sparkles, Users } from "lucide-react";

import { GoogleButton } from "@/app/(main)/auth/_components/social-auth/google-button";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth/auth-provider";

export function CommunityHero() {
  const user = useAuthStore((s) => s.user);

  return (
    <section
      className="relative overflow-hidden border-b py-20 transition-colors duration-500 lg:py-28"
      style={{
        backgroundColor: "var(--theme-bg-subtle)",
        borderColor: "var(--theme-border)",
      }}
    >
      {/* Background ambient radial glow */}
      <div
        className="pointer-events-none absolute -top-40 -right-40 size-[600px] rounded-full opacity-30 blur-3xl"
        style={{
          background: "radial-gradient(circle, var(--theme-primary) 0%, transparent 70%)",
        }}
      />

      <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          {/* Left Column: Editorial Headline & CTAs */}
          <div className="flex flex-col items-start lg:col-span-7">
            {/* Top pill badge */}
            <div
              className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-medium text-xs shadow-xs transition-colors"
              style={{
                borderColor: "var(--theme-border)",
                backgroundColor: "var(--background)",
                color: "var(--theme-text)",
              }}
            >
              <Sparkles className="size-3.5" style={{ color: "var(--theme-primary)" }} />
              <span>Official Chapter • GDG Jakarta</span>
            </div>

            {/* Oversized Display Typography */}
            <h1 className="mt-6 text-left font-medium text-[48px] leading-[1.05] tracking-tight sm:text-[68px] lg:text-[96px]">
              Where developer <br />
              <span
                className="transition-colors duration-500"
                style={{
                  color: "var(--theme-text)",
                }}
              >
                communities
              </span>{" "}
              thrive.
            </h1>

            {/* Subtitle */}
            <p className="mt-6 max-w-xl text-left text-muted-foreground text-[14px] leading-relaxed">
              Google Developer Groups (GDG) Jakarta is the premier hub for developers, creators, and engineers in
              Indonesia to learn Google technologies, build groundbreaking software, and connect directly with industry
              experts.
            </p>

            {/* Pill CTA Row */}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button
                asChild
                size="lg"
                className="group h-12 rounded-full px-8 font-medium text-[14px] shadow-[var(--theme-shadow)] transition-all duration-300 hover:scale-[1.02] hover:bg-[var(--theme-primary-hover)]"
                style={{
                  backgroundColor: "var(--theme-primary)",
                  color: "var(--theme-primary-foreground)",
                }}
              >
                <Link href="/events" className="flex items-center gap-2">
                  <span>Explore Events</span>
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>

              {user ? (
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-12 rounded-full border-[var(--theme-border)] bg-background/80 px-8 font-medium text-[14px] backdrop-blur-xs transition-all duration-300 hover:border-[var(--theme-primary)] hover:bg-background hover:text-[var(--theme-text)]"
                >
                  <Link href={user.role === "organizer" ? "/dashboard/organizer" : "/dashboard/member"}>
                    Go to Dashboard
                  </Link>
                </Button>
              ) : (
                <GoogleButton
                  size="lg"
                  variant="outline"
                  className="h-12 w-auto rounded-full border-[var(--theme-border)] bg-background/80 px-8 font-medium text-[14px] backdrop-blur-xs transition-all duration-300 hover:border-[var(--theme-primary)] hover:bg-background hover:text-[var(--theme-text)]"
                >
                  Join Community
                </GoogleButton>
              )}
            </div>

            {/* Social Proof Stats Pill */}
            <div className="mt-10 flex flex-wrap items-center gap-6 text-muted-foreground text-[14px]">
              <div className="flex items-center gap-2">
                <Users className="size-4" style={{ color: "var(--theme-primary)" }} />
                <span>
                  <strong className="text-foreground">10,000+</strong> Members
                </span>
              </div>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-2">
                <Calendar className="size-4" style={{ color: "var(--theme-primary)" }} />
                <span>
                  <strong className="text-foreground">120+</strong> Events Hosted
                </span>
              </div>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-2">
                <Heart className="size-4" style={{ color: "var(--theme-primary)" }} />
                <span>
                  <strong className="text-foreground">100%</strong> Free & Community Run
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Showcase Card with Floating Elements */}
          <div className="relative lg:col-span-5">
            {/* Visual Glass Card */}
            <div
              className="relative overflow-hidden rounded-[2.5rem] border bg-background/90 p-6 shadow-xl backdrop-blur-md transition-all duration-500 sm:p-8"
              style={{
                borderColor: "var(--theme-border)",
                boxShadow: "var(--theme-shadow)",
              }}
            >
              {/* Card Header Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="flex size-9 items-center justify-center rounded-2xl"
                    style={{
                      backgroundColor: "var(--theme-bg-subtle)",
                      color: "var(--theme-primary)",
                    }}
                  >
                    <Code className="size-5" />
                  </div>
                  <div>
                    <p className="font-medium text-[14px]">GDG Jakarta Community</p>
                    <p className="text-muted-foreground text-xs">Empowering Indonesian Builders</p>
                  </div>
                </div>
                <span
                  className="rounded-full px-3 py-1 font-medium text-xs"
                  style={{
                    backgroundColor: "var(--theme-bg-subtle)",
                    color: "var(--theme-primary)",
                  }}
                >
                  Live Chapter
                </span>
              </div>

              {/* Graphic Banner Mockup */}
              <div
                className="mt-6 flex flex-col justify-end overflow-hidden rounded-2xl p-6 text-white transition-all duration-300"
                style={{
                  background: "linear-gradient(135deg, var(--theme-primary) 0%, #1a1a1a 100%)",
                  minHeight: "220px",
                }}
              >
                <span className="inline-block w-fit rounded-full bg-white/20 px-3 py-0.5 font-medium text-xs backdrop-blur-sm">
                  Flagship Gathering
                </span>
                <h3 className="mt-2 font-medium text-[24px] text-white tracking-tight sm:text-[36.67px]">
                  DevFest Jakarta 2026
                </h3>
                <p className="mt-1 text-white/80 text-[14px]">
                  The biggest annual technology conference by Google Developer Groups in Jakarta.
                </p>
              </div>

              {/* Topics Pills */}
              <div className="mt-6">
                <p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  Technology Pillars
                </p>
                <div className="flex flex-wrap gap-2">
                  {["Gemini & AI", "Google Cloud", "Android & Kotlin", "Next.js & Web", "Flutter", "Firebase"].map(
                    (tag) => (
                      <span
                        key={tag}
                        className="rounded-full border px-3 py-1 font-medium text-xs transition-colors hover:border-[var(--theme-primary)] hover:text-[var(--theme-text)]"
                        style={{
                          borderColor: "var(--theme-border)",
                          backgroundColor: "var(--theme-bg-subtle)",
                        }}
                      >
                        {tag}
                      </span>
                    ),
                  )}
                </div>
              </div>

              {/* Quick Action */}
              <div className="mt-6 border-t pt-4" style={{ borderColor: "var(--theme-border)" }}>
                <Link
                  href="/events"
                  className="flex items-center justify-between font-medium text-[14px] transition-colors hover:text-[var(--theme-text)]"
                >
                  <span>Browse all upcoming activities</span>
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
