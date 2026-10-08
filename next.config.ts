import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
