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

export function VendorsSearch({ categories }: { categories: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const [category, setCategory] = useState(
    searchParams.get("category") ?? ALL,
  );
  const [, startTransition] = useTransition();

  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (value) params.set("q", value);
      else params.delete("q");
      if (category && category !== ALL) params.set("category", category);
      else params.delete("category");
      params.delete("page");
      startTransition(() => {
        router.replace(`/vendors?${params.toString()}`);
      });
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, category]);

  return (
    <div className="flex items-center gap-2">
      <Input
        autoFocus
        placeholder="Search name, contact email…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="max-w-md h-9"
      />
      <Select
        value={category}
        onValueChange={(v) => setCategory(v ?? ALL)}
      >
        <SelectTrigger className="w-[200px] h-9">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All categories</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
