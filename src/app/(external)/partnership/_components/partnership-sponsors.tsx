import Image from "next/image";

import { ExternalLink, Handshake } from "lucide-react";

import type { BevySponsor } from "@/lib/bevy/types";

interface PartnershipSponsorsProps {
  sponsors: BevySponsor[];
}

function resolveSponsorUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function PartnershipSponsors({ sponsors }: PartnershipSponsorsProps) {
  const seenCompanies = new Set<string>();
  const validSponsors = sponsors.filter((sponsor) => {
    if (!sponsor.logo || !sponsor.company?.trim()) return false;
    const normalizedName = sponsor.company.trim().toLowerCase();
    if (seenCompanies.has(normalizedName)) return false;
    seenCompanies.add(normalizedName);
    return true;
  });

  return (
    <section className="border-t bg-muted/20 py-16 lg:py-20">
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
            <Handshake className="size-3.5" style={{ color: "var(--theme-primary)" }} />
            <span>Trusted Ecosystem</span>
          </div>

          <h2 className="mt-4 font-bold text-2xl tracking-tight sm:text-3xl text-foreground">
            Trusted by Leading Technology Brands
          </h2>
          <p className="mt-2 text-muted-foreground text-xs sm:text-sm">
            Organizations and community partners who have empowered our developer conferences and community initiatives.
          </p>
        </div>

        {validSponsors.length > 0 ? (
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {validSponsors.map((sponsor) => {
              const href = resolveSponsorUrl(sponsor.url);
              const cardContent = (
                <>
                  <div className="relative h-12 w-full sm:h-14">
                    <Image
                      src={sponsor.logo as string}
                      alt={sponsor.company}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
                      className="object-contain opacity-75 grayscale filter transition-all duration-300 group-hover:scale-105 group-hover:opacity-100 group-hover:grayscale-0"
                    />
                  </div>
                  {href ? (
                    <span className="absolute top-2 right-2 text-muted-foreground/0 transition-all duration-200 group-hover:text-muted-foreground/60">
                      <ExternalLink className="size-3" />
                    </span>
                  ) : null}
                </>
              );

              const cardClasses =
                "-translate-y-0.5 group relative flex w-full items-center justify-center rounded-xl border border-border/60 bg-card p-4 transition-all duration-300 hover:border-border hover:shadow-xs sm:h-24";

              if (href) {
                return (
                  <a
                    key={sponsor.company}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Visit ${sponsor.company}`}
                    title={sponsor.company}
                    className={cardClasses}
                  >
                    {cardContent}
                  </a>
                );
              }

              return (
                <div key={sponsor.company} title={sponsor.company} className={cardClasses}>
                  {cardContent}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-8 mx-auto max-w-md rounded-xl border border-dashed bg-card/60 p-6 text-center">
            <Handshake className="mx-auto mb-2 size-8 text-muted-foreground/40" />
            <p className="text-muted-foreground text-xs">
              Be the first partner to secure category exclusivity for DevFest Jakarta 2026.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
