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
} from "@/app/(app)/quotes/lookups";
import type { EnrichedLine } from "@/lib/extractors/enrich";
import {
  commitReviewToQuote,
  commitReviewToVendorQuotes,
  rejectReview,
} from "../../actions";
import { InlineCreatePart } from "./inline-create-part";

type Picked = { id: string; name: string };
type Mode = "customer" | "vendor";

type LineDraft = {
  raw_text: string;
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
};

type Props = {
  eventId: string;
  defaultMode: Mode;
  initialLines: EnrichedLine[];
  initialCustomer:
    | { customer_id: string; customer_name: string }
    | null;
  vendorHint: string | null;
};

export function ReviewEditor({
  eventId,
  defaultMode,
  initialLines,
  initialCustomer,
  vendorHint,
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
      part_id: l.matched_part?.id ?? null,
      part_display: l.matched_part?.internal_pn ?? l.part_number_guess ?? "",
      description: l.matched_part?.description ?? null,
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
    })),
  );
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
  }, [mode]);

  const update = (idx: number, patch: Partial<LineDraft>) => {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    );
  };

  const acceptedCount = lines.filter((l) => l.accepted).length;

  const onCommit = () => {
    if (!picked) {
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
      startCommit(async () => {
        const result = await commitReviewToQuote({
          event_id: eventId,
          customer_id: picked.id,
          lines: ready.map((l) => ({
            part_id: l.part_id!,
            qty: Number(l.qty),
            unit_price: l.unit_price === "" ? null : Number(l.unit_price),
          })),
        });
        if (!result.ok) {
          toast.error(result.error.message);
          return;
        }
        toast.success("Quote created");
        router.push(`/quotes/${result.data.quote_id}`);
      });
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
          vendor_id: picked.id,
          lines: ready.map((l) => ({
            part_id: l.part_id!,
            qty: l.qty === "" ? null : Number(l.qty),
            unit_price: Number(l.unit_price),
            lead_time_days:
              l.lead_time_days === "" ? null : Number(l.lead_time_days),
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
          </div>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[44px]" />
              <TableHead className="w-[260px]">Part</TableHead>
              <TableHead>Extracted from</TableHead>
              <TableHead className="w-[80px] text-right">Qty</TableHead>
              <TableHead className="w-[110px] text-right">
                {mode === "customer" ? "Unit $" : "Unit cost"}
              </TableHead>
              {mode === "vendor" && (
                <TableHead className="w-[100px] text-right">Lead (d)</TableHead>
              )}
              <TableHead className="w-[80px] text-right">Conf.</TableHead>
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
                          description: p.description,
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
                    {line.match_source === "none" && !line.part_id && (
                      <>
                        <div className="text-[10px] text-rose-700 mt-1">
                          no part match — pick one, create new, or reject
                        </div>
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
                            onCreated={(part) =>
                              update(idx, {
                                part_id: part.id,
                                part_display: part.internal_pn,
                                description: part.description,
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
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      value={line.qty}
                      onChange={(e) => update(idx, { qty: e.target.value })}
                      className="h-8 text-right tabular-nums"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={line.unit_price}
                      onChange={(e) =>
                        update(idx, { unit_price: e.target.value })
                      }
                      placeholder={mode === "customer" ? "optional" : "required"}
                      className="h-8 text-right tabular-nums"
                    />
                  </TableCell>
                  {mode === "vendor" && (
                    <TableCell>
                      <Input
                        type="number"
                        step="1"
                        min="0"
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
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs tabular-nums",
                        line.confidence < 0.5 &&
                          "bg-rose-50 text-rose-700 border-rose-200",
                        line.confidence >= 0.5 &&
                          line.confidence < 0.7 &&
                          "bg-amber-50 text-amber-700 border-amber-200",
                        line.confidence >= 0.7 &&
                          "bg-emerald-50 text-emerald-700 border-emerald-200",
                      )}
                    >
                      {line.confidence.toFixed(2)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
                ? `Create draft quote (${acceptedCount})`
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
