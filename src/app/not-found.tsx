"use client";

import { PublicFooter } from "@/app/(external)/_components/public-footer";
import { PublicHeader } from "@/app/(external)/_components/public-header";
import { CookieConsent } from "@/components/cookie-consent";
import { NotFoundContent } from "@/components/not-found-content";
import { APP_CONFIG } from "@/config/app-config";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <title>{`404 - Page Not Found | ${APP_CONFIG.name}`}</title>
      <meta
        name="description"
        content="The page you are looking for doesn't exist, has been moved, or is temporarily unavailable."
      />

      <PublicHeader />

      <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-16 sm:px-6 lg:px-8">
        <NotFoundContent />
      </main>

      <PublicFooter />
      <CookieConsent />
    </div>
  );
}
