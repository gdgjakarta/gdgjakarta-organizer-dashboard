import type { Metadata } from "next";

import { getReferralLeaderboardAction, getReferralProgramSettingsAction } from "@/lib/firestore/actions";

import { ReferralPresentView } from "../_components/referral-present-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leaderboard Presentation | GDG Jakarta",
  description: "Live stage presentation and reveal mode for GDG Jakarta Referral Championship.",
};

export default async function ReferralPresentPage() {
  const [entries, settings] = await Promise.all([
    getReferralLeaderboardAction(200),
    getReferralProgramSettingsAction(),
  ]);

  return <ReferralPresentView initialEntries={entries} initialSettings={settings} />;
}
