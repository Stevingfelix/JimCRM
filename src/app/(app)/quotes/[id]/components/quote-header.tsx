"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import {
  ChevronLeft,
  Copy,
  ExternalLink,
  Link2,
  Mail,
  Trash2,
} from "lucide-react";
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
    "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  sent: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  won: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  lost: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800",
  expired:
    "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
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
    part_short_description: string | null;
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
      <div className="flex items-center gap-2">
        <Link
          href="/quotes"
          className="inline-flex items-center justify-center size-8 rounded-full border hover:bg-muted transition-colors"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <div className="text-sm">
          <span className="font-semibold tabular-nums">
            Quote {formatQuoteNumber(quote.quote_number)}
          </span>
          <span className="text-muted-foreground mx-1.5">·</span>
          <Link
            href={`/customers/${quote.customer_id}`}
            className="text-muted-foreground hover:underline"
          >
            {quote.customer_name}
          </Link>
        </div>
      </div>

      {/* Action toolbar — inspired by invoice UIs: status pill + action buttons */}
      <div className="rounded-2xl border bg-card px-4 py-3 sm:px-5 flex flex-wrap items-center gap-2.5">
        {/* Status pill */}
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={statusPending}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-semibold capitalize transition hover:opacity-80 disabled:opacity-60",
              STATUS_STYLES[status],
            )}
          >
            {status}
            <span aria-hidden className="text-[10px] opacity-60">
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

        {/* Divider */}
        <div className="w-px h-6 bg-border hidden sm:block" />

        {/* Action buttons — outlined pill style */}
        <ActionButton icon={<ExternalLink />} label="Print/Save PDF" onClick={onSend} />
        <ActionButton
          icon={<Mail />}
          label="Email Quote"
          onClick={() => setEmailOpen(true)}
        />
        <ActionButton
          icon={<Link2 />}
          label="Share Link"
          onClick={onShare}
          disabled={!quote.public_token}
        />

        <div className="w-px h-6 bg-border hidden sm:block" />

        <RfqDialog
          quoteId={quote.id}
          quoteNumber={quote.quote_number}
          lines={lines}
        />
        <ActionButton
          icon={<Copy />}
          label="Duplicate"
          onClick={onDuplicate}
          disabled={pending}
        />
        <ActionButton
          icon={<Trash2 />}
          label="Delete"
          onClick={onDelete}
          disabled={pending}
          destructive
        />
      </div>

      {/* Settings strip — validity + template */}
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

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-medium transition",
        "hover:bg-muted disabled:opacity-50 disabled:pointer-events-none",
        destructive
          ? "text-rose-600 border-rose-200 hover:bg-rose-50 dark:text-rose-400 dark:border-rose-800 dark:hover:bg-rose-950"
          : "text-foreground/80 border-foreground/10 hover:border-foreground/20",
      )}
    >
      <span className="size-3.5 [&>svg]:size-3.5">{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
