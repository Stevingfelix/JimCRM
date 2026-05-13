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
import { createCustomer } from "../actions";

export function NewCustomerDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setName("");
    setContactName("");
    setEmail("");
    setPhone("");
    setRole("");
    setNotes("");
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await createCustomer({
        name,
        notes: notes || null,
        primary_contact:
          contactName || email || phone || role
            ? {
                name: contactName || null,
                email: email || null,
                phone: phone || null,
                role: role || null,
              }
            : null,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Customer saved");
      reset();
      setOpen(false);
      router.push(`/customers/${result.data.id}`);
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
        + New customer
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-5">
          <DialogHeader className="space-y-1.5">
            <DialogTitle>Add new customer</DialogTitle>
            <DialogDescription>
              Optional primary contact saves the first contact row in one go.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="name">Company name *</Label>
              <Input
                id="name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Acme Industrial"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="contact-name">Contact name</Label>
              <Input
                id="contact-name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Sarah Chen"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="email">
                  Email{" "}
                  <span className="text-xs text-muted-foreground font-normal">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sarah@acme.com"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="555-0142"
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="role">Role / title</Label>
              <Input
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Buyer"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="notes">Internal notes</Label>
              <Textarea
                id="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Net-30 terms. Prefers part numbers prefixed with…"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={pending || !name.trim()}
              className="h-11 rounded-full w-full text-sm"
            >
              {pending ? "Saving…" : "Save customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
