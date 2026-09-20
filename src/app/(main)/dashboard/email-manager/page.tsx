import type { Metadata } from "next";

import { EmailManager } from "./_components/email-manager";

export const metadata: Metadata = {
  title: "Email Manager",
  description: "Manage community email communications and send bulk email blasts.",
};

export default function EmailManagerPage() {
  return <EmailManager />;
}
