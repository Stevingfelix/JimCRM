"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bookmark, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  deleteSearch,
  saveSearch,
  type SavedSearch,
} from "@/app/(app)/saved-searches/actions";

type RouteKey = "parts" | "customers" | "vendors" | "quotes";

type Props = {
  routeKey: RouteKey;
  routeBase: string; // e.g. "/parts"
  initial: SavedSearch[];
};

export function SavedSearchesMenu({ routeKey, routeBase, initial }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [, startTransition] = useTransition();
  const [items, setItems] = useState(initial);

  const currentQuery = searchParams.toString();
  const hasQuery = currentQuery.length > 0;

  const onSave = () => {
    const name = draftName.trim();
    if (!name) return;
    startTransition(async () => {
      const result = await saveSearch({
        route_key: routeKey,
        name,
        query_string: currentQuery,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      // Update local state optimistically.
      setItems((prev) => {
        const filtered = prev.filter((s) => s.name !== name);
        return [...filtered, { name, query_string: currentQuery }];
      });
      setDraftName("");
      setNaming(false);
      toast.success(`Saved "${name}"`);
    });
  };

  const onApply = (s: SavedSearch) => {
    router.push(`${routeBase}${s.query_string ? `?${s.query_string}` : ""}`);
    setOpen(false);
  };

  const onDelete = (name: string) => {
    startTransition(async () => {
      const result = await deleteSearch({ route_key: routeKey, name });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setItems((prev) => prev.filter((s) => s.name !== name));
      toast.success(`Removed "${name}"`);
    });
  };

  return (
    <div className="relative">
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen((v) => !v)}
        className="h-9 rounded-full"
      >
        <Bookmark className="size-4 mr-1.5" />
        Saved {items.length > 0 && <span className="text-muted-foreground ml-1">({items.length})</span>}
      </Button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => {
              setOpen(false);
              setNaming(false);
            }}
          />
          <div className="absolute right-0 top-full mt-2 w-[320px] rounded-xl border bg-card shadow-lg z-40 overflow-hidden">
            <div className="px-3 py-2 border-b text-xs uppercase tracking-wider text-muted-foreground">
              Saved searches
            </div>

            {items.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                No saved searches yet.
              </div>
            ) : (
              <ul className="divide-y max-h-72 overflow-auto">
                {items.map((s) => (
                  <li
                    key={s.name}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 hover:bg-muted/40",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onApply(s)}
                      className="flex-1 text-left text-sm truncate"
                    >
                      {s.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(s.name)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Delete ${s.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="border-t p-3">
              {!naming ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setNaming(true)}
                  disabled={!hasQuery}
                  className="w-full h-9 text-xs"
                >
                  {hasQuery
                    ? "+ Save current view"
                    : "Apply a filter first to save it"}
                </Button>
              ) : (
                <div className="space-y-2">
                  <Input
                    autoFocus
                    placeholder="Name this view…"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onSave();
                      } else if (e.key === "Escape") {
                        setNaming(false);
                        setDraftName("");
                      }
                    }}
                    className="h-9"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={onSave}
                      disabled={!draftName.trim()}
                      className="flex-1 h-9"
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setNaming(false);
                        setDraftName("");
                      }}
                      className="h-9"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
