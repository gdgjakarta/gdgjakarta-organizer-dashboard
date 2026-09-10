import { redirect } from "next/navigation";

export default function MemberLoginRedirect() {
  redirect("/auth/login");
}
