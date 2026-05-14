"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatQuoteNumber } from "@/lib/format";
import {
  duplicateQuoteAndRedirect,
  softDeleteQuote,
  updateQuote,
  updateQuoteStatus,
} from "../../actions";
import {
  OutcomeReasonDialog,
  type Outcome,
} from "./outcome-reason-dialog";
import { RfqDialog } from "./rfq-dialog";

const STATUSES = ["draft", "sent", "won", "lost", "expired"] as const;
type Status = (typeof STATUSES)[number];

const TERMINAL_STATUSES = new Set<Status>(["won", "lost", "expired"]);

type Props = {
  quote: {
    id: string;
    quote_number: number;
    customer_id: string;
    customer_name: string;
    status: Status;
    validity_date: string | null;
    template_id: string | null;
    public_token: string | null;
  };
  templates: Array<{ id: string; name: string }>;
  lines: Array<{
    part_id: string | null;
    part_internal_pn: string | null;
    part_description: string | null;
    qty: number;
  }>;
};

export function QuoteHeader({ quote, templates, lines }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(quote.status);
  const [validity, setValidity] = useState(quote.validity_date ?? "");
  const [templateId, setTemplateId] = useState(quote.template_id ?? "");
  const [pending, startTransition] = useTransition();
  const [statusPending, startStatus] = useTransition();
  const [pendingOutcome, setPendingOutcome] = useState<Outcome | null>(null);

  const dirty =
    validity !== (quote.validity_date ?? "") ||
    templateId !== (quote.template_id ?? "");

  const onSaveMeta = () => {
    startTransition(async () => {
      const result = await updateQuote({
        id: quote.id,
        validity_date: validity || null,
        customer_notes: null,
        internal_notes: null,
        template_id: templateId || null,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Saved");
      router.refresh();
    });
  };

  const applyStatus = (v: Status, outcomeReason: string | null) => {
    startStatus(async () => {
      const result = await updateQuoteStatus({
        id: quote.id,
        status: v,
        outcome_reason: outcomeReason,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        setStatus(quote.status);
        setPendingOutcome(null);
        return;
      }
      setStatus(v);
      setPendingOutcome(null);
      toast.success(`Status → ${v}`);
      router.refresh();
    });
  };

  const onStatusChange = (next: string | null) => {
    if (!next) return;
    const v = next as Status;
    if (TERMINAL_STATUSES.has(v)) {
      // Prompt for reason before committing the status change.
      setPendingOutcome(v as Outcome);
      return;
    }
    setStatus(v);
    applyStatus(v, null);
  };

  const onSend = () => {
    window.open(`/api/quotes/${quote.id}/pdf`, "_blank");
    applyStatus("sent", null);
  };

  const onDuplicate = () => {
    startTransition(async () => {
      const result = await duplicateQuoteAndRedirect({ source_id: quote.id });
      if (result && !result.ok) {
        toast.error(result.error.message);
      }
      // success → server redirect handles navigation
    });
  };

  const onDelete = () => {
    if (
      !confirm(
        `Soft-delete ${formatQuoteNumber(quote.quote_number)}? You can recover from the DB.`,
      )
    )
      return;
    startTransition(async () => {
      await softDeleteQuote(quote.id);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center text-sm text-muted-foreground gap-1">
          <Link href="/quotes" className="hover:underline">
            Quotes
          </Link>
          <span>›</span>
          <span className="text-foreground font-medium tabular-nums">
            {formatQuoteNumber(quote.quote_number)}
          </span>
          <span className="text-muted-foreground">·</span>
          <Link
            href={`/customers/${quote.customer_id}`}
            className="hover:underline"
          >
            {quote.customer_name}
          </Link>
          <Badge variant="outline" className="ml-2 capitalize">
            {status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onSend}>
            Send ↗
          </Button>
          <RfqDialog
            quoteId={quote.id}
            quoteNumber={quote.quote_number}
            lines={lines}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={onDuplicate}
            disabled={pending}
          >
            Duplicate
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onDelete}
            disabled={pending}
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-3xl">
        <div className="grid gap-1.5">
          <Label htmlFor="validity">Validity date</Label>
          <Input
            id="validity"
            type="date"
            value={validity}
            onChange={(e) => setValidity(e.target.value)}
            onBlur={dirty ? onSaveMeta : undefined}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="status">Status</Label>
          <Select
            value={status}
            onValueChange={onStatusChange}
            disabled={statusPending}
          >
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="template">PDF template</Label>
          <Select
            value={templateId || undefined}
            onValueChange={(v) => {
              setTemplateId(v ?? "");
              setTimeout(onSaveMeta, 0);
            }}
          >
            <SelectTrigger id="template">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <OutcomeReasonDialog
        open={pendingOutcome !== null}
        outcome={pendingOutcome}
        pending={statusPending}
        onCancel={() => setPendingOutcome(null)}
        onConfirm={(reason) =>
          pendingOutcome && applyStatus(pendingOutcome, reason)
        }
      />
    </div>
  );
}
