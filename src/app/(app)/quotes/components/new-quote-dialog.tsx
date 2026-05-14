"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

// Default validity = today + 30 days (per Jim's requirements doc).
function defaultValidity(): string {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

export function NewQuoteDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [validity, setValidity] = useState(defaultValidity());
  const [customerNotes, setCustomerNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setQuery("");
    setResults([]);
    setSelected(null);
    setValidity(defaultValidity());
    setCustomerNotes("");
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
        customer_notes: customerNotes || null,
        internal_notes: internalNotes || null,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Draft quote created");
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
      <DialogTrigger
        render={<Button className="h-10 rounded-full px-5" />}
      >
        + New quote
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-5">
          <DialogHeader className="space-y-1.5">
            <DialogTitle>New quote</DialogTitle>
            <DialogDescription>
              Fill in what you know now — lines go in the builder.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="customer">Customer *</Label>
              {selected ? (
                <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-2.5 h-11">
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
                    placeholder="Type to search customers…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {results.length > 0 && (
                    <div className="rounded-xl border bg-card max-h-48 overflow-auto">
                      {results.map((c) => (
                        <button
                          type="button"
                          key={c.id}
                          onClick={() => setSelected(c)}
                          className={cn(
                            "block w-full text-left px-4 py-2 text-sm hover:bg-muted",
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
              <Label htmlFor="cust-notes">
                Customer notes{" "}
                <span className="text-xs text-muted-foreground font-normal">
                  (shown on the PDF)
                </span>
              </Label>
              <Textarea
                id="cust-notes"
                rows={2}
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="Net-30. Standard ground freight."
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="int-notes">
                Internal notes{" "}
                <span className="text-xs text-muted-foreground font-normal">
                  (never on customer PDF)
                </span>
              </Label>
              <Textarea
                id="int-notes"
                rows={2}
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Reminders for the team…"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={pending || !selected}
              className="h-11 rounded-full w-full text-sm"
            >
              {pending ? "Creating…" : "Create draft quote"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
