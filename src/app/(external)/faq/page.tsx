import Link from "next/link";

import { ArrowLeft, CreditCard, HelpCircle, Mail, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { APP_CONFIG } from "@/config/app-config";

import { FaqAccordion } from "./_components/faq-accordion";

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
  title: `Frequently Asked Questions - ${APP_CONFIG.name}`,
  description:
    "Find answers to frequently asked questions about GDG Jakarta events, RSVPs, commitment fees, refunds, merchandise, and anti-fraud verification.",
};

export default function FaqPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Back button & quick policy link */}
      <div className="mb-8 flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="gap-2 text-muted-foreground hover:text-foreground">
          <Link href="/">
            <ArrowLeft className="size-4" />
            Back to Home
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
          <Link href="/payment-policy">
            <CreditCard className="size-3.5" />
            Payment Policy
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="mb-8 text-center sm:text-left">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 font-medium text-primary text-xs">
          <HelpCircle className="size-3.5" />
          <span>GDG Jakarta Community Help Center</span>
        </div>
        <h1 className="font-extrabold text-3xl tracking-tight sm:text-4xl lg:text-5xl">Frequently Asked Questions</h1>
        <p className="mt-3 text-muted-foreground text-sm sm:text-base max-w-2xl">
          Everything you need to know about our events, commitment fees, ticket reservations, merchandise distribution,
          and community guidelines.
        </p>
      </div>

      {/* Crucial Verification Notice */}
      <Alert className="mb-8 border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-200">
        <ShieldAlert className="size-5 text-amber-600 dark:text-amber-400" />
        <AlertTitle className="font-semibold text-amber-900 dark:text-amber-100">Crucial Payment Notice</AlertTitle>
        <AlertDescription className="mt-1 text-amber-800 text-xs sm:text-sm leading-relaxed dark:text-amber-300">
          All official payment requests and ticket instructions will <strong>ONLY</strong> come from verified emails:{" "}
          <code className="rounded bg-amber-200/50 px-1 py-0.5 font-mono text-xs dark:bg-amber-950/70">
            info@gdgjakarta.org
          </code>{" "}
          or{" "}
          <code className="rounded bg-amber-200/50 px-1 py-0.5 font-mono text-xs dark:bg-amber-950/70">
            info@gdgjakarta.com
          </code>
          . Please read our{" "}
          <Link
            href="/payment-policy"
            className="font-semibold underline hover:text-amber-950 dark:hover:text-amber-100"
          >
            Payment Policy
          </Link>{" "}
          for complete rules on commitment fees and merchandise.
        </AlertDescription>
      </Alert>

      {/* Interactive FAQ accordion */}
      <FaqAccordion />

      {/* Bottom Contact Section */}
      <div className="mt-16 rounded-2xl border bg-muted/30 p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <h3 className="font-bold text-foreground text-lg">Still have questions or doubts?</h3>
            <p className="text-muted-foreground text-xs sm:text-sm max-w-md">
              Can&apos;t find what you are looking for, or received a suspicious message? Our volunteer organizer team
              is ready to assist you.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button size="sm" asChild variant="default">
              <a href="mailto:info@gdgjakarta.org" className="gap-2">
                <Mail className="size-3.5" />
                info@gdgjakarta.org
              </a>
            </Button>
            <Button size="sm" asChild variant="outline">
              <a href="https://instagram.com/gdgjakarta" target="_blank" rel="noopener noreferrer" className="gap-2">
                <InstagramIcon className="size-3.5" />
                @gdgjakarta
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
