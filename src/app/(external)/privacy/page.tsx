import Link from "next/link";

import { ArrowLeft, Cookie, Database, Lock, Mail, Shield, UserCheck } from "lucide-react";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { APP_CONFIG } from "@/config/app-config";

export const metadata: Metadata = {
  title: `Privacy Policy - ${APP_CONFIG.name}`,
  description: "Learn how GDG Jakarta collects, uses, and protects your personal data and cookie preferences.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Back button */}
      <div className="mb-8">
        <Button variant="ghost" size="sm" asChild className="gap-2 text-muted-foreground hover:text-foreground">
          <Link href="/">
            <ArrowLeft className="size-4" />
            Back to Home
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="mb-12 border-b pb-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 font-medium text-primary text-xs">
          <Shield className="size-3.5" />
          <span>GDG Jakarta Data Protection</span>
        </div>
        <h1 className="font-extrabold text-3xl tracking-tight sm:text-4xl lg:text-5xl">Privacy Policy</h1>
        <p className="mt-3 text-muted-foreground text-sm sm:text-base">
          Last updated: October 2, 2026 • Effective Date: January 1, 2026
        </p>
      </div>

      {/* Content */}
      <div className="space-y-10 text-muted-foreground leading-relaxed">
        {/* Section 1 */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-2.5 font-bold text-foreground text-xl">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm">
              1
            </span>
            Introduction
          </h2>
          <p>
            Welcome to the <strong>Google Developer Groups (GDG) Jakarta Organizer & Community Dashboard</strong>{" "}
            (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;). GDG Jakarta is an independent, community-driven
            developer group for tech professionals, enthusiasts, and students in Jakarta, Indonesia who are interested
            in Google's developer technologies.
          </p>
          <p>
            This Privacy Policy explains how we collect, handle, use, and protect your information when you visit our
            dashboard, register for events, sign in with Google, or engage with our community programs.
          </p>
        </section>

        {/* Section 2 */}
        <section className="space-y-4">
          <h2 className="flex items-center gap-2.5 font-bold text-foreground text-xl">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm">
              2
            </span>
            Information We Collect
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="bg-card/50">
              <CardContent className="pt-6">
                <div className="mb-2 flex items-center gap-2 font-semibold text-foreground text-sm">
                  <UserCheck className="size-4 text-primary" />
                  Account & Profile Information
                </div>
                <p className="text-muted-foreground text-xs leading-normal">
                  When you sign in using Google Sign-In (via Firebase Authentication), we collect your name, email
                  address, profile avatar URL, and Google user ID to provide personalized dashboard features.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/50">
              <CardContent className="pt-6">
                <div className="mb-2 flex items-center gap-2 font-semibold text-foreground text-sm">
                  <Database className="size-4 text-primary" />
                  Event Registrations & Tickets
                </div>
                <p className="text-muted-foreground text-xs leading-normal">
                  When you RSVP for chapter events, we synchronize your ticket and check-in status with the official
                  Bevy Community Platform (gdg.community.dev) to verify attendance and manage venue capacity.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/50">
              <CardContent className="pt-6">
                <div className="mb-2 flex items-center gap-2 font-semibold text-foreground text-sm">
                  <Cookie className="size-4 text-primary" />
                  Cookies & Device Storage
                </div>
                <p className="text-muted-foreground text-xs leading-normal">
                  We store essential session cookies, your dark/light theme preference, and your cookie consent status
                  in your browser's local storage.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/50">
              <CardContent className="pt-6">
                <div className="mb-2 flex items-center gap-2 font-semibold text-foreground text-sm">
                  <Lock className="size-4 text-primary" />
                  Technical & Security Logs
                </div>
                <p className="text-muted-foreground text-xs leading-normal">
                  Standard network requests pass through Cloudflare edge servers to provide DDoS protection, performance
                  caching, and SSL/TLS encryption.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Section 3 */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-2.5 font-bold text-foreground text-xl">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm">
              3
            </span>
            Cookie Policy & Consent
          </h2>
          <p>
            Cookies are small text files placed on your device to ensure the web application functions properly and to
            remember your preferences across visits:
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Essential / Strictly Necessary Cookies:</strong> Used for authenticating your session (
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground text-xs">auth_token</code>,{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground text-xs">auth_role</code>),
              cross-site request forgery prevention, and maintaining dashboard state. These cookies cannot be turned off
              without breaking basic dashboard functionality.
            </li>
            <li>
              <strong>Preference Storage:</strong> Stores your chosen theme mode (dark, light, or system), custom layout
              presets, and font configurations using browser{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground text-xs">localStorage</code>.
            </li>
            <li>
              <strong>Analytics:</strong> Anonymized metrics on page views and navigation latency to ensure fast loading
              times across Indonesia and globally.
            </li>
          </ul>
        </section>

        {/* Section 4 */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-2.5 font-bold text-foreground text-xl">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm">
              4
            </span>
            How We Use Your Data
          </h2>
          <p>We use the data collected exclusively for legitimate community operations:</p>
          <ul className="list-disc space-y-1.5 pl-6">
            <li>Facilitating on-site event check-in, badges, and QR scanner verification at our venue doors.</li>
            <li>Sending critical event updates, venue changes, or schedule announcements.</li>
            <li>Enabling organizer administrative tools for managing chapter rosters and community merchandise.</li>
            <li>We do not sell, rent, or monetize your personal information to third parties or advertisers.</li>
          </ul>
        </section>

        {/* Section 5 */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-2.5 font-bold text-foreground text-xl">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm">
              5
            </span>
            Third-Party Platforms
          </h2>
          <p>Our dashboard integrates with the following trusted third-party providers:</p>
          <ul className="list-disc space-y-1.5 pl-6">
            <li>
              <strong>Google Firebase:</strong> Authentication provider and secure identity management.
            </li>
            <li>
              <strong>Bevy Community Platform (gdg.community.dev):</strong> Official Google Developer Groups event and
              ticket management platform.
            </li>
            <li>
              <strong>Cloudflare:</strong> Edge compute, DDoS mitigation, and R2 media storage.
            </li>
          </ul>
        </section>

        {/* Section 6 */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-2.5 font-bold text-foreground text-xl">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm">
              6
            </span>
            Your Rights & Contact
          </h2>
          <p>
            You have the right to inspect, correct, or request the deletion of your personal account information from
            our records. If you have questions regarding this policy or wish to submit a data inquiry, please contact
            our lead organizers:
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-xl border bg-muted/30 p-4 text-foreground text-sm">
            <Mail className="size-4 text-primary" />
            <span>Email us at: </span>
            <a href="mailto:info@gdgjakarta.org" className="font-medium text-primary hover:underline">
              info@gdgjakarta.org
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
