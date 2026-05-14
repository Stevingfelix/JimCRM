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
  UserCog,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/app/(auth)/login/actions";

type NavItem = {
  href: string;
  label: string;
  Icon: typeof LayoutDashboard;
  match?: "exact";
};

type NavSection = {
  // null heading = no label (rendered as plain group at the top).
  heading: string | null;
  items: NavItem[];
};

const PRIMARY: NavItem[] = [
  { href: "/", label: "Dashboard", Icon: LayoutDashboard, match: "exact" },
];

const SECTIONS: NavSection[] = [
  {
    heading: "Quoting",
    items: [
      { href: "/quotes", label: "Quotes", Icon: FileText },
      { href: "/review", label: "Review", Icon: Inbox },
    ],
  },
  {
    heading: "Catalog",
    items: [
      { href: "/customers", label: "Customers", Icon: Users },
      { href: "/parts", label: "Parts", Icon: Package },
      { href: "/vendors", label: "Vendors", Icon: Truck },
    ],
  },
  {
    heading: "Intelligence",
    items: [{ href: "/analytics", label: "Analytics", Icon: BarChart3 }],
  },
];

const BOTTOM_NAV: NavItem[] = [
  { href: "/settings/team", label: "Team", Icon: UserCog },
  { href: "/settings", label: "Settings", Icon: Settings, match: "exact" },
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

function isActive(pathname: string, item: NavItem): boolean {
  if (item.match === "exact") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function Sidebar({ reviewCount = 0, user, company }: Props) {
  const pathname = usePathname();
  const initials = initialsFromUser(user);
  const displayName =
    user.full_name || (user.email ? user.email.split("@")[0] : "User");
  const [signingOut, startSignOut] = useTransition();
  const monogram = companyMonogram(company.name);
  const profileActive = pathname.startsWith("/settings/profile");

  return (
    <aside className="w-60 shrink-0 border-r bg-card flex flex-col">
      {/* Brand */}
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

      {/* Scrollable main nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {/* Primary (Dashboard) */}
        <div className="space-y-0.5">
          {PRIMARY.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(pathname, item)}
              reviewCount={reviewCount}
            />
          ))}
        </div>

        {/* Sectioned groups */}
        {SECTIONS.map((section) => (
          <div key={section.heading} className="space-y-0.5">
            {section.heading && (
              <div className="px-3 pt-1 pb-1.5 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground/70">
                {section.heading}
              </div>
            )}
            {section.items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isActive(pathname, item)}
                reviewCount={reviewCount}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* User chip */}
      <div className="px-3 pt-3 pb-2">
        <Link
          href="/settings/profile"
          className={cn(
            "group relative flex items-center gap-2.5 px-2 py-2 rounded-lg transition-colors",
            profileActive ? "bg-brand-gradient-soft" : "hover:bg-muted",
          )}
          aria-label="Open profile settings"
        >
          <div className="size-9 rounded-full bg-brand-gradient text-primary-foreground grid place-items-center font-semibold text-sm shadow-sm shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{displayName}</div>
            <div className="text-[10px] font-semibold tracking-wider uppercase text-primary">
              {user.role}
            </div>
          </div>
          <Pencil
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-opacity",
              profileActive ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            )}
          />
        </Link>
      </div>

      {/* Bottom nav */}
      <div className="px-3 pb-3 space-y-0.5 border-t pt-3">
        {BOTTOM_NAV.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActive(pathname, item)}
            reviewCount={reviewCount}
          />
        ))}
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
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-50"
          >
            <LogOut className="size-4 shrink-0" />
            <span className="flex-1 text-left">
              {signingOut ? "Signing out…" : "Logout"}
            </span>
          </button>
        </form>
      </div>
    </aside>
  );
}

function NavLink({
  item,
  active,
  reviewCount,
}: {
  item: NavItem;
  active: boolean;
  reviewCount: number;
}) {
  const { href, label, Icon } = item;
  return (
    <Link
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
}
