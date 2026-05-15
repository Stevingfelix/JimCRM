"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { EmailQuoteDialog } from "./email-quote-dialog";

const STATUSES = ["draft", "sent", "won", "lost", "expired"] as const;
type Status = (typeof STATUSES)[number];

const TERMINAL_STATUSES = new Set<Status>(["won", "lost", "expired"]);

const STATUS_STYLES: Record<Status, string> = {
  draft:
    "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
  sent: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900",
  won: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-900",
  lost: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-900",
  expired:
    "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700",
};

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
  customerContacts: Array<{ name: string | null; email: string | null }>;
};

export function QuoteHeader({ quote, templates, lines, customerContacts }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(quote.status);
  const [validity, setValidity] = useState(quote.validity_date ?? "");
  const [templateId, setTemplateId] = useState(quote.template_id ?? "");
  const [pending, startTransition] = useTransition();
  const [statusPending, startStatus] = useTransition();
  const [pendingOutcome, setPendingOutcome] = useState<Outcome | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);

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

  const onStatusChange = (next: Status) => {
    if (TERMINAL_STATUSES.has(next)) {
      setPendingOutcome(next as Outcome);
      return;
    }
    setStatus(next);
    applyStatus(next, null);
  };

  const onSend = () => {
    window.open(`/api/quotes/${quote.id}/pdf`, "_blank");
    applyStatus("sent", null);
  };

  const onShare = async () => {
    if (!quote.public_token) {
      toast.error("This quote has no public link yet — save it first.");
      return;
    }
    const url = `${window.location.origin}/q/${quote.public_token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy — link: " + url);
    }
  };

  const onDuplicate = () => {
    startTransition(async () => {
      const result = await duplicateQuoteAndRedirect({ source_id: quote.id });
      if (result && !result.ok) {
        toast.error(result.error.message);
      }
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
      {/* Breadcrumb */}
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
      </div>

      {/* Action toolbar */}
      <div className="rounded-xl border bg-card px-3 py-2.5 sm:px-4 flex flex-wrap items-center gap-2">
        {/* Status pill dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={statusPending}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium capitalize transition hover:opacity-80 disabled:opacity-60",
              STATUS_STYLES[status],
            )}
          >
            {status}
            <span aria-hidden className="text-[10px] opacity-70">
              ▾
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {STATUSES.map((s) => (
              <DropdownMenuItem
                key={s}
                onSelect={() => onStatusChange(s)}
                disabled={s === status}
                className="capitalize"
              >
                {s}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={onSend}>
            Send ↗
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEmailOpen(true)}
            className="gap-1.5"
          >
            <Mail className="h-3.5 w-3.5" />
            Email
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onShare}
            disabled={!quote.public_token}
            title={
              quote.public_token
                ? "Copy customer-facing link"
                : "No public link yet"
            }
          >
            Share
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

      {/* Secondary settings strip — validity + template */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
        <div className="grid gap-1.5">
          <Label htmlFor="validity" className="text-xs text-muted-foreground">
            Validity date
          </Label>
          <Input
            id="validity"
            type="date"
            value={validity}
            onChange={(e) => setValidity(e.target.value)}
            onBlur={dirty ? onSaveMeta : undefined}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="template" className="text-xs text-muted-foreground">
            PDF template
          </Label>
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

      <EmailQuoteDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        quoteId={quote.id}
        quoteNumber={quote.quote_number}
        customerContacts={customerContacts}
        defaultValidity={quote.validity_date}
      />
    </div>
  );
}
