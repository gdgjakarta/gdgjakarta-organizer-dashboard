import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard/organizer");
  return <>Coming Soon</>;
}
