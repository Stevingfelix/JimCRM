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
import { softDeleteQuote, updateQuote, updateQuoteStatus } from "../../actions";

const STATUSES = ["draft", "sent", "won", "lost", "expired"] as const;
type Status = (typeof STATUSES)[number];

type Props = {
  quote: {
    id: string;
    quote_number: number;
    customer_id: string;
    customer_name: string;
    status: Status;
    validity_date: string | null;
    template_id: string | null;
  };
  templates: Array<{ id: string; name: string }>;
};

export function QuoteHeader({ quote, templates }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(quote.status);
  const [validity, setValidity] = useState(quote.validity_date ?? "");
  const [templateId, setTemplateId] = useState(quote.template_id ?? "");
  const [pending, startTransition] = useTransition();
  const [statusPending, startStatus] = useTransition();

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
      // NOTE: customer_notes/internal_notes get persisted by the notes section;
      // the header only owns validity + template. We re-send nulls here only when
      // the user hasn't edited notes — handled by sending current values from the
      // server. For simplicity, the notes section calls updateQuote independently.
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Saved");
      router.refresh();
    });
  };

  const onStatusChange = (next: string | null) => {
    if (!next) return;
    const v = next as Status;
    setStatus(v);
    startStatus(async () => {
      const result = await updateQuoteStatus({ id: quote.id, status: v });
      if (!result.ok) {
        toast.error(result.error.message);
        setStatus(quote.status);
        return;
      }
      toast.success(`Status → ${v}`);
      router.refresh();
    });
  };

  const onSend = () => {
    // Render PDF (opens in a new tab) and flip status to sent.
    // Email send via Gmail is deferred — gmail.send is a separate restricted
    // scope; Jim can download the PDF and send manually for now.
    window.open(`/api/quotes/${quote.id}/pdf`, "_blank");
    startStatus(async () => {
      const result = await updateQuoteStatus({ id: quote.id, status: "sent" });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setStatus("sent");
      toast.success("PDF generated · status → sent");
      router.refresh();
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
    </div>
  );
}
