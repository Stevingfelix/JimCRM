"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PartSearchCell } from "@/app/(app)/quotes/[id]/components/part-search-cell";
import {
  searchCustomersAction,
  searchVendorsAction,
  searchDraftQuotesAction,
  getVendorRecsAction,
  getSimilarVendorRecsAction,
  type QuickVendorRec,
  type SimilarVendorRec,
} from "@/app/(app)/quotes/lookups";
import type { DraftQuoteResult } from "@/app/(app)/quotes/lookups";
import { NewCustomerDialog } from "@/app/(app)/customers/components/new-customer-dialog";
import type { EnrichedLine } from "@/lib/extractors/enrich";
import {
  appendLinesToExistingQuote,
  commitReviewToQuote,
  commitReviewToVendorQuotes,
  rejectReview,
} from "../../actions";
import { InlineCreatePart } from "./inline-create-part";

type Picked = { id: string; name: string };
type Mode = "customer" | "vendor";

type LineDraft = {
  raw_text: string;
  part_number_guess: string | null;
  part_id: string | null;
  part_display: string;
  description: string | null;
  qty: string;
  unit_price: string;
  lead_time_days: string;
  confidence: number;
  reasoning: string;
  match_source: EnrichedLine["match_source"];
  matched_alias: string | null;
  extraction_source: string;
  accepted: boolean;
  thread_size: string | null;
  length: string | null;
  material: string | null;
  finish: string | null;
  grade: string | null;
  head_type: string | null;
  stock_status: string | null;
  availability_date: string | null;
  packaging_note: string | null;
  weight: string | null;
};

type Props = {
  eventId: string;
  defaultMode: Mode;
  initialLines: EnrichedLine[];
  initialCustomer:
    | { customer_id: string; customer_name: string }
    | null;
  vendorHint: string | null;
  senderName?: string | null;
  senderEmail?: string | null;
};

