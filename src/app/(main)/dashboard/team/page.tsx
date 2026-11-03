import { redirect } from "next/navigation";

export default function TeamPage() {
  redirect("/dashboard/members?tab=team");
}
