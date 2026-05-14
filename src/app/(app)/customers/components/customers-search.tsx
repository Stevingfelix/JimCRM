"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FILTERS = [
  { value: "all", label: "All customers" },
  { value: "with_quotes", label: "With quotes" },
  { value: "with_wins", label: "With wins" },
  { value: "no_quotes", label: "Inactive (no quotes)" },
] as const;

export function CustomersSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const filter = searchParams.get("filter") ?? "all";
  const [, startTransition] = useTransition();

  // Debounced search update.
  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (value) params.set("q", value);
      else params.delete("q");
      params.delete("page");
      startTransition(() => {
        router.replace(`/customers?${params.toString()}`);
      });
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleFilter(next: string | null) {
    const params = new URLSearchParams(searchParams);
    if (next && next !== "all") params.set("filter", next);
    else params.delete("filter");
    params.delete("page");
    router.replace(`/customers?${params.toString()}`);
  }

  return (
    <div className="flex flex-1 items-center gap-3 flex-wrap">
      <div className="relative flex-1 min-w-[220px] max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search customers…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-9 pl-9"
        />
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Filter by:</span>
        <Select value={filter} onValueChange={handleFilter}>
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
