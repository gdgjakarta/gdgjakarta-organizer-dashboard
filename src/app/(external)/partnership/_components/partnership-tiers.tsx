"use client";

import { Check, Mail, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePartnershipContent } from "@/lib/content/hooks";

export function PartnershipTiers() {
  const { content } = usePartnershipContent();
  const contactEmail = content.hero.contactEmail || "hello@gdgjakarta.org";
  const visibleTiers = content.tiers.filter((tier) => tier.isActive !== false);

  return (
    <section id="tiers" className="bg-muted/30 py-16 lg:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div
            className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1 font-medium text-xs"
            style={{
              borderColor: "var(--theme-border)",
              backgroundColor: "var(--background)",
              color: "var(--theme-text)",
            }}
          >
            <Sparkles className="size-3.5" style={{ color: "var(--theme-primary)" }} />
            <span>{content.devfest.title ? `${content.devfest.title} Packages` : "Sponsorship Packages"}</span>
          </div>

          <h2 className="mt-4 font-bold text-2xl text-foreground tracking-tight sm:text-4xl">
            Sponsorship Tiers & Packages
          </h2>
          <p className="mt-3 text-muted-foreground text-sm leading-relaxed sm:text-base">
            Select a tier that matches your quarterly marketing, hiring, or developer advocacy budget. Every package can
            be tailored to fit your unique campaign objectives.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {visibleTiers.map((tier) => (
            <div
              key={tier.id || tier.name}
              className={`relative flex flex-col justify-between rounded-2xl border bg-background p-6 shadow-xs transition-all duration-300 hover:shadow-lg ${
                tier.popular ? "ring-2 ring-[var(--theme-primary)]" : ""
              }`}
              style={{
                borderColor: tier.popular ? "var(--theme-primary)" : "var(--theme-border)",
              }}
            >
              {tier.popular && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 max-w-[calc(100%-2rem)] rounded-full px-3 py-0.5 text-center font-semibold text-[11px] shadow-sm"
                  style={{
                    backgroundColor: "var(--theme-primary)",
                    color: "var(--theme-primary-foreground)",
                  }}
                >
                  {tier.badge || "Most Popular"}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-foreground text-xl">{tier.name}</h3>
                  {tier.badge && !tier.popular && (
                    <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-[10px] text-muted-foreground">
                      {tier.badge}
                    </span>
                  )}
                </div>

                <p className="mt-2 min-h-[3rem] text-muted-foreground text-xs leading-relaxed">{tier.description}</p>

                <div className="mt-3 rounded-lg bg-muted/60 px-3 py-1.5 text-center font-medium text-[11px] text-foreground/80">
                  {tier.slots}
                </div>

                <div className="my-5 border-t border-dashed" />

                <div className="space-y-2.5">
                  <span className="font-semibold text-foreground text-xs uppercase tracking-wider">
                    What&apos;s Included:
                  </span>
                  <ul className="space-y-2 text-xs">
                    {tier.highlights?.map((highlight) => (
                      <li
                        key={`${tier.id || tier.name}-${highlight}`}
                        className="flex items-start gap-2 text-foreground/80"
                      >
                        <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span className="leading-tight">{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-8 border-t pt-5">
                <Button
                  asChild
                  variant={tier.popular ? "default" : "outline"}
                  className="w-full rounded-xl font-semibold text-xs"
                  style={
                    tier.popular
                      ? {
                          backgroundColor: "var(--theme-primary)",
                          color: "var(--theme-primary-foreground)",
                        }
                      : {}
                  }
                >
                  <a
                    href={`mailto:${contactEmail}?subject=%5BSponsorship%20Proposal%5D%20Request%20for%20${encodeURIComponent(
                      tier.name,
                    )}%20Tier&body=Hi%20GDG%20Jakarta%20Team%2C%0A%0AWe%20would%20like%20to%20receive%20the%20detailed%20proposal%20deck%20and%20pricing%20for%20the%20${encodeURIComponent(
                      tier.name,
                    )}.%0A%0ACompany%3A%0AName%3A%0APhone%2FWhatsApp%3A%0A%0AThank%20you!`}
                  >
                    <Mail className="mr-1.5 size-3.5" />
                    Request Proposal Deck
                  </a>
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Footnote notes from proposal deck */}
        <div className="mt-8 space-y-1 text-center text-muted-foreground text-xs">
          <p>* Speaking opportunities title have to meet our criteria.</p>
          <p>Brand visibility will be served in our social media post, web-page event, merchandise and printings.</p>
        </div>

        {/* Bespoke Activations Notice */}
        <div className="mt-12 flex flex-col items-center justify-between gap-6 rounded-2xl border border-dashed bg-card/70 p-6 text-center sm:flex-row sm:p-8 sm:text-left">
          <div className="space-y-1">
            <h4 className="font-bold text-base text-foreground sm:text-lg">Need a Custom or Specialized Activation?</h4>
            <p className="max-w-2xl text-muted-foreground text-xs sm:text-sm">
              We frequently build custom packages for Official Coffee Bars, Hackathon Challenge Tracks, Speaker VIP
              Dinners, After-Parties, and Women Techmakers (WTM) diversity scholarships.
            </p>
          </div>
          <Button asChild variant="outline" className="shrink-0 rounded-xl font-medium">
            <a href={`mailto:${contactEmail}?subject=%5BCustom%20Partnership%5D%20Special%20Activation%20Idea`}>
              Discuss Custom Idea &rarr;
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
