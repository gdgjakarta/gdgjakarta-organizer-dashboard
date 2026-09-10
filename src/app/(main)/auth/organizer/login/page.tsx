import { redirect } from "next/navigation";

export default function OrganizerLoginRedirect() {
  redirect("/auth/login");
}
