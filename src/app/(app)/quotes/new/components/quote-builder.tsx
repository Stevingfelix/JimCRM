"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ChevronLeft,
  GripVertical,
  Plus,
  Trash2,
  UserPlus,
  X,
  Search,
  Pencil,
  FileEdit,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AiTextPanel,
  AiVoicePanel,
  AiTriggerButtons,
} from "@/components/ai-text-assist";
import { NewCustomerDialog } from "@/app/(app)/customers/components/new-customer-dialog";
import { cn } from "@/lib/utils";
import { formatMoney, formatQuoteNumber } from "@/lib/format";
import { searchPartsAction, searchCustomersAction } from "../../lookups";
import {
  createQuoteWithLines,
  extractQuoteFromText,
  type ExtractedQuote,
} from "../../actions";

type Customer = { id: string; name: string };

type Line = {
  // Local row id for React keys; not sent to the server.
  uid: string;
  part_id: string | null;
  part_label: string | null; // human-readable display when a part is linked
  description: string;
  qty: number;
  unit_price: number | null;
};

type Props = {
  initialCustomers: Customer[];
  previewQuoteNumber: number;
  presetCustomerId: string | null;
};

function newLine(): Line {
  return {
    uid: Math.random().toString(36).slice(2),
    part_id: null,
    part_label: null,
    description: "",
    qty: 1,
    unit_price: null,
  };
}

