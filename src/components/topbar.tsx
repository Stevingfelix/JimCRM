"use client";

import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { NewQuoteDialog } from "@/app/(app)/quotes/components/new-quote-dialog";

type Notif = React.ComponentProps<typeof NotificationBell>["initial"];

const STATIC_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/quotes": "Quotes",
  "/review": "Review queue",
  "/parts": "Parts",
  "/parts/import": "Import parts",
  "/customers": "Customers",
  "/vendors": "Vendors",
  "/analytics": "Analytics",
  "/settings": "Settings",
  "/settings/profile": "Profile",
  "/settings/company": "Company info",
  "/settings/team": "Team",
  "/settings/exports": "CSV export profiles",
};

function titleFor(pathname: string): string {
  if (STATIC_TITLES[pathname]) return STATIC_TITLES[pathname];
  // Detail routes (e.g. /quotes/abc-123) fall back to the parent.
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length > 0) {
    const parent = "/" + segments[0];
    if (STATIC_TITLES[parent]) return STATIC_TITLES[parent];
  }
  return "";
}

function openCommandPalette() {
  window.dispatchEvent(new CustomEvent("open-command-palette"));
}

export function TopBar({ notifications }: { notifications: Notif }) {
  const pathname = usePathname();
  const title = titleFor(pathname);

  return (
    <header className="h-16 border-b bg-card px-6 flex items-center gap-4 shrink-0">
      <div className="min-w-0 shrink-0">
        <h1 className="text-xl font-semibold tracking-tight truncate">
          {title}
        </h1>
      </div>

      <div className="flex-1 flex justify-center px-4">
        <button
          type="button"
          onClick={openCommandPalette}
          className="w-full max-w-md flex items-center gap-2 h-10 rounded-full border bg-background/60 px-4 text-sm text-muted-foreground hover:bg-muted transition-colors"
          aria-label="Search (⌘K)"
        >
          <Search className="size-4 shrink-0" />
          <span className="flex-1 text-left truncate">
            Search quotes, parts, customers…
          </span>
          <kbd className="hidden sm:inline font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            ⌘K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <NotificationBell initial={notifications} />
        <NewQuoteDialog />
      </div>
    </header>
  );
}
