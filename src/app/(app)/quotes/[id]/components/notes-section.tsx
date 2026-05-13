"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateQuote } from "../../actions";

type Props = {
  quote: {
    id: string;
    validity_date: string | null;
    customer_notes: string | null;
    internal_notes: string | null;
    template_id: string | null;
  };
};

export function NotesSection({ quote }: Props) {
  const router = useRouter();
  const [customerNotes, setCustomerNotes] = useState(
    quote.customer_notes ?? "",
  );
  const [internalNotes, setInternalNotes] = useState(
    quote.internal_notes ?? "",
  );
  const [, startTransition] = useTransition();

  const save = () => {
    const changed =
      customerNotes !== (quote.customer_notes ?? "") ||
      internalNotes !== (quote.internal_notes ?? "");
    if (!changed) return;
    startTransition(async () => {
      const result = await updateQuote({
        id: quote.id,
        validity_date: quote.validity_date,
        customer_notes: customerNotes || null,
        internal_notes: internalNotes || null,
        template_id: quote.template_id,
      });
      if (!result.ok) toast.error(result.error.message);
      else router.refresh();
    });
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="cust-notes">Customer notes (shown on PDF)</Label>
        <Textarea
          id="cust-notes"
          rows={3}
          value={customerNotes}
          onChange={(e) => setCustomerNotes(e.target.value)}
          onBlur={save}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="int-notes">
          Internal notes{" "}
          <span className="text-xs text-muted-foreground">
            (never on customer PDF)
          </span>
        </Label>
        <Textarea
          id="int-notes"
          rows={3}
          value={internalNotes}
          onChange={(e) => setInternalNotes(e.target.value)}
          onBlur={save}
        />
      </div>
    </div>
  );
}
