"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import type {
  PartSearchResult,
  QuoteLineDetail,
  VendorRecommendation,
} from "../../queries";
import {
  addLine,
  deleteLine,
  suggestPriceForLine,
  updateLine,
} from "../../actions";
import { PartSearchCell } from "./part-search-cell";
import { LineHistoryPopover } from "./line-history-popover";

type Props = {
  quoteId: string;
  initialLines: QuoteLineDetail[];
};

export function LinesEditor({ quoteId, initialLines }: Props) {
  const subtotal = initialLines.reduce<number | null>((acc, l) => {
    if (l.unit_price == null) return acc;
    return (acc ?? 0) + l.qty * l.unit_price;
  }, null);

  return (
    <div className="space-y-2">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">#</TableHead>
              <TableHead className="w-[260px]">Part</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[90px] text-right">Qty</TableHead>
              <TableHead className="w-[120px] text-right">Unit $</TableHead>
              <TableHead className="w-[110px] text-right">Line $</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialLines.map((line) => (
              <LineRow key={line.id} quoteId={quoteId} initial={line} />
            ))}
            <NewLineRow quoteId={quoteId} />
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end items-baseline gap-4 px-4 pt-2 text-sm">
        <span className="text-muted-foreground uppercase text-xs tracking-wide">
          Subtotal
        </span>
        <span className="text-base font-semibold tabular-nums">
          {formatMoney(subtotal)}
        </span>
      </div>
    </div>
  );
}

