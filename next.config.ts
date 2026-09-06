import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/listings",
        has: [{ type: "query", key: "verified", value: "true" }],
        destination: "/realtors",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
