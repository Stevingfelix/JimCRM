"use client";

import { useState } from "react";
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

// Placeholder: opens a modal that collects initial quote metadata.
// Day 3 wires this to a real createQuote action + redirect to the builder.
export function NewQuoteDialog({ customerName }: { customerName: string }) {
  const [open, setOpen] = useState(false);
  const [validity, setValidity] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.info("Quote builder lands on Day 3 — wiring this up then.");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>New quote ↗</DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>New quote for {customerName}</DialogTitle>
            <DialogDescription>
              Fill in optional details. You can edit everything from the
              builder.
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
            <Button type="submit">Create draft</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
