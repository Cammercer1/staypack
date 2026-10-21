const requiredPublic = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

const missing = requiredPublic.filter((key) => !process.env[key]?.trim());

if (process.env.STORAGE_PROVIDER === "r2") {
  missing.push(...["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_PUBLIC_BUCKET", "R2_PRIVATE_BUCKET", "R2_PUBLIC_BASE_URL"].filter(key => !process.env[key]?.trim()));
}

if (missing.length > 0) {
  console.error(
    "\nBuild failed: missing required environment variables:\n",
    missing.map((key) => `  - ${key}`).join("\n"),
    "\n\nSet these in Netlify → Site configuration → Environment variables.",
    "\nScope must include Builds. Then trigger Deploy site → Clear cache and deploy.\n",
  );
  process.exit(1);
}

console.log("Required Supabase environment variables are present.");
