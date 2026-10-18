import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

void initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
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
            value: "unsafe-none",
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
  turbopack: {
    resolveAlias: {
      "firebase/firestore": "./src/lib/firestore/server-noop.ts",
      "@firebase/firestore": "./src/lib/firestore/server-noop.ts",
    },
  },
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