export function ReviewEditor({
  eventId,
  defaultMode,
  initialLines,
  initialCustomer,
  vendorHint,
  senderName,
  senderEmail,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [customer, setCustomer] = useState<Picked | null>(
    initialCustomer
      ? { id: initialCustomer.customer_id, name: initialCustomer.customer_name }
      : null,
  );
  const [vendor, setVendor] = useState<Picked | null>(null);
  const [partyQuery, setPartyQuery] = useState("");
  const [partyResults, setPartyResults] = useState<Picked[]>([]);
  const [lines, setLines] = useState<LineDraft[]>(() =>
    initialLines.map((l) => ({
      raw_text: l.raw_text,
      part_number_guess: l.part_number_guess ?? null,
      part_id: l.matched_part?.id ?? null,
      part_display: l.matched_part?.internal_pn ?? l.part_number_guess ?? "",
      description: l.matched_part?.short_description ?? null,
      qty: l.qty != null ? String(l.qty) : "",
      unit_price: l.unit_price != null ? String(l.unit_price) : "",
      lead_time_days: "",
      confidence: l.confidence,
      reasoning: l.reasoning,
      match_source: l.match_source,
      matched_alias: l.matched_alias,
      extraction_source: l.extraction_source ?? "email_body",
      accepted:
        l.matched_part !== null &&
        (l.match_source === "internal_pn_exact" ||
          l.match_source === "alias_exact") &&
        l.qty != null,
      thread_size: l.thread_size ?? null,
      length: l.length ?? null,
      material: l.material ?? null,
      finish: l.finish ?? null,
      grade: l.grade ?? null,
      head_type: l.head_type ?? null,
      stock_status: l.stock_status ?? null,
      availability_date: l.availability_date ?? null,
      packaging_note: l.packaging_note ?? null,
      weight: l.weight ?? null,
    })),
  );
  const [useExistingQuote, setUseExistingQuote] = useState(false);
  const [existingQuote, setExistingQuote] = useState<{
    quote_id: string;
    display: string;
  } | null>(null);
  const [draftQuery, setDraftQuery] = useState("");
  const [draftResults, setDraftResults] = useState<DraftQuoteResult[]>([]);
  const [committing, startCommit] = useTransition();
  const [, startReject] = useTransition();

  const picked = mode === "customer" ? customer : vendor;
  const setPicked = mode === "customer" ? setCustomer : setVendor;

  useEffect(() => {
    if (picked) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const rows = await (mode === "customer"
        ? searchCustomersAction(partyQuery)
        : searchVendorsAction(partyQuery || vendorHint || ""));
      if (!cancelled) setPartyResults(rows);
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [picked, partyQuery, mode, vendorHint]);

  useEffect(() => {
    setPartyQuery("");
    setPartyResults([]);
    setUseExistingQuote(false);
    setExistingQuote(null);
    setDraftQuery("");
    setDraftResults([]);
  }, [mode]);

  // Search draft quotes when "Add to existing" is selected.
  useEffect(() => {
    if (mode !== "customer" || !useExistingQuote || existingQuote) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const rows = await searchDraftQuotesAction(draftQuery);
      if (!cancelled) setDraftResults(rows);
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [mode, useExistingQuote, existingQuote, draftQuery]);

  const update = (idx: number, patch: Partial<LineDraft>) => {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    );
  };

  const acceptedCount = lines.filter((l) => l.accepted).length;

  const onCommit = () => {
    if (mode === "customer" && useExistingQuote) {
      if (!existingQuote) {
        toast.error("Pick a draft quote to append to");
        return;
      }
    } else if (!picked) {
      toast.error(`Pick a ${mode === "customer" ? "customer" : "vendor"} first`);
      return;
    }
    const accepted = lines.filter((l) => l.accepted);

    if (mode === "customer") {
      const ready = accepted.filter(
        (l) => l.part_id && l.qty.trim() && Number(l.qty) > 0,
      );
      if (ready.length === 0) {
        toast.error("Accept at least one line with a part + qty");
        return;
      }
      if (ready.length !== accepted.length) {
        toast.error(
          `${accepted.length - ready.length} accepted line${accepted.length - ready.length === 1 ? "" : "s"} missing part or qty`,
        );
        return;
      }
      const mappedLines = ready.map((l) => ({
        part_id: l.part_id!,
        qty: Number(l.qty),
        unit_price: l.unit_price === "" ? null : Number(l.unit_price),
        raw_text: l.raw_text,
        part_number_guess: l.part_number_guess,
        reasoning: l.reasoning,
      }));
      if (useExistingQuote && existingQuote) {
        startCommit(async () => {
          const result = await appendLinesToExistingQuote({
            event_id: eventId,
            quote_id: existingQuote.quote_id,
            lines: mappedLines,
          });
          if (!result.ok) {
            toast.error(result.error.message);
            return;
          }
          toast.success(`Lines appended to ${existingQuote.display}`);
          router.push(`/quotes/${result.data.quote_id}`);
        });
      } else {
        startCommit(async () => {
          const result = await commitReviewToQuote({
            event_id: eventId,
            customer_id: picked!.id,
            lines: mappedLines,
          });
          if (!result.ok) {
            toast.error(result.error.message);
            return;
          }
          toast.success("Quote created");
          router.push(`/quotes/${result.data.quote_id}`);
        });
      }
    } else {
      const ready = accepted.filter(
        (l) => l.part_id && l.unit_price.trim() && Number(l.unit_price) > 0,
      );
      if (ready.length === 0) {
        toast.error("Accept at least one line with a part + unit price");
        return;
      }
      if (ready.length !== accepted.length) {
        toast.error(
          `${accepted.length - ready.length} accepted line${accepted.length - ready.length === 1 ? "" : "s"} missing part or unit price`,
        );
        return;
      }
      startCommit(async () => {
        const result = await commitReviewToVendorQuotes({
          event_id: eventId,
          vendor_id: picked!.id,
          lines: ready.map((l) => ({
            part_id: l.part_id!,
            qty: l.qty === "" ? null : Number(l.qty),
            unit_price: Number(l.unit_price),
            lead_time_days:
              l.lead_time_days === "" ? null : Number(l.lead_time_days),
            raw_text: l.raw_text,
            part_number_guess: l.part_number_guess,
            reasoning: l.reasoning,
            stock_status: l.stock_status,
            availability_date: l.availability_date,
            packaging_note: l.packaging_note,
            weight: l.weight,
          })),
        });
        if (!result.ok) {
          toast.error(result.error.message);
          return;
        }
        toast.success(`Logged ${result.data.inserted} vendor quote${result.data.inserted === 1 ? "" : "s"}`);
        router.push(`/vendors/${result.data.vendor_id}`);
      });
    }
  };

  const [rejectOpen, setRejectOpen] = useState(false);

  const confirmReject = () => {
    startReject(async () => {
      const result = await rejectReview(eventId);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Rejected");
      setRejectOpen(false);
      router.push("/review");
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Commit as:</span>
        <div className="inline-flex rounded-md border overflow-hidden">
          <button
            type="button"
            onClick={() => setMode("customer")}
            className={cn(
              "px-3 py-1 text-xs",
              mode === "customer"
                ? "bg-foreground text-background"
                : "hover:bg-muted",
            )}
          >
            Customer quote
          </button>
          <button
            type="button"
            onClick={() => setMode("vendor")}
            className={cn(
              "px-3 py-1 text-xs border-l",
              mode === "vendor"
                ? "bg-foreground text-background"
                : "hover:bg-muted",
            )}
          >
            Vendor quotes
          </button>
        </div>
      </div>

      <div className="rounded-md border p-3 space-y-2">
        <div className="text-sm font-medium">
          {mode === "customer" ? "Customer" : "Vendor"}
          {mode === "vendor" && vendorHint && (
            <span className="ml-2 text-xs text-muted-foreground font-normal">
              hint from extraction: {vendorHint}
            </span>
          )}
        </div>
        {picked ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm">{picked.name}</span>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setPicked(null)}
            >
              change
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <Input
              placeholder={`Type to search ${mode}s…`}
              value={partyQuery}
              onChange={(e) => setPartyQuery(e.target.value)}
              className="h-8"
            />
            {partyResults.length > 0 && (
              <div className="rounded-md border max-h-48 overflow-auto">
                {partyResults.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => setPicked(c)}
                    className="block w-full text-left px-3 py-1.5 text-sm hover:bg-muted"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
            {mode === "customer" && (
              <NewCustomerDialog
                onCreated={(c) => setPicked({ id: c.id, name: c.name })}
                defaultContactName={senderName ?? undefined}
                defaultEmail={senderEmail ?? undefined}
                trigger={
                  <button
                    type="button"
                    className="text-sm text-primary hover:underline"
                  >
                    + Create new customer
                    {senderName && (
                      <span className="text-muted-foreground font-normal ml-1">
                        ({senderName})
                      </span>
                    )}
                  </button>
                }
              />
            )}
          </div>
        )}
      </div>

      {/* Mobile card layout */}
      <div className="md:hidden space-y-3">
        {lines.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-6 border rounded-md">
            No lines extracted. Reject to clear this email.
          </div>
        ) : (
          lines.map((line, idx) => (
            <div
              key={idx}
              className={cn(
                "rounded-lg border p-3 space-y-2",
                line.accepted && "bg-muted/30 border-foreground/10",
              )}
            >
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={line.accepted}
                    onChange={(e) =>
                      update(idx, { accepted: e.target.checked })
                    }
                  />
                  {line.accepted ? "Accepted" : "Pending"}
                </label>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px]",
                    line.part_id
                      ? (line.match_source === "internal_pn_exact" || line.match_source === "alias_exact")
                        ? "text-emerald-700 border-emerald-200"
                        : "text-amber-700 border-amber-200"
                      : "text-rose-700 border-rose-200",
                  )}
                >
                  {line.part_id
                    ? (line.match_source === "internal_pn_exact" || line.match_source === "alias_exact")
                      ? "Matched"
                      : "Fuzzy"
                    : "New part"}
                </Badge>
              </div>
              <PartSearchCell
                initialDisplay={line.part_display}
                onSelect={(p) =>
                  update(idx, {
                    part_id: p.id,
                    part_display: p.internal_pn,
                    description: p.short_description,
                  })
                }
                onClear={() =>
                  update(idx, {
                    part_id: null,
                    part_display: "",
                    description: null,
                  })
                }
                placeholder="Search part…"
              />
              {line.part_id && (
                <VendorRecsInline partId={line.part_id} />
              )}
              {line.match_source === "none" && !line.part_id && (
                <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-2 py-1.5 text-xs text-amber-800 dark:text-amber-300 font-medium">
                  New part — not in catalog
                </div>
              )}
              {line.match_source === "none" && !line.part_id && (
                <SimilarVendorRecsInline
                  threadSize={line.thread_size}
                  material={line.material}
                />
              )}
              {line.match_source === "none" && !line.part_id && line.part_display.trim() && (
                <InlineCreatePart
                  aliasPn={line.part_display.trim()}
                  suggestedDescription={line.description ?? line.raw_text}
                  aliasSourceType={mode === "customer" ? "customer" : "vendor"}
                  aliasSourceName={picked?.name ?? vendorHint ?? null}
                  suggestedThreadSize={line.thread_size}
                  suggestedLength={line.length}
                  suggestedMaterial={line.material}
                  suggestedFinish={line.finish}
                  suggestedGrade={line.grade}
                  suggestedHeadType={line.head_type}
                  onCreated={(part) =>
                    update(idx, {
                      part_id: part.id,
                      part_display: part.internal_pn,
                      description: part.short_description,
                      accepted: true,
                    })
                  }
                />
              )}
              <div className="text-xs text-muted-foreground italic">
                &ldquo;{line.raw_text}&rdquo;
              </div>
              <SpecChips line={line} />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[10px] text-muted-foreground mb-0.5">Qty</div>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={line.qty}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9.]/g, "");
                      update(idx, { qty: v });
                    }}
                    placeholder="qty"
                    className="h-8 text-right tabular-nums"
                  />
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground mb-0.5">
                    {mode === "customer" ? "Unit $" : "Unit cost"}
                  </div>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={line.unit_price}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9.]/g, "");
                      update(idx, { unit_price: v });
                    }}
                    placeholder="$0.00"
                    className="h-8 text-right tabular-nums"
                  />
                </div>
              </div>
              {mode === "vendor" && (
                <div>
                  <div className="text-[10px] text-muted-foreground mb-0.5">Lead time (days)</div>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={line.lead_time_days}
                    onChange={(e) => update(idx, { lead_time_days: e.target.value })}
                    placeholder="—"
                    className="h-8 text-right tabular-nums"
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Desktop table layout */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[44px]" />
              <TableHead className="w-[260px]">Part</TableHead>
              <TableHead>Extracted from</TableHead>
              <TableHead className="w-[100px] text-right">Qty</TableHead>
              <TableHead className="w-[120px] text-right">
                {mode === "customer" ? "Unit $" : "Unit cost"}
              </TableHead>
              {mode === "vendor" && (
                <TableHead className="w-[100px] text-right">Lead (d)</TableHead>
              )}
              <TableHead className="w-[100px] text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={mode === "vendor" ? 7 : 6}
                  className="text-center text-sm text-muted-foreground py-6"
                >
                  No lines extracted. Reject to clear this email.
                </TableCell>
              </TableRow>
            ) : (
              lines.map((line, idx) => (
                <TableRow
                  key={idx}
                  className={cn(line.accepted && "bg-muted/30")}
                >
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={line.accepted}
                      onChange={(e) =>
                        update(idx, { accepted: e.target.checked })
                      }
                      aria-label="accept line"
                    />
                  </TableCell>
                  <TableCell>
                    <PartSearchCell
                      initialDisplay={line.part_display}
                      onSelect={(p) =>
                        update(idx, {
                          part_id: p.id,
                          part_display: p.internal_pn,
                          description: p.short_description,
                        })
                      }
                      onClear={() =>
                        update(idx, {
                          part_id: null,
                          part_display: "",
                          description: null,
                        })
                      }
                      placeholder="Search part…"
                    />
                    {line.matched_alias && (
                      <div className="text-[10px] text-muted-foreground mt-1">
                        matched via alias “{line.matched_alias}”
                      </div>
                    )}
                    {(line.match_source === "internal_pn_ilike" ||
                      line.match_source === "alias_ilike") && (
                      <div className="text-[10px] text-amber-700 mt-1">
                        fuzzy match — verify
                      </div>
                    )}
                    {line.part_id && (
                      <VendorRecsInline partId={line.part_id} />
                    )}
                    {line.match_source === "none" && !line.part_id && (
                      <>
                        <div className="mt-1.5 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-2 py-1.5 text-xs text-amber-800 dark:text-amber-300 font-medium">
                          New part — not in catalog. Pick an existing part, or create a new one below.
                        </div>
                        <SimilarVendorRecsInline
                          threadSize={line.thread_size}
                          material={line.material}
                        />
                        {line.part_display.trim() && (
                          <InlineCreatePart
                            aliasPn={line.part_display.trim()}
                            suggestedDescription={
                              line.description ?? line.raw_text
                            }
                            aliasSourceType={
                              mode === "customer" ? "customer" : "vendor"
                            }
                            aliasSourceName={
                              picked?.name ?? vendorHint ?? null
                            }
                            suggestedThreadSize={line.thread_size}
                            suggestedLength={line.length}
                            suggestedMaterial={line.material}
                            suggestedFinish={line.finish}
                            suggestedGrade={line.grade}
                            suggestedHeadType={line.head_type}
                            onCreated={(part) =>
                              update(idx, {
                                part_id: part.id,
                                part_display: part.internal_pn,
                                description: part.short_description,
                                accepted: true,
                              })
                            }
                          />
                        )}
                      </>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground italic max-w-[360px]">
                    <div className="flex items-center gap-1 not-italic mb-1">
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {line.extraction_source}
                      </Badge>
                    </div>
                    “{line.raw_text}”
                    <div className="not-italic mt-1 text-[10px]">
                      {line.reasoning}
                    </div>
                    <SpecChips line={line} className="not-italic" />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={line.qty}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9.]/g, "");
                        update(idx, { qty: v });
                      }}
                      placeholder="qty"
                      className="h-8 w-full text-right tabular-nums"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={line.unit_price}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9.]/g, "");
                        update(idx, { unit_price: v });
                      }}
                      placeholder="$0.00"
                      className="h-8 w-full text-right tabular-nums"
                    />
                  </TableCell>
                  {mode === "vendor" && (
                    <TableCell>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={line.lead_time_days}
                        onChange={(e) =>
                          update(idx, { lead_time_days: e.target.value })
                        }
                        placeholder="—"
                        className="h-8 text-right tabular-nums"
                      />
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    {line.part_id ? (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          (line.match_source === "internal_pn_exact" || line.match_source === "alias_exact")
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                            : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
                        )}
                      >
                        {(line.match_source === "internal_pn_exact" || line.match_source === "alias_exact")
                          ? "Matched"
                          : "Fuzzy"}
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-xs bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800"
                      >
                        New part
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {mode === "customer" && (
        <div className="rounded-md border p-3 space-y-2">
          <div className="text-sm font-medium">Commit target</div>
          <div className="inline-flex rounded-md border overflow-hidden">
            <button
              type="button"
              onClick={() => {
                setUseExistingQuote(false);
                setExistingQuote(null);
                setDraftQuery("");
                setDraftResults([]);
              }}
              className={cn(
                "px-3 py-1 text-xs",
                !useExistingQuote
                  ? "bg-foreground text-background"
                  : "hover:bg-muted",
              )}
            >
              Create new quote
            </button>
            <button
              type="button"
              onClick={() => setUseExistingQuote(true)}
              className={cn(
                "px-3 py-1 text-xs border-l",
                useExistingQuote
                  ? "bg-foreground text-background"
                  : "hover:bg-muted",
              )}
            >
              Add to existing
            </button>
          </div>
          {useExistingQuote && (
            <>
              {existingQuote ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm">{existingQuote.display}</span>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setExistingQuote(null);
                      setDraftQuery("");
                    }}
                  >
                    change
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    placeholder="Search by quote number or customer name..."
                    value={draftQuery}
                    onChange={(e) => setDraftQuery(e.target.value)}
                    className="h-8"
                  />
                  {draftResults.length > 0 && (
                    <div className="rounded-md border max-h-48 overflow-auto">
                      {draftResults.map((q) => (
                        <button
                          type="button"
                          key={q.id}
                          onClick={() =>
                            setExistingQuote({
                              quote_id: q.id,
                              display: `Q-${q.quote_number} (${q.customer_name})`,
                            })
                          }
                          className="block w-full text-left px-3 py-1.5 text-sm hover:bg-muted"
                        >
                          <span className="font-medium">Q-{q.quote_number}</span>
                          <span className="mx-1.5 text-muted-foreground">—</span>
                          <span>{q.customer_name}</span>
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            ({q.line_count} line{q.line_count === 1 ? "" : "s"})
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {draftResults.length === 0 && draftQuery.trim() !== "" && (
                    <div className="text-xs text-muted-foreground">
                      No draft quotes found
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {acceptedCount} of {lines.length} line{lines.length === 1 ? "" : "s"}{" "}
          accepted
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setRejectOpen(true)}>
            Reject email
          </Button>
          <Button onClick={onCommit} disabled={committing || acceptedCount === 0}>
            {committing
              ? "Saving…"
              : mode === "customer"
                ? useExistingQuote && existingQuote
                  ? `Append to ${existingQuote.display} (${acceptedCount})`
                  : `Create draft quote (${acceptedCount})`
                : `Log vendor quotes (${acceptedCount})`}
          </Button>
        </div>
      </div>

      <Dialog
        open={rejectOpen}
        onOpenChange={(o) => {
          // Block close while the reject is in flight so the user doesn't
          // accidentally dismiss mid-call.
          if (!o) setRejectOpen(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this email?</DialogTitle>
            <DialogDescription>
              It will be removed from the review queue without creating any
              quote or vendor-quote records. This can&apos;t be undone — if
              you change your mind, the email will need to be re-imported
              from Gmail.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRejectOpen(false)}
              className="rounded-full"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmReject}
              className="rounded-full"
            >
              Reject email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Displays all extracted specs as individually labeled chips. */
function SpecChips({ line, className }: { line: LineDraft; className?: string }) {
  const specs: { label: string; value: string; color?: string }[] = [];

  if (line.description) specs.push({ label: "Type", value: line.description });
  if (line.thread_size) specs.push({ label: "Thread", value: line.thread_size });
  if (line.length) specs.push({ label: "Length", value: line.length });
  if (line.head_type) specs.push({ label: "Head", value: line.head_type });
  if (line.material) specs.push({ label: "Material", value: line.material });
  if (line.finish) specs.push({ label: "Finish", value: line.finish });
  if (line.grade) specs.push({ label: "Grade", value: line.grade });
  if (line.stock_status) specs.push({
    label: "Vendor stock",
    value: line.stock_status,
    color: line.stock_status.toLowerCase().includes("in stock")
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  });
  if (line.availability_date) specs.push({ label: "Available", value: line.availability_date });
  if (line.packaging_note) specs.push({ label: "Packaging", value: line.packaging_note });
  if (line.weight) specs.push({ label: "Weight", value: line.weight });

  if (specs.length === 0) return null;

  return (
    <div className={cn("mt-1.5 flex flex-wrap gap-1.5", className)}>
      {specs.map((s) => (
        <span
          key={s.label}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px]",
            s.color ?? "bg-muted text-muted-foreground",
          )}
        >
          <span className="font-semibold">{s.label}:</span>
          <span>{s.value}</span>
        </span>
      ))}
    </div>
  );
}

/** Inline vendor recommendation that auto-fetches when a part is linked. */
function VendorRecsInline({ partId }: { partId: string }) {
  const [recs, setRecs] = useState<QuickVendorRec[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getVendorRecsAction(partId).then((r) => {
      if (!cancelled) setRecs(r);
    });
    return () => { cancelled = true; };
  }, [partId]);

  if (recs.length === 0) return null;

  const best = recs[0];
  const alts = recs.slice(1);

  return (
    <div className="mt-1.5 rounded-md border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/30 px-2.5 py-1.5 text-[11px]">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex size-3.5 items-center justify-center rounded bg-emerald-600 text-white text-[8px] font-bold shrink-0">
          V
        </span>
        <span className="font-medium text-foreground">{best.vendor_name}</span>
        <span className="tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
          ${best.unit_price.toFixed(4)}
        </span>
        {best.lead_time_days != null && (
          <span className="text-muted-foreground">{best.lead_time_days}d</span>
        )}
        {alts.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="ml-auto text-muted-foreground hover:text-foreground text-[10px]"
          >
            +{alts.length} more {expanded ? "▴" : "▾"}
          </button>
        )}
      </div>
      {expanded && alts.length > 0 && (
        <div className="mt-1.5 pt-1.5 border-t border-emerald-200 dark:border-emerald-900 space-y-1">
          {alts.map((a) => (
            <div key={a.vendor_name} className="flex items-center gap-2.5 text-muted-foreground">
              <span className="inline-flex size-3.5 items-center justify-center rounded bg-muted text-[8px] font-bold shrink-0">
                V
              </span>
              <span className="text-foreground">{a.vendor_name}</span>
              <span className="tabular-nums">${a.unit_price.toFixed(4)}</span>
              {a.lead_time_days != null && <span>{a.lead_time_days}d</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Vendor suggestions for NEW/unmatched parts — uses similar specs to find comparable pricing. */
function SimilarVendorRecsInline({
  threadSize,
  material,
  productFamily,
}: {
  threadSize?: string | null;
  material?: string | null;
  productFamily?: string | null;
}) {
  const [recs, setRecs] = useState<SimilarVendorRec[]>([]);
  const [expanded, setExpanded] = useState(false);

  const hasSpecs = !!(threadSize || material || productFamily);

  useEffect(() => {
    if (!hasSpecs) return;
    let cancelled = false;
    getSimilarVendorRecsAction({
      thread_size: threadSize,
      material,
      product_family: productFamily,
    }).then((r) => {
      if (!cancelled) setRecs(r);
    });
    return () => { cancelled = true; };
  }, [threadSize, material, productFamily, hasSpecs]);

  if (recs.length === 0) return null;

  const best = recs[0];
  const alts = recs.slice(1);

  return (
    <div className="mt-1.5 rounded-md border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/30 px-2.5 py-1.5 text-[11px]">
      <div className="flex items-center gap-2">
        <span className="inline-flex size-3.5 items-center justify-center rounded bg-blue-600 text-white text-[8px] font-bold shrink-0">
          ~
        </span>
        <span className="text-muted-foreground">Similar:</span>
        <span className="font-medium text-foreground">{best.vendor_name}</span>
        <span className="tabular-nums font-medium text-blue-700 dark:text-blue-400">
          ${best.unit_price.toFixed(4)}
        </span>
        {best.lead_time_days != null && (
          <span className="text-muted-foreground">{best.lead_time_days}d</span>
        )}
        <span className="text-muted-foreground text-[9px]">({best.match_reason})</span>
        {alts.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="ml-auto text-muted-foreground hover:text-foreground text-[10px]"
          >
            +{alts.length} more {expanded ? "▴" : "▾"}
          </button>
        )}
      </div>
      {expanded && alts.length > 0 && (
        <div className="mt-1.5 pt-1.5 border-t border-blue-200 dark:border-blue-900 space-y-1">
          {alts.map((a) => (
            <div key={a.vendor_name + a.matched_part_pn} className="flex items-center gap-2 text-muted-foreground">
              <span className="inline-flex size-3.5 items-center justify-center rounded bg-muted text-[8px] font-bold shrink-0">
                ~
              </span>
              <span className="text-foreground">{a.vendor_name}</span>
              <span className="tabular-nums">${a.unit_price.toFixed(4)}</span>
              {a.lead_time_days != null && <span>{a.lead_time_days}d</span>}
              <span className="text-[9px]">({a.match_reason})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
