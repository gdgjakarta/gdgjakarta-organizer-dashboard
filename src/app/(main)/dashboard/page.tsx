import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { isExecutiveOrganizer } from "@/lib/auth-roles";

export default async function Page() {
  const cookieStore = await cookies();
  const role = cookieStore.get("auth_role")?.value;

  if (isExecutiveOrganizer(role)) {
    redirect("/dashboard/organizer");
  }

  redirect("/dashboard/member");
}
