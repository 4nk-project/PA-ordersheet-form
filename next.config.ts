import type { NextConfig } from "next";

/** 招待・編集URL（トークンを含む）から参照元経由でトークンが漏れないようにする */
const capabilityUrlHeaders = [
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Cache-Control", value: "private, no-store" },
  { key: "X-Content-Type-Options", value: "nosniff" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/invite/:path*", headers: capabilityUrlHeaders },
      { source: "/orders/:path*", headers: capabilityUrlHeaders },
      { source: "/thanks", headers: capabilityUrlHeaders },
      { source: "/api/integration/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;

if (process.env.NODE_ENV === "development") {
  import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
}
