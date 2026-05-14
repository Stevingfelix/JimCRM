"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/phone-input";
import { AiTextAssist } from "@/components/ai-text-assist";
import { cn } from "@/lib/utils";
import {
  createCustomer,
  extractCustomerFromText,
  type ExtractedCustomer,
} from "../actions";

export function NewCustomerDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setName("");
    setContactName("");
    setEmail("");
    setPhone("");
    setBillingAddress("");
    setAiOpen(false);
  };

  function applyExtraction(r: ExtractedCustomer) {
    if (r.company_name) setName(r.company_name);
    if (r.contact_name) setContactName(r.contact_name);
    if (r.contact_email) setEmail(r.contact_email);
    if (r.contact_phone) setPhone(r.contact_phone);
    if (r.billing_address) setBillingAddress(r.billing_address);
  }

  const canSubmit = name.trim().length > 0 || contactName.trim().length > 0;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Either company OR contact name is required (one stands in for the other).
    if (!canSubmit) {
      toast.error("Provide a company or contact name");
      return;
    }
    startTransition(async () => {
      const result = await createCustomer({
        // If only contact was given, use it as the customer name.
        name: name.trim() || contactName.trim(),
        billing_address: billingAddress.trim() || null,
        primary_contact:
          contactName || email || phone
            ? {
                name: contactName.trim() || null,
                email: email.trim() || null,
                phone: phone.trim() || null,
                role: null,
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
      <DialogTrigger render={<Button className="h-10 rounded-full px-5" />}>
        + New customer
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 pr-10">
              <DialogTitle>Add new customer</DialogTitle>
              <button
                type="button"
                onClick={() => setAiOpen((v) => !v)}
                aria-pressed={aiOpen}
                className={cn(
                  "inline-flex items-center justify-center size-8 rounded-full border transition-colors",
                  aiOpen
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-brand-gradient-soft text-primary border-primary/30 hover:opacity-90",
                )}
                aria-label="Toggle AI assist"
                title="Fill with AI (paste text or speak)"
              >
                <Sparkles className="size-4" />
              </button>
            </div>
          </DialogHeader>

          {aiOpen && (
            <AiTextAssist
              extractAction={extractCustomerFromText}
              onExtracted={applyExtraction}
              hint="paste a signature, or tap Speak"
            />
          )}

          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="name" className="text-xs font-medium">
                Company Name{" "}
                <span className="text-muted-foreground font-normal">
                  (optional if contact name given)
                </span>
              </Label>
              <Input
                id="name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Group"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="contact-name" className="text-xs font-medium">
                Contact Name{" "}
                <span className="text-muted-foreground font-normal">
                  (optional if company name given)
                </span>
              </Label>
              <Input
                id="contact-name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="John Doe"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="email" className="text-xs font-medium">
                  Email Address{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="billing@acmegroup.com"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="phone" className="text-xs font-medium">
                  Phone Number
                </Label>
                <PhoneInput
                  id="phone"
                  value={phone}
                  onChange={setPhone}
                  placeholder="e.g. 555-0199"
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="billing" className="text-xs font-medium">
                Billing Address
              </Label>
              <Textarea
                id="billing"
                rows={3}
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                placeholder={"e.g. 123 Industry Way\nSuite 200\nCity, ST 00000"}
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={pending || !canSubmit}
            className="h-11 rounded-full w-full text-sm"
          >
            {pending ? "Saving…" : "Save Customer"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