function defaultValidity(): string {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function QuoteBuilder({
  initialCustomers,
  previewQuoteNumber,
  presetCustomerId,
}: Props) {
  const router = useRouter();
  const [aiMode, setAiMode] = useState<"voice" | "text" | null>(null);
  const [processing, setProcessing] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(
    presetCustomerId
      ? initialCustomers.find((c) => c.id === presetCustomerId) ?? null
      : null,
  );
  const [validity, setValidity] = useState(defaultValidity());
  const [customerNotes, setCustomerNotes] = useState(
    "Thank you for the opportunity. Pricing valid through the validity date above.",
  );
  const [internalNotes, setInternalNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [pending, startTransition] = useTransition();

  const subtotal = useMemo(
    () =>
      lines.reduce<number>((acc, l) => {
        if (l.unit_price == null) return acc;
        return acc + l.qty * l.unit_price;
      }, 0),
    [lines],
  );

  function updateLine(uid: string, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));
  }
  function removeLine(uid: string) {
    setLines((ls) =>
      ls.length <= 1 ? [newLine()] : ls.filter((l) => l.uid !== uid),
    );
  }
  function moveLine(uid: string, dir: -1 | 1) {
    setLines((ls) => {
      const idx = ls.findIndex((l) => l.uid === uid);
      if (idx < 0) return ls;
      const next = idx + dir;
      if (next < 0 || next >= ls.length) return ls;
      const copy = [...ls];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
  }
  function addLine() {
    setLines((ls) => [...ls, newLine()]);
  }

  async function trackedExtract(text: string) {
    setProcessing(true);
    try {
      return await extractQuoteFromText(text);
    } finally {
      setProcessing(false);
    }
  }

  function applyExtraction(r: ExtractedQuote) {
    if (r.validity_date) setValidity(r.validity_date);
    if (r.customer_notes) setCustomerNotes(r.customer_notes);
    if (r.internal_notes) setInternalNotes(r.internal_notes);
    // Customer name → try to fuzzy-match the dropdown; otherwise leave the
    // current selection so Jim can pick manually after reviewing.
    if (r.customer_name && !customer) {
      const lower = r.customer_name.toLowerCase();
      const hit = initialCustomers.find((c) =>
        c.name.toLowerCase().includes(lower) ||
        lower.includes(c.name.toLowerCase()),
      );
      if (hit) setCustomer(hit);
    }
    if (r.lines.length > 0) {
      const mapped: Line[] = r.lines.map((l) => ({
        uid: Math.random().toString(36).slice(2),
        part_id: null,
        part_label: l.part_number_guess,
        description: [l.part_number_guess, l.description]
          .filter(Boolean)
          .join(" — "),
        qty: l.qty ?? 1,
        unit_price: l.unit_price,
      }));
      setLines((existing) => {
        // If the only existing line is the empty default, replace it.
        const hasContent = existing.some(
          (e) => e.description.trim() || e.part_id || e.unit_price != null,
        );
        return hasContent ? [...existing, ...mapped] : mapped;
      });
    }
  }

  // mode controls where to go after save:
  //   "draft"    → back to the quotes list (keep working later)
  //   "finalize" → open the detail page to finish the quote
  function handleSave(mode: "draft" | "finalize") {
    if (!customer) {
      toast.error("Pick a customer first");
      return;
    }
    const cleanLines = lines
      .filter((l) => l.description.trim() || l.part_id)
      .map((l) => ({
        part_id: l.part_id,
        description: l.description.trim() || null,
        qty: l.qty,
        unit_price: l.unit_price,
      }));
    startTransition(async () => {
      const res = await createQuoteWithLines({
        customer_id: customer.id,
        validity_date: validity || null,
        customer_notes: customerNotes.trim() || null,
        internal_notes: internalNotes.trim() || null,
        lines: cleanLines,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(
        mode === "draft" ? "Saved as draft" : "Quote created",
      );
      // Native View Transition for a smooth fade when the browser supports
      // it; falls back to a normal navigation otherwise.
      const w = window as unknown as {
        startViewTransition?: (cb: () => void) => unknown;
      };
      const target =
        mode === "draft" ? "/quotes" : `/quotes/${res.data.id}`;
      const navigate = () => router.push(target);
      if (typeof w.startViewTransition === "function") {
        w.startViewTransition(navigate);
      } else {
        navigate();
      }
    });
  }

  return (
    <div
      className="px-8 py-6 max-w-7xl mx-auto"
      style={{ viewTransitionName: "quote-builder" }}
    >
      <div className="flex items-center justify-between mb-5">
        <Link
          href="/quotes"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="size-4 mr-1" />
          Back to quotes
        </Link>
      </div>

      <form
        onSubmit={(e) => {
          // Enter inside an input shouldn't submit anything destructive;
          // explicit footer buttons drive both save flows.
          e.preventDefault();
          handleSave("finalize");
        }}
        className="space-y-6"
      >
        <section className="rounded-xl border bg-card p-6 space-y-5">
          {/* Title + AI triggers */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-semibold tracking-tight">
              Quote Details
            </h2>
            <AiTriggerButtons
              active={aiMode}
              onPick={setAiMode}
              disabled={processing}
            />
          </div>

          {aiMode === "text" && (
            <AiTextPanel
              extractAction={trackedExtract}
              onExtracted={(r) => applyExtraction(r as ExtractedQuote)}
              onClose={() => setAiMode(null)}
              title="Describe the quote in plain language."
              placeholder="e.g. RFQ from Acme — need 50 hex bolts M8, 200 washers A2 stainless, by Friday, ship to NY."
            />
          )}

          {aiMode === "voice" && (
            <AiVoicePanel
              extractAction={trackedExtract}
              onExtracted={(r) => applyExtraction(r as ExtractedQuote)}
              onClose={() => setAiMode(null)}
            />
          )}

          <div
            className={cn(
              "space-y-5 transition-all",
              processing && "blur-sm opacity-60 pointer-events-none",
            )}
            aria-busy={processing}
          >
            {/* Customer + dates row */}
            <div className="grid md:grid-cols-2 gap-5">
              <CustomerPicker
                value={customer}
                onChange={setCustomer}
                initialCustomers={initialCustomers}
              />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Issue Date">
                  <Input value={today()} disabled />
                </Field>
                <Field label="Validity Date">
                  <Input
                    type="date"
                    value={validity}
                    onChange={(e) => setValidity(e.target.value)}
                  />
                </Field>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <Field label="Quote Number">
                <Input
                  value={`${formatQuoteNumber(previewQuoteNumber)} (assigned on save)`}
                  disabled
                />
              </Field>
              <div />
            </div>
          </div>
        </section>

        {/* LINE ITEMS — overflow stays visible so the part-search popover
            can extend below row boundaries. Header + footer round their own
            corners to preserve the card look. */}
        <section className="rounded-xl border bg-card">
          <div className="grid grid-cols-[28px_1fr_90px_120px_110px_36px] gap-2 px-4 py-2.5 border-b text-[10px] font-semibold tracking-wider uppercase text-muted-foreground rounded-t-xl">
            <span />
            <span>Item description</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Unit price</span>
            <span className="text-right">Total</span>
            <span />
          </div>
          <ul className="divide-y">
            {lines.map((line, idx) => (
              <LineRow
                key={line.uid}
                line={line}
                index={idx}
                canMoveUp={idx > 0}
                canMoveDown={idx < lines.length - 1}
                onUpdate={(patch) => updateLine(line.uid, patch)}
                onRemove={() => removeLine(line.uid)}
                onMoveUp={() => moveLine(line.uid, -1)}
                onMoveDown={() => moveLine(line.uid, 1)}
              />
            ))}
          </ul>
          <div className="px-4 py-3 border-t bg-muted/20 rounded-b-xl">
            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <Plus className="size-3.5" />
              Add line item
            </button>
          </div>
        </section>

        {/* NOTES + TOTALS */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            <section className="rounded-xl border bg-card p-5 space-y-3">
              <h3 className="text-sm font-semibold">Customer notes</h3>
              <p className="text-[11px] text-muted-foreground -mt-2">
                Printed on the quote PDF.
              </p>
              <Textarea
                rows={4}
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="Net-30. Standard ground freight."
              />
            </section>
            <section className="rounded-xl border bg-card p-5 space-y-3">
              <h3 className="text-sm font-semibold">Internal notes</h3>
              <p className="text-[11px] text-muted-foreground -mt-2">
                Never shown to the customer.
              </p>
              <Textarea
                rows={3}
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Reminders for the team…"
              />
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-xl border bg-card p-5">
              <h3 className="text-sm font-semibold mb-4">Summary</h3>
              <dl className="space-y-2.5">
                <Row label="Subtotal" value={formatMoney(subtotal)} />
                <Row label="Discount" value="$0.00" tone="muted" />
                <Row label="Tax" value="$0.00" tone="muted" />
                <div className="pt-3 mt-2 border-t flex items-baseline justify-between">
                  <span className="text-sm font-semibold">Total</span>
                  <span className="text-xl font-semibold tabular-nums text-primary">
                    {formatMoney(subtotal)}
                  </span>
                </div>
              </dl>
            </section>
            <div className="text-[11px] text-muted-foreground px-1">
              Pricing rules from the customer profile apply on the detail page
              after you save.
            </div>
          </aside>
        </div>

        {/* FOOTER ACTIONS — three buttons matching the reference:
            Discard (back to list) / Save as Draft (save + list) /
            Finalize & Create (save + open the detail page). */}
        <div className="border-t pt-5 pb-8 flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2">
          <Link
            href="/quotes"
            className="inline-flex items-center justify-center h-10 rounded-full border bg-background px-5 text-sm hover:bg-muted transition-colors"
          >
            Discard
          </Link>
          <button
            type="button"
            onClick={() => handleSave("draft")}
            disabled={pending || !customer}
            className="inline-flex items-center justify-center gap-1.5 h-10 rounded-full bg-brand-gradient-soft text-primary px-5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Pencil className="size-4" />
            {pending ? "Saving…" : "Save as Draft"}
          </button>
          <button
            type="button"
            onClick={() => handleSave("finalize")}
            disabled={pending || !customer}
            className="inline-flex items-center justify-center gap-1.5 h-10 rounded-full bg-brand-gradient text-primary-foreground px-6 text-sm font-medium shadow-sm hover:brightness-105 transition-all disabled:opacity-50"
          >
            <FileEdit className="size-4" />
            {pending ? "Creating…" : "Finalize & Create"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "muted";
}) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className={tone === "muted" ? "text-muted-foreground" : ""}>
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Line row

function LineRow({
  line,
  index,
  canMoveUp,
  canMoveDown,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  line: Line;
  index: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onUpdate: (patch: Partial<Line>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const total =
    line.unit_price != null ? line.qty * line.unit_price : null;
  return (
    <li className="grid grid-cols-[28px_1fr_90px_120px_110px_36px] gap-2 px-4 py-2.5 items-center">
      <div className="flex flex-col items-center text-muted-foreground">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={!canMoveUp}
          className="size-4 grid place-items-center hover:text-foreground disabled:opacity-30"
          aria-label="Move up"
        >
          <GripVertical className="size-3" />
        </button>
        <span className="text-[10px] tabular-nums">{index + 1}</span>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={!canMoveDown}
          className="size-4 grid place-items-center hover:text-foreground disabled:opacity-30"
          aria-label="Move down"
        >
          <GripVertical className="size-3" />
        </button>
      </div>
      <PartCell line={line} onUpdate={onUpdate} />
      <Input
        type="number"
        min={0}
        step={1}
        value={line.qty}
        onChange={(e) =>
          onUpdate({ qty: Math.max(0, Number(e.target.value) || 0) })
        }
        className="h-9 text-right tabular-nums"
      />
      <Input
        type="number"
        min={0}
        step="0.01"
        value={line.unit_price ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onUpdate({ unit_price: v === "" ? null : Number(v) });
        }}
        placeholder="0.00"
        className="h-9 text-right tabular-nums"
      />
      <div className="text-right text-sm font-medium tabular-nums">
        {total != null ? formatMoney(total) : "—"}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="size-8 grid place-items-center text-muted-foreground hover:text-destructive rounded"
        aria-label="Remove line"
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Part cell with search + free-text fallback

function PartCell({
  line,
  onUpdate,
}: {
  line: Line;
  onUpdate: (patch: Partial<Line>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    Array<{ id: string; internal_pn: string; description: string | null }>
  >([]);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced part search.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      const q = query.trim();
      if (!q) {
        setResults([]);
        return;
      }
      const hits = await searchPartsAction(q);
      setResults(hits.slice(0, 8));
    }, 150);
    return () => clearTimeout(t);
  }, [open, query]);

  // Click-outside close.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div className="relative" ref={boxRef}>
      {line.part_id ? (
        <div className="flex items-center justify-between h-9 px-3 rounded-md border bg-muted/30">
          <span className="text-sm truncate font-medium">
            {line.part_label}
          </span>
          <button
            type="button"
            onClick={() =>
              onUpdate({ part_id: null, part_label: null, description: "" })
            }
            className="size-5 grid place-items-center text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Unlink part"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <Input
          value={line.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          onFocus={() => setOpen(true)}
          placeholder="Search or enter item…"
          className="h-9"
        />
      )}
      {open && !line.part_id && (
        <div className="absolute z-30 left-0 right-0 mt-1 rounded-lg border bg-card shadow-xl overflow-hidden">
          <div className="px-3 py-2 border-b flex items-center gap-2">
            <Search className="size-3.5 text-muted-foreground shrink-0" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search parts by PN or description…"
              className="h-7 border-0 px-0 shadow-none focus-visible:ring-0"
            />
          </div>
          {results.length > 0 ? (
            <ul className="max-h-48 overflow-auto">
              {results.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdate({
                        part_id: p.id,
                        part_label: p.internal_pn,
                        description: p.description ?? "",
                      });
                      setOpen(false);
                      setQuery("");
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                  >
                    <div className="font-medium">{p.internal_pn}</div>
                    {p.description && (
                      <div className="text-xs text-muted-foreground truncate">
                        {p.description}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {query.trim()
                ? "No matches — leave as free text or create the part later."
                : "Type to search the catalog, or keep typing in the field above for free text."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Customer picker

function CustomerPicker({
  value,
  onChange,
  initialCustomers,
}: {
  value: Customer | null;
  onChange: (c: Customer | null) => void;
  initialCustomers: Customer[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Customer[]>(
    initialCustomers.slice(0, 15),
  );
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      const rows = await searchCustomersAction(query);
      setResults(rows);
    }, 150);
    return () => clearTimeout(t);
  }, [open, query]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div className="space-y-1.5" ref={boxRef}>
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-muted-foreground">
          Customer
        </Label>
        <NewCustomerDialog
          onCreated={(c) => {
            onChange(c);
            setOpen(false);
          }}
          trigger={
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <UserPlus className="size-3.5" />
              Add new customer
            </button>
          }
        />
      </div>
      <div className="relative">
        {value ? (
          <div className="flex items-center justify-between h-10 px-3 rounded-md border bg-muted/30">
            <span className="text-sm font-medium truncate">{value.name}</span>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              change
            </button>
          </div>
        ) : (
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search customers…"
            className="h-10"
          />
        )}
        {open && !value && (
          <div className="absolute z-30 left-0 right-0 mt-1 rounded-lg border bg-card shadow-xl max-h-56 overflow-auto">
            {results.length > 0 ? (
              <ul>
                {results.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(c);
                        setOpen(false);
                        setQuery("");
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                    >
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                No customers found.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
