"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import {
  LayoutDashboard,
  FileText,
  Inbox,
  Package,
  Users,
  Truck,
  LogOut,
  BarChart3,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/app/(auth)/login/actions";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", Icon: LayoutDashboard, match: "exact" as const },
  { href: "/quotes", label: "Quotes", Icon: FileText },
  { href: "/review", label: "Review", Icon: Inbox },
  { href: "/parts", label: "Parts", Icon: Package },
  { href: "/customers", label: "Customers", Icon: Users },
  { href: "/vendors", label: "Vendors", Icon: Truck },
  { href: "/analytics", label: "Analytics", Icon: BarChart3 },
  { href: "/settings", label: "Settings", Icon: Settings },
];

type Props = {
  reviewCount?: number;
  user: {
    email: string | null;
    full_name: string | null;
    role: string;
  };
  company: {
    name: string;
    logo_url: string | null;
  };
};

function initialsFromUser(user: Props["user"]): string {
  if (user.full_name) {
    const parts = user.full_name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (user.email) {
    const local = user.email.split("@")[0] ?? "";
    const parts = local.split(/[.\-_]+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (local.slice(0, 2) || "?").toUpperCase();
  }
  return "?";
}

function companyMonogram(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.slice(0, 2) || "—").toUpperCase();
}

export function Sidebar({ reviewCount = 0, user, company }: Props) {
  const pathname = usePathname();
  const initials = initialsFromUser(user);
  const displayName =
    user.full_name || (user.email ? user.email.split("@")[0] : "User");
  const [signingOut, startSignOut] = useTransition();
  const monogram = companyMonogram(company.name);

  return (
    <aside className="w-60 shrink-0 border-r bg-card flex flex-col">
      <div className="px-5 py-5 border-b">
        <Link href="/" className="flex items-center gap-2.5">
          {company.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logo_url}
              alt={company.name}
              className="size-8 rounded-lg object-contain bg-white border"
            />
          ) : (
            <div className="size-8 rounded-lg bg-brand-gradient text-primary-foreground grid place-items-center font-bold text-sm shadow-sm">
              {monogram}
            </div>
          )}
          <span className="font-semibold tracking-tight truncate">
            {company.name}
          </span>
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
                  ? "bg-brand-gradient-soft text-primary font-medium"
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
                      ? "bg-brand-gradient text-primary-foreground"
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
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="size-9 rounded-full bg-brand-gradient text-primary-foreground grid place-items-center font-semibold text-sm shadow-sm shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{displayName}</div>
            <div className="text-[11px] text-muted-foreground tracking-wide uppercase">
              {user.role}
            </div>
          </div>
          <form
            action={() => {
              startSignOut(async () => {
                await signOut();
              });
            }}
          >
            <button
              type="submit"
              disabled={signingOut}
              aria-label="Sign out"
              className="size-8 rounded-md grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
