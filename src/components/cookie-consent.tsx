"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import { Cookie, ShieldCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";

const CONSENT_STORAGE_KEY = "gdg_cookie_consent";

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already made a choice
    const savedConsent = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!savedConsent) {
      // Small delay before showing so it appears smoothly after page load
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, []);

  const saveConsent = (status: "accepted" | "essential_only") => {
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, status);
      // Also write cookie for server-side awareness if needed
      // biome-ignore lint/suspicious/noDocumentCookie: Necessary for setting consent cookie on client
      document.cookie = `${CONSENT_STORAGE_KEY}=${status}; path=/; max-age=31536000; SameSite=Lax`;
    } catch (e) {
      console.warn("[Cookie Consent] Unable to persist consent:", e);
    }
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-description"
      className="fade-in slide-in-from-bottom-5 fixed right-4 bottom-4 left-4 z-50 mx-auto max-w-lg animate-in duration-300 sm:right-6 sm:left-auto"
    >
      <div className="rounded-2xl border border-border/80 bg-background/95 p-5 shadow-2xl backdrop-blur-xl transition-all duration-300 dark:bg-card/95">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Cookie className="size-5" />
            </div>
            <div>
              <h3 id="cookie-consent-title" className="font-semibold text-base tracking-tight">
                We value your privacy
              </h3>
              <p className="flex items-center gap-1 text-muted-foreground text-xs">
                <ShieldCheck className="size-3.5 text-emerald-500" />
                GDG Jakarta Community Platform
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => saveConsent("essential_only")}
            aria-label="Close and use essential cookies only"
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <p id="cookie-consent-description" className="mt-3 text-muted-foreground text-sm leading-relaxed">
          We use cookies and local storage to keep your session authenticated, remember your preferences, and understand
          community engagement. You can read details in our{" "}
          <Link
            href="/privacy"
            className="font-medium text-foreground underline underline-offset-4 transition-colors hover:text-primary"
          >
            Privacy Policy
          </Link>
          .
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => saveConsent("essential_only")}
            className="h-9 px-4 font-medium text-xs"
          >
            Essential Only
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => saveConsent("accepted")}
            className="h-9 px-5 font-medium text-xs"
          >
            Accept All
          </Button>
        </div>
      </div>
    </div>
  );
}
