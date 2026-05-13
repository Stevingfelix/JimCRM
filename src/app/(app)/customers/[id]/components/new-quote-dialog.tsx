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
import { createQuote } from "@/app/(app)/quotes/actions";

export function NewQuoteDialog({
  customerId,
  customerName,
}: {
  customerId: string;
  customerName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [validity, setValidity] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setValidity("");
    setInternalNotes("");
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await createQuote({
        customer_id: customerId,
        validity_date: validity || null,
        internal_notes: internalNotes || null,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Quote created");
      reset();
      setOpen(false);
      router.push(`/quotes/${result.data.id}`);
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
      <DialogTrigger render={<Button size="sm" />}>New quote ↗</DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>New quote for {customerName}</DialogTitle>
            <DialogDescription>
              Optional metadata. You can change anything from the builder.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="validity">Validity date</Label>
              <Input
                id="validity"
                type="date"
                value={validity}
                onChange={(e) => setValidity(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="notes">
                Internal notes{" "}
                <span className="text-xs text-muted-foreground">
                  (never on customer PDF)
                </span>
              </Label>
              <Textarea
                id="notes"
                rows={3}
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create draft"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
