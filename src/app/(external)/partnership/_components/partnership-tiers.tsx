"use client";

import { Mail, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePartnershipContent } from "@/lib/content/hooks";

export function PartnershipTiers() {
  const { content } = usePartnershipContent();
  const contactEmail = content.hero.contactEmail || "hello@gdgjakarta.org";
  const visibleTiers = content.tiers.filter((tier) => tier.isActive !== false);

  return (
    <section id="tiers" className="bg-muted/30 py-16 lg:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header with Title and "hybrid agenda" pill */}
        <div className="flex flex-col justify-between gap-4 pb-2 sm:flex-row sm:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 font-medium text-muted-foreground text-xs shadow-2xs">
              <Sparkles className="size-3.5 text-primary" />
              <span>{content.devfest.title || "DevFest Jakarta 2026"}</span>
            </div>
            <h2 className="font-bold text-3xl text-foreground tracking-tight sm:text-4xl">Sponsorship Package</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground text-sm sm:text-base">
              Elevate your brand presence across our hybrid conference agenda. Connect with software engineers, system
              architects, and tech leaders in Jakarta.
            </p>
          </div>
          <div className="shrink-0 self-start sm:self-end">
            <span className="inline-flex items-center rounded-full border-2 border-foreground/80 bg-background px-4 py-1 font-semibold text-foreground text-xs tracking-tight shadow-xs sm:text-sm dark:border-foreground/60">
              hybrid agenda
            </span>
          </div>
        </div>

        {/* 4 Cards Grid */}
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {visibleTiers.map((tier) => (
            <div
              key={tier.id || tier.name}
              className="relative flex flex-col justify-between rounded-2xl border-2 border-foreground/15 bg-card p-6 shadow-xs transition-all duration-300 hover:border-foreground/40 hover:shadow-md dark:border-foreground/20"
            >
              <div>
                <h3 className="font-bold text-2xl text-foreground tracking-tight">{tier.name}</h3>
                <p className="mt-1 font-medium text-muted-foreground text-xs">Pricing upon request</p>

                <div className="my-5 border-border/60 border-t" />

                <ol className="space-y-3.5 text-foreground/90 text-xs">
                  {tier.highlights?.map((highlight, hIdx) => {
                    const [title, sub] = highlight.split("\n");
                    return (
                      <li key={`${tier.id || tier.name}-${title}`} className="flex items-start gap-2.5">
                        <span className="shrink-0 select-none font-semibold text-foreground/90 text-xs">
                          {hIdx + 1}.
                        </span>
                        <div className="leading-snug">
                          <span className="font-medium text-foreground">{title}</span>
                          {sub && (
                            <span className="mt-0.5 block text-[11px] text-muted-foreground leading-tight">{sub}</span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>

              <div className="mt-8 border-border/60 border-t pt-4">
                <Button
                  asChild
                  variant="outline"
                  className="w-full rounded-xl font-semibold text-xs transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  <a
                    href={`mailto:${contactEmail}?subject=%5BSponsorship%20Proposal%5D%20Request%20for%20${encodeURIComponent(
                      tier.name,
                    )}%20Tier&body=Hi%20GDG%20Jakarta%20Team%2C%0A%0AWe%20would%20like%20to%20receive%20the%20detailed%20proposal%20deck%20and%20pricing%20for%20the%20${encodeURIComponent(
                      tier.name,
                    )}%20tier.%0A%0ACompany%3A%0AName%3A%0APhone%2FWhatsApp%3A%0A%0AThank%20you!`}
                  >
                    <Mail className="mr-1.5 size-3.5" />
                    Request Proposal Deck
                  </a>
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Slide Footnote Pill */}
        <div className="mt-10 flex justify-center">
          <div className="max-w-3xl rounded-full border border-border bg-background px-6 py-2.5 text-center text-muted-foreground text-xs shadow-2xs sm:text-sm">
            Brand visibility will be served in our social media post, web-page event, merchandise and printings.
          </div>
        </div>

        <div className="mt-3 text-center text-muted-foreground text-xs">
          <p>* Speaking opportunities title have to meet our criteria.</p>
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
