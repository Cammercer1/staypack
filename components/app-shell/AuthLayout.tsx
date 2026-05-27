import Link from "next/link";
import { StayPackLogo } from "@/components/app-shell/StayPackLogo";

export function AuthLayout({
  children,
  title,
  highlight,
  description,
}: {
  children: React.ReactNode;
  title: string;
  highlight: string;
  description: string;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-primary px-12 py-16 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_40%)]" />
        <div className="relative">
          <StayPackLogo href="/" height={28} />
        </div>
        <div className="relative max-w-md space-y-6">
          <h1 className="font-display text-5xl tracking-tight">
            <span className="italic">{highlight}</span> {title}
          </h1>
          <p className="text-lg leading-8 text-primary-foreground/80">
            {description}
          </p>
        </div>
        <p className="relative text-sm text-primary-foreground/60">
          Branded STR potential reports for Australian real estate agencies.
        </p>
      </div>

      <div className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <StayPackLogo href="/" height={24} />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
