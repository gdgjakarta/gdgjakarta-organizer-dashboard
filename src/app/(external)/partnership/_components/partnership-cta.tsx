"use client";

import { useState } from "react";

import Link from "next/link";

import { Check, Copy, ExternalLink, HelpCircle, Mail, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const OFFICIAL_EMAIL = "hello@gdgjakarta.org";
const INSTAGRAM_URL = "https://instagram.com/gdgjakarta";

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

const SPONSOR_FAQS = [
  {
    q: "How early should we confirm our sponsorship for DevFest Jakarta 2026?",
    a: "We recommend confirming as early as possible. Premium tiers (Platinum & Gold) have strictly capped speaking slots and premier booth locations that are allocated on a first-come, first-served basis. Early confirmation also guarantees maximum duration of pre-event digital branding.",
  },
  {
    q: "How do we receive the full DevFest 2026 sponsorship proposal deck and rate card?",
    a: "Simply send an email to hello@gdgjakarta.org or submit the quick contact inquiry on this page. Our partnership team will respond within 24–48 hours with our official slide deck, floor plan, and pricing sheet.",
  },
  {
    q: "Can our engineering team deliver a workshop or hands-on session?",
    a: "Yes! We strongly encourage practical, hands-on technical sessions over sales pitches. As part of Gold and Platinum packages (or standalone workshop sponsorships), our content committee will collaborate with your engineering leads to ensure the session provides high technical value to attendees.",
  },
  {
    q: "Can we provide cloud credits, software licenses, or developer gear instead of cash?",
    a: "Yes, our Community & In-Kind Partnership tier accommodates product credits, developer tooling subscriptions, venue support, merchandise, and hackathon prizes. Get in touch with us to explore mutual value fits.",
  },
  {
    q: "Can you provide official invoices and receipts for corporate compliance?",
    a: "Yes, GDG Jakarta provides complete corporate paperwork, partnership agreements, itemized receipts, and tax documentation necessary for your finance and legal departments.",
  },
];

export function PartnershipCta() {
  const [copied, setCopied] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [selectedInterest, setSelectedInterest] = useState("DevFest Jakarta 2026");
  const [message, setMessage] = useState("");

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(OFFICIAL_EMAIL);
      setCopied(true);
      toast.success("Email copied to clipboard!", {
        description: `${OFFICIAL_EMAIL} is ready to paste into your mail app.`,
      });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Could not copy automatically", {
        description: `Please email us directly at ${OFFICIAL_EMAIL}`,
      });
    }
  };

  const handleLaunchEmail = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = `[Partnership Inquiry] ${companyName ? `${companyName} x ` : ""}GDG Jakarta (${selectedInterest})`;
    const bodyLines = [
      "Hi GDG Jakarta Team,",
      "",
      "We are interested in collaborating with GDG Jakarta and receiving the sponsorship proposal deck.",
      "",
      `Company / Organization: ${companyName || "-"}`,
      `Contact Person: ${contactName || "-"}`,
      `Interest Area: ${selectedInterest}`,
      "",
      `Message / Details:`,
      message || "Please share your DevFest 2026 sponsorship deck and packages.",
      "",
      "Best regards,",
      contactName || "Prospective Partner",
    ];

    const mailtoUrl = `mailto:${OFFICIAL_EMAIL}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(bodyLines.join("\n"))}`;

    window.location.href = mailtoUrl;
    toast.success("Opening your mail application...", {
      description: `Drafting proposal inquiry to ${OFFICIAL_EMAIL}`,
    });
  };

  return (
    <section id="contact" className="container mx-auto px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      {/* Main CTA Container */}
      <div
        className="relative overflow-hidden rounded-[2.5rem] border p-8 sm:p-12 lg:p-16 shadow-xl"
        style={{
          backgroundColor: "var(--theme-bg-subtle)",
          borderColor: "var(--theme-border)",
        }}
      >
        <div
          className="pointer-events-none absolute -bottom-32 -left-20 size-96 rounded-full opacity-25 blur-3xl"
          style={{
            background: "radial-gradient(circle, var(--theme-primary) 0%, transparent 70%)",
          }}
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-4xl text-center">
          <div
            className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-medium text-xs shadow-xs"
            style={{
              borderColor: "var(--theme-border)",
              backgroundColor: "var(--background)",
              color: "var(--theme-text)",
            }}
          >
            <Sparkles className="size-3.5" style={{ color: "var(--theme-primary)" }} />
            <span>Connect with Our Partnership Team</span>
          </div>

          <h2 className="mt-6 font-extrabold text-3xl tracking-tight sm:text-4xl lg:text-5xl text-foreground">
            Let’s Build Something Impactful Together!
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-foreground/80 text-sm sm:text-base leading-relaxed">
            Ready to align your brand with Jakarta’s premier developer community? Drop us an email or send us a DM to
            receive our complete sponsorship proposal deck.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="rounded-full px-6 font-semibold shadow-[var(--theme-shadow)]"
              style={{
                backgroundColor: "var(--theme-primary)",
                color: "var(--theme-primary-foreground)",
              }}
            >
              <a href={`mailto:${OFFICIAL_EMAIL}`} className="gap-2">
                <Mail className="size-4" />
                <span>Email {OFFICIAL_EMAIL}</span>
              </a>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleCopyEmail}
              className="rounded-full border-[var(--theme-border)] bg-background/80 px-5 font-medium backdrop-blur-xs"
            >
              {copied ? (
                <>
                  <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="size-4" />
                  <span>Copy Email</span>
                </>
              )}
            </Button>

            <Button
              asChild
              variant="outline"
              size="lg"
              className="rounded-full border-[var(--theme-border)] bg-background/80 px-5"
            >
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="gap-2">
                <InstagramIcon className="size-4" />
                <span>DM @gdgjakarta</span>
                <ExternalLink className="size-3" />
              </a>
            </Button>
          </div>
        </div>

        {/* Quick Inquiry Form Box */}
        <div className="relative mt-12 mx-auto max-w-2xl rounded-2xl border bg-background p-6 sm:p-8 shadow-md">
          <div className="mb-6">
            <h3 className="font-bold text-foreground text-lg sm:text-xl">Request Sponsorship Proposal Deck</h3>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1">
              Fill in your details to quickly prepare and draft your partnership inquiry email.
            </p>
          </div>

          <form onSubmit={handleLaunchEmail} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 text-left">
                <Label htmlFor="companyName" className="text-xs font-semibold">
                  Company / Organization <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="companyName"
                  placeholder="e.g. Acme Cloud Corp"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5 text-left">
                <Label htmlFor="contactName" className="text-xs font-semibold">
                  Your Name / Role <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="contactName"
                  placeholder="e.g. Alex (DevRel Lead)"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <Label htmlFor="interest" className="text-xs font-semibold">
                Area of Collaboration
              </Label>
              <select
                id="interest"
                value={selectedInterest}
                onChange={(e) => setSelectedInterest(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="DevFest Jakarta 2026 - Platinum / Title Tier">
                  DevFest Jakarta 2026 (Platinum / Title)
                </option>
                <option value="DevFest Jakarta 2026 - Gold Tier">DevFest Jakarta 2026 (Gold Tier)</option>
                <option value="DevFest Jakarta 2026 - Silver Tier">DevFest Jakarta 2026 (Silver Tier)</option>
                <option value="DevFest Jakarta 2026 - Community / In-Kind">
                  DevFest Jakarta 2026 (Community / In-Kind)
                </option>
                <option value="Technical Workshop or Hands-on Codelab">Technical Workshop or Hands-on Codelab</option>
                <option value="Hackathon or Developer Challenge Track">Hackathon or Developer Challenge Track</option>
                <option value="Custom Bespoke Activation">Custom Bespoke Activation</option>
              </select>
            </div>

            <div className="space-y-1.5 text-left">
              <Label htmlFor="message" className="text-xs font-semibold">
                Message or Specific Questions (Optional)
              </Label>
              <Textarea
                id="message"
                placeholder="Tell us about what you'd like to achieve or any questions regarding dates, booth sizes, or proposal details..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>

            <Button
              type="submit"
              className="w-full rounded-xl font-semibold gap-2"
              style={{
                backgroundColor: "var(--theme-primary)",
                color: "var(--theme-primary-foreground)",
              }}
            >
              <Send className="size-4" />
              <span>Send Inquiry</span>
            </Button>
          </form>
        </div>

        {/* Sponsor FAQ Accordion */}
        <div className="mt-16 mx-auto max-w-3xl">
          <div className="mb-6 flex items-center justify-center gap-2 text-center">
            <HelpCircle className="size-4 text-[var(--theme-primary)]" />
            <h3 className="font-bold text-foreground text-lg sm:text-xl">Partnership Frequently Asked Questions</h3>
          </div>

          <Accordion type="single" collapsible className="w-full rounded-2xl border bg-background/80 p-2 shadow-xs">
            {SPONSOR_FAQS.map((faq, i) => (
              <AccordionItem key={faq.q} value={`faq-${i}`} className="border-b last:border-b-0 px-4">
                <AccordionTrigger className="text-left font-semibold text-xs sm:text-sm hover:no-underline">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-xs leading-relaxed">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
