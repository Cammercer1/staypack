"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Home, Inbox, LayoutDashboard, LogOut, Menu, Plus, Settings } from "lucide-react";
import { toast } from "sonner";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { StayPackLogo } from "@/components/app-shell/StayPackLogo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/listings", label: "Listings", icon: Home },
  { href: "/leads", label: "Leads", icon: Inbox },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      toast.error(error.message);
      setLoggingOut(false);
      return;
    }

    toast.success("Signed out");
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-6">
          <div className="flex items-center gap-8">
            <StayPackLogo href="/dashboard" height={24} />
            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Desktop controls */}
          <div className="hidden items-center gap-2 md:flex">
            <LogoutButton />
            <Link href="/listings/new" prefetch={false}>
              <Button size="lg">
                <Plus className="h-4 w-4" />
                New listing
              </Button>
            </Link>
          </div>

          {/* Mobile burger menu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Open menu"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 md:hidden"
            >
              <Menu className="h-5 w-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <DropdownMenuItem key={item.href} render={<Link href={item.href} />}>
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={loggingOut}
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                {loggingOut ? "Signing out..." : "Log out"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">{children}</main>
    </div>
  );
}
