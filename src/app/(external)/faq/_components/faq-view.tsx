"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  CheckCircle2,
  CreditCard,
  HelpCircle,
  Mail,
  Package,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useFaqContent } from "@/lib/content/hooks";

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

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  HelpCircle,
  Banknote,
  Package,
  ShieldAlert,
  CheckCircle2,
};

function renderFaqAnswer(answer: string) {
  const paragraphs = answer.split("\n\n").filter(Boolean);

  return (
    <div className="space-y-2.5 text-sm leading-relaxed text-muted-foreground">
      {paragraphs.map((p, pIdx) => {
        // Bullet list
        if (p.includes("• ") || p.startsWith("- ")) {
          const lines = p.split("\n").filter(Boolean);
          return (
            <ul key={pIdx} className="list-disc pl-5 space-y-1">
              {lines.map((line, lIdx) => (
                <li key={lIdx}>{line.replace(/^[•-]\s*/, "")}</li>
              ))}
            </ul>
          );
        }
        return <p key={pIdx}>{p}</p>;
      })}
    </div>
  );
}

export function FaqView() {
  const { content } = useFaqContent();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const filteredFaqs = useMemo(() => {
    return content.items.filter((item) => {
      if (item.isActive === false) return false;
      const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
      const query = searchQuery.trim().toLowerCase();
      if (!query) return matchesCategory;

      const matchesQuestion = item.question.toLowerCase().includes(query);
      const matchesCategoryLabel = item.categoryLabel.toLowerCase().includes(query);
      const matchesAnswer = item.answer.toLowerCase().includes(query);

      return matchesCategory && (matchesQuestion || matchesCategoryLabel || matchesAnswer);
    });
  }, [content.items, searchQuery, selectedCategory]);

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
          <Link href={content.notice.policyUrl || "/payment-policy"}>
            <CreditCard className="size-3.5" />
            {content.notice.policyLinkText || "Payment Policy"}
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="mb-8 text-center sm:text-left">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 font-medium text-primary text-xs">
          <HelpCircle className="size-3.5" />
          <span>{content.header.badge || "GDG Jakarta Community Help Center"}</span>
        </div>
        <h1 className="font-extrabold text-3xl tracking-tight sm:text-4xl lg:text-5xl">
          {content.header.title || "Frequently Asked Questions"}
        </h1>
        <p className="mt-3 text-muted-foreground text-sm sm:text-base max-w-2xl">
          {content.header.description ||
            "Everything you need to know about our events, commitment fees, ticket reservations, merchandise distribution, and community guidelines."}
        </p>
      </div>

      {/* Crucial Verification Notice */}
      {content.notice.enabled && (
        <Alert className="mb-8 border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-200">
          <ShieldAlert className="size-5 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="font-semibold text-amber-900 dark:text-amber-100">
            {content.notice.title || "Crucial Payment Notice"}
          </AlertTitle>
          <AlertDescription className="mt-1 text-amber-800 text-xs sm:text-sm leading-relaxed dark:text-amber-300">
            {content.notice.description}{" "}
            {content.notice.verifiedEmails?.map((email) => (
              <code
                key={email}
                className="mr-1 rounded bg-amber-200/50 px-1 py-0.5 font-mono text-xs dark:bg-amber-950/70"
              >
                {email}
              </code>
            ))}
            . Please read our{" "}
            <Link
              href={content.notice.policyUrl || "/payment-policy"}
              className="font-semibold underline hover:text-amber-950 dark:hover:text-amber-100"
            >
              {content.notice.policyLinkText || "Payment Policy"}
            </Link>{" "}
            for complete rules on commitment fees and merchandise.
          </AlertDescription>
        </Alert>
      )}

      {/* Search and Filters */}
      <div className="space-y-8">
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search FAQs (e.g. commitment fee, refund, merchandise, verification)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-9 h-11 bg-card/60 rounded-full border-border/80 text-sm shadow-xs focus-visible:ring-primary/30"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {content.categories.map((cat) => {
              const Icon = ICON_MAP[cat.iconName || ""] || HelpCircle;
              const isActive = selectedCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setSelectedCategory(cat.key)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-xs scale-105"
                      : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="size-3.5" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Results Header */}
        <div className="flex items-center justify-between border-b pb-3 text-xs text-muted-foreground">
          <span>
            Showing <strong className="text-foreground">{filteredFaqs.length}</strong>{" "}
            {filteredFaqs.length === 1 ? "question" : "questions"}
          </span>
          {selectedCategory !== "all" && (
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className="text-primary hover:underline cursor-pointer"
            >
              Reset category filter
            </button>
          )}
        </div>

        {/* Accordion Questions */}
        {filteredFaqs.length > 0 ? (
          <Accordion type="multiple" className="w-full space-y-3">
            {filteredFaqs.map((faq) => (
              <AccordionItem
                key={faq.id}
                value={faq.id}
                className="rounded-xl border border-border/60 bg-card/50 px-5 transition-all data-[state=open]:border-primary/40 data-[state=open]:bg-card data-[state=open]:shadow-xs"
              >
                <AccordionTrigger className="text-left font-medium text-foreground py-4 hover:no-underline">
                  <div className="flex flex-col gap-1 pr-4 sm:flex-row sm:items-center sm:gap-3">
                    <span className="text-sm font-semibold">{faq.question}</span>
                    <Badge variant="secondary" className="w-fit text-[11px] font-normal py-0 h-5">
                      {faq.categoryLabel}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-1 pb-4">{renderFaqAnswer(faq.answer)}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <div className="rounded-xl border border-dashed p-12 text-center">
            <HelpCircle className="mx-auto mb-3 size-10 text-muted-foreground/40" />
            <h3 className="font-semibold text-foreground text-sm">No matching questions found</h3>
            <p className="mt-1 text-muted-foreground text-xs">
              Try adjusting your search terms or clearing filters to find what you&apos;re looking for.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("all");
              }}
              className="mt-4 text-xs"
            >
              Clear Search & Filters
            </Button>
          </div>
        )}

        {/* Helpful Cards Banner */}
        <div className="grid gap-4 pt-6 sm:grid-cols-2">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
                    <CreditCard className="size-4 text-primary" />
                    Official Payment Policy
                  </div>
                  <p className="text-muted-foreground text-xs leading-normal">
                    Read the complete official terms regarding commitment fees, non-attendance forfeiture, and verified
                    emails.
                  </p>
                </div>
                <Button size="sm" asChild variant="default" className="shrink-0 gap-1.5 text-xs">
                  <Link href={content.notice.policyUrl || "/payment-policy"}>
                    Read Policy
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/50">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-semibold text-foreground text-sm">
                    <ShieldCheck className="size-4 text-emerald-500" />
                    Suspicious Activity?
                  </div>
                  <p className="text-muted-foreground text-xs leading-normal">
                    Received an unverified request? Contact us immediately at{" "}
                    <code className="text-xs">{content.contact.email || "info@gdgjakarta.org"}</code> before paying.
                  </p>
                </div>
                <Button size="sm" asChild variant="outline" className="shrink-0 gap-1.5 text-xs">
                  <a href={`mailto:${content.contact.email || "info@gdgjakarta.org"}`}>
                    <Mail className="size-3.5" />
                    Verify Email
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Contact Section */}
      <div className="mt-16 rounded-2xl border bg-muted/30 p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <h3 className="font-bold text-foreground text-lg">
              {content.contact.title || "Still have questions or doubts?"}
            </h3>
            <p className="text-muted-foreground text-xs sm:text-sm max-w-md">
              {content.contact.description ||
                "Can't find what you are looking for, or received a suspicious message? Our volunteer organizer team is ready to assist you."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button size="sm" asChild variant="default">
              <a href={`mailto:${content.contact.email || "info@gdgjakarta.org"}`} className="gap-2">
                <Mail className="size-3.5" />
                {content.contact.email || "info@gdgjakarta.org"}
              </a>
            </Button>
            <Button size="sm" asChild variant="outline">
              <a
                href={`https://instagram.com/${(content.contact.instagram || "gdgjakarta").replace(/^@/, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="gap-2"
              >
                <InstagramIcon className="size-3.5" />
                {content.contact.instagram?.startsWith("@")
                  ? content.contact.instagram
                  : `@${content.contact.instagram}`}
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
