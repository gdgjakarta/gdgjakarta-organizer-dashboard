import { isCloudflareAnalyticsConfigured } from "@/lib/analytics/providers/cloudflare";
import { isGa4Configured } from "@/lib/analytics/providers/ga4";
import type { AnalyticsCapabilities } from "@/lib/analytics/types";
import { isInstagramConfigured } from "@/lib/instagram/client";

export function getAnalyticsCapabilities(): AnalyticsCapabilities {
  const ga4Configured = isGa4Configured();
  const cloudflareConfigured = isCloudflareAnalyticsConfigured();
  const websiteConfigured = ga4Configured || cloudflareConfigured;
  const instagramConfigured = isInstagramConfigured();

  return {
    websiteConfigured,
    ga4Configured,
    cloudflareConfigured,
    instagramConfigured,
    defaultTab: websiteConfigured ? "website" : "events",
  };
}
