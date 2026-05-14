"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";

// Status filter lives in QuotesStatusTabs; this file only owns the free-text
// search box. Both write to the same URL so they stay in sync.
export function QuotesFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [, startTransition] = useTransition();

  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (q) params.set("q", q);
      else params.delete("q");
      params.delete("page");
      startTransition(() => {
        router.replace(`/quotes?${params.toString()}`);
      });
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <Input
      placeholder="Search customer or quote # (e.g. Q-0492)…"
      value={q}
      onChange={(e) => setQ(e.target.value)}
      className="max-w-md h-9"
    />
  );
}
