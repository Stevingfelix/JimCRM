"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Package,
  Users,
  Truck,
  FileText,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { globalSearch, type GlobalSearchHit } from "@/app/(app)/global-search";

const KIND_ICON: Record<GlobalSearchHit["kind"], React.ComponentType<{ className?: string }>> = {
  part: Package,
  customer: Users,
  vendor: Truck,
  quote: FileText,
};

const KIND_LABEL: Record<GlobalSearchHit["kind"], string> = {
  part: "Part",
  customer: "Customer",
  vendor: "Vendor",
  quote: "Quote",
};

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GlobalSearchHit[]>([]);
  const [highlight, setHighlight] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd+K / Ctrl+K toggles the palette globally.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Reset when opening.
  useEffect(() => {
    if (open) {
      setQuery("");
      setHits([]);
      setHighlight(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  // Debounced search.
  useEffect(() => {
    if (!open) return;
    if (!query.trim()) {
      setHits([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const results = await globalSearch(query);
      if (!cancelled) {
        setHits(results);
        setHighlight(0);
        setLoading(false);
      }
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, open]);

  const choose = useCallback(
    (hit: GlobalSearchHit) => {
      setOpen(false);
      router.push(hit.href);
    },
    [router],
  );

  const onKeyDownInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(hits.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (hits[highlight]) choose(hits[highlight]);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 bg-foreground/20 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl rounded-2xl border bg-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDownInput}
            placeholder="Search parts, customers, vendors, quotes…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          <kbd className="text-[10px] text-muted-foreground border rounded px-1.5 py-0.5">
            esc
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-auto">
          {query.trim() === "" ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Type to search across the workspace.
            </div>
          ) : loading && hits.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Searching…
            </div>
          ) : hits.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No results for &ldquo;{query}&rdquo;.
            </div>
          ) : (
            <ul className="py-1">
              {hits.map((hit, idx) => {
                const Icon = KIND_ICON[hit.kind];
                return (
                  <li key={`${hit.kind}:${hit.id}`}>
                    <button
                      type="button"
                      onMouseEnter={() => setHighlight(idx)}
                      onClick={() => choose(hit)}
                      className={cn(
                        "flex items-center gap-3 w-full text-left px-4 py-2.5",
                        idx === highlight && "bg-muted",
                      )}
                    >
                      <Icon className="size-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {hit.title}
                        </div>
                        {hit.subtitle && (
                          <div className="text-xs text-muted-foreground truncate">
                            {hit.subtitle}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                        {KIND_LABEL[hit.kind]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-4 py-2 border-t bg-muted/40 text-[11px] text-muted-foreground flex items-center justify-between">
          <span>
            <kbd className="border rounded px-1">↑↓</kbd> navigate
            <span className="mx-2">·</span>
            <kbd className="border rounded px-1">↵</kbd> open
          </span>
          <span>
            <kbd className="border rounded px-1">⌘K</kbd> toggle
          </span>
        </div>
      </div>
    </div>
  );
}
