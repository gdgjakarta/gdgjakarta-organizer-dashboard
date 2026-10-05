import type { ReactNode } from "react";

import type { Metadata, Viewport } from "next";

import { NavigationProgressProvider } from "@/components/navigation-progress-bar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { APP_CONFIG } from "@/config/app-config";
import { fontVars } from "@/lib/fonts/registry";
import { PREFERENCE_DEFAULTS } from "@/lib/preferences/preferences-config";
import { ThemeBootScript } from "@/scripts/theme-boot";
import { AuthStoreProvider } from "@/stores/auth/auth-provider";
import { PreferencesStoreProvider } from "@/stores/preferences/preferences-provider";

import "./globals.css";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1e1e1e" },
  ],
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(APP_CONFIG.url),
  title: {
    default: APP_CONFIG.meta.title,
    template: `%s | ${APP_CONFIG.name}`,
  },
  description: APP_CONFIG.meta.description,
  applicationName: APP_CONFIG.name,
  authors: [{ name: APP_CONFIG.name, url: APP_CONFIG.url }],
  creator: APP_CONFIG.name,
  publisher: APP_CONFIG.name,
  keywords: APP_CONFIG.meta.keywords,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: APP_CONFIG.meta.locale,
    alternateLocale: [APP_CONFIG.meta.alternateLocale],
    url: APP_CONFIG.url,
    siteName: APP_CONFIG.meta.siteName,
    title: {
      default: APP_CONFIG.meta.title,
      template: `%s | ${APP_CONFIG.name}`,
    },
    description: APP_CONFIG.meta.description,
    images: [
      {
        url: APP_CONFIG.meta.ogImage,
        width: 1200,
        height: 630,
        alt: APP_CONFIG.meta.ogImageAlt,
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: APP_CONFIG.meta.twitterHandle,
    creator: APP_CONFIG.meta.twitterHandle,
    title: {
      default: APP_CONFIG.meta.title,
      template: `%s | ${APP_CONFIG.name}`,
    },
    description: APP_CONFIG.meta.description,
    images: [
      {
        url: APP_CONFIG.meta.ogImage,
        width: 1200,
        height: 630,
        alt: APP_CONFIG.meta.ogImageAlt,
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/favicon/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
  manifest: "/favicon/site.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_CONFIG.name,
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const { theme_mode, theme_preset, content_layout, navbar_style, sidebar_variant, sidebar_collapsible, font } =
    PREFERENCE_DEFAULTS;

  return (
    <html
      lang="en"
      data-theme-mode={theme_mode}
      data-theme-preset={theme_preset}
      data-content-layout={content_layout}
      data-navbar-style={navbar_style}
      data-sidebar-variant={sidebar_variant}
      data-sidebar-collapsible={sidebar_collapsible}
      data-font={font}
      suppressHydrationWarning
    >
      <head>
        {/* Applies theme and layout preferences on load to avoid flicker and unnecessary server rerenders. */}
        <ThemeBootScript />
      </head>
      <body className={`${fontVars} min-h-screen antialiased`}>
        <TooltipProvider>
          <AuthStoreProvider>
            <PreferencesStoreProvider initialValues={PREFERENCE_DEFAULTS}>
              <NavigationProgressProvider>
                {children}
                <Toaster />
              </NavigationProgressProvider>
            </PreferencesStoreProvider>
          </AuthStoreProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
