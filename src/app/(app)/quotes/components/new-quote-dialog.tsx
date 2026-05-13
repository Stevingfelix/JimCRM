"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { searchCustomersAction } from "../lookups";
import { createQuote } from "../actions";

type Customer = { id: string; name: string };

export function NewQuoteDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [validity, setValidity] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setQuery("");
    setResults([]);
    setSelected(null);
    setValidity("");
    setInternalNotes("");
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    searchCustomersAction(selected ? "" : query).then((rows) => {
      if (!cancelled) setResults(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [open, query, selected]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) {
      toast.error("Pick a customer first");
      return;
    }
    startTransition(async () => {
      const result = await createQuote({
        customer_id: selected.id,
        validity_date: validity || null,
        internal_notes: internalNotes || null,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Quote created");
      reset();
      setOpen(false);
      router.push(`/quotes/${result.data.id}`);
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>+ New quote</DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>New quote</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="customer">Customer *</Label>
              {selected ? (
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className="text-sm font-medium">{selected.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(null);
                      setQuery("");
                      setTimeout(() => inputRef.current?.focus(), 0);
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    change
                  </button>
                </div>
              ) : (
                <>
                  <Input
                    ref={inputRef}
                    id="customer"
                    autoFocus
                    placeholder="Type to search…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {results.length > 0 && (
                    <div className="rounded-md border max-h-48 overflow-auto">
                      {results.map((c) => (
                        <button
                          type="button"
                          key={c.id}
                          onClick={() => setSelected(c)}
                          className={cn(
                            "block w-full text-left px-3 py-1.5 text-sm hover:bg-muted",
                          )}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="validity">Validity date</Label>
              <Input
                id="validity"
                type="date"
                value={validity}
                onChange={(e) => setValidity(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="notes">
                Internal notes{" "}
                <span className="text-xs text-muted-foreground">
                  (never on customer PDF)
                </span>
              </Label>
              <Textarea
                id="notes"
                rows={3}
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={pending || !selected}>
              {pending ? "Creating…" : "Create draft"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
