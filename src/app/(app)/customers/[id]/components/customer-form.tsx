"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateCustomer } from "../../actions";

type Props = {
  initial: {
    id: string;
    name: string;
    notes: string | null;
    markup_multiplier: number;
    discount_pct: number;
    pricing_notes: string | null;
  };
};

export function CustomerForm({ initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [markup, setMarkup] = useState(String(initial.markup_multiplier));
  const [discount, setDiscount] = useState(String(initial.discount_pct));
  const [pricingNotes, setPricingNotes] = useState(
    initial.pricing_notes ?? "",
  );
  const [pending, startTransition] = useTransition();

  const dirty =
    name !== initial.name ||
    notes !== (initial.notes ?? "") ||
    Number(markup) !== initial.markup_multiplier ||
    Number(discount) !== initial.discount_pct ||
    pricingNotes !== (initial.pricing_notes ?? "");

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateCustomer({
        id: initial.id,
        name,
        notes: notes || null,
        markup_multiplier: Number(markup) || 1,
        discount_pct: Number(discount) || 0,
        pricing_notes: pricingNotes || null,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Saved");
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSave} className="space-y-4">
      <div className="grid gap-1.5">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="text-sm font-medium">Pricing rules</div>
        <p className="text-xs text-muted-foreground">
          The AI price suggester multiplies its baseline by{" "}
          <code>markup × (1 − discount%)</code> for this customer.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="markup">
              Markup multiplier{" "}
              <span className="text-xs text-muted-foreground font-normal">
                (1.000 = baseline)
              </span>
            </Label>
            <Input
              id="markup"
              type="number"
              step="0.01"
              min="0.5"
              max="5"
              value={markup}
              onChange={(e) => setMarkup(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="discount">
              Discount %{" "}
              <span className="text-xs text-muted-foreground font-normal">
                (0–50)
              </span>
            </Label>
            <Input
              id="discount"
              type="number"
              step="0.5"
              min="0"
              max="50"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pricing-notes">
            Pricing notes{" "}
            <span className="text-xs text-muted-foreground font-normal">
              (free-text guidance the AI will follow)
            </span>
          </Label>
          <Textarea
            id="pricing-notes"
            rows={2}
            value={pricingNotes}
            onChange={(e) => setPricingNotes(e.target.value)}
            placeholder="Never quote below cost. Match Acme's last price on shared SKUs."
          />
        </div>
      </div>

      <div className="flex items-center justify-end">
        <Button type="submit" disabled={!dirty || pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
