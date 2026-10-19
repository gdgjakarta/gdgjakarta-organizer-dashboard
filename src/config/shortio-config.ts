/**
 * Short.io API Configuration for GDG Jakarta
 */
export const SHORTIO_CONFIG = {
  apiKey: process.env.SHORTIO_API_KEY || "",
  domain: process.env.SHORTIO_DOMAIN || "gdgjakarta.org",
  domainId: Number(process.env.SHORTIO_DOMAIN_ID || 1516440),
  apiBaseUrl: "https://api.short.io",
} as const;
