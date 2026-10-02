import Link from "next/link";

import { CheckCircle2, QrCode, ShieldCheck, Ticket, Users } from "lucide-react";

import { Button } from "@/components/ui/button";

export function CommunityAccessSpotlight() {
  return (
    <section
      className="relative overflow-hidden border-y py-20 transition-colors duration-500 lg:py-28"
      style={{
        backgroundColor: "var(--theme-bg-subtle)",
        borderColor: "var(--theme-border)",
      }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          {/* Left Column: Bold Headline & Copy */}
          <div className="flex flex-col items-start lg:col-span-6">
            <span
              className="font-medium text-xs uppercase tracking-widest transition-colors duration-500"
              style={{ color: "var(--theme-text)" }}
            >
              Direct Community Access
            </span>

            <h2 className="mt-3 text-left font-medium text-[32px] leading-[1.1] tracking-tight sm:text-[44px] lg:text-[59.33px]">
              Developers. Mentors. <br />
              <span style={{ color: "var(--theme-text)" }}>Nothing in between.</span>
            </h2>

            <p className="mt-6 text-[14px] text-muted-foreground leading-relaxed">
              No paywalls or algorithms between you and your technical growth. GDG Jakarta gives you direct, unmediated
              access to real engineering discussions, collaborative code reviews, and live Q&A sessions with Google
              Developer Experts.
            </p>

            <ul className="mt-8 space-y-4">
              {[
                "100% free registrations for official workshops and seminars",
                "Direct networking with local engineering leaders & founders",
                "Instant digital RSVP passes with fast QR check-in at venues",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-[14px]">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0" style={{ color: "var(--theme-primary)" }} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-10">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-full px-8 font-medium text-[14px] shadow-[var(--theme-shadow)] transition-all hover:scale-[1.02]"
                style={{
                  backgroundColor: "var(--theme-primary)",
                  color: "var(--theme-primary-foreground)",
                }}
              >
                <Link href="/events">Explore Available Passes</Link>
              </Button>
            </div>
          </div>

          {/* Right Column: Floating UI Ticket / Member Pass Mockup */}
          <div className="relative flex justify-center lg:col-span-6">
            {/* Ambient Backlight */}
            <div
              className="pointer-events-none absolute inset-0 rounded-full opacity-40 blur-3xl"
              style={{
                background: "radial-gradient(circle, var(--theme-primary) 0%, transparent 70%)",
              }}
            />

            {/* Floating Ticket Container */}
            <div
              className="relative w-full max-w-md overflow-hidden rounded-[2.5rem] border bg-background p-6 shadow-2xl transition-all duration-300 sm:p-8"
              style={{
                borderColor: "var(--theme-border)",
              }}
            >
              {/* Badge Header */}
              <div
                className="flex items-center justify-between border-b pb-5"
                style={{ borderColor: "var(--theme-border)" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex size-10 items-center justify-center rounded-2xl"
                    style={{
                      backgroundColor: "var(--theme-bg-subtle)",
                      color: "var(--theme-primary)",
                    }}
                  >
                    <Ticket className="size-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">GDG Jakarta All-Access</h4>
                    <p className="text-muted-foreground text-xs">Community Digital Badge</p>
                  </div>
                </div>

                <div
                  className="flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold text-xs"
                  style={{
                    backgroundColor: "var(--theme-bg-subtle)",
                    color: "var(--theme-text)",
                  }}
                >
                  <ShieldCheck className="size-3.5" />
                  <span>Verified</span>
                </div>
              </div>

              {/* Ticket Details */}
              <div className="mt-6 space-y-4">
                <div
                  className="rounded-2xl border p-4"
                  style={{ borderColor: "var(--theme-border)", backgroundColor: "var(--theme-bg-subtle)" }}
                >
                  <p className="text-muted-foreground text-xs uppercase tracking-wider">Next Confirmed Event</p>
                  <p className="mt-1 font-bold text-base">DevFest Jakarta 2026: AI & Cloud Horizon</p>
                  <p className="mt-1 text-muted-foreground text-xs">Saturday • Jakarta Convention Center</p>
                </div>

                {/* QR Code Demo Section */}
                <div
                  className="flex items-center justify-between rounded-2xl border border-dashed p-4"
                  style={{ borderColor: "var(--theme-border)" }}
                >
                  <div>
                    <p className="font-semibold text-xs">Fast Check-in Pass</p>
                    <p className="text-[11px] text-muted-foreground">Scan at venue entrance</p>
                    <span className="mt-2 inline-block rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-bold text-[10px] text-emerald-600 dark:text-emerald-400">
                      TIER: ALL-ACCESS
                    </span>
                  </div>
                  <div className="flex size-16 items-center justify-center rounded-xl bg-foreground text-background">
                    <QrCode className="size-11" />
                  </div>
                </div>
              </div>

              {/* Bottom attendee row */}
              <div
                className="mt-6 flex items-center justify-between border-t pt-4 text-xs"
                style={{ borderColor: "var(--theme-border)" }}
              >
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="size-3.5" />
                  <span>3,500+ Registered Attendees</span>
                </div>
                <span className="font-bold text-xs" style={{ color: "var(--theme-text)" }}>
                  Admission: Free
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
