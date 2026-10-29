import type { Metadata } from "next";

import { APP_CONFIG } from "@/config/app-config";

import { PaymentPolicyView } from "./_components/payment-policy-view";

export const metadata: Metadata = {
  title: "Payment Policy",
  description:
    "Official GDG Jakarta Payment Policy, Commitment Fee guidelines, merchandise sales rules, and anti-fraud verification channels.",
  alternates: {
    canonical: "/payment-policy",
  },
  openGraph: {
    title: "Payment Policy | GDG Jakarta",
    description:
      "Official GDG Jakarta Payment Policy, Commitment Fee guidelines, merchandise sales rules, and anti-fraud verification channels.",
    url: "/payment-policy",
    siteName: APP_CONFIG.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Payment Policy | GDG Jakarta",
    description:
      "Official GDG Jakarta Payment Policy, Commitment Fee guidelines, merchandise sales rules, and anti-fraud verification channels.",
  },
};

export default function PaymentPolicyPage() {
  return <PaymentPolicyView />;
}
