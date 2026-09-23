import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function Page() {
  const cookieStore = await cookies();
  const role = cookieStore.get("auth_role")?.value;

  if (role === "organizer") {
    redirect("/dashboard/organizer");
  }

  redirect("/dashboard/member");
}
