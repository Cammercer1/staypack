import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://staypack.app"),
  title: {
    default: "StayPack | Branded property reports",
    template: "%s | StayPack",
  },
  description:
    "Create polished, data-backed property reports and marketing collateral in your agency's branding.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}<Toaster richColors /></body>
    </html>
  );
}
