import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return ["/proposal/:path*", "/api/proposals/:path*", "/example/:path*", "/examples/:path*"].map(source => ({ source, headers: [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
      { key: "Cache-Control", value: "private, no-store, max-age=0" },
    ] }));
  },
  env: {
    // Explicit opt-in for the synthetic-data regression playground on a preview build.
    STAYPACK_REGRESSION_PREVIEW: process.env.STAYPACK_REGRESSION_PREVIEW === "1" ? "1" : "0",
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_REPORTS_URL: process.env.NEXT_PUBLIC_REPORTS_URL,
  },
};

export default nextConfig;
