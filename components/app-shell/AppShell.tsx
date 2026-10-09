"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  House,
  Building2,
  LayoutDashboard,
  Menu,
  Palette,
  Plus,
  Users,
  X,
} from "lucide-react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { StayPackLogo } from "@/components/app-shell/StayPackLogo";
import { cn } from "@/lib/utils";

const navigationGroups = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/listings", label: "Listings", icon: House },
    ],
  },
  {
    label: "Agency",
    items: [
      { href: "/settings/agency", label: "Agency details", icon: Building2 },
      { href: "/settings/brand", label: "Brand settings", icon: Palette },
      { href: "/settings/agents", label: "Agents", icon: Users },
    ],
  },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-full flex-col px-5 pb-5 pt-8">
      <div className="px-3" onClick={onNavigate}>
        <StayPackLogo href="/dashboard" height={27} />
      </div>
      <Link
        href="/listings/new"
        prefetch={false}
        onClick={onNavigate}
        className="du-btn du-btn-primary du-btn-sm mt-10 min-h-12 w-full rounded-xl"
      >
        <Plus className="size-4" aria-hidden="true" />
        New listing
      </Link>
      <nav aria-label="Main navigation" className="mt-8 space-y-7">
        {navigationGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-base-content/45">
              {group.label}
            </p>
            <ul className="mt-2 w-full space-y-1">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active =
                  pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex min-h-11 items-center gap-3 rounded-[6px] px-3 py-2.5 text-sm leading-5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                        active
                          ? "bg-primary/8 font-semibold text-primary before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:rounded-full before:bg-primary"
                          : "font-medium text-base-content/60 hover:bg-base-200/65 hover:text-base-content",
                      )}
                    >
                      <Icon
                        className="size-[18px] shrink-0"
                        strokeWidth={1.6}
                        aria-hidden="true"
                      />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="mt-auto pt-10">
        <div className="border-t border-base-300 pt-4">
          <LogoutButton className="min-h-11 w-full justify-start rounded-xl px-3 text-base-content/65" />
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setMenuOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <div className="min-h-dvh">
      <a
        href="#workspace-content"
        className="sr-only z-50 rounded-lg bg-background px-4 py-3 text-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <aside
        aria-label="Workspace sidebar"
        data-theme="staypack-workspace"
        className="fixed inset-y-0 left-0 z-30 hidden w-64 overflow-y-auto border-r border-base-300 bg-base-100 text-base-content lg:block"
      >
        <SidebarContent />
      </aside>
      <div className="min-w-0 lg:pl-64">
        <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <header
            data-theme="staypack-workspace"
            className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-base-300 bg-base-100 px-5 text-base-content lg:hidden"
          >
            <StayPackLogo href="/dashboard" height={24} />
            <Dialog.Trigger
              aria-label="Open navigation"
              className="du-btn du-btn-ghost du-btn-square du-btn-sm min-h-11 min-w-11"
            >
              <Menu className="size-5" aria-hidden="true" />
            </Dialog.Trigger>
          </header>
          <Dialog.Portal>
            <Dialog.Backdrop
              data-theme="staypack-workspace"
              className="fixed inset-0 z-40 bg-neutral/35 backdrop-blur-sm transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none"
            />
            <Dialog.Popup
              data-theme="staypack-workspace"
              className="fixed inset-y-0 left-0 z-50 w-72 max-w-[calc(100%-3rem)] overflow-y-auto border-r border-base-300 bg-base-100 text-base-content shadow-xl outline-none transition-transform duration-200 data-ending-style:-translate-x-full data-starting-style:-translate-x-full motion-reduce:transition-none"
            >
              <Dialog.Title className="sr-only">
                Workspace navigation
              </Dialog.Title>
              <Dialog.Close
                aria-label="Close navigation"
                className="du-btn du-btn-ghost du-btn-square du-btn-sm absolute right-2 top-5 min-h-11 min-w-11"
              >
                <X className="size-5" aria-hidden="true" />
              </Dialog.Close>
              <SidebarContent onNavigate={() => setMenuOpen(false)} />
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
        <main
          id="workspace-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-7xl px-5 py-8 outline-none sm:px-8 lg:px-10 lg:py-12 xl:px-12"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
