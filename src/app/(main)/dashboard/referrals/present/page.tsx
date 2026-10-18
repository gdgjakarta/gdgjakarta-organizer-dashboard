import type { Metadata } from "next";

import { ReferralPresentView } from "../_components/referral-present-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leaderboard Presentation | GDG Jakarta",
  description: "Live stage presentation and reveal mode for GDG Jakarta Referral Championship.",
};

export default function ReferralPresentPage() {
  return <ReferralPresentView />;
}
