"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const REASON_OPTIONS: Record<
  "won" | "lost" | "expired",
  Array<{ value: string; label: string }>
> = {
  won: [
    { value: "best_price", label: "Best price" },
    { value: "best_lead_time", label: "Best lead time" },
    { value: "existing_relationship", label: "Existing relationship" },
    { value: "spec_match", label: "Spec match / quality" },
    { value: "other", label: "Other" },
  ],
  lost: [
    { value: "price_too_high", label: "Price too high" },
    { value: "lead_time_too_long", label: "Lead time too long" },
    { value: "no_response", label: "Customer didn't respond" },
    { value: "lost_to_competitor", label: "Lost to a competitor" },
    { value: "customer_cancelled", label: "Customer cancelled the project" },
    { value: "spec_mismatch", label: "Spec / quality mismatch" },
    { value: "other", label: "Other" },
  ],
  expired: [
    { value: "validity_passed", label: "Validity date passed" },
    { value: "no_response", label: "Customer never responded" },
    { value: "other", label: "Other" },
  ],
};

export type Outcome = "won" | "lost" | "expired";

type Props = {
  open: boolean;
  outcome: Outcome | null;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
};

export function OutcomeReasonDialog({
  open,
  outcome,
  pending,
  onCancel,
  onConfirm,
}: Props) {
  const [selected, setSelected] = useState<string>("");
  const [customNote, setCustomNote] = useState("");

  if (!outcome) return null;
  const options = REASON_OPTIONS[outcome];

  const handleConfirm = () => {
    const base = options.find((o) => o.value === selected)?.label ?? "";
    const note = customNote.trim();
    const reason = note ? (base ? `${base} — ${note}` : note) : base;
    onConfirm(reason);
    // Reset for next time.
    setSelected("");
    setCustomNote("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
    >
      <DialogContent>
        <div className="space-y-5">
          <DialogHeader className="space-y-1.5">
            <DialogTitle>
              Why was this quote{" "}
              <span className="capitalize">{outcome}</span>?
            </DialogTitle>
            <DialogDescription>
              Quick reason helps with reporting and tunes the AI price
              suggester over time.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setSelected(o.value)}
                className={cn(
                  "text-left rounded-xl border px-4 py-3 text-sm transition-colors",
                  selected === o.value
                    ? "bg-brand-gradient-soft border-primary text-primary"
                    : "hover:bg-muted/50",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="note">
              Note{" "}
              <span className="text-xs text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Textarea
              id="note"
              rows={2}
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="Any context worth saving?"
            />
          </div>

          <DialogFooter>
            <Button
              onClick={handleConfirm}
              disabled={pending || (!selected && !customNote.trim())}
              className="h-11 rounded-full w-full text-sm"
            >
              {pending ? "Saving…" : `Mark as ${outcome}`}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
