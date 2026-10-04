"use client";

import { useState } from "react";

import { Check, Copy, ExternalLink, HelpCircle, Mail, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePartnershipContent } from "@/lib/content/hooks";

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

export function PartnershipCta() {
  const { content } = usePartnershipContent();
  const contact = content.contact;
  const officialEmail = contact.contactEmail || "hello@gdgjakarta.org";
  const instagramUrl = contact.instagramUrl || "https://instagram.com/gdgjakarta";
  const featuredEventTitle = content.devfest.title || "Featured Event";

  const [copied, setCopied] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [selectedInterest, setSelectedInterest] = useState(
    contact.interestOptions?.[0] || `${featuredEventTitle} - Sponsorship Tier`,
  );
  const [message, setMessage] = useState("");

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(officialEmail);
      setCopied(true);
      toast.success("Email copied to clipboard!", {
        description: `${officialEmail} is ready to paste into your mail app.`,
      });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Could not copy automatically", {
        description: `Please email us directly at ${officialEmail}`,
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
      message || `Please share your ${featuredEventTitle} sponsorship deck and packages.`,
      "",
      "Best regards,",
      contactName || "Prospective Partner",
    ];

    const mailtoUrl = `mailto:${officialEmail}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(bodyLines.join("\n"))}`;

    window.location.href = mailtoUrl;
    toast.success("Opening your mail application...", {
      description: `Drafting proposal inquiry to ${officialEmail}`,
    });
  };

  const interestOptions =
    contact.interestOptions && contact.interestOptions.length > 0
      ? contact.interestOptions
      : [
          `${featuredEventTitle} - Platinum / Title Tier`,
          `${featuredEventTitle} - Gold Tier`,
          `${featuredEventTitle} - Silver Tier`,
          `${featuredEventTitle} - Community / In-Kind`,
          "Technical Workshop or Hands-on Codelab",
          "Hackathon or Developer Challenge Track",
          "Custom Bespoke Activation",
        ];

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
            {contact.heading || "Let’s Build Something Impactful Together!"}
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-foreground/80 text-sm sm:text-base leading-relaxed">
            {contact.subheading ||
              "Ready to align your brand with Jakarta’s premier developer community? Drop us an email or send us a DM to receive our complete sponsorship proposal deck."}
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
              <a href={`mailto:${officialEmail}`} className="gap-2">
                <Mail className="size-4" />
                <span>Email {officialEmail}</span>
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
              <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="gap-2">
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
                {interestOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
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
        {content.faqs && content.faqs.length > 0 && (
          <div className="mt-16 mx-auto max-w-3xl">
            <div className="mb-6 flex items-center justify-center gap-2 text-center">
              <HelpCircle className="size-4 text-[var(--theme-primary)]" />
              <h3 className="font-bold text-foreground text-lg sm:text-xl">Partnership Frequently Asked Questions</h3>
            </div>

            <Accordion type="single" collapsible className="w-full rounded-2xl border bg-background/80 p-2 shadow-xs">
              {content.faqs.map((faq, i) => (
                <AccordionItem key={faq.id || i} value={`faq-${faq.id || i}`} className="border-b last:border-b-0 px-4">
                  <AccordionTrigger className="text-left font-semibold text-xs sm:text-sm hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-xs leading-relaxed">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}
      </div>
    </section>
  );
}
