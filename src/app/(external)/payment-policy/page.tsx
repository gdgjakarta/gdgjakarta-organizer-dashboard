import Link from "next/link";

import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CheckCircle2,
  CreditCard,
  HelpCircle,
  Mail,
  Package,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import type { Metadata } from "next";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { APP_CONFIG } from "@/config/app-config";

function InstagramIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

export const metadata: Metadata = {
  title: `Payment Policy - ${APP_CONFIG.name}`,
  description:
    "Official GDG Jakarta Payment Policy, Commitment Fee guidelines, merchandise sales rules, and anti-fraud verification channels.",
};

export default function PaymentPolicyPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Back button */}
      <div className="mb-8 flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="gap-2 text-muted-foreground hover:text-foreground">
          <Link href="/">
            <ArrowLeft className="size-4" />
            Back to Home
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
          <Link href="/faq">
            <HelpCircle className="size-3.5" />
            View FAQ
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="mb-10 border-b pb-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 font-medium text-primary text-xs">
          <CreditCard className="size-3.5" />
          <span>Official GDG Jakarta Guidelines</span>
        </div>
        <h1 className="font-extrabold text-3xl tracking-tight sm:text-4xl lg:text-5xl">Payment Policy</h1>
        <p className="mt-3 text-muted-foreground text-sm sm:text-base">
          Official guidance regarding event commitment fees, ticket reservations, merchandise distribution, and fraud
          prevention.
        </p>
      </div>

      {/* Crucial Security Banner */}
      <Alert className="mb-10 border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-200">
        <ShieldAlert className="size-5 text-amber-600 dark:text-amber-400" />
        <AlertTitle className="font-semibold text-amber-900 dark:text-amber-100">
          Crucial: Official Payment Verification
        </AlertTitle>
        <AlertDescription className="mt-1.5 text-amber-800 text-sm leading-relaxed dark:text-amber-300">
          All official payment requests from GDG Jakarta will <strong>ONLY</strong> originate from our verified emails (
          <code className="rounded bg-amber-200/50 px-1.5 py-0.5 font-mono text-xs text-amber-900 dark:bg-amber-950/70 dark:text-amber-200">
            info@gdgjakarta.org
          </code>{" "}
          or{" "}
          <code className="rounded bg-amber-200/50 px-1.5 py-0.5 font-mono text-xs text-amber-900 dark:bg-amber-950/70 dark:text-amber-200">
            info@gdgjakarta.com
          </code>
          ). Any payment request originating from other email domains, WhatsApp numbers, Telegram accounts, or direct
          messages is <strong>invalid, unauthorized, and not from GDG Jakarta</strong>.
        </AlertDescription>
      </Alert>

      {/* Content Sections */}
      <div className="space-y-12 text-muted-foreground leading-relaxed">
        {/* Section 1: Introduction */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-2.5 font-bold text-foreground text-xl">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm">
              1
            </span>
            Introduction
          </h2>
          <p>Hi Jakarta Geeks!</p>
          <p>
            To ensure clarity and prevent any misunderstandings regarding our events, ticket reservations, merchandise
            payments, and official communications, please carefully read our official FAQ and Payment Policy. By
            registering for our events, purchasing merchandise, or participating in chapter activities, you acknowledge
            and agree to the terms outlined below.
          </p>
        </section>

        {/* Section 2: Commitment Fee for Events */}
        <section className="space-y-4">
          <h2 className="flex items-center gap-2.5 font-bold text-foreground text-xl">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm">
              2
            </span>
            Commitment Fee for Events
          </h2>
          <p>
            Spots for GDG Jakarta events are strictly limited and allocated on a{" "}
            <strong>first-come, first-served</strong> basis to ensure quality experience, venue compliance, and fair
            access for all developers.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-border/60 bg-card/60">
              <CardContent className="pt-6">
                <div className="mb-2 flex items-center gap-2 font-semibold text-foreground text-sm">
                  <Banknote className="size-4 text-primary" />
                  Reservation & Cash Refund
                </div>
                <p className="text-muted-foreground text-xs leading-normal">
                  To secure your event reservation, we require a commitment fee. This fee will be{" "}
                  <strong className="text-foreground">fully returned to you in cash on the day of the event</strong>{" "}
                  upon your physical check-in and attendance at the venue registration desk.
                </p>
              </CardContent>
            </Card>

            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="pt-6">
                <div className="mb-2 flex items-center gap-2 font-semibold text-destructive text-sm">
                  <AlertTriangle className="size-4 text-destructive" />
                  Absence & Forfeiture Guarantee
                </div>
                <p className="text-muted-foreground text-xs leading-normal">
                  <strong className="text-destructive">If you are unable to attend the event</strong>, the commitment
                  fee will be <strong>forfeited</strong> and utilized as a financial guarantee toward the venue rental,
                  equipment, and operational costs committed on your behalf.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="rounded-xl border bg-muted/40 p-4 text-xs leading-relaxed">
            <p className="font-medium text-foreground">Important Note on Commitment Fees:</p>
            <p className="mt-1">
              Commitment fees ensure registered attendees actually turn up, respecting both the organizers&apos;
              logistics and fellow community members on the waitlist who eagerly want to attend.
            </p>
          </div>
        </section>

        {/* Section 3: Merchandise & Paid Tickets */}
        <section className="space-y-4">
          <h2 className="flex items-center gap-2.5 font-bold text-foreground text-xl">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm">
              3
            </span>
            Merchandise & Paid Event Tickets
          </h2>
          <p>
            From time to time, GDG Jakarta offers exclusive community merchandise (such as anniversary t-shirts,
            hoodies, badges) and special paid event access passes.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-border/60 bg-card/60">
              <CardContent className="pt-6">
                <div className="mb-2 flex items-center gap-2 font-semibold text-foreground text-sm">
                  <Package className="size-4 text-primary" />
                  Official Announcement & Distribution
                </div>
                <p className="text-muted-foreground text-xs leading-normal">
                  All official sales for merchandise and paid event tickets are announced strictly through our verified
                  Instagram account (
                  <a
                    href="https://instagram.com/gdgjakarta"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline"
                  >
                    @gdgjakarta
                  </a>
                  ). Purchased merchandise will be distributed on-site on the day of the designated event.
                </p>
              </CardContent>
            </Card>

            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="pt-6">
                <div className="mb-2 flex items-center gap-2 font-semibold text-destructive text-sm">
                  <ShieldAlert className="size-4 text-destructive" />
                  Strict No-Refund & No-Delivery Rule
                </div>
                <p className="text-muted-foreground text-xs leading-normal">
                  Please note that{" "}
                  <strong className="text-destructive">
                    if you are unable to attend the event, we will not provide any kind of refund or merchandise
                    delivery for any reason.
                  </strong>{" "}
                  We do not operate postal logistics or personal courier dispatch for unclaimed orders.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Section 4: Payment Verification & Anti-Fraud */}
        <section className="space-y-4">
          <h2 className="flex items-center gap-2.5 font-bold text-foreground text-xl">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm">
              4
            </span>
            Payment Verification & Anti-Fraud Security
          </h2>
          <p>
            Protecting community members against phishing, impersonation, and fraudulent payment solicitations is our
            highest priority:
          </p>

          <div className="space-y-3 rounded-xl border bg-card/60 p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
              <div className="text-sm">
                <strong className="text-foreground">Official Sender Emails Only:</strong> Legitimate payment
                instructions and transfer details will <strong>ONLY</strong> come from{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground text-xs">
                  info@gdgjakarta.org
                </code>{" "}
                or{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground text-xs">
                  info@gdgjakarta.com
                </code>
                .
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
              <div className="text-sm">
                <strong className="text-foreground">No Direct Message Payment Requests:</strong> Organizers will never
                send direct payment solicitations via personal WhatsApp, Telegram, Discord, or Instagram DMs without an
                accompanying official email verification.
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
              <div className="text-sm">
                <strong className="text-foreground">Always Check the Domain:</strong> Look carefully at email headers.
                Phishing emails using slight variations (e.g. gmail.com addresses or misspelled domains) are invalid and
                dangerous.
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Official Communication Channels */}
        <section className="space-y-4">
          <h2 className="flex items-center gap-2.5 font-bold text-foreground text-xl">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm">
              5
            </span>
            Verified Communication Channels
          </h2>
          <p>All official information and communication from GDG Jakarta will come from our verified platforms only:</p>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2 rounded-xl border bg-card/50 p-4">
              <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
                <Mail className="size-4 text-primary" />
                Official Emails
              </div>
              <p className="text-muted-foreground text-xs">Primary for ticket and payment communications:</p>
              <div className="mt-auto space-y-1">
                <a href="mailto:info@gdgjakarta.org" className="block font-mono text-primary text-xs hover:underline">
                  info@gdgjakarta.org
                </a>
                <a href="mailto:info@gdgjakarta.com" className="block font-mono text-primary text-xs hover:underline">
                  info@gdgjakarta.com
                </a>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border bg-card/50 p-4">
              <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
                <InstagramIcon className="size-4 text-primary" />
                Instagram
              </div>
              <p className="text-muted-foreground text-xs">Official announcements, merchandise drops, and updates:</p>
              <div className="mt-auto">
                <a
                  href="https://instagram.com/gdgjakarta"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary text-xs hover:underline"
                >
                  @gdgjakarta
                </a>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border bg-card/50 p-4">
              <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
                <ShieldCheck className="size-4 text-primary" />
                Bevy Community Profile
              </div>
              <p className="text-muted-foreground text-xs">Official Google Developer Groups chapter portal:</p>
              <div className="mt-auto">
                <a
                  href="https://gdg.community.dev/gdg-jakarta/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary text-xs hover:underline"
                >
                  gdg.community.dev/gdg-jakarta
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Section 6: Questions or Doubts */}
        <section className="space-y-4">
          <h2 className="flex items-center gap-2.5 font-bold text-foreground text-xl">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm">
              6
            </span>
            Questions or Doubts?
          </h2>
          <p>
            If you are ever in doubt or receive any suspicious payment request or communication claiming to represent
            GDG Jakarta, please do not hesitate to contact us for immediate verification before taking any action.
          </p>

          <div className="flex flex-col gap-4 rounded-xl border bg-muted/30 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h3 className="font-semibold text-foreground text-sm">Need Clarification?</h3>
              <p className="text-muted-foreground text-xs">
                Our organizing team is happy to assist you and verify requests.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Button size="sm" asChild variant="default">
                <a href="mailto:info@gdgjakarta.org" className="gap-2">
                  <Mail className="size-3.5" />
                  Email: info@gdgjakarta.org
                </a>
              </Button>
              <Button size="sm" asChild variant="outline">
                <a href="https://instagram.com/gdgjakarta" target="_blank" rel="noopener noreferrer" className="gap-2">
                  <InstagramIcon className="size-3.5" />
                  Instagram DM: @gdgjakarta
                </a>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
