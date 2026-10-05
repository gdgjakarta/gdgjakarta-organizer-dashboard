import type { Metadata } from "next";

import { APP_CONFIG } from "@/config/app-config";

import { FaqView } from "./_components/faq-view";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description:
    "Find answers to frequently asked questions about GDG Jakarta events, RSVPs, commitment fees, refunds, merchandise, and anti-fraud verification.",
  alternates: {
    canonical: "/faq",
  },
  openGraph: {
    title: "Frequently Asked Questions | GDG Jakarta",
    description:
      "Find answers to frequently asked questions about GDG Jakarta events, RSVPs, commitment fees, refunds, merchandise, and anti-fraud verification.",
    url: "/faq",
    siteName: APP_CONFIG.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Frequently Asked Questions | GDG Jakarta",
    description:
      "Find answers to frequently asked questions about GDG Jakarta events, RSVPs, commitment fees, refunds, merchandise, and anti-fraud verification.",
  },
};

export default function FaqPage() {
  return <FaqView />;
}
