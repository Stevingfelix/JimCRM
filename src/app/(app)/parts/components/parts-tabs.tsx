"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/parts", label: "Catalog" },
  { href: "/parts/rules", label: "Naming Rules" },
] as const;

export function PartsTabs() {
  const pathname = usePathname();

  return (
    <div className="inline-flex items-center gap-1 border-b w-full">
      {TABS.map((tab) => {
        const active =
          tab.href === "/parts"
            ? pathname === "/parts"
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
              active
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
