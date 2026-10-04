"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import {
  AlertTriangle,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export interface FaqItem {
  id: string;
  category: "commitment" | "merchandise" | "security" | "registration" | "general";
  categoryLabel: string;
  question: string;
  answer: React.ReactNode;
}

const FAQ_DATA: FaqItem[] = [
  // Commitment Fee & Refunds
  {
    id: "commitment-fee-reason",
    category: "commitment",
    categoryLabel: "Commitment Fee",
    question: "Why does GDG Jakarta require a commitment fee for events?",
    answer: (
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
        <p>
          Spots for GDG Jakarta events are strictly limited and allocated on a <strong>first-come, first-served</strong>{" "}
          basis. In past free events, we observed high no-show rates where attendees registered but didn&apos;t show up,
          preventing eager waitlisted developers from attending.
        </p>
        <p>
          The commitment fee guarantees that reserved seats are occupied by genuine attendees, respecting the venue
          capacity and the time our volunteer organizers invest in logistics.
        </p>
      </div>
    ),
  },
  {
    id: "commitment-fee-refund",
    category: "commitment",
    categoryLabel: "Commitment Fee",
    question: "How and when do I get my commitment fee refunded?",
    answer: (
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
        <p>
          Your commitment fee is <strong>fully returned to you in cash on the day of the event</strong> upon your
          physical attendance and check-in at the registration desk.
        </p>
        <p>
          Simply present your event ticket or QR code to our registration volunteers. Once your check-in is verified,
          your commitment fee will be handed back to you in full cash.
        </p>
      </div>
    ),
  },
  {
    id: "commitment-fee-absence",
    category: "commitment",
    categoryLabel: "Commitment Fee",
    question: "What happens to my commitment fee if I cannot attend the event?",
    answer: (
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
        <p className="text-destructive font-medium">
          If you are unable to attend, the commitment fee will be strictly forfeited.
        </p>
        <p>
          Forfeited fees cannot be refunded under any circumstances. They are used as a financial guarantee to cover the
          non-refundable venue rental, audiovisual equipment, and catering deposits committed for your reserved seat.
        </p>
      </div>
    ),
  },
  {
    id: "commitment-fee-transfer",
    category: "commitment",
    categoryLabel: "Commitment Fee",
    question: "Can I transfer my RSVP and commitment fee to a friend or colleague?",
    answer: (
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
        <p>
          Event reservations and commitment fees are generally non-transferable due to venue security guidelines and
          badge printing.
        </p>
        <p>
          If you have an urgent emergency, contact us at least 48 hours prior to the event at{" "}
          <a href="mailto:info@gdgjakarta.org" className="font-medium text-primary hover:underline">
            info@gdgjakarta.org
          </a>{" "}
          with your registration details and your proxy&apos;s information for organizer consideration.
        </p>
      </div>
    ),
  },

  // Merchandise & Orders
  {
    id: "merch-announcements",
    category: "merchandise",
    categoryLabel: "Merchandise",
    question: "Where are merchandise and paid event tickets announced?",
    answer: (
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
        <p>
          All sales for official merchandise (t-shirts, jackets, stickers, badges) and paid event access passes will be
          announced through our official Instagram account:{" "}
          <a
            href="https://instagram.com/gdgjakarta"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline"
          >
            @gdgjakarta
          </a>
          .
        </p>
        <p>
          Follow our Instagram and turn on post notifications so you don&apos;t miss exclusive community merchandise
          drops.
        </p>
      </div>
    ),
  },
  {
    id: "merch-collection",
    category: "merchandise",
    categoryLabel: "Merchandise",
    question: "How and when do I collect my purchased merchandise?",
    answer: (
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
        <p>
          Merchandise will be distributed <strong>on-site on the day of the designated event</strong>.
        </p>
        <p>
          When you arrive at the venue, visit the official GDG Jakarta Swag Counter and present your purchase
          confirmation email or receipt from our verified email address.
        </p>
      </div>
    ),
  },
  {
    id: "merch-no-refund-delivery",
    category: "merchandise",
    categoryLabel: "Merchandise",
    question: "Can I request a refund or postal delivery if I cannot attend the event to collect my merchandise?",
    answer: (
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
        <p className="font-semibold text-destructive">
          No. If you are unable to attend, we will not provide any kind of refund or merchandise delivery for any
          reason.
        </p>
        <p>
          GDG Jakarta is a community-run chapter and does not operate postal shipping or home delivery logistics. If you
          purchase merchandise, please ensure you or someone authorized can attend in person to collect it.
        </p>
      </div>
    ),
  },

  // Security & Verification
  {
    id: "security-verify-payments",
    category: "security",
    categoryLabel: "Security & Fraud",
    question: "How do I verify that a payment request or email is genuinely from GDG Jakarta?",
    answer: (
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
        <p>
          <strong className="text-foreground">CRUCIAL RULE:</strong> All official payment requests from GDG Jakarta will{" "}
          <strong>ONLY</strong> come from our verified email addresses:
        </p>
        <div className="flex flex-wrap gap-2 my-2">
          <code className="rounded bg-muted px-2 py-1 font-mono text-xs text-foreground">info@gdgjakarta.org</code>
          <code className="rounded bg-muted px-2 py-1 font-mono text-xs text-foreground">info@gdgjakarta.com</code>
        </div>
        <p>
          Any payment request originating from free Gmail accounts, WhatsApp messages, Telegram groups, or Instagram DMs
          is <strong>fraudulent and invalid</strong>. We will never ask you to transfer funds to personal unverified
          accounts.
        </p>
      </div>
    ),
  },
  {
    id: "security-suspicious-request",
    category: "security",
    categoryLabel: "Security & Fraud",
    question: "What should I do if I receive a suspicious message or payment request?",
    answer: (
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
        <p>
          If you are ever in doubt or receive a suspicious request, <strong>do NOT send any funds</strong> or click
          suspicious links. Contact us immediately for clarification through our verified channels:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Email:{" "}
            <a href="mailto:info@gdgjakarta.org" className="font-medium text-primary hover:underline">
              info@gdgjakarta.org
            </a>
          </li>
          <li>
            Instagram DM:{" "}
            <a
              href="https://instagram.com/gdgjakarta"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              @gdgjakarta
            </a>
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: "official-channels",
    category: "security",
    categoryLabel: "Official Channels",
    question: "What are the official communication channels of GDG Jakarta?",
    answer: (
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
        <p>All official information and communication from GDG Jakarta will come from our verified platforms only:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Email:</strong> <code>info@gdgjakarta.org</code> or <code>info@gdgjakarta.com</code>
          </li>
          <li>
            <strong>Instagram:</strong>{" "}
            <a
              href="https://instagram.com/gdgjakarta"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              @gdgjakarta
            </a>
          </li>
          <li>
            <strong>Official Bevy Profile:</strong>{" "}
            <a
              href="https://gdg.community.dev/gdg-jakarta/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              gdg.community.dev/gdg-jakarta
            </a>
          </li>
        </ul>
      </div>
    ),
  },

  // Event Registration
  {
    id: "registration-how-to-rsvp",
    category: "registration",
    categoryLabel: "Registration",
    question: "How do I register for GDG Jakarta events?",
    answer: (
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
        <p>
          You can browse upcoming events on our{" "}
          <Link href="/events" className="text-primary hover:underline">
            Events Directory
          </Link>{" "}
          or directly on the Google Developer Groups Bevy platform.
        </p>
        <p>
          Click on any event to see venue details, agenda, and speakers. Sign in with your Google account to RSVP. If a
          commitment fee is required, instructions will be sent to your registered email from{" "}
          <code>info@gdgjakarta.org</code>.
        </p>
      </div>
    ),
  },
  {
    id: "registration-qr-ticket",
    category: "registration",
    categoryLabel: "Registration",
    question: "Do I need a ticket or QR code to check in at the venue?",
    answer: (
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
        <p>
          Yes. Once your registration is confirmed, your digital ticket with a unique check-in QR code will be available
          under your Member Dashboard in the &quot;My Events&quot; tab, and also sent to your email.
        </p>
        <p>
          Please keep the QR code ready on your phone or printed out for our volunteers to scan at the entrance door.
        </p>
      </div>
    ),
  },

  // General & Community
  {
    id: "general-who-can-join",
    category: "general",
    categoryLabel: "General",
    question: "Who can attend GDG Jakarta events?",
    answer: (
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
        <p>
          Everyone interested in technology is welcome! GDG Jakarta is an inclusive developer community open to software
          engineers, students, designers, data scientists, product managers, and tech hobbyists regardless of background
          or experience level.
        </p>
        <p>All participants are expected to adhere to the official Google Community Guidelines.</p>
      </div>
    ),
  },
  {
    id: "general-speaker-volunteer",
    category: "general",
    categoryLabel: "General",
    question: "How can I become a speaker or volunteer for GDG Jakarta?",
    answer: (
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
        <p>
          We are always looking for passionate speakers to share knowledge and volunteers to help make our events
          successful!
        </p>
        <p>
          We regularly post Call for Speakers (CFS) and Call for Volunteers (CFV) links on our Instagram{" "}
          <a
            href="https://instagram.com/gdgjakarta"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            @gdgjakarta
          </a>
          . You can also email your proposal directly to{" "}
          <a href="mailto:info@gdgjakarta.org" className="text-primary hover:underline">
            info@gdgjakarta.org
          </a>
          .
        </p>
      </div>
    ),
  },
];

type CategoryKey = "all" | "commitment" | "merchandise" | "security" | "registration" | "general";

const CATEGORIES: { key: CategoryKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "all", label: "All Questions", icon: HelpCircle },
  { key: "commitment", label: "Commitment Fee", icon: Banknote },
  { key: "merchandise", label: "Merchandise", icon: Package },
  { key: "security", label: "Security & Fraud", icon: ShieldAlert },
  { key: "registration", label: "Registration", icon: CheckCircle2 },
  { key: "general", label: "General", icon: HelpCircle },
];

export function FaqAccordion() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>("all");

  const filteredFaqs = useMemo(() => {
    return FAQ_DATA.filter((item) => {
      const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
      const query = searchQuery.trim().toLowerCase();
      if (!query) return matchesCategory;

      const matchesQuestion = item.question.toLowerCase().includes(query);
      const matchesCategoryLabel = item.categoryLabel.toLowerCase().includes(query);

      return matchesCategory && (matchesQuestion || matchesCategoryLabel);
    });
  }, [searchQuery, selectedCategory]);

  return (
    <div className="space-y-8">
      {/* Search and Filters */}
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
          {CATEGORIES.map(({ key, label, icon: Icon }) => {
            const isActive = selectedCategory === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedCategory(key)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xs scale-105"
                    : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="size-3.5" />
                <span>{label}</span>
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
              <AccordionContent className="pt-1 pb-4">{faq.answer}</AccordionContent>
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
                <Link href="/payment-policy">
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
                  <code className="text-xs">info@gdgjakarta.org</code> before paying.
                </p>
              </div>
              <Button size="sm" asChild variant="outline" className="shrink-0 gap-1.5 text-xs">
                <a href="mailto:info@gdgjakarta.org">
                  <Mail className="size-3.5" />
                  Verify Email
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
