"use client";

import Link from "next/link";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  HelpCircle,
  Info,
  Mail,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { usePaymentPolicyContent } from "@/lib/content/hooks";
import type { PaymentPolicySection } from "@/lib/content/types";

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

function renderFormattedText(text: string) {
  // Parses simple **bold** markers safely
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function SectionCallout({ callout }: { callout: NonNullable<PaymentPolicySection["callout"]> }) {
  const isDestructive = callout.type === "destructive";
  const isWarning = callout.type === "warning";
  const isSuccess = callout.type === "success";

  const alertClass = isDestructive
    ? "border-destructive/30 bg-destructive/10 text-destructive dark:border-destructive/40"
    : isWarning
      ? "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-200"
      : isSuccess
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200"
        : "border-primary/20 bg-primary/5 text-primary";

  const titleClass = isDestructive
    ? "text-destructive dark:text-destructive"
    : isWarning
      ? "text-amber-900 dark:text-amber-100"
      : isSuccess
        ? "text-emerald-900 dark:text-emerald-100"
        : "text-foreground";

  const descClass = isDestructive
    ? "text-destructive/90 dark:text-destructive/90"
    : isWarning
      ? "text-amber-800 dark:text-amber-300"
      : isSuccess
        ? "text-emerald-800 dark:text-emerald-300"
        : "text-muted-foreground";

  return (
    <Alert className={`mt-4 ${alertClass}`}>
      {isDestructive ? (
        <AlertTriangle className="size-4 text-destructive" />
      ) : isWarning ? (
        <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
      ) : isSuccess ? (
        <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Info className="size-4 text-primary" />
      )}
      {callout.title && <AlertTitle className={`font-semibold ${titleClass}`}>{callout.title}</AlertTitle>}
      <AlertDescription className={`text-xs leading-relaxed ${descClass}`}>
        {renderFormattedText(callout.message)}
      </AlertDescription>
    </Alert>
  );
}

export function PaymentPolicyView() {
  const { content } = usePaymentPolicyContent();

  const activeSections = (content.sections || [])
    .filter((s) => s.isActive !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

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
        {content.header?.badge && (
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 font-medium text-primary text-xs">
            <CreditCard className="size-3.5" />
            <span>{content.header.badge}</span>
          </div>
        )}
        <h1 className="font-extrabold text-3xl tracking-tight sm:text-4xl lg:text-5xl">
          {content.header?.title || "Payment Policy"}
        </h1>
        {content.header?.description && (
          <p className="mt-3 text-muted-foreground text-sm sm:text-base">{content.header.description}</p>
        )}
      </div>

      {/* Crucial Security Banner */}
      {content.notice?.enabled && (
        <Alert className="mb-10 border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-200">
          <ShieldAlert className="size-5 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="font-semibold text-amber-900 dark:text-amber-100">
            {content.notice.title || "Crucial: Official Payment Verification"}
          </AlertTitle>
          <AlertDescription className="mt-1.5 text-amber-800 text-sm leading-relaxed dark:text-amber-300">
            {renderFormattedText(content.notice.description)}
          </AlertDescription>
        </Alert>
      )}

      {/* Content Sections */}
      <div className="space-y-12 text-muted-foreground leading-relaxed">
        {activeSections.map((section, idx) => (
          <section key={section.id || idx} className="space-y-3">
            <h2 className="flex items-center gap-2.5 font-bold text-foreground text-xl">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm">
                {idx + 1}
              </span>
              {section.title}
            </h2>

            {section.body && <p className="leading-relaxed">{renderFormattedText(section.body)}</p>}

            {section.bullets && section.bullets.length > 0 && (
              <ul className="space-y-2.5 pl-2">
                {section.bullets.map((bullet, bIdx) => (
                  <li key={bIdx} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{renderFormattedText(bullet)}</span>
                  </li>
                ))}
              </ul>
            )}

            {section.callout && <SectionCallout callout={section.callout} />}
          </section>
        ))}

        {/* Channels Section */}
        {content.channels && content.channels.length > 0 && (
          <section className="space-y-4">
            <h2 className="flex items-center gap-2.5 font-bold text-foreground text-xl">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm">
                {activeSections.length + 1}
              </span>
              Verified Communication Channels
            </h2>
            <p>
              All official information and communication from GDG Jakarta will come from our verified platforms only:
            </p>

            <div className="grid gap-4 sm:grid-cols-3">
              {content.channels.map((chan) => (
                <div key={chan.id} className="flex flex-col gap-2 rounded-xl border bg-card/50 p-4">
                  <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
                    {chan.iconName === "Mail" ? (
                      <Mail className="size-4 text-primary" />
                    ) : chan.iconName === "Instagram" ? (
                      <InstagramIcon className="size-4 text-primary" />
                    ) : (
                      <ShieldCheck className="size-4 text-primary" />
                    )}
                    {chan.title}
                  </div>
                  <p className="text-muted-foreground text-xs">{chan.description}</p>
                  <div className="mt-auto space-y-1">
                    {chan.links?.map((link, lIdx) => (
                      <a
                        key={lIdx}
                        href={link.url}
                        target={link.isExternal ? "_blank" : undefined}
                        rel={link.isExternal ? "noopener noreferrer" : undefined}
                        className="block font-medium text-primary text-xs hover:underline"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Contact Section */}
        {content.contact && (
          <section className="space-y-4">
            <h2 className="flex items-center gap-2.5 font-bold text-foreground text-xl">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm">
                {activeSections.length + (content.channels?.length ? 2 : 1)}
              </span>
              {content.contact.title || "Questions or Doubts?"}
            </h2>
            <p>
              {content.contact.description ||
                "If you are ever in doubt or receive any suspicious payment request or communication claiming to represent GDG Jakarta, please do not hesitate to contact us for immediate verification before taking any action."}
            </p>

            <div className="flex flex-col gap-4 rounded-xl border bg-muted/30 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h3 className="font-semibold text-foreground text-sm">Need Clarification?</h3>
                <p className="text-muted-foreground text-xs">
                  Our organizing team is happy to assist you and verify requests.
                </p>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {content.contact.email && (
                  <Button size="sm" asChild variant="default">
                    <a href={`mailto:${content.contact.email}`} className="gap-2">
                      <Mail className="size-3.5" />
                      Email: {content.contact.email}
                    </a>
                  </Button>
                )}
                {content.contact.instagram && (
                  <Button size="sm" asChild variant="outline">
                    <a href={content.contact.instagram} target="_blank" rel="noopener noreferrer" className="gap-2">
                      <InstagramIcon className="size-3.5" />
                      Instagram DM: @gdgjakarta
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