function LineRow({
  quoteId,
  initial,
}: {
  quoteId: string;
  initial: QuoteLineDetail;
}) {
  const router = useRouter();
  const [partId, setPartId] = useState<string | null>(initial.part_id);
  const [partDisplay, setPartDisplay] = useState(
    initial.part_internal_pn ?? "",
  );
  const [description, setDescription] = useState(
    initial.part_description ?? "",
  );
  const [qty, setQty] = useState(String(initial.qty));
  const [unitPrice, setUnitPrice] = useState(
    initial.unit_price != null ? String(initial.unit_price) : "",
  );
  const [overrideReason, setOverrideReason] = useState(
    initial.override_reason ?? "",
  );
  const [showNotes, setShowNotes] = useState(false);
  const [notesInternal, setNotesInternal] = useState(
    initial.line_notes_internal ?? "",
  );
  const [notesCustomer, setNotesCustomer] = useState(
    initial.line_notes_customer ?? "",
  );
  const [pending, startTransition] = useTransition();
  const [suggesting, startSuggest] = useTransition();

  const numericPrice = unitPrice === "" ? null : Number(unitPrice);
  const numericQty = qty === "" ? 0 : Number(qty);
  const lineTotal =
    numericPrice != null && !Number.isNaN(numericPrice) && !Number.isNaN(numericQty)
      ? numericQty * numericPrice
      : null;

  const aiSuggest = initial.ai_suggested_price;
  const priceOverridden =
    aiSuggest != null &&
    numericPrice != null &&
    Math.abs(numericPrice - aiSuggest) > 0.0001;

  // Margin badge — based on the cheapest recommended vendor cost.
  const vendorCost = initial.recommended_vendor?.unit_price ?? null;
  const marginPct =
    numericPrice != null && numericPrice > 0 && vendorCost != null
      ? ((numericPrice - vendorCost) / numericPrice) * 100
      : null;
  const targetMargin = initial.part_target_margin_pct ?? 30;
  const marginTone =
    marginPct == null
      ? "muted"
      : marginPct >= targetMargin
        ? "ok"
        : marginPct >= targetMargin - 10
          ? "warn"
          : "bad";

  const dirty =
    partId !== initial.part_id ||
    Number(qty) !== initial.qty ||
    (numericPrice ?? null) !== initial.unit_price ||
    overrideReason !== (initial.override_reason ?? "") ||
    notesInternal !== (initial.line_notes_internal ?? "") ||
    notesCustomer !== (initial.line_notes_customer ?? "");

  const persist = () => {
    if (!dirty) return;
    startTransition(async () => {
      const result = await updateLine({
        id: initial.id,
        quote_id: quoteId,
        part_id: partId,
        qty: numericQty,
        unit_price: numericPrice,
        override_reason: priceOverridden ? overrideReason || null : null,
        line_notes_internal: notesInternal || null,
        line_notes_customer: notesCustomer || null,
      });
      if (!result.ok) toast.error(result.error.message);
      else router.refresh();
    });
  };

  const remove = () => {
    if (!confirm("Remove this line?")) return;
    startTransition(async () => {
      const result = await deleteLine({ id: initial.id, quote_id: quoteId });
      if (!result.ok) toast.error(result.error.message);
      else router.refresh();
    });
  };

  return (
    <>
      <TableRow className="align-top">
        <TableCell className="tabular-nums text-muted-foreground py-2">
          {initial.position}
        </TableCell>
        <TableCell className="py-2">
          <div className="flex items-center">
            <div className="flex-1">
              <PartSearchCell
                initialDisplay={partDisplay}
                onSelect={(p) => {
                  setPartId(p.id);
                  setPartDisplay(p.internal_pn);
                  setDescription(p.description ?? "");
                  setTimeout(persist, 0);
                }}
                onClear={() => {
                  setPartId(null);
                  setPartDisplay("");
                  setDescription("");
                }}
              />
            </div>
            {partId && <LineHistoryPopover partId={partId} />}
          </div>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground py-2 truncate max-w-[400px]">
          {description || "—"}
        </TableCell>
        <TableCell className="py-2">
          <Input
            type="number"
            step="any"
            min="0"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onBlur={persist}
            className="h-8 text-right tabular-nums"
          />
        </TableCell>
        <TableCell className="py-2">
          <Input
            type="number"
            step="0.0001"
            min="0"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            onBlur={persist}
            className="h-8 text-right tabular-nums"
          />
          <div className="mt-1 flex items-center justify-end gap-2 text-[11px]">
            {aiSuggest != null && (
              <span className="text-muted-foreground tabular-nums">
                💡 {formatMoney(aiSuggest)}
                {initial.ai_reasoning && (
                  <span title={initial.ai_reasoning}> ⓘ</span>
                )}
                {(unitPrice === "" ||
                  (aiSuggest !== Number(unitPrice) && !Number.isNaN(aiSuggest))) && (
                  <button
                    type="button"
                    onClick={() => {
                      setUnitPrice(String(aiSuggest));
                      setTimeout(persist, 0);
                    }}
                    className="ml-1 underline text-foreground/70 hover:text-foreground"
                  >
                    use
                  </button>
                )}
              </span>
            )}
            {partId && (
              <button
                type="button"
                onClick={() => {
                  startSuggest(async () => {
                    const result = await suggestPriceForLine({
                      line_id: initial.id,
                      quote_id: quoteId,
                    });
                    if (!result.ok) toast.error(result.error.message);
                    else {
                      toast.success(
                        `Suggested ${formatMoney(result.data.suggested_price)} · ${(result.data.confidence * 100).toFixed(0)}%`,
                      );
                      router.refresh();
                    }
                  });
                }}
                disabled={suggesting}
                className="text-muted-foreground hover:text-foreground underline"
              >
                {suggesting ? "…" : aiSuggest != null ? "re-suggest" : "💡 suggest"}
              </button>
            )}
          </div>
        </TableCell>
        <TableCell className="text-right tabular-nums text-sm py-2">
          <div>{lineTotal != null ? formatMoney(lineTotal) : "—"}</div>
          {marginPct != null && (
            <div
              className={cn(
                "text-[10px] tabular-nums mt-0.5",
                marginTone === "ok" && "text-emerald-600",
                marginTone === "warn" && "text-amber-600",
                marginTone === "bad" && "text-rose-600",
              )}
              title={`Vendor cost ${formatMoney(vendorCost)} · target ${targetMargin}%`}
            >
              {marginPct.toFixed(0)}% margin
            </div>
          )}
        </TableCell>
        <TableCell className="py-2">
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={() => setShowNotes((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground"
              aria-expanded={showNotes}
            >
              Notes {showNotes ? "▴" : "▾"}
            </button>
            <Button
              size="sm"
              variant="ghost"
              onClick={remove}
              disabled={pending}
              className="h-6 px-2"
            >
              ×
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {priceOverridden && (
        <TableRow>
          <TableCell colSpan={2} />
          <TableCell colSpan={5} className="py-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-amber-600 dark:text-amber-500 whitespace-nowrap">
                ⚠ Price differs from AI suggestion
              </span>
              <Input
                placeholder="Why? (saved with the line)"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                onBlur={persist}
                className="h-7 max-w-xl text-xs"
              />
            </div>
          </TableCell>
        </TableRow>
      )}
      {initial.recommended_vendor && (
        <TableRow>
          <TableCell colSpan={2} />
          <TableCell colSpan={5} className="py-1">
            <VendorRecCallout
              recommended={initial.recommended_vendor}
              alternatives={initial.alt_vendors}
            />
          </TableCell>
        </TableRow>
      )}
      {showNotes && (
        <TableRow>
          <TableCell colSpan={2} />
          <TableCell colSpan={5} className="py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] text-muted-foreground mb-1">
                  Internal notes{" "}
                  <span className="text-muted-foreground">(never on PDF)</span>
                </div>
                <Textarea
                  rows={2}
                  value={notesInternal}
                  onChange={(e) => setNotesInternal(e.target.value)}
                  onBlur={persist}
                  className="text-xs"
                />
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground mb-1">
                  Customer notes
                </div>
                <Textarea
                  rows={2}
                  value={notesCustomer}
                  onChange={(e) => setNotesCustomer(e.target.value)}
                  onBlur={persist}
                  className="text-xs"
                />
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function VendorRecCallout({
  recommended,
  alternatives,
}: {
  recommended: VendorRecommendation;
  alternatives: VendorRecommendation[];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/30 px-3 py-2 text-xs">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex size-4 items-center justify-center rounded bg-emerald-600 text-white text-[9px] font-bold shrink-0">
            V
          </span>
          <span className="font-medium text-foreground">
            {recommended.vendor_name}
          </span>
        </div>
        <span className="tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
          {formatMoney(recommended.unit_price)}
        </span>
        {recommended.lead_time_days != null && (
          <span className="text-muted-foreground">
            {recommended.lead_time_days}d lead
          </span>
        )}
        {alternatives.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="ml-auto text-muted-foreground hover:text-foreground"
          >
            +{alternatives.length} more {expanded ? "▴" : "▾"}
          </button>
        )}
      </div>
      {expanded && alternatives.length > 0 && (
        <div className="mt-2 pt-2 border-t border-emerald-200 dark:border-emerald-900 space-y-1">
          {alternatives.map((a) => (
            <div
              key={a.vendor_id}
              className="flex items-center gap-3 text-muted-foreground"
            >
              <span className="inline-flex size-4 items-center justify-center rounded bg-muted text-[9px] font-bold shrink-0">
                V
              </span>
              <span className="text-foreground">{a.vendor_name}</span>
              <span className="tabular-nums">
                {formatMoney(a.unit_price)}
              </span>
              {a.lead_time_days != null && (
                <span>{a.lead_time_days}d lead</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NewLineRow({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [partId, setPartId] = useState<string | null>(null);
  const [partDisplay, setPartDisplay] = useState("");
  const [qty, setQty] = useState("");
  const [unitPrice, setUnitPrice] = useState("");

  const submit = (override?: { part?: PartSearchResult; qty?: string }) => {
    const finalPartId = override?.part?.id ?? partId;
    const finalQty = override?.qty ?? qty;
    if (!finalPartId || !finalQty.trim()) return;
    startTransition(async () => {
      const result = await addLine({
        quote_id: quoteId,
        part_id: finalPartId,
        qty: Number(finalQty),
        unit_price: unitPrice === "" ? null : Number(unitPrice),
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setPartId(null);
      setPartDisplay("");
      setQty("");
      setUnitPrice("");
      router.refresh();
    });
  };

  return (
    <TableRow className="bg-muted/20">
      <TableCell className={cn("text-muted-foreground", pending && "opacity-50")}>
        +
      </TableCell>
      <TableCell>
        <PartSearchCell
          initialDisplay={partDisplay}
          onSelect={(p) => {
            setPartId(p.id);
            setPartDisplay(p.internal_pn);
          }}
          onClear={() => {
            setPartId(null);
            setPartDisplay("");
          }}
          placeholder="Search part by PN, alias, description…"
        />
      </TableCell>
      <TableCell />
      <TableCell>
        <Input
          type="number"
          step="any"
          min="0"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="qty"
          className="h-8 text-right tabular-nums"
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          step="0.0001"
          min="0"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="optional"
          className="h-8 text-right tabular-nums"
        />
      </TableCell>
      <TableCell />
      <TableCell>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => submit()}
          disabled={pending || !partId || !qty}
        >
          add
        </Button>
      </TableCell>
    </TableRow>
  );
}
