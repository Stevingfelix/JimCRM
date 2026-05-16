"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Plus, Search } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { NotificationBell } from "@/components/notification-bell";
import { NewCustomerDialog } from "@/app/(app)/customers/components/new-customer-dialog";
import { NewVendorDialog } from "@/app/(app)/vendors/components/new-vendor-dialog";
import { cn } from "@/lib/utils";

type Notif = React.ComponentProps<typeof NotificationBell>["initial"];

const STATIC_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/quotes": "Quotes",
  "/quotes/new": "New quote",
  "/review": "Review queue",
  "/parts": "Parts",
  "/parts/new": "New part",
  "/parts/import": "Import parts",
  "/customers": "Customers",
  "/vendors": "Vendors",
  "/analytics": "Analytics",
  "/settings": "Settings",
  "/settings/profile": "Profile",
  "/settings/company": "Company info",
  "/settings/team": "Team",
  "/parts/rules": "Part naming rules",
  "/settings/exports": "CSV export profiles",
};

function titleFor(pathname: string): string {
  if (STATIC_TITLES[pathname]) return STATIC_TITLES[pathname];
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length > 0) {
    const parent = "/" + segments[0];
    if (STATIC_TITLES[parent]) return STATIC_TITLES[parent];
  }
  return "";
}

function ActionFor({ pathname }: { pathname: string }) {
  if (pathname === "/quotes/new" || pathname === "/parts/new") return null;

  const segments = pathname.split("/").filter(Boolean);
  const top = "/" + (segments[0] ?? "");

  switch (top) {
    case "/":
    case "/quotes":
      return (
        <Link
          href="/quotes/new"
          className={cn(
            buttonVariants(),
            "h-10 rounded-full px-4 sm:px-5 gap-1.5",
          )}
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">New quote</span>
        </Link>
      );
    case "/customers":
      return <NewCustomerDialog />;
    case "/parts":
      return (
        <Link
          href="/parts/new"
          className={cn(
            buttonVariants(),
            "h-10 rounded-full px-4 sm:px-5 gap-1.5",
          )}
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">New part</span>
        </Link>
      );
    case "/vendors":
      return <NewVendorDialog />;
    default:
      return null;
  }
}

function openCommandPalette() {
  window.dispatchEvent(new CustomEvent("open-command-palette"));
}

function openMobileNav() {
  window.dispatchEvent(new CustomEvent("open-mobile-nav"));
}

export function TopBar({ notifications }: { notifications: Notif }) {
  const pathname = usePathname();
  const title = titleFor(pathname);

  return (
    <header className="h-16 border-b bg-card px-4 sm:px-6 flex items-center gap-2 sm:gap-4 shrink-0">
      {/* Hamburger — mobile only */}
      <button
        type="button"
        onClick={openMobileNav}
        aria-label="Open navigation"
        className="md:hidden size-9 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
      >
        <Menu className="size-5" />
      </button>

      <div className="min-w-0 shrink-0">
        <h1 className="text-base sm:text-xl font-semibold tracking-tight truncate">
          {title}
        </h1>
      </div>

      {/* Search — full pill on md+, icon-only on mobile */}
      <div className="flex-1 flex justify-end md:justify-center md:px-4">
        <button
          type="button"
          onClick={openCommandPalette}
          aria-label="Search (⌘K)"
          className="md:hidden size-9 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
        >
          <Search className="size-4" />
        </button>
        <button
          type="button"
          onClick={openCommandPalette}
          className="hidden md:flex w-full max-w-md items-center gap-2 h-10 rounded-full border bg-background/60 px-4 text-sm text-muted-foreground hover:bg-muted transition-colors"
          aria-label="Search (⌘K)"
        >
          <Search className="size-4 shrink-0" />
          <span className="flex-1 text-left truncate">
            Search quotes, parts, customers…
          </span>
          <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            ⌘K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <NotificationBell initial={notifications} />
        <ActionFor pathname={pathname} />
      </div>
    </header>
  );
}
