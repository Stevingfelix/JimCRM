"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PartSearchCell } from "@/app/(app)/quotes/[id]/components/part-search-cell";
import { createVendorQuote } from "../../actions";

export function LogVendorQuoteDialog({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [partId, setPartId] = useState<string | null>(null);
  const [partDisplay, setPartDisplay] = useState("");
  const [qty, setQty] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState("");
  const [sourceNote, setSourceNote] = useState("");
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setPartId(null);
    setPartDisplay("");
    setQty("");
    setUnitPrice("");
    setLeadTimeDays("");
    setSourceNote("");
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partId) {
      toast.error("Pick a part");
      return;
    }
    if (!unitPrice.trim()) {
      toast.error("Unit cost is required");
      return;
    }
    startTransition(async () => {
      const result = await createVendorQuote({
        vendor_id: vendorId,
        part_id: partId,
        qty: qty === "" ? null : Number(qty),
        unit_price: Number(unitPrice),
        lead_time_days: leadTimeDays === "" ? null : Number(leadTimeDays),
        source_note: sourceNote || null,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Vendor quote logged");
      reset();
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        + Log vendor quote
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Log vendor quote</DialogTitle>
            <DialogDescription>
              Records a vendor price for a part. Feeds the AI price suggester
              and the per-line recommendation on the quote builder.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <div className="grid gap-1.5">
              <Label>Part *</Label>
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
                autoFocus
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="qty">Qty (optional)</Label>
                <Input
                  id="qty"
                  type="number"
                  step="any"
                  min="0"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="text-right tabular-nums"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="unit-price">Unit cost *</Label>
                <Input
                  id="unit-price"
                  type="number"
                  step="0.0001"
                  min="0"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  className="text-right tabular-nums"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="lead">Lead time (days)</Label>
                <Input
                  id="lead"
                  type="number"
                  step="1"
                  min="0"
                  value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(e.target.value)}
                  className="text-right tabular-nums"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="note">Source note</Label>
              <Textarea
                id="note"
                rows={2}
                value={sourceNote}
                onChange={(e) => setSourceNote(e.target.value)}
                placeholder="e.g. phone call with Tom 2026-05-12, or email subject"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={pending || !partId || !unitPrice}>
              {pending ? "Saving…" : "Log quote"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
