import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

void initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_FIREBASE_API_KEY:
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
      process.env.FIREBASE_API_KEY ||
      "AIzaSyCVk8ECyA8Lqd7KNqdnItxYUu9jdFzoohU",
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      "",
  },
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

export default nextConfig;
