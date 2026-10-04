import type { Metadata } from "next";

import { BEVY_CONFIG } from "@/config/bevy-config";
import { getGoogleThemeByKey, getRandomGoogleTheme } from "@/config/homepage-themes";
import { getBevyChapterSponsors } from "@/lib/bevy/client";

import { HomepageThemeContainer } from "../_components/homepage-theme-container";
import { PartnershipBenefits } from "./_components/partnership-benefits";
import { PartnershipCta } from "./_components/partnership-cta";
import { PartnershipDevfest } from "./_components/partnership-devfest";
import { PartnershipFormats } from "./_components/partnership-formats";
import { PartnershipHero } from "./_components/partnership-hero";
import { PartnershipSponsors } from "./_components/partnership-sponsors";
import { PartnershipTiers } from "./_components/partnership-tiers";
import { PartnershipWhyUs } from "./_components/partnership-why-us";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Brand Collaboration & Sponsorship - DevFest Jakarta 2026 | GDG Jakarta",
  description:
    "DevFest Jakarta 2026 is coming! Elevate the community together with GDG Jakarta. Position your brand at the center of the developer ecosystem and showcase your technology to developers, tech leads, and innovators.",
  openGraph: {
    title: "Brand Collaboration & Sponsorship - DevFest Jakarta 2026 | GDG Jakarta",
    description:
      "DevFest Jakarta 2026 is coming! Partner with GDG Jakarta to elevate the developer community. Reach out to hello@gdgjakarta.org for sponsorship proposals.",
  },
};

interface PartnershipPageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function PartnershipPage(props: PartnershipPageProps) {
  const searchParams = await props.searchParams;
  const themeParam = typeof searchParams?.theme === "string" ? searchParams.theme : undefined;
  const colorParam = typeof searchParams?.color === "string" ? searchParams.color : undefined;
  const requestedColor = themeParam ?? colorParam;
  const initialTheme = requestedColor ? getGoogleThemeByKey(requestedColor) : getRandomGoogleTheme();

  // Fetch chapter sponsors from Bevy API
  const sponsors = await getBevyChapterSponsors(BEVY_CONFIG.chapterSlug || BEVY_CONFIG.chapterId);

  return (
    <HomepageThemeContainer initialTheme={initialTheme}>
      {/* 1. Hero Section */}
      <PartnershipHero />

      {/* 2. How Collaboration Looks Like / Why Us */}
      <PartnershipWhyUs />

      {/* 3. DevFest Jakarta 2026 Spotlight */}
      <PartnershipDevfest />

      {/* 4. What Can We Do Together (Formats) */}
      <PartnershipFormats />

      {/* 5. What Brands Get (Deliverables & Value) */}
      <PartnershipBenefits />

      {/* 6. Sponsorship Tiers & Packages */}
      <PartnershipTiers />

      {/* 7. Existing Chapter Sponsors & Brand Trust */}
      <PartnershipSponsors sponsors={sponsors} />

      {/* 8. Call to Action, Quick Email Launcher, & FAQ */}
      <PartnershipCta />
    </HomepageThemeContainer>
  );
}
