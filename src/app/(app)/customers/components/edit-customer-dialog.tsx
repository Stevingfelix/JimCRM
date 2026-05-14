"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getCustomerForQuickEdit,
  quickUpdateCustomer,
} from "../actions";

type Props = {
  customerId: string | null;
  onClose: () => void;
};

export function EditCustomerDialog({ customerId, onClose }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  const [id, setId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [billing, setBilling] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!customerId) {
      setId(null);
      setName("");
      setBilling("");
      setNotes("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    getCustomerForQuickEdit(customerId).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        toast.error(res.error.message);
        onClose();
        return;
      }
      setId(res.data.id);
      setName(res.data.name);
      setBilling(res.data.billing_address ?? "");
      setNotes(res.data.notes ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [customerId, onClose]);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    startTransition(async () => {
      const res = await quickUpdateCustomer({
        id,
        name: name.trim(),
        billing_address: billing.trim() || null,
        notes: notes.trim() || null,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Customer updated");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={!!customerId}
      onOpenChange={(o) => {
        if (!o && !pending) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit customer</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-20 w-full" />
            <div className="pt-2 flex items-center justify-center">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-3">
              <div className="grid gap-1.5">
                <Label htmlFor="edit-name" className="text-sm font-medium">
                  Company / customer name
                </Label>
                <Input
                  id="edit-name"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-billing" className="text-sm font-medium">
                  Billing address
                </Label>
                <Textarea
                  id="edit-billing"
                  rows={3}
                  value={billing}
                  onChange={(e) => setBilling(e.target.value)}
                  placeholder="e.g. 123 Industry Way, NY"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-notes" className="text-sm font-medium">
                  Internal notes
                </Label>
                <Textarea
                  id="edit-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Net-30 terms. Prefers part numbers prefixed with…"
                />
              </div>

              {id && (
                <Link
                  href={`/customers/${id}`}
                  onClick={onClose}
                  className="inline-flex items-center text-xs text-primary hover:underline"
                >
                  Open full profile (contacts, pricing rules, quote history)
                  <ArrowRight className="size-3 ml-1" />
                </Link>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={pending}
                className="rounded-full"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={pending || !name.trim()}
                className="rounded-full"
              >
                {pending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
