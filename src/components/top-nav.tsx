"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/parts", label: "Parts" },
  { href: "/customers", label: "Customers" },
  { href: "/vendors", label: "Vendors" },
  { href: "/review", label: "Review" },
  { href: "/quotes", label: "Quotes" },
] as const;

export function TopNav({ reviewCount = 0 }: { reviewCount?: number }) {
  const pathname = usePathname();

  return (
    <header className="border-b bg-background sticky top-0 z-40">
      <div className="flex h-12 items-center px-4 gap-6">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight whitespace-nowrap"
        >
          CAP Quoting
        </Link>

        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-md transition-colors",
                  active
                    ? "text-foreground font-medium bg-muted"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
              >
                {item.label}
                {item.href === "/review" && reviewCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-medium px-1.5 py-0.5 min-w-[18px]">
                    {reviewCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto text-sm text-muted-foreground">
          {/* TODO: real user dropdown once Supabase auth is wired */}
          jim
        </div>
      </div>
    </header>
  );
}
