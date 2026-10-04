import { BEVY_CONFIG } from "@/config/bevy-config";
import { getGoogleThemeByKey, getRandomGoogleTheme } from "@/config/homepage-themes";
import { getBevyChapterEvents, getBevyChapterSponsors } from "@/lib/bevy/client";

import { CategoryPillFilter } from "./_components/category-pill-filter";
import { CommunityAccessSpotlight } from "./_components/community-access-spotlight";
import { CommunityCtaBanner } from "./_components/community-cta-banner";
import { CommunityHero } from "./_components/community-hero";
import { CommunityPillarsSection } from "./_components/community-pillars-section";
import { CommunityQuoteSection } from "./_components/community-quote-section";
import { FeaturedEventsSection } from "./_components/featured-events-section";
import { HomepageThemeContainer } from "./_components/homepage-theme-container";
import { OrganizersSpotlightSection } from "./_components/organizers-spotlight-section";
import { SponsorsSection } from "./_components/sponsors-section";
import { PartnershipCta } from "./partnership/_components/partnership-cta";

export const dynamic = "force-dynamic";

interface HomeProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function Home(props: HomeProps) {
  const searchParams = await props.searchParams;
  const themeParam = typeof searchParams?.theme === "string" ? searchParams.theme : undefined;
  const colorParam = typeof searchParams?.color === "string" ? searchParams.color : undefined;
  const requestedColor = themeParam ?? colorParam;
  const initialTheme = requestedColor ? getGoogleThemeByKey(requestedColor) : getRandomGoogleTheme();

  // Fetch upcoming events and chapter sponsors in parallel
  const [eventsData, sponsors] = await Promise.all([
    getBevyChapterEvents(BEVY_CONFIG.chapterId, 6, 1, false, "Published"),
    getBevyChapterSponsors(BEVY_CONFIG.chapterSlug || BEVY_CONFIG.chapterId),
  ]);

  const upcomingEvents = (eventsData?.results ?? []).filter(
    (e) =>
      !e.is_hidden && !(e as { hidden?: boolean }).hidden && (e.status ? e.status.toLowerCase() === "published" : true),
  );

  return (
    <HomepageThemeContainer initialTheme={initialTheme}>
      {/* 1. Hero Section */}
      <CommunityHero />

      {/* 2. Category Pill Filter Bar */}
      <CategoryPillFilter />

      {/* 3. Featured Events Grid */}
      <FeaturedEventsSection events={upcomingEvents} />

      {/* 4. Large Editorial Quote Section */}
      <CommunityQuoteSection />

      {/* 5. Complete Developer Empowerment (3 Value Pillars) */}
      <CommunityPillarsSection />

      {/* 6. Direct Community Access Showcase */}
      <CommunityAccessSpotlight />

      {/* 7. Leadership & Community Organizers Spotlight */}
      <OrganizersSpotlightSection />

      {/* 8. Call to Action, Quick Email Launcher, & FAQ */}
      <CommunityCtaBanner />

      {/* 9. Official Sponsors & Partners */}
      <SponsorsSection sponsors={sponsors} />
      <PartnershipCta />
    </HomepageThemeContainer>
  );
}
