"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { searchPartsAction } from "../../lookups";
import type { PartSearchResult } from "../../queries";

type Props = {
  initialDisplay: string;
  onSelect: (part: PartSearchResult) => void;
  onClear?: () => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onTabOut?: () => void;
};

export function PartSearchCell({
  initialDisplay,
  onSelect,
  onClear,
  className,
  placeholder = "Search part…",
  autoFocus,
  onTabOut,
}: Props) {
  const [value, setValue] = useState(initialDisplay);
  const [results, setResults] = useState<PartSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const term = value.trim();
    if (!term) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const rows = await searchPartsAction(term);
      if (!cancelled) {
        setResults(rows);
        setHighlight(0);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value, open]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const choose = (part: PartSearchResult) => {
    setValue(part.internal_pn);
    setOpen(false);
    onSelect(part);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
          if (e.target.value === "" && onClear) onClear();
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || results.length === 0) {
            if (e.key === "Tab" && onTabOut) onTabOut();
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(results.length - 1, h + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(0, h - 1));
          } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            choose(results[highlight]);
            if (e.key === "Tab" && onTabOut) onTabOut();
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        className="h-8"
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border bg-popover shadow-lg max-h-72 overflow-auto">
          {results.map((r, idx) => (
            <button
              key={r.id}
              type="button"
              onMouseEnter={() => setHighlight(idx)}
              onClick={() => choose(r)}
              className={cn(
                "block w-full text-left px-3 py-1.5 text-sm",
                idx === highlight && "bg-muted",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{r.internal_pn}</span>
                {r.matched_alias && (
                  <span className="text-xs text-muted-foreground">
                    ↳ alias “{r.matched_alias}”
                  </span>
                )}
              </div>
              {r.description && (
                <div className="text-xs text-muted-foreground truncate">
                  {r.description}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
