import type { Metadata } from "next";

import { AccountView } from "./_components/account-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account Settings",
  description: "Manage your GDG Jakarta member and organizer profile, community affiliation, referrals, and security.",
};

export default function AccountPage() {
  return <AccountView />;
}
