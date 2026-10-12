import type { Metadata } from "next";

import { getReferralLeaderboardAction, getReferralProgramSettingsAction } from "@/lib/firestore/actions";

import { ReferralLeaderboardView } from "./_components/referral-leaderboard-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Referral Leaderboard",
  description: "Track GDG Jakarta community member referral points, ticket conversions, and merchandise rewards.",
};

export default async function ReferralLeaderboardPage() {
  const [entries, settings] = await Promise.all([
    getReferralLeaderboardAction(200),
    getReferralProgramSettingsAction(),
  ]);

  return <ReferralLeaderboardView initialEntries={entries} initialSettings={settings} />;
}
