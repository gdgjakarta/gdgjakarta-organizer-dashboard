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
};

export default nextConfig;
