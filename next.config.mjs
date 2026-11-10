import { PHASE_PRODUCTION_BUILD } from "next/constants.js";

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

void initOpenNextCloudflareForDev();

// NEXT_PUBLIC_* are inlined by `next build`; on Cloudflare they must be Workers Builds "Build variables", not runtime vars.
const REQUIRED_PUBLIC_ENV = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID",
  "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
  "NEXT_PUBLIC_R2_PUBLIC_URL",
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  experimental: {
    turbopackFileSystemCacheForDev: false,
  },
  compiler: {
    removeConsole: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "gravatar.com",
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "assets.gdgjakarta.org",
      },
      {
        protocol: "https",
        hostname: "*.r2.dev",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(self), browsing-topics=()",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/dashboard/admin",
        permanent: false,
      },
      {
        source: "/sponsor",
        destination: "/partnership",
        permanent: true,
      },
      {
        source: "/sponsorship",
        destination: "/partnership",
        permanent: true,
      },
      {
        source: "/collaboration",
        destination: "/partnership",
        permanent: true,
      },
      {
        source: "/collaborate",
        destination: "/partnership",
        permanent: true,
      },
    ];
  },
  turbopack: {},
  webpack(config, { isServer }) {
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "firebase/firestore": new URL("./src/lib/firestore/server-noop.ts", import.meta.url).pathname,
        "@firebase/firestore": new URL("./src/lib/firestore/server-noop.ts", import.meta.url).pathname,
      };
    }
    return config;
  },
};

export default function config(phase) {
  if (phase === PHASE_PRODUCTION_BUILD) {
    const missing = REQUIRED_PUBLIC_ENV.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(
        `Missing build-time env: ${missing.join(", ")}. On Cloudflare set them in Settings → Build → Variables and secrets (runtime vars / wrangler.jsonc are not visible to next build).`,
      );
    }
  }
  return nextConfig;
}
