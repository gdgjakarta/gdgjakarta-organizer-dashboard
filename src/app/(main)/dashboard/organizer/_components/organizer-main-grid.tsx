"use client";

import type { AnalyticsCapabilities } from "@/lib/analytics/types";
import type { FirestoreEvent, FirestoreMember } from "@/lib/firestore/types";

import { GDGUpcomingEvents } from "./gdg-upcoming-events";
import { PlatformAnalyticsHub } from "./platform-analytics-hub";
import { type CommunityOrganizerItem, RecentMembersWidget } from "./recent-members-widget";
import { ReferralLeaderboardWidget } from "./referral-leaderboard-widget";

export function OrganizerMainGrid({
  events,
  organizersList,
  members,
  analyticsCapabilities,
}: {
  events: FirestoreEvent[];
  organizersList: CommunityOrganizerItem[];
  members: FirestoreMember[];
  analyticsCapabilities: AnalyticsCapabilities;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      <div className="flex flex-col xl:col-span-7">
        <GDGUpcomingEvents events={events} />
      </div>

      <div className="flex flex-col gap-5 xl:col-span-5">
        <RecentMembersWidget organizers={organizersList} members={members} />
        <ReferralLeaderboardWidget />
      </div>

      <div className="xl:col-span-12">
        <PlatformAnalyticsHub capabilities={analyticsCapabilities} />
      </div>
    </div>
  );
}
