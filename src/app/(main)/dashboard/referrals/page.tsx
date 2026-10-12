import type { Metadata } from "next";

import { ReferralLeaderboardView } from "./_components/referral-leaderboard-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Referral Leaderboard",
  description: "Track GDG Jakarta community member referral points, ticket conversions, and merchandise rewards.",
};

export default function ReferralLeaderboardPage() {
  return <ReferralLeaderboardView />;
}
