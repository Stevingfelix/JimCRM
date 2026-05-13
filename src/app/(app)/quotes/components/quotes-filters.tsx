"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all__";
const STATUSES = ["draft", "sent", "won", "lost", "expired"] as const;

export function QuotesFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? ALL);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (q) params.set("q", q);
      else params.delete("q");
      if (status && status !== ALL) params.set("status", status);
      else params.delete("status");
      params.delete("page");
      startTransition(() => {
        router.replace(`/quotes?${params.toString()}`);
      });
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status]);

  return (
    <div className="flex items-center gap-2">
      <Input
        autoFocus
        placeholder="Search customer, quote # (e.g. Q-0492)…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-md h-9"
      />
      <Select value={status} onValueChange={(v) => setStatus(v ?? ALL)}>
        <SelectTrigger className="w-[160px] h-9">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s} className="capitalize">
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
