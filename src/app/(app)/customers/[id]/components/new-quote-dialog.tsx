"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
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
  const [customerNotes, setCustomerNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setValidity("");
    setCustomerNotes("");
    setInternalNotes("");
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await createQuote({
        customer_id: customerId,
        validity_date: validity || null,
        customer_notes: customerNotes || null,
        internal_notes: internalNotes || null,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Draft quote created");
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
      <DialogTrigger
        render={<Button className="h-10 rounded-full px-5" />}
      >
        New quote ↗
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-5">
          <DialogHeader className="space-y-1.5">
            <DialogTitle>New quote for {customerName}</DialogTitle>
            <DialogDescription>
              Fill in what you know now — lines go in the builder.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
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
              <Label htmlFor="cust-notes">
                Customer notes{" "}
                <span className="text-xs text-muted-foreground font-normal">
                  (shown on the PDF)
                </span>
              </Label>
              <Textarea
                id="cust-notes"
                rows={2}
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="Net-30. Standard ground freight."
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="int-notes">
                Internal notes{" "}
                <span className="text-xs text-muted-foreground font-normal">
                  (never on customer PDF)
                </span>
              </Label>
              <Textarea
                id="int-notes"
                rows={2}
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Reminders for the team…"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={pending}
              className="h-11 rounded-full w-full text-sm"
            >
              {pending ? "Creating…" : "Create draft quote"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
