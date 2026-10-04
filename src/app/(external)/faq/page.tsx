import type { Metadata } from "next";

import { APP_CONFIG } from "@/config/app-config";

import { FaqView } from "./_components/faq-view";

export const metadata: Metadata = {
  title: `Frequently Asked Questions - ${APP_CONFIG.name}`,
  description:
    "Find answers to frequently asked questions about GDG Jakarta events, RSVPs, commitment fees, refunds, merchandise, and anti-fraud verification.",
};

export default function FaqPage() {
  return <FaqView />;
}
