"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Inbox,
  Package,
  Users,
  Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", Icon: LayoutDashboard, match: "exact" as const },
  { href: "/quotes", label: "Quotes", Icon: FileText },
  { href: "/review", label: "Review", Icon: Inbox },
  { href: "/parts", label: "Parts", Icon: Package },
  { href: "/customers", label: "Customers", Icon: Users },
  { href: "/vendors", label: "Vendors", Icon: Truck },
];

export function Sidebar({ reviewCount = 0 }: { reviewCount?: number }) {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 border-r bg-card flex flex-col">
      <div className="px-5 py-5 border-b">
        <Link href="/" className="flex items-center gap-2">
          <div className="size-7 rounded-md bg-primary text-primary-foreground grid place-items-center font-bold text-sm">
            C
          </div>
          <span className="font-semibold tracking-tight">CAP Quoting</span>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, Icon, match }) => {
          const active =
            match === "exact"
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {href === "/review" && reviewCount > 0 && (
                <span
                  className={cn(
                    "inline-flex items-center justify-center rounded-full text-[10px] font-semibold px-1.5 min-w-[18px] h-[18px]",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary/15 text-primary",
                  )}
                >
                  {reviewCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t">
        <div className="flex items-center gap-3 px-2 py-1.5">
          <div className="size-8 rounded-full bg-primary/15 text-primary grid place-items-center font-semibold text-sm">
            J
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">Jim</div>
            <div className="text-[11px] text-muted-foreground tracking-wide uppercase">
              Admin
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
