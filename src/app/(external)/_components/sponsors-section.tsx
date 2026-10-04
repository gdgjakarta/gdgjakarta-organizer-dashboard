import Image from "next/image";
import Link from "next/link";

import { ExternalLink, Handshake } from "lucide-react";

import type { BevySponsor } from "@/lib/bevy/types";

interface SponsorsSectionProps {
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

export function SponsorsSection({ sponsors }: SponsorsSectionProps) {
  // Deduplicate and filter sponsors with valid logos
  const seenCompanies = new Set<string>();
  const validSponsors = sponsors.filter((sponsor) => {
    if (!sponsor.logo || !sponsor.company?.trim()) return false;
    const normalizedName = sponsor.company.trim().toLowerCase();
    if (seenCompanies.has(normalizedName)) return false;
    seenCompanies.add(normalizedName);
    return true;
  });

  if (validSponsors.length === 0) {
    return (
      <section className="bg-muted/30 py-16">
        <div className="container mx-auto px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-2 font-medium text-[32px] leading-[1.1] tracking-tight sm:text-[44px] lg:text-[59.33px]">
            Our Sponsors & Partners
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-muted-foreground text-[14px] leading-relaxed">
            Interested in supporting GDG Jakarta? Reach out to collaborate with our vibrant developer community.
          </p>
          <div className="mx-auto max-w-md rounded-xl border border-border/80 border-dashed bg-background/50 p-8 text-center">
            <Handshake className="mx-auto mb-3 size-10 text-muted-foreground/50" />
            <p className="text-muted-foreground text-[14px]">Sponsor list is currently updating. Check back soon!</p>
            <div className="mt-4">
              <Link
                href="/partnership"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-1.5 font-medium text-xs text-foreground transition-all hover:border-foreground"
              >
                Learn About Partnership Opportunities &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-muted/30 py-16 lg:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="font-medium text-[32px] leading-[1.1] tracking-tight sm:text-[44px] lg:text-[59.33px]">
            Our Sponsors & Partners
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground text-[14px] leading-relaxed">
            Proudly supported by organizations and tech companies driving innovation and developer empowerment in
            Jakarta.
          </p>
          <div className="mt-4">
            <Link
              href="/partnership"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--theme-border)] bg-[var(--theme-bg-subtle)] px-4 py-1.5 font-medium text-xs text-[var(--theme-text)] transition-all hover:scale-105"
            >
              <span>Explore DevFest 2026 Collaboration & Sponsorship &rarr;</span>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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
              "-translate-y-0.5 group relative flex w-full items-center justify-center rounded-xl transition-all duration-300 hover:bg-card sm:h-28";

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
      </div>
    </section>
  );
}
