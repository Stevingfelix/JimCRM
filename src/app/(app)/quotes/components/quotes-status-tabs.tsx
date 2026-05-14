"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "sent", label: "Sent" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
  { key: "expired", label: "Expired" },
] as const;

export function QuotesStatusTabs() {
  const searchParams = useSearchParams();
  const current = searchParams.get("status") ?? "";

  return (
    <div
      role="tablist"
      className="inline-flex items-center gap-1 border-b w-full overflow-x-auto"
    >
      {TABS.map((tab) => {
        const active = tab.key === current;
        const params = new URLSearchParams(searchParams);
        if (tab.key) params.set("status", tab.key);
        else params.delete("status");
        params.delete("page");
        const qs = params.toString();
        return (
          <Link
            key={tab.key || "all"}
            href={qs ? `/quotes?${qs}` : "/quotes"}
            role="tab"
            aria-selected={active}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
              active
                ? "border-primary text-primary"
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
