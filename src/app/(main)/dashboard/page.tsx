import { redirect } from "next/navigation";

import { isExecutiveOrganizer } from "@/lib/auth-roles";
import { getVerifiedSessionRole } from "@/server/auth-guard";

export default async function Page() {
  const role = await getVerifiedSessionRole();

  if (isExecutiveOrganizer(role)) {
    redirect("/dashboard/organizer");
  }

  redirect("/dashboard/member");
}
